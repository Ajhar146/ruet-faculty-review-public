'use server'

import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { hitLimit, rateLimitMessage } from '@/lib/rate-limit'
import { getCourseReviewsPage } from '@/server/reviews'
import type { PublicReview } from '@/server/reviews'
import { getVoteSummaries } from '@/server/votes'
import type { VoteSummaries } from '@/lib/votes'

/**
 * The only action behind "Show all 180 reviews".
 *
 * WHY AN ACTION AND NOT THE PAGE. A teacher with twenty courses and 180
 * reviews each would ship thousands of rows nobody asked for on first paint.
 * The page sends two per course; the rest arrive ten at a time, and only for
 * the course the reader actually opened.
 *
 * ------------------------------------------------------------------
 * IT REQUIRES A SESSION. THIS WAS ONCE WRONG. DO NOT UNDO IT.
 * ------------------------------------------------------------------
 *
 * The first version of this file had no session check, on the reasoning that
 * "a teacher page is readable signed out". That was simply false:
 * app/(app)/layout.tsx calls requireAuth(), so /teachers/* redirects to
 * /login for anyone without a session.
 *
 * The hole was worse than a missing check on a page, because A SERVER ACTION
 * IS REACHABLE DIRECTLY OVER HTTP. It does not need its page, its layout, or
 * the button that normally calls it. Anyone outside RUET could POST to it and
 * read every published review on the site, ten at a time, without ever
 * signing in — which is the whole point of the site being closed.
 *
 * The rule this file exists to remember: a gate on the page is not a gate on
 * the action. Every action checks for itself.
 *
 * NO redirect() HERE. requireAuth() redirects, and a redirect thrown inside
 * an action called from a button becomes a navigation or an unhandled error
 * rather than something the card can show. This returns the refusal instead,
 * so a session that expired while someone was reading gets the sentence the
 * card already handles.
 *
 * ANONYMITY. Everything about which columns come back lives in
 * server/reviews.ts, in one select that has no userId. This file adds no
 * query of its own.
 */

type Result =
  | { ok: true; reviews: PublicReview[]; voteSummaries: VoteSummaries }
  | { ok: false; error: string }

// One sentence for every refusal. The card shows its own message on !ok, so
// this is what ends up in a log rather than on screen — and it deliberately
// does not say whether the problem was the session, the input or the limit.
const REFUSED = 'Could not load more reviews. Please reload the page.'

const inputSchema = z.object({
  teacherId: z.uuid(),
  // "CSE 3203" shape, already normalised: it comes from a course row the page
  // rendered, not from anything a person typed.
  courseCode: z.string().trim().min(3).max(20),
  // How many the caller is already showing. Capped so a single call cannot
  // ask Postgres to count past an absurd offset.
  skip: z.number().int().min(0).max(10_000),
})

export async function loadMoreCourseReviews(input: unknown): Promise<Result> {
  // THE GATE, before validation and before any query of the data. A caller
  // with no session is told nothing at all about what it asked for.
  const user = await getCurrentUser()

  // isBanned as well as absent, because requireAuth() bounces a banned user
  // to /login too. A ban that only applies to pages is not a ban.
  if (!user || user.isBanned) return { ok: false, error: REFUSED }

  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: REFUSED }

  // Every caller is signed in now, so the user id is always available and the
  // IP fallback that was here is gone. It only ever existed to give anonymous
  // visitors a bucket, and there are no anonymous visitors.
  if (await hitLimit('loadMore', user.id)) {
    return { ok: false, error: rateLimitMessage('loadMore') }
  }

  const { teacherId, courseCode, skip } = parsed.data

  const reviews = await getCourseReviewsPage(teacherId, courseCode, skip)

  // The counts for THIS batch only, so a newly revealed review arrives with
  // its numbers instead of showing zeros until the next page load.
  //
  // COUNTS AND THE CALLER'S OWN VOTE. user.id is passed as the viewer, which
  // is the session's own id and never an argument -- see server/votes.ts. No
  // voter id is in this response.
  const voteSummaries = await getVoteSummaries(
    reviews.map((review) => review.id),
    user.id
  )

  return { ok: true, reviews, voteSummaries }
}
