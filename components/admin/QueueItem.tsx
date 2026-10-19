'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  approveReview,
  dismissReport,
  hideReview,
  rejectReview,
  unhideReview,
} from '@/app/actions/admin'
import { Alert, Badge, Button, Textarea } from '@/components/ui'
import type { BadgeVariant } from '@/components/ui'
import type { ModerationDecision, ReviewStatus } from '@/lib/types'
import type { QueueReview } from '@/server/admin'
import { REPORT_REASON_LABELS } from '@/validators/report'

const NOTE_MAX = 500

/**
 * Rejecting asks first, at every width.
 *
 * It is the one button here that cannot be taken back: Hide has Publish it
 * again, and Dismiss only clears a report. On a laptop a misclick is rare; on
 * a phone, thumbing past a column of cards, it is not.
 *
 * WHY NOT ONLY ON A PHONE. There is no honest way to make a button behave
 * differently by window width — CSS cannot gate a click handler, and the same
 * button doing two different things depending on how wide the window happens
 * to be is worse than one extra tap. So it asks everywhere. Nothing about the
 * card LOOKS different until it is pressed.
 */
const REJECT_WARNING =
  'Rejecting is final for this attempt. The student is told why and can edit and resubmit, unless they have already appealed.'

// Waiting longer than this is itself the problem to look at.
const STALE_DAYS = 7

const DECISION: Record<ModerationDecision, { label: string; variant: BadgeVariant }> = {
  HIGH_RISK: { label: 'High risk', variant: 'danger' },
  SPAM: { label: 'Spam', variant: 'danger' },
  SUSPICIOUS: { label: 'Needs a look', variant: 'neutral' },
  ERROR: { label: 'Check failed', variant: 'neutral' },
  SAFE: { label: 'Safe', variant: 'success' },
}

