import type { Metadata } from 'next'
import { AppealCard } from '@/components/admin/AppealCard'
import { QueueItem } from '@/components/admin/QueueItem'
import { SettingToggle } from '@/components/admin/SettingToggle'
import { Container } from '@/components/layout/Container'
import { EmptyState } from '@/components/ui'
import { requireAdmin } from '@/lib/auth'
import { getAdminQueue, getAppeals, getTeacherSignIns } from '@/server/admin'
import { getSetting } from '@/server/settings'
import { rejectionMessage } from '@/services/moderation/messages'
import type { RuleFlag } from '@/services/moderation/rules'

export const metadata: Metadata = {
  title: 'Admin | RUET Faculty Review',
}

// "21 Sep 2026", the same shape the review cards use.
//
// LOCAL ON PURPOSE, for now. This is the third copy of a date formatter in
// the codebase (components/review/ReviewCard.tsx and
// app/(student)/my-reviews/page.tsx hold the other two) and all three belong
// in lib/format.ts next to formatRating. That consolidation is its own change;
// this one was scoped to two files.
function formatSignInDate(value: Date): string {
  return value.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * "today", "yesterday", "2 days ago".
 *
 * The absolute date says WHEN; this says HOW LONG AGO, which is the half that
 * answers "are teachers watching right now" at a glance.
 *
 * CALENDAR DAYS, NOT ELAPSED HOURS, so the two halves of the line agree. An
 * elapsed-hours version read "Most recent 12 Oct - today" for a sign-in 23
 * hours earlier: true by the clock, and confusing next to a date that says
 * otherwise. Both are now anchored to local midnight.
 *
 * A timestamp in the future, from clock skew between the database and the
 * server, floors to 0 and reads "today" rather than "-1 days ago".
 */
function relativeDays(value: Date): string {
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round(
    (midnight(new Date()).getTime() - midnight(value).getTime()) / (24 * 60 * 60 * 1000)
  )

  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/**
 * Still not a dashboard. No charts and no health widgets; the page is one
 * list of what is waiting for a decision.
 *
 * THE ONE COUNT, and why it earns its place: how many teachers have signed
 * in, and when the last one did. It is not decoration -- it changes how
 * carefully a borderline review wants handling this week, which is a decision
 * the rest of this page exists to support. Anything that does not change a
 * decision still does not belong here.
 *
 * The layout already calls requireAdmin(). It is called again here because
 * a page that depends on being an admin should say so itself, rather than
 * trusting that nobody ever moves it.
 */
export default async function AdminPage() {
  const admin = await requireAdmin()

  // The admin's own reviews are in the queue, marked and with their
  // buttons disabled, so one cannot sit PENDING unnoticed. He still cannot
  // decide them: the actions refuse on the server. They clear when
  // moderation publishes them, or when another admin decides them.
  const queue = await getAdminQueue(admin.id)

  // The one section that gets looked at regularly: a student has run out of
  // attempts and asked a human. Oldest first.
  const appeals = await getAppeals(admin.id)

  // Read fresh on every render. The toggles below show what is stored, not
  // what was last clicked.
  const [reviewsEnabled, maintenanceMode] = await Promise.all([
    getSetting('reviews_enabled'),
    getSetting('maintenance_mode'),
  ])

  // Live, every request, uncached. See the note on getTeacherSignIns for why
  // it does not go anywhere near getSiteStats().
  const teacherSignIns = await getTeacherSignIns()

  return (
    <main>
      <Container className="py-8 md:py-20">
        <div className="flex flex-col gap-3">
          <h1 className="text-[24px] leading-[1.2] font-bold text-ink sm:text-[32px] md:text-[48px]">
            Admin
          </h1>
          <p className="text-[13px] text-slate md:text-[16px]">
            Reviews waiting for a decision. Highest risk first, then the
            ones that have waited longest.
          </p>
        </div>

        {/* The same card treatment as the toggles below: rounded-card, a line
            border, paper, 16px of padding on a phone and 24px from md. No
            shadow, because SettingToggle has none either. */}
        <div className="mt-8 rounded-card border border-line bg-paper p-4 md:p-6">
          <p className="text-[13px] text-slate md:text-[15px]">Teachers signed in</p>

          <p className="mt-1 text-[28px] leading-none font-bold text-ink">
            {teacherSignIns.count}
          </p>

          {/* NO PLACEHOLDER when nobody has signed in. The date line is absent
              rather than an em dash or an empty slot, so a zero reads as a
              zero and not as a missing value. */}
          {teacherSignIns.mostRecent ? (
            <p className="mt-2 text-[13px] text-slate">
              Most recent {formatSignInDate(teacherSignIns.mostRecent)} ·{' '}
              {relativeDays(teacherSignIns.mostRecent)}
            </p>
          ) : null}
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-2 md:gap-4">
          <SettingToggle
            settingKey="reviews_enabled"
            label="New reviews"
            value={reviewsEnabled}
            whenOn="Reviews are on"
            whenOff="Reviews are paused"
            turnOn="Turn reviews on"
            turnOff="Pause new reviews"
          />

          <SettingToggle
            settingKey="maintenance_mode"
            label="The site"
            value={maintenanceMode}
            whenOn="Maintenance mode"
            whenOff="Site is live"
            turnOn="Close the site"
            turnOff="Open the site"
            alarmWhenOn
          />
        </div>

        <p className="mt-3 text-[13px] text-slate">
          Pausing reviews blocks new ones. Everything already published
          stays visible. Maintenance mode closes the site to everyone except
          you, and this page keeps working either way.
        </p>

        {appeals.length > 0 ? (
          <section className="mt-10 md:mt-12">
            <h2 className="text-[22px] leading-[1.2] font-bold text-ink sm:text-[28px]">
              Appeals ({appeals.length})
            </h2>

            <p className="mt-2 text-[15px] text-slate">
              A student has used their attempts and asked for a second look.
              Deciding either way closes the appeal; there is no second one.
            </p>

            <div className="mt-6 flex flex-col gap-3 md:gap-6">
              {appeals.map((appeal) => (
                <AppealCard
                  key={appeal.id}
                  appeal={appeal}
                  // Built here, on the server, from this review's own
                  // moderation row, so the admin reads the same sentence the
                  // student did.
                  rejection={rejectionMessage(
                    appeal.decision ?? 'ERROR',
                    appeal.ruleFlags as RuleFlag[]
                  )}
                />
              ))}
            </div>
          </section>
        ) : null}

        {queue.length === 0 ? (
          // "Nothing is waiting" would contradict a list of appeals sitting
          // above it, so it only appears when both are clear.
          appeals.length === 0 ? (
            <div className="mt-10 md:mt-12">
              <EmptyState
                heading="Nothing is waiting"
                message="Every review has been decided and every report has been handled."
              />
            </div>
          ) : null
        ) : (
          <>
            <h2 className="mt-10 text-[22px] leading-[1.2] font-bold text-ink sm:text-[28px] md:mt-12">
              Needs a decision ({queue.length})
            </h2>

            <div className="mt-6 flex flex-col gap-3 md:gap-6">
              {queue.map((review) => (
                <QueueItem key={review.id} review={review} />
              ))}
            </div>
          </>
        )}

        <p className="mt-10 text-[13px] text-slate md:mt-12">
          You are never shown who wrote a review or who reported one. If you
          ever need that, it is a deliberate SQL query you run by hand.
        </p>
      </Container>
    </main>
  )
}
