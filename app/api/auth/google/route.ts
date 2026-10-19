import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  CALLBACK_COOKIE,
  SHORT_COOKIE_OPTIONS,
  STATE_COOKIE,
  getAuthUrl,
  safeCallbackUrl,
} from '@/lib/google'
import { getClientIp, hitLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // By IP: there is no user yet. `busy`, not `domain` — the limit is
  // counted before any address is known, so the message must not hint that
  // one exists or is allowed.
  const ip = await getClientIp()
  if (await hitLimit('signInStart', ip)) {
    return NextResponse.redirect(new URL('/login?error=busy', request.url))
  }

  // The state ties this redirect to the callback, so another site cannot
  // hand us a code of its own.
  const state = randomBytes(32).toString('base64url')
  const callbackUrl = safeCallbackUrl(request.nextUrl.searchParams.get('callbackUrl'))

  const store = await cookies()
  store.set(STATE_COOKIE, state, SHORT_COOKIE_OPTIONS)
  store.set(CALLBACK_COOKIE, callbackUrl, SHORT_COOKIE_OPTIONS)

  return NextResponse.redirect(getAuthUrl(state))
}