const STATUS: Record<ReviewStatus, string> = {
  PENDING: 'Pending',
  PUBLISHED: 'Published',
  HIDDEN: 'Hidden',
  REJECTED: 'Rejected',
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function daysSince(value: Date): number {
  return Math.floor((Date.now() - value.getTime()) / 86_400_000)
}

export type QueueItemProps = {
  review: QueueReview
}

/**
 * One review waiting for a decision.
 *
 * It is given the comment, the teacher, the course, the status, the flags
 * and the report count. It is not given who wrote the review, who reported
 * it, or any id but the review's own and its reports'. There is no name
 * variable here to fill in by accident.
 */
export function QueueItem({ review }: QueueItemProps) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [confirmingReject, setConfirmingReject] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const waiting = daysSince(review.createdAt)
  const decision = review.decision ? DECISION[review.decision] : null

  // Shown so it cannot sit PENDING unnoticed, but not decidable. The
  // actions refuse it on the server too; this only stops a pointless click.
  const locked = pending || review.isOwn

  function reject() {
    if (!confirmingReject) {
      setConfirmingReject(true)
      return
    }

    run(() =>
      rejectReview({
        reviewId: review.id,
        note: note.trim() ? note : undefined,
      })
    )
  }

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)

    startTransition(async () => {
      const result = await work()

      if (!result.ok) {
        setError(result.error ?? 'Something went wrong. Please try again.')
        setConfirmingReject(false)
        return
      }

      setNote('')
      setConfirmingReject(false)
      router.refresh()
    })
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

          <Badge>{STATUS[review.status]}</Badge>

          {review.reasons.includes('AUTO_HIDDEN') ? (
            <Badge variant="danger">Auto hidden</Badge>
          ) : null}
        </div>

        {waiting > STALE_DAYS ? (
          <p className="text-[13px] font-medium text-danger">
            waiting {waiting} days
          </p>
        ) : (
          <p className="text-[13px] text-slate">{formatDate(review.createdAt)}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-ink">
          {review.teacherName} · {review.departmentCode}
        </p>
        <p className="text-[13px] text-slate">
          {review.courseCode} · {review.courseName} · {review.semester}
        </p>
      </div>

      {/* break-words because this is a student's text. A 200-character URL
          with no spaces in it would otherwise push the card wider than the
          screen and make the whole page scroll sideways. It only does
          anything in that case, at any width. */}
      {review.comment ? (
        <p className="rounded-control bg-mist p-4 text-[15px] leading-relaxed break-words text-ink">
          {review.comment}
        </p>
      ) : (
        <p className="text-[13px] text-slate">Ratings only. No comment was written.</p>
      )}

      <div className="flex flex-col gap-1 text-[13px] text-slate">
        {review.ruleFlags.length > 0 ? (
          <p>Flagged: {review.ruleFlags.join(', ')}</p>
        ) : null}
        <p>
          {review.reportCount === 1 ? '1 report' : `${review.reportCount} reports`}
          {review.reports.length > 0 ? ` · ${review.reports.length} not handled` : ''}
        </p>
      </div>

      {review.reports.length > 0 ? (
        <ul className="flex flex-col gap-3 border-t border-line pt-4">
          {review.reports.map((report) => (
            <li
              key={report.id}
              className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:justify-between"
            >
              <div className="flex flex-col gap-1">
                <p className="text-[15px] text-ink">
                  {REPORT_REASON_LABELS[report.reason]}
                </p>
                {report.description ? (
                  <p className="text-[13px] break-words text-slate">
                    {report.description}
                  </p>
                ) : null}
              </div>

              {/* Not destructive to the review: it clears one report and
                  Hide/Publish are untouched. So no confirmation, but still a
                  full-width 44px target on a phone. */}
              <Button
                type="button"
                disabled={locked}
                onClick={() => run(() => dismissReport({ reportId: report.id }))}
                className="w-full md:w-auto"
              >
                Dismiss
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {review.status === 'PENDING' || review.status === 'PUBLISHED' ? (
        <Textarea
          label="Note for the audit log"
          hint="Optional. Only you will ever read it."
          maxLength={NOTE_MAX}
          rows={2}
          value={note}
          disabled={locked}
          onChange={(event) => setNote(event.target.value)}
        />
      ) : null}

      {/* Shown before the buttons, so the warning is read on the way down to
          the button it is about rather than after it. */}
      {confirmingReject ? <Alert variant="warning">{REJECT_WARNING}</Alert> : null}

      {/* THE BUTTONS LAST, and Reject last within them.
          Stacked and full width on a phone; from md every class resolves to
          the row this has always been: flex-row, flex-wrap, items-center,
          gap-3. */}
      <div className="flex flex-col gap-3 border-t border-line pt-4 md:flex-row md:flex-wrap md:items-center">
        {review.isOwn ? (
          // UNCHANGED. The review stays visible and its buttons stay
          // disabled, because hidden is not the same as undecidable.
          <p className="text-[13px] text-slate">
            Your own review. You cannot decide this one.
          </p>
        ) : null}

        {review.status === 'PENDING' ? (
          confirmingReject ? (
            // ONLY TWO CHOICES WHILE CONFIRMING: reject, or cancel. Leaving
            // Publish live beside a confirmation is the misclick this change
            // exists to stop, and it matches how AppealCard has always
            // handled an allegation.
            <>
              <Button
                type="button"
                loading={pending}
                disabled={locked}
                onClick={reject}
                className="w-full md:w-auto"
              >
                Yes, reject it
              </Button>

              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirmingReject(false)}
                className="w-full md:w-auto"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                loading={pending}
                disabled={locked}
                onClick={() => run(() => approveReview({ reviewId: review.id }))}
                className="w-full md:w-auto"
              >
                Publish
              </Button>

              {/* The irreversible one, so it is last: at the bottom of the
                  card on a phone, rightmost from md. */}
              <Button
                type="button"
                disabled={locked}
                onClick={reject}
                className="w-full md:w-auto"
              >
                Reject
              </Button>
            </>
          )
        ) : null}

        {review.status === 'PUBLISHED' ? (
          // No confirmation: Publish it again undoes this exactly.
          <Button
            type="button"
            disabled={locked}
            onClick={() =>
              run(() =>
                hideReview({
                  reviewId: review.id,
                  note: note.trim() ? note : undefined,
                })
              )
            }
            className="w-full md:w-auto"
          >
            Hide it
          </Button>
        ) : null}

        {review.status === 'HIDDEN' ? (
          <Button
            type="button"
            disabled={locked}
            onClick={() => run(() => unhideReview({ reviewId: review.id }))}
            className="w-full md:w-auto"
          >
            Publish it again
          </Button>
        ) : null}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
    </article>
  )
}
