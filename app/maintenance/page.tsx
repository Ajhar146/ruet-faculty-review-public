import type { Metadata } from 'next'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Back soon | RUET Faculty Review',
}

/**
 * Shown to everyone but an admin while maintenance_mode is on.
 *
 * A real page, not an error page: it is calm, it gives a reason, and it
 * offers something to do. The root layout renders this component in place
 * of the app, and /maintenance reaches it directly.
 *
 * The sign-in link is not decoration. A signed-out admin looks exactly
 * like a visitor, so without a way in from here the switch could lock the
 * owner out of his own site.
 */
export default function MaintenancePage() {
  return (
    <main>
      <Container className="py-10 md:py-20">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
          <h1 className="text-[24px] leading-[1.2] font-bold text-ink sm:text-[32px] md:text-[48px]">
            Back soon
          </h1>

          <p className="text-[16px] leading-relaxed text-slate">
            We are making some changes to the site. Nothing has been lost,
            and your reviews are safe. Please try again in a little while.
          </p>

          <Button as="link" href="/login">
            Sign in with your RUET email
          </Button>
        </div>
      </Container>
    </main>
  )
}
