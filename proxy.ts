import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Proxy does three things only: the x-pathname header, a per-request CSP
// nonce, and the Content Security Policy itself. It never checks auth, and
// maintenance mode is decided in app/layout.tsx where the user is known.
// See docs/API.md section 7.
//
// The other security headers are in next.config.ts, because they are the
// same on every response and that file covers routes this matcher skips.

/**
 * ENFORCED. The browser BLOCKS anything this policy does not allow, and
 * blocking is silent — a refused script or fetch leaves a console error and
 * nothing else. There is no reporting endpoint, so nothing reaches a log.
 *
 * WHAT THIS MEANS FOR ANYTHING ADDED LATER. A new external script, an
 * iframe, a third-party font, or a browser fetch to another origin will
 * simply not happen until its origin is listed below. The symptom is a
 * feature that does nothing, not an error you will be told about.
 *
 * Sentry is the one on the launch list: it needs its ingest host in
 * connect-src, and script-src too if the loader script is used rather than
 * the bundled SDK. Analytics would need the same.
 *
 * To go back to observing without blocking, set CSP_HEADER to
 * 'Content-Security-Policy-Report-Only'. Next reads the nonce from either
 * header, so the nonce keeps working in both modes.
 *
 * WHAT EACH DIRECTIVE IS FOR, checked against what the site actually loads
 * rather than guessed:
 *
 *   script-src   'self' plus a per-request nonce. Next renders two inline
 *                <script> tags for hydration and the RSC payload; a nonce
 *                is what lets those run without 'unsafe-inline'. 'self'
 *                stays because the preload <link as="script"> tags are
 *                governed by this directive too and carry no nonce.
 *
 *   style-src    'unsafe-inline' is unavoidable and it is a deliberate
 *                trade-off. There are no <style> blocks, but there ARE
 *                inline style ATTRIBUTES: next/image writes
 *                style="color:transparent" on every photo, and the review
 *                form sizes its progress bar the same way. The precise fix
 *                is style-src-attr, which Safari does not support fully, so
 *                it would break there. Inline styles cannot exfiltrate data
 *                the way inline scripts can; this is a far smaller hole
 *                than 'unsafe-inline' on script-src would be.
 *
 *   img-src      'self' only, plus data: and blob:. Teacher photos are NOT
 *                loaded from Supabase by the browser — next/image proxies
 *                them through /_next/image on our own origin. The Supabase
 *                hostname appears only inside a query string.
 *
 *   font-src     'self'. next/font self-hosts both families: 13 .woff2
 *                files ship in /_next/static/media and the build contains
 *                no reference to fonts.googleapis.com or fonts.gstatic.com.
 *
 *   connect-src  'self'. Server actions and RSC payloads are same-origin.
 *                Groq, Resend and Supabase are called from the server, not
 *                the browser.
 *
 *   form-action  'self' and accounts.google.com. The sign-in form POSTs to
 *                our own /api/auth/google, which then redirects to Google.
 *                Browsers disagree about whether form-action follows a
 *                redirect, so Google is listed rather than risk breaking
 *                sign-in on the ones that do.
 */
const CSP_HEADER = 'Content-Security-Policy'

function policy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self' https://accounts.google.com",
  ].join('; ')
}

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)

  // requireAuth reads this to send a signed-out user back where they were.
  // Always overwritten, so a value sent by the browser is never trusted.
  requestHeaders.set('x-pathname', request.nextUrl.pathname + request.nextUrl.search)

  // A fresh nonce per request. Buffer is not available in the edge runtime,
  // so the random bytes are base64'd by hand.
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
  const value = policy(nonce)

  // ON THE REQUEST as well as the response, and that is not belt and braces.
  // Next reads the nonce out of the request header to stamp it onto the
  // script tags it renders — see getScriptNonceFromHeader in
  // next/dist/server/app-render. It accepts either the enforcing or the
  // report-only header, which is why a nonce works while this is still
  // report-only.
  requestHeaders.set(CSP_HEADER, value)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(CSP_HEADER, value)

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
}
