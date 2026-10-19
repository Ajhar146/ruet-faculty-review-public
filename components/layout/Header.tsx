import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { signOut } from '@/app/actions/auth'
import { Container } from './Container'
import { MobileMenu } from './MobileMenu'

// focus-visible, never focus. A mouse click must not leave an outline
// behind; only keyboard users need to see where they are.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

const TEXT_LINK = `text-[15px] font-semibold text-ink hover:underline ${FOCUS_RING}`

// Button's style, written out here because the header sizes its own items.
//
// IT IS DELIBERATELY NOT IDENTICAL ANY MORE. Button gained shadow-resting and
// hover:shadow-raised in the elevation rollout; this did not. The header sits
// on top of everything and has the accent line under it already, so a shadow
// here would fight that line rather than lift anything. Do not "fix" the
// difference by syncing the two strings. See docs/DESIGN-SYSTEM.md section 5.
const FILLED = `inline-flex min-h-11 items-center justify-center rounded-control bg-ink px-5 text-[15px] font-medium text-paper hover:bg-brand-hover ${FOCUS_RING}`

export async function Header() {
  const user = await getCurrentUser()
  const role = user?.role ?? null
  // Independent of the role. A student admin is both, and sees both.
  const isAdmin = user?.isAdmin ?? false

  return (
    <header className="sticky top-0 z-40 bg-paper">
      <Container>
        <div className="flex h-16 items-center gap-6">
          <Link
            href="/"
            className={`inline-flex shrink-0 items-center gap-2 text-[16px] leading-4 ${FOCUS_RING}`}
          >
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
          </Link>

          {/* Signed out, the logo is the whole header. Everything below
              needs a session anyway. */}
          {role ? (
            <>
              {/* 20px between each item. */}
              <nav
                aria-label="Account"
                className="ml-auto hidden items-center gap-5 md:flex"
              >
                <Link href="/teachers" className={TEXT_LINK}>
                  Teachers
                </Link>

                {/* A teacher writes nothing, so they never get this one. */}
                {role === 'STUDENT' ? (
                  <Link href="/my-reviews" className={FILLED}>
                    My reviews
                  </Link>
                ) : null}

                {/* One filled button per screen. A student admin already
                    spent it on My reviews, so Admin is a plain link for
                    them and the filled one for everybody else. */}
                {isAdmin ? (
                  <Link
                    href="/admin"
                    className={role === 'STUDENT' ? TEXT_LINK : FILLED}
                  >
                    Admin
                  </Link>
                ) : null}

                <form action={signOut}>
                  <button type="submit" className={TEXT_LINK}>
                    Sign out
                  </button>
                </form>
              </nav>

              <div className="ml-auto md:hidden">
                <MobileMenu role={role} isAdmin={isAdmin} />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      <div className="h-0.5 bg-accent" aria-hidden="true" />
    </header>
  )
}
