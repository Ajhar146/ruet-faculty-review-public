import { Alert, Card } from '@/components/ui'
import { Container } from '@/components/layout/Container'
import { safeCallbackUrl } from '@/lib/google'
import { getSetting } from '@/server/settings'

/**
 * The sign-in screen, as a component, because it is served from TWO URLs.
 *
 * WHY. Google indexes the redirect TARGET, so while / redirected to /login the
 * result in Google would have read
 *
 *     ruet-faculty-review.vercel.app/login?callbackUrl=%2F
 *
 * which looks broken and nobody clicks. / now returns 200 and renders this
 * directly. /login still exists and still renders it, because requireAuth()
 * sends a signed-out visitor there with a callbackUrl, and because the Google
 * round trip comes back to it.
 *
 * NOT A REDESIGN. Every class, every comment and every number below is exactly
 * what app/(public)/login/page.tsx had. The card's position was tuned by hand
 * at 360px; only where it is served from changed.
 */

export type SignInViewProps = {
  error?: string
  callbackUrl?: string
}

const ERRORS: Record<string, string> = {
  domain: 'Please sign in with your RUET email address.',
  banned: 'This account cannot sign in.',
  // Rate limited. Deliberately says nothing about any address: the limit is
  // per IP and is counted before we know who is signing in.
  busy: 'Too many sign-in attempts from this network. Please wait about 10 minutes and try again.',
}

// Google's branding guidelines require the official multi-colour "G".
function GoogleLogo() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

export async function SignInView({ error, callbackUrl }: SignInViewProps) {
  const message = error ? ERRORS[error] : undefined

  const safe = safeCallbackUrl(callbackUrl)

  // This page stays open while the site is closed, so that an admin can get
  // back in. Anyone else who signs in here will land on the maintenance
  // page, and should be told that before they bother.
  const underMaintenance = (await getSetting('maintenance_mode')) === 'true'

  // ONE SCREEN MINUS THE HEADER, with the card and the line below it
  // centred in that as one block.
  //
  // The 66px is the header: a 64px row (h-16) plus the 2px accent rule under
  // it. It is sticky, not fixed, so it takes that much flow space above this
  // element. A plain 100dvh here was the bug — it made this section a full
  // screen tall BELOW a 66px header, so its middle sat 33px under the middle
  // of the screen and the gap above the card looked bigger than the one
  // below the line. Subtracting the header puts the two gaps back level.
  //
  // dvh, not vh: on a phone 100vh includes the strip under the address bar,
  // so a card centred in it jumps every time the bar hides or shows.
  //
  // THE FIRST SCREEN ENDS AT THE DISCLAIMER. This block is a column: the
  // card takes whatever height is left over, and the disclaimer is the last
  // thing in it, so it lands on the bottom edge of the screen. The footer
  // links follow in normal flow at 66px + (100dvh - 66px), which is exactly
  // the fold, so they are reached only by scrolling.
  //
  // min-h rather than h, so a screen too short for the card grows instead of
  // spilling it over the links.
  return (
    <main className="flex min-h-[calc(100dvh_-_66px)] flex-col">
      {/* flex-1: everything the disclaimer does not use. The card is
          centred in that, not in the whole screen. */}
      <div className="flex flex-1 items-center justify-center">
        <Container>
          <div className="mx-auto flex w-full max-w-[400px] -translate-y-5 flex-col gap-6">
            {/* 32px of padding each side left 248px for text at 360px, which
                is what broke "(@student.ruet.ac.bd or @ruet.ac.bd) to
                continue" across three lines. 16px is the phone card padding in
                the Mobile section and gives 280px. md keeps today's 32px, so
                desktop is untouched.

                gap-8 rather than gap-6 is the vertical room: 32px between the
                crest, the heading and the button. */}
            <Card
              padding="p-4 md:p-8"
              className="flex flex-col items-center gap-8 text-center"
            >
              {/* The crest is a 500 KB SVG with sub-pixel detail, so it is
                  given real height here rather than the 48px the R mark used. */}
              <img
                src="/ruet-logo.svg"
                alt=""
                aria-hidden="true"
                width={69}
                height={80}
                className="h-20 w-auto"
              />

              <div className="flex flex-col gap-2">
                {/* An h2, not an h1. The page's h1 is "What RUET Faculty Review is" in
                      components/home/SignedOutAbout.tsx: this page is about the site,
                      not about the act of signing in, and an h1 of "Sign in" told
                      Google the opposite. The className is unchanged character for
                      character, so nothing moves by a pixel. */}
                  <h2 className="text-[22px] leading-[1.2] font-bold text-ink sm:text-[28px]">Sign in</h2>
                <p className="text-[15px] text-slate">
                  Use your RUET email address (@student.ruet.ac.bd or @ruet.ac.bd) to
                  continue.
                </p>
              </div>

              {message ? (
                <Alert variant="error" className="w-full">
                  {message}
                </Alert>
              ) : null}

              {underMaintenance ? (
                <p className="w-full text-[13px] leading-relaxed text-slate">
                  The site is down for maintenance right now. You can sign in,
                  but you will not be able to use it until we are back.
                </p>
              ) : null}

              {/* A plain GET navigation, not a Next <Link>: a Link would prefetch
                  the route, which sets state cookies and uses up rate limit hits
                  before anyone clicks. */}
              <form action="/api/auth/google" method="get" className="w-full">
                {safe !== '/' ? <input type="hidden" name="callbackUrl" value={safe} /> : null}
                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-control border border-line bg-paper text-[15px] font-medium text-ink hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <GoogleLogo />
                  Continue with Google
                </button>
              </form>
            </Card>

            {/* The disclaimer that used to be here is at the foot of the
                screen now. What a new student needs to read before signing in
                is this. */}
            <p className="text-center text-[13px] text-slate">
              Your identity stays private
            </p>
          </div>
        </Container>
      </div>

      {/* Pinned to the bottom of the first screen, and the last thing on it.
          Moved here out of the footer, which keeps only the links. */}
      <Container>
        <p className="pb-6 text-center text-[13px] text-slate">
          Not affiliated with, or endorsed by, RUET.
        </p>
      </Container>
    </main>
  )
}
