'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { getMyReviewsAnonymous } from '@/app/actions/ownership'
import { useSchoolKeyword } from '@/components/auth/SchoolKeywordGate'
import { AppealBox } from '@/components/review/AppealBox'
import { EditableComment } from '@/components/review/EditableComment'
import { ResubmitForm } from '@/components/review/ResubmitForm'
import { Alert, Badge, Button, EmptyState } from '@/components/ui'
import type { BadgeVariant } from '@/components/ui'
import type { ReviewStatus } from '@/lib/types'
import { appealLockMessage } from '@/lib/appeal'
import { rejectionMessage } from '@/services/moderation/messages'
import type { RuleFlag } from '@/services/moderation/rules'
import { MAX_SUBMITS } from '@/validators/review'
import { formatRating } from '@/lib/format'

const STATUS: Record<
  ReviewStatus,
  { label: string; variant: BadgeVariant; note?: string }
> = {
  PUBLISHED: { label: 'Published', variant: 'success' },
  PENDING: {
    label: 'Being checked',
    variant: 'neutral',
    note: 'We are still checking this review. It will appear shortly.',
  },
  HIDDEN: {
    label: 'Not visible',
    variant: 'neutral',
    note: 'This review is not currently shown.',
  },
  REJECTED: {
    label: 'Not published',
    variant: 'danger',
  },
}

function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateShort(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function MyReviewsContent() {
  const { keyword, forgetKeyword } = useSchoolKeyword()
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!keyword) return

    let active = true
    setLoading(true)
    setError(null)

    startTransition(async () => {
      try {
        const res = await getMyReviewsAnonymous(keyword)
        if (!active) return
        if (res.ok) {
          setReviews(res.reviews)
        } else {
          setError(res.error)
        }
      } catch {
        if (active) setError('Could not load reviews. Please try again.')
      } finally {
        if (active) setLoading(false)
      }
    })

    return () => {
      active = false
    }
  }, [keyword])

  return (
    <div>
      <div className="flex flex-col gap-2">
        <h1 className="text-[24px] leading-[1.2] font-bold text-ink sm:text-[32px] md:text-[48px]">
          My reviews
        </h1>
        <p className="text-[13px] text-slate md:text-[16px]">
          Only you can see this page. Your name is never shown on a review.
        </p>
      </div>

      {loading ? (
        <div className="mt-8 md:mt-12 flex flex-col gap-4">
          <div className="h-32 animate-pulse rounded-card bg-mist" />
          <div className="h-32 animate-pulse rounded-card bg-mist" />
        </div>
      ) : error ? (
        <div className="mt-8 md:mt-12">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : reviews.length === 0 ? (
        <div className="mt-8 md:mt-12 flex flex-col gap-6">
          <EmptyState
            heading={
              <span className="inline-block rounded-control bg-accent/15 px-3.5 py-1.5 text-[15px] font-bold uppercase tracking-wide text-ink border border-accent/30 md:text-[17px]">
                Either you typed the wrong secret key, or you haven&apos;t written any reviews yet.
              </span>
            }
            message="No review found"
            action={
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button as="link" href="/teachers">
                  Find a teacher
                </Button>
                <button
                  type="button"
                  onClick={forgetKeyword}
                  className="text-[15px] font-medium text-slate underline hover:text-ink cursor-pointer"
                >
                  Re-enter secret key
                </button>
              </div>
            }
          />
          <div className="rounded-card border border-line bg-mist p-4 text-[13px] text-slate">
            <p>
              <strong>Looking for existing reviews?</strong> If you previously submitted reviews using a different secret key on another device, use{' '}
              <button
                type="button"
                onClick={forgetKeyword}
                className="font-semibold text-ink underline cursor-pointer"
              >
                Clear secret word
              </button>{' '}
              to enter the exact secret you used previously.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 md:mt-12 flex flex-col gap-6">
          {reviews.map((review) => {
            const status = STATUS[review.status as ReviewStatus]
            const rejection =
              review.status === 'REJECTED' && review.verdict
                ? rejectionMessage(
                    review.verdict.decision,
                    review.verdict.ruleFlags as RuleFlag[]
                  )
                : null

            const attemptsLeft = MAX_SUBMITS - review.submitCount
            const lockMessage = appealLockMessage(review)

            return (
              <article
                key={review.id}
                className="flex flex-col gap-3 rounded-card border border-line bg-paper p-4 shadow-resting md:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/teachers/${review.teacher.slug}`}
                        className="min-w-0 truncate text-[15px] leading-[1.3] font-semibold text-ink underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:overflow-visible md:text-[20px] md:leading-[1.2] md:whitespace-normal"
                      >
                        {review.teacher.nameEn}
                      </Link>

                      <span className="shrink-0 md:hidden">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </span>
                    </div>

                    <p className="text-[13px] text-slate md:text-[15px]">
                      {review.course.code} · {review.course.name} · {review.semester}
                    </p>
                  </div>

                  <div className="hidden flex-col items-end gap-1 md:flex">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <p className="text-[20px] leading-none font-semibold text-ink">
                      {formatRating(review.ratingOverall)}
                    </p>
                  </div>
                </div>

                {status.note ? (
                  <p className="text-[13px] text-slate">{status.note}</p>
                ) : null}

                <EditableComment
                  reviewId={review.id}
                  comment={review.comment}
                  dateLabel={formatDate(review.createdAt)}
                  dateLabelShort={formatDateShort(review.createdAt)}
                  locked={lockMessage !== null}
                >
                  <p className="border-t border-line pt-3 text-[13px] text-slate">
                    <span className="md:hidden">
                      Overall {formatRating(review.ratingOverall)} ·{' '}
                    </span>
                    Teaching {review.ratingTeaching} · Clarity{' '}
                    {review.ratingClarity} · Fairness {review.ratingFairness}
                  </p>
                </EditableComment>

                {review.status === 'REJECTED' ? (
                  <div className="flex flex-col gap-4 border-t border-line pt-4">
                    {rejection ? <Alert variant="error">{rejection}</Alert> : null}

                    {lockMessage ? (
                      <p className="text-[13px] text-slate">{lockMessage}</p>
                    ) : (
                      <>
                        {attemptsLeft > 0 ? (
                          <ResubmitForm
                            reviewId={review.id}
                            ratings={{
                              ratingTeaching: review.ratingTeaching,
                              ratingClarity: review.ratingClarity,
                              ratingFairness: review.ratingFairness,
                              ratingOverall: review.ratingOverall,
                            }}
                            comment={review.comment}
                            attemptsLeft={attemptsLeft}
                          />
                        ) : (
                          <p className="text-[13px] text-slate">
                            You have used all {MAX_SUBMITS} attempts for this review.
                          </p>
                        )}

                        <AppealBox
                          reviewId={review.id}
                          appealed={review.appealedAt !== null}
                          attemptsLeft={attemptsLeft}
                        />
                      </>
                    )}

                    <Link
                      href="/guidelines"
                      className="text-[13px] text-slate underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      Read the guidelines
                    </Link>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
