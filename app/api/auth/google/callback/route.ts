import { timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseRoll } from '@/lib/roll'
import { getClientIp, hitLimit } from '@/lib/rate-limit'
import { generateToken } from '@/lib/tokens'
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, SESSION_MAX_AGE } from '@/lib/auth'
import {
  CALLBACK_COOKIE,
  STATE_COOKIE,
  safeCallbackUrl,
  verifyCode,
} from '@/lib/google'

function domainsFrom(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)
}

function statesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function GET(request: NextRequest) {
  // Every failure lands on the same message. Never say which check failed.
  const reject = (error: 'domain' | 'banned' | 'busy' = 'domain') =>
    NextResponse.redirect(new URL(`/login?error=${error}`, request.url))

  // Limited separately from the start route and by IP, because this half
  // does the expensive work: a token exchange with Google and a user
  // upsert. Checked before the state cookie, so a flood of codes cannot buy
  // unlimited attempts. `busy` says nothing about any address.
  if (await hitLimit('signInCallback', await getClientIp())) return reject('busy')

  const store = await cookies()
  const expectedState = store.get(STATE_COOKIE)?.value
  const callbackUrl = safeCallbackUrl(store.get(CALLBACK_COOKIE)?.value)

  // Single use, whatever happens next.
  store.delete(STATE_COOKIE)
  store.delete(CALLBACK_COOKIE)

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')

  if (!code || !state || !expectedState || !statesMatch(state, expectedState)) {
    return reject()
  }

  let identity
  try {
    identity = await verifyCode(code)
  } catch {
    return reject()
  }

  // Required for BOTH routes in. An unverified email proves nothing about
  // who is holding it, allowlisted or not.
  if (!identity.emailVerified) return reject()

  // verifyCode already lowercases this. Done again so the exact comparison
  // below does not depend on a promise made in another file.
  const email = identity.email.toLowerCase()

  // The admin allowlist. One person runs this site, and his admin account
  // has to be separate from the student account he reviews teachers with,
  // so a named personal address can sign in without a Workspace domain.
  //
  // Same comma-separated parse as the domain lists: trim, lowercase, and
  // drop empty strings. So if ADMIN_EMAILS is missing or empty the list is
  // empty, nobody matches, and every line below behaves exactly as it did
  // before this existed.
  const adminEmails = domainsFrom(process.env.ADMIN_EMAILS)

  // Exact equality, one address at a time. Never includes(), never
  // endsWith(), never a regex: each of those would also accept an address
  // that merely contains or ends with an allowed one, and anyone can
  // register admin@gmail.com.evil.com or the same local part on
  // another domain.
  const isAllowlistedAdmin = adminEmails.some((allowed) => allowed === email)

  let role: 'STUDENT' | 'TEACHER' | 'ADMIN'

  if (isAllowlistedAdmin) {
    // No hd check on this route. A personal Google account has no hd claim
    // at all, which is exactly why the exact-match list has to be the whole
    // check, and why it is a list of addresses and not of domains.
    role = 'ADMIN'
  } else {
    // THE CRITICAL CHECK. hd is set by Google Workspace and cannot be forged
    // by the user, unlike the email text itself.
    const hd = identity.hd?.toLowerCase() ?? null
    if (!hd) return reject()

    // The email must belong to the domain Google vouched for. If the two ever
    // disagree, fail closed rather than hand out the wrong role for good.
    const emailDomain = email.split('@')[1]
    if (emailDomain !== hd) return reject()

    const studentDomains = domainsFrom(process.env.ALLOWED_STUDENT_DOMAINS)
    const teacherDomains = domainsFrom(process.env.ALLOWED_TEACHER_DOMAINS)

    if (studentDomains.includes(hd)) role = 'STUDENT'
    else if (teacherDomains.includes(hd)) role = 'TEACHER'
    // A Gmail that is not on the list has no hd, so it already failed
    // above, with the same redirect and the same words as a wrong RUET
    // domain. Nothing in the response says an allowlist exists.
    else return reject()
  }

  const now = new Date()

  // A student's batch and department come from the roll number in their
  // email. Teachers have no roll, so both stay null for them.
  let batchYear: number | null = null
  let departmentId: string | null = null

  if (role === 'STUDENT') {
    // Only a brand new student needs this. A returning one already has both
    // fields, and the update block below never touches them, so looking the
    // department up again would be a query wasted on every sign in.
    const existing = await prisma.user.findUnique({
      where: { email: identity.email },
      select: { id: true },
    })

    const roll = existing ? null : parseRoll(identity.email)

    if (roll) {
      const department = await prisma.department.findUnique({
        where: { rollCode: roll.rollCode },
        select: { id: true },
      })

      // A roll code we do not know leaves both fields null. Never guess a
      // department: the eligibility check explains it later in plain words.
      if (department) {
        batchYear = roll.batchYear
        departmentId = department.id
      }
    }
  }

  // The role is set once, on create. The update block never touches it, and
  // it never touches batchYear or departmentId either: an existing user
  // keeps what they were given the day they signed up.
  const user = await prisma.user.upsert({
    where: { email: identity.email },
    create: {
      email: identity.email,
      role,
      // Set here only, and only for an address on the allowlist. Everyone
      // else is created with the schema default of false, and the update
      // block below never touches it, so an existing account's admin rights
      // are still changed by SQL and nothing else.
      isAdmin: isAllowlistedAdmin,
      emailVerifiedAt: now,
      lastLoginAt: now,
      // Both null for an admin: the STUDENT branch above is the only thing
      // that fills them, and an admin has no roll number to read.
      batchYear,
      departmentId,
    },
    update: {
      lastLoginAt: now,
    },
  })

  if (user.isBanned) return reject('banned')

  const { raw, hash } = generateToken()

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(now.getTime() + SESSION_MAX_AGE * 1000),
    },
  })

  const response = NextResponse.redirect(new URL(callbackUrl, request.url))
  response.cookies.set(SESSION_COOKIE, raw, SESSION_COOKIE_OPTIONS)
  return response
}
