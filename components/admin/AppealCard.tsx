'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { keepRejected, publishAppeal } from '@/app/actions/admin'
import { Alert, Badge, Button } from '@/components/ui'
import type { BadgeVariant } from '@/components/ui'
import type { ModerationDecision } from '@/lib/types'
import type { AppealReview } from '@/server/admin'

const DECISION: Record<ModerationDecision, { label: string; variant: BadgeVariant }> = {
  HIGH_RISK: { label: 'High risk', variant: 'danger' },
  SPAM: { label: 'Spam', variant: 'danger' },
  SUSPICIOUS: { label: 'Needs a look', variant: 'neutral' },
  ERROR: { label: 'Check failed', variant: 'neutral' },
  SAFE: { label: 'Safe', variant: 'success' },
}

// The one case where publishing can harm a named person who may have done
// nothing. It is never a single click.
const ALLEGATION_WARNING =
  'This review was blocked as an unverified accusation. Publishing it is your decision and your risk.'

/**
 * Keeping it rejected asks first now, at every width.
 *
 * It is the most irreversible button on the page: the appeal closes, there is
 * no second one, and the student cannot ask again. It had no confirmation at
 * all, sitting one tap away from Publish it.
 *
 * It asks at every width rather than only on a phone, for the same reason the
 * Reject confirmation does — see QueueItem. Nothing LOOKS different until it
 * is pressed.
 */
const KEEP_REJECTED_WARNING =
  'This closes the appeal for good. There is no second appeal, and the student cannot ask again.'

function formatDate(value: Date): string {
  return value.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export type AppealCardProps = {
  appeal: AppealReview
  // The sentence the student was shown, built on the server from this
  // review's own moderation row.
  rejection: string | null
}

/**
 * One appeal, with everything needed to decide it on screen.
 *
 * It is given the comment, the ratings, the verdict, the flags, how many
 * times it was submitted and what the student wrote. It is not given who
 * wrote it. There is no name variable here to fill in by accident.
 */
export function AppealCard({ appeal, rejection }: AppealCardProps) {
  const router = useRouter()
  // Which button is waiting for a second press, if either. One value, so
  // opening one closes the other.
  const [confirming, setConfirming] = useState<'publish' | 'keep' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const decision = appeal.decision ? DECISION[appeal.decision] : null
  const locked = pending || appeal.isOwn

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)

    startTransition(async () => {
      const result = await work()

      if (!result.ok) {
        setError(result.error ?? 'Something went wrong. Please try again.')
        setConfirming(null)
        return
      }

      // Handled, so it leaves the section on the next render.
      router.refresh()
    })
  }

  function publish() {
    // An allegation asks first. Everything else publishes on the one click,
    // exactly as before.
    if (appeal.isAllegation && confirming !== 'publish') {
      setConfirming('publish')
      return
    }

    run(() => publishAppeal({ reviewId: appeal.id }))
  }

  function keep() {
    if (confirming !== 'keep') {
      setConfirming('keep')
      return
    }

    run(() => keepRejected({ reviewId: appeal.id }))
  }

  return (
    <article className="flex flex-col gap-4 rounded-card border border-line bg-paper p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {decision ? (
            <Badge variant={decision.variant}>{decision.label}</Badge>
          ) : (
            <Badge>Not checked</Badge>
          )}

          <Badge>
            {appeal.submitCount === 1
              ? 'Submitted once'
              : `Submitted ${appeal.submitCount} times`}
          </Badge>
        </div>

        <p className="text-[13px] text-slate">
          Appealed {formatDate(appeal.appealedAt)}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-ink">
          {appeal.teacherName} · {appeal.departmentCode}
        </p>
        <p className="text-[13px] text-slate">
          {appeal.courseCode} · {appeal.courseName} · {appeal.semester}
        </p>
      </div>

      {/* The review as it stands now, after any edits they made. */}
      {appeal.comment ? (
        <p className="rounded-control bg-mist p-4 text-[15px] leading-relaxed break-words text-ink">
          {appeal.comment}
        </p>
      ) : (
        <p className="text-[13px] text-slate">Ratings only. No comment was written.</p>
      )}

      <p className="text-[13px] text-slate">
        Overall {appeal.ratingOverall} · Teaching {appeal.ratingTeaching} · Clarity{' '}
        {appeal.ratingClarity} · Fairness {appeal.ratingFairness}
      </p>

      {/* Exactly what the student was told, and which rules fired. */}
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <p className="text-[13px] font-medium text-ink">They were told:</p>
        {rejection ? (
          <Alert variant="error">{rejection}</Alert>
        ) : (
          <p className="text-[13px] text-slate">
            No rejection sentence on record for this review.
          </p>
        )}

        {appeal.ruleFlags.length > 0 ? (
          <p className="text-[13px] text-slate">
            Flagged: {appeal.ruleFlags.join(', ')}
          </p>
        ) : null}
      </div>

      {/* Their side of it. */}
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <p className="text-[13px] font-medium text-ink">Their appeal:</p>
        {appeal.appealText ? (
          <p className="rounded-control bg-mist p-4 text-[15px] leading-relaxed break-words text-ink">
            {appeal.appealText}
          </p>
        ) : (
          <p className="text-[13px] text-slate">They wrote nothing.</p>
        )}
      </div>

      {/* Above the buttons, so the warning is read on the way down to the
          button it belongs to. */}
      {confirming === 'publish' ? (
        <Alert variant="warning">{ALLEGATION_WARNING}</Alert>
      ) : null}

      {confirming === 'keep' ? (
        <Alert variant="warning">{KEEP_REJECTED_WARNING}</Alert>
      ) : null}

      {/* Stacked and full width on a phone, with the irreversible one at the
          bottom. From md every class resolves to the row this already was:
          flex-row, flex-wrap, items-center, gap-3. */}
      <div className="flex flex-col gap-3 border-t border-line pt-4 md:flex-row md:flex-wrap md:items-center">
        {appeal.isOwn ? (
          // UNCHANGED. Visible, and not decidable.
          <p className="text-[13px] text-slate">
            Your own review. You cannot decide this one.
          </p>
        ) : null}

        {/* WHILE CONFIRMING THERE ARE ONLY TWO CHOICES: go ahead, or cancel.
            The original card already worked this way for an allegation —
            Cancel took the place of the other button — and that is the part
            worth keeping. Leaving the opposite decision live next to a
            confirmation is the misclick this whole change is about. */}
        {confirming === null ? (
          <>
            <Button
              type="button"
              loading={pending}
              disabled={locked}
              onClick={publish}
              className="w-full md:w-auto"
            >
              Publish it
            </Button>

            {/* The most irreversible button on the page, so it is last. */}
            <Button
              type="button"
              disabled={locked}
              onClick={keep}
              className="w-full md:w-auto"
            >
              Keep it rejected
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              loading={pending}
              disabled={locked}
              onClick={confirming === 'publish' ? publish : keep}
              className="w-full md:w-auto"
            >
              {confirming === 'publish' ? 'Yes, publish it' : 'Yes, keep it rejected'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setConfirming(null)}
              className="w-full md:w-auto"
            >
              Cancel
            </Button>
          </>
        )}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
    </article>
  )
}
