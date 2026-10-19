'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resubmitReview } from '@/app/actions/review'
import type { SubmitOutcome } from '@/app/actions/review'
import { useSchoolKeyword } from '@/components/auth/SchoolKeywordGate'
import { Alert, Button, StarRating, Textarea } from '@/components/ui'
import { COMMENT_MAX, COMMENT_MIN } from '@/validators/review'

// The same four questions as the first time, in the same order and words.
const RATINGS = [
  { key: 'ratingTeaching', label: 'Teaching quality' },
  { key: 'ratingClarity', label: 'Concept clarity' },
  { key: 'ratingFairness', label: 'Fairness' },
  { key: 'ratingOverall', label: 'Overall' },
] as const

type RatingKey = (typeof RATINGS)[number]['key']

export type ResubmitFormProps = {
  reviewId: string
  // What they wrote last time, so they are fixing it rather than starting
  // again from nothing.
  ratings: Record<RatingKey, number>
  comment: string | null
  attemptsLeft: number
  // Given by a caller that shows the result itself, such as the screen
  // straight after a submit. Without it the component refreshes the page,
  // which is what /my-reviews wants.
  onResult?: (outcome: SubmitOutcome) => void
}

/**
 * Fixing a rejected review.
 *
 * The teacher, the course and the semester are not here and cannot be
 * changed. They are what eligibility was checked against; the server reads
 * them from the stored row and ignores anything else that arrives.
 */
export function ResubmitForm({
  reviewId,
  ratings: initialRatings,
  comment: initialComment,
  attemptsLeft,
  onResult,
}: ResubmitFormProps) {
  const router = useRouter()
  const { keyword } = useSchoolKeyword()
  const [open, setOpen] = useState(false)
  const [ratings, setRatings] = useState<Record<RatingKey, number>>(initialRatings)
  const [comment, setComment] = useState(initialComment ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function send() {
    setError(null)

    startTransition(async () => {
      const result = await resubmitReview({
        reviewId,
        ...ratings,
        comment: comment.trim() ? comment : undefined,
        schoolKeyword: keyword ?? '',
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      // The new status is whatever moderation just decided, never a guess
      // made here.
      setOpen(false)

      if (onResult && result.data) {
        onResult(result.data)
        return
      }

      router.refresh()
    })
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => setOpen(true)}>
          Edit and submit again
        </Button>

        <p className="text-[13px] text-slate">
          {attemptsLeft === 1
            ? 'One attempt left.'
            : `${attemptsLeft} attempts left.`}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 rounded-card border border-line bg-mist p-4 md:p-6">
      <div className="flex flex-col gap-4">
        {RATINGS.map((item) => (
          <div
            key={item.key}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <p className="text-[15px] text-ink">{item.label}</p>
            <StarRating
              value={ratings[item.key]}
              label={item.label}
              onChange={(value) =>
                setRatings((current) => ({ ...current, [item.key]: value }))
              }
            />
          </div>
        ))}
      </div>

      <Textarea
        label="Your feedback"
        hint={`Optional. ${COMMENT_MIN} to ${COMMENT_MAX} characters if you write one.`}
        maxLength={COMMENT_MAX}
        rows={5}
        value={comment}
        disabled={pending}
        onChange={(event) => setComment(event.target.value)}
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" loading={pending} onClick={send}>
          Submit again
        </Button>

        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
