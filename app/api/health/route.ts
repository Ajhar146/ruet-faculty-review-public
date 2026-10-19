import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * What an uptime monitor watches. No authentication: the monitor cannot
 * sign in, and there is nothing here worth protecting.
 *
 * IT SAYS ONE THING ONLY: the database answered. No error message, no
 * connection string, no count of users or reviews, no version. This URL is
 * public and a stranger can poll it, so the response body is the same three
 * fields whatever happens behind it.
 *
 * A FAILURE MUST BE A NON-200. The monitor alerts on the status code, not
 * on the body, so swallowing the error and returning 200 with
 * database:"error" would leave it green while the site was down. That is
 * the one mistake this route cannot make.
 *
 * ------------------------------------------------------------------
 * WHY THIS IS CACHED, AND WHY THE CACHE COMES FIRST
 * ------------------------------------------------------------------
 *
 * It was unauthenticated, unlimited, and ran a query on every call. Around
 * 500 students know this site; one `while true; do curl ...; done` would
 * exhaust the connection pool and take every page down with it, and the
 * endpoint that exists to report an outage would have caused one.
 *
 * A PER-INSTANCE MEMORY CACHE IS THE RIGHT TOOL HERE, and that is not a
 * contradiction of the home-page stat band, where the same pattern was a
 * bug. There the instances held DIFFERENT numbers, so refreshing bounced
 * between them and the count appeared to move backwards. Here every instance
 * computes the same yes/no about the same database, so there is nothing for
 * them to disagree about -- and the whole point is that each instance makes
 * at most ONE query per CACHE_MS however many requests arrive.
 *
 * THE CACHE IS CHECKED BEFORE THE RATE LIMIT, deliberately. The rate limiter
 * is itself backed by the database -- checkRateLimit does a COUNT and an
 * INSERT on rate_limit_hits -- so limiting first would turn one query per
 * request into THREE and make the flood worse. Cache first means a flood
 * costs zero queries. The limit then guards the only path that can still
 * reach the database: a miss.
 *
 * BOTH OUTCOMES ARE CACHED, success and failure, for the same CACHE_MS. That
 * is what bounds a stale answer in both directions: a cached "healthy"
 * cannot outlive a real outage by more than CACHE_MS, and a cached failure
 * cannot outlive a recovery by more than CACHE_MS either. Caching only
 * success would leave an outage unbounded -- every request would retry, each
 * waiting out the 5s timeout, which is the worst possible load at the worst
 * possible moment.
 */

// WITHOUT THESE TWO, THE ROUTE IS USELESS. Vercel would serve a cached
// response and never touch the database — the monitor would stay green
// forever while Supabase paused itself after seven idle days, which is
// exactly the failure this route exists to catch.
//
// They are about the PLATFORM's cache, not the one below. The module cache
// here is ours, it is 10 seconds, and we decide when it is stale; Vercel's
// would be invisible and unbounded.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Longer than this and the database may as well be down: every page on the
// site would be timing out too.
const TIMEOUT_MS = 5000

// Ten seconds. Short enough that a monitor polling every minute always gets
// a fresh answer and an outage is reported within one poll; long enough that
// a request flood collapses to one query per instance per ten seconds.
const CACHE_MS = 10_000

// Sixty a minute per IP. UptimeRobot and cron-job.org poll every few
// minutes, so this is a hundredfold more headroom than any real monitor
// needs, while a loop hits it in a second.
const MAX_PER_MINUTE = 60
const WINDOW_MINUTES = 1

// No shape beyond what the body already returned. latencyMs is the last REAL
// measurement; a cache hit reports that number rather than inventing a new
// one, because the response shape must not change and 0 would be a lie.
type Cached = {
  body: { ok: true; database: 'ok'; latencyMs: number } | { ok: false; database: 'error' }
  status: 200 | 503
  expiresAt: number
}

let cache: Cached | null = null

// Belt and braces with force-dynamic above: no proxy between here and the
// monitor may answer on the database's behalf.
const NO_STORE = { 'Cache-Control': 'no-store' } as const

function respond(entry: Cached): NextResponse {
  return NextResponse.json(entry.body, { status: entry.status, headers: NO_STORE })
}

export async function GET() {
  // 1. THE CACHE, before anything that touches the database — including the
  //    rate limiter. This is the branch a flood takes, and it costs nothing.
  if (cache && cache.expiresAt > Date.now()) return respond(cache)

  // 2. Only a miss can reach the database, so only a miss is worth limiting.
  //    Keyed by IP because there is no user here to key on.
  //
  //    checkRateLimit, not hitLimit: hitLimit reads its numbers from the
  //    RATE_LIMITS table in lib/rate-limit.ts, and adding an entry there
  //    would mean editing a file this change is scoped out of. checkRateLimit
  //    is the same helper one layer down, with the bucket and the limit given
  //    here instead.
  const ip = await getClientIp()

  // THE LIMITER FAILS OPEN, and this try/catch is not decoration -- without
  // it this route returned 500 instead of 503 with the database down.
  //
  // checkRateLimit is itself database-backed (a COUNT and an INSERT on
  // rate_limit_hits). When the database is unreachable it THROWS, and a
  // throw here is outside the health check's own try/catch below, so Next
  // turned it into a bare 500 with an empty body -- losing the 503 that is
  // the entire contract of this endpoint, in exactly the outage it exists to
  // report. Measured, not theorised: the first version did this.
  //
  // hitLimit in lib/rate-limit.ts has this guard built in for the same
  // reason; checkRateLimit is one layer below it and does not, so the guard
  // belongs here. Failing open is right either way: a database we cannot
  // reach means the limit is unenforceable AND the answer is "unhealthy",
  // and the second of those is what the caller must be told.
  let limited = false

  try {
    limited = await checkRateLimit(`health:ip:${ip}`, MAX_PER_MINUTE, WINDOW_MINUTES)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`[health] rate limit check failed, allowing the request: ${reason}`)
  }

  if (limited) {
    // NO BODY. A limiter that explains itself is a limiter that tells a
    // prober how the limit works.
    return new NextResponse(null, { status: 429, headers: NO_STORE })
  }

  const started = Date.now()

  try {
    // Promise.race, not just an await: a hung connection would otherwise
    // hold the function open until the platform killed it, and the monitor
    // would see a timeout rather than a clean 503.
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
      ),
    ])

    cache = {
      body: { ok: true, database: 'ok', latencyMs: Date.now() - started },
      status: 200,
      expiresAt: Date.now() + CACHE_MS,
    }

    return respond(cache)
  } catch (error) {
    // Logged where only the owner can read it, never returned. The reason a
    // database is unreachable is not a stranger's business.
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`[health] database check failed after ${Date.now() - started}ms: ${reason}`)

    // Cached like the success, for the same ten seconds. The 503 is still a
    // 503 on every request in that window — the monitor sees the outage, it
    // just does not cost a fresh 5s timeout each time.
    cache = {
      body: { ok: false, database: 'error' },
      status: 503,
      expiresAt: Date.now() + CACHE_MS,
    }

    return respond(cache)
  }
}
