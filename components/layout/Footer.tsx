import { headers } from 'next/headers'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { Container } from './Container'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

type FooterLink = { href: string; label: string }
type FooterGroup = { heading: string; links: FooterLink[] }

// EXPLORE is the signed-in-only group: both of its links are behind
// requireAuth, so for a signed-out visitor they bounce straight to the
// sign-in page, which reads as a broken site.
const EXPLORE: FooterGroup = {
  heading: 'Explore',
  links: [
    { href: '/teachers', label: 'Teachers' },
    { href: '/departments', label: 'Departments' },
  ],
}

// Both public, under app/(public). /contact matters most: it is where a
// teacher with a complaint arrives, and they have no account.
const ABOUT: FooterGroup = {
  heading: 'About',
  links: [
    { href: '/guidelines', label: 'Guidelines' },
    { href: '/contact', label: 'Contact' },
  ],
}

const LEGAL: FooterGroup = {
  heading: 'Legal',
  links: [
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
  ],
}

// Labels, not links: small, uppercase, letter-spaced, muted. 13px is the
// caption size and it does not grow on a wide screen — a heading that
// out-sizes the links under it reads as the thing to click.
const GROUP_HEADING =
  'text-[13px] font-semibold tracking-wider text-slate uppercase'

// 44px minimum on every footer link. It is the smallest tap target on the
// page and the easiest one to miss.
const LINK =
  'inline-flex min-h-11 items-center text-[13px] text-slate hover:text-ink hover:underline active:text-ink active:underline sm:text-[15px]'

const NOTE = 'text-[13px] text-slate'

/** The header's lockup, set the same way: same file, same sizes, same weights. */
function Brand() {
  return (
    <div className="flex items-center gap-2 text-[16px] leading-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- a plain <img>
          on purpose, the same as the header's. next/image does not optimise
          SVG, and the point of this block is that it is set exactly the way
          the header sets it. */}
      <img
        src="/ruet-logo.svg"
        alt=""
        aria-hidden="true"
        width={24}
        height={28}
        className="h-7 w-auto shrink-0"
      />
      <span>
        <span className="font-bold text-ink">RUET</span>
        <span className="font-bold text-slate">{' Faculty Review'}</span>
      </span>
    </div>
  )
}

function LinkGroup({ group }: { group: FooterGroup }) {
  return (
    <nav aria-label={group.heading}>
      <h2 className={GROUP_HEADING}>{group.heading}</h2>

      {/* The 44px rows already space themselves; a gap on top of them would
          make the column taller than the brand block beside it. */}
      <ul className="mt-1 flex flex-col">
        {group.links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={`${LINK} ${FOCUS_RING}`}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * True on /login only.
 *
 * x-pathname is set by proxy.ts and carries the query string, so /login
 * arrives as "/login?error=domain" after a refused sign-in. Compare the path
 * alone, the same way the maintenance check in app/layout.tsx does.
 *
 * No header means the proxy did not run, so there is no way to tell which
 * page this is. Fall back to the full footer: every other page on the site
 * gets it, so that is the safe answer.
 */
async function isLoginPage(): Promise<boolean> {
  const pathname = (await headers()).get('x-pathname')
  if (pathname === null) return false

  return pathname.split('?')[0] === '/login'
}

/**
 * The footer for /login, and nowhere else. DELIBERATELY NOT REBUILT.
 *
 * That page centres a card in one screen minus the header and ends the first
 * screen on its own disclaimer — see the comment in
 * components/auth/SignInView.tsx. A left-aligned four-column block with a
 * brand lockup is the right footer under a normal page and the wrong one
 * under a centred card, and this variant has no top margin for the same
 * reason: the page above is already centred in the space that is left.
 *
 * NOTE: / renders the same sign-in card but gets the FULL footer, because
 * this check is on the path. That is worth a decision; it is not one made
 * here.
 */
function LoginFooter() {
  return (
    // bg-paper: the footer is a surface, not the page. Without it the
    // canvas shows through and the footer merges into the background.
    <footer className="bg-paper">
      <div className="h-0.5 bg-accent" aria-hidden="true" />

      <Container>
        <div className="flex flex-col items-center gap-1 py-6 md:py-8">
          <nav aria-label="About">
            <ul className="flex flex-wrap items-center justify-center gap-x-4">
              {[...ABOUT.links, ...LEGAL.links].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={`${LINK} ${FOCUS_RING}`}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Container>
    </footer>
  )
}

/**
 * Asked on the SERVER, from the session cookie, not guessed in the browser.
 * getSession() is wrapped in cache(), so the Header having already asked who
 * this is makes this free.
 */
export async function Footer() {
  // Checked before the session: on /login the answer does not depend on it.
  if (await isLoginPage()) return <LoginFooter />

  const user = await getCurrentUser()

  // EXPLORE only when it works. Not rendered at all rather than hidden, so
  // the grid closes up and leaves no empty column where it was.
  const groups = user ? [EXPLORE, ABOUT, LEGAL] : [ABOUT, LEGAL]

  return (
    <footer className="mt-10 bg-paper md:mt-20">
      {/* The divider between the page and the footer, and the same 2px accent
          token as the rule under the header. Outside Container so it reaches
          both edges, exactly as the header's does. */}
      <div className="h-0.5 bg-accent" aria-hidden="true" />

      <Container>
        <div className="py-6 md:py-8">
          {/*
            ONE GRID, TWO SHAPES.

            Phone: two columns. The brand spans both, so it sits on its own
            full-width row at the top, and the groups fall side by side under
            it. Signed in there are three, so the third WRAPS onto a second
            row rather than squeezing three across 360px.

            Desktop: five tracks, the brand taking two of them, which is how
            column one is wider than the other three without an arbitrary
            grid template. Signed out there are three content blocks across
            four tracks and the row simply ends early — nothing is left
            standing in an empty column.
          */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-5 md:gap-x-8">
            <div className="col-span-2 flex flex-col gap-2">
              <Brand />
              <p className={NOTE}>
                Anonymous reviews of teaching at RUET, written by students.
              </p>
            </div>

            {groups.map((group) => (
              <LinkGroup key={group.heading} group={group} />
            ))}
          </div>

          {/* The thin divider, and the fine print under it. Left aligned like
              everything above it. */}
          <div className="mt-6 flex flex-col gap-1 border-t border-line pt-6">
            <p className={NOTE}>Not affiliated with, or endorsed by, RUET.</p>
            {/* Computed, not written in. A hardcoded year is wrong every
                January and nobody notices for months. */}
            <p className={NOTE}>
              © {new Date().getFullYear()} RUET Faculty Review
            </p>
          </div>
        </div>
      </Container>
    </footer>
  )
}
