'use client'

import { useState, useTransition } from 'react'
import { loadMoreCourseReviews } from '@/app/actions/course-reviews'
import { ReviewCard } from '@/components/review/ReviewCard'
import { Button } from '@/components/ui'
import type { CourseReviews, PublicReview } from '@/server/reviews'
import { formatRating } from '@/lib/format'
import { EMPTY_VOTE_SUMMARY } from '@/lib/votes'
import type { VoteSummaries } from '@/lib/votes'

export type CourseReviewBlockProps = {
  block: CourseReviews
  // Needed by the load-more action. The review form already receives this
  // same id; it says nothing about any person.
  teacherId: string
  // Ids of reviews the viewer wrote. Never anyone else's.
  ownReviewIds: string[]
  isStudent: boolean
  // Two counts per review, plus the VIEWER's own vote. Keyed by review id;
  // a review with no votes has no key and falls back to zeroes.
  voteSummaries: VoteSummaries
}

/** "1 review" / "12 reviews". */
function reviewLabel(count: number): string {
  return count === 1 ? '1 review' : `${count} reviews`
}

/**
 * One course, as a card: a header to scan, two comments to read, and a button
 * for the rest.
 *
 * A CARD AT EVERY WIDTH NOW. On a phone this used to be a bare heading and a
 * list, because it was a card holding ReviewCards and two levels of border
 * plus two levels of padding left almost no width for the comment — which is
 * the only part anyone came to read. The inner reviews are a divided list on
 * a phone rather than cards, so one card level is all there is and the width
 * problem does not come back. Desktop renders exactly what it rendered
 * before: the same radius, border and 24px padding from md.
 *
 * NO DISPLAY THRESHOLD HERE. min_students_for_display used to hide this
 * course's average and print "Not enough reviews". It no longer does: that
 * threshold is about the headline rating at the top of the page. It also
 * protected nothing here, because each review below already shows its own
 * four ratings — so on a course with one review the average was arithmetic
 * anyone could do from what was already on screen.
 */
export function CourseReviewBlock({
  block,
  teacherId,
  ownReviewIds,
  isStudent,
  voteSummaries,
}: CourseReviewBlockProps) {
  // Batches already fetched, in order, appended after the two previews.
  const [extra, setExtra] = useState<PublicReview[]>([])
  // Counts for the batches fetched since first paint, merged over the ones
  // the page sent. Never computed here -- every number came from the server.
  const [extraVotes, setExtraVotes] = useState<VoteSummaries>({})
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()

  const own = new Set(ownReviewIds)

  // Belt and braces against a review published between first paint and a
  // press: the ordering is stable, but a duplicate id must never render
  // twice if it ever happens.
  const seen = new Set(block.reviews.map((review) => review.id))
  const shown = [
    ...block.reviews,
    ...extra.filter((review) => {
      if (seen.has(review.id)) return false
      seen.add(review.id)
      return true
    }),
  ]

  // reviewCount is exact: it comes from the groupBy, which is not capped.
  const remaining = Math.max(0, block.reviewCount - shown.length)

  // Both numbers, so the average says what it rests on.
  const countLabel = `${reviewLabel(block.reviewCount)} from ${
    block.studentCount === 1 ? '1 student' : `${block.studentCount} students`
  }`

  function loadMore() {
    setFailed(false)

    startTransition(async () => {
      try {
        const result = await loadMoreCourseReviews({
          teacherId,
          courseCode: block.course.code,
          skip: shown.length,
        })

        if (!result.ok || result.reviews.length === 0) {
          // A refusal or an empty batch both mean "not now". The button stays,
          // so the reader can try again rather than being left with no way
          // forward.
          setFailed(true)
          return
        }

        setExtra((current) => [...current, ...result.reviews])
        setExtraVotes((current) => ({ ...current, ...result.voteSummaries }))
      } catch {
        // Offline, or a 500.
        setFailed(true)
      }
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-paper p-4 shadow-resting md:gap-4 md:p-6">
      {/* 1. THE HEADER. The line a student scans: which course, how good, how
             many people said so. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Bold, not semibold, so 20px against 15px body reads as a level
              rather than as slightly larger text. The size is not raised:
              this h3 sits inside the 20/24px "Reviews by course" h2, and a
              child heading must not out-size its parent. */}
          <h3 className="text-[20px] leading-[1.2] font-bold text-ink">
            {block.course.code}
          </h3>

          <p className="text-[13px] text-slate md:text-[15px]">
            {block.course.name}
            {block.course.semester ? ` · ${block.course.semester}` : ''}
          </p>

          {/* ONE line on a phone, where there is no room for the rating to
              sit off to the right. */}
          <p className="text-[13px] text-slate md:hidden">
            {formatRating(block.avgOverall)} · {countLabel}
          </p>
        </div>

        {/* The same pair, in the same place, from md. */}
        <div className="hidden shrink-0 flex-col items-end gap-1 md:flex">
          <p className="text-[24px] leading-none font-bold text-ink">
            {formatRating(block.avgOverall)}
          </p>

          <p className="text-[13px] text-slate">{countLabel}</p>
        </div>
      </div>

      {/* 2. THE COMMENTS. A divided list on a phone, spaced cards from md. */}
      <div className="flex flex-col divide-y divide-line border-t border-line md:gap-4 md:divide-y-0 md:pt-4">
        {shown.map((review) => (
          <ReviewCard
            key={review.id}
            reviewId={review.id}
            courseCode={block.course.code}
            semester={review.semester}
            ratingOverall={review.ratingOverall}
            ratingTeaching={review.ratingTeaching}
            ratingClarity={review.ratingClarity}
            ratingFairness={review.ratingFairness}
            comment={review.comment}
            createdAt={review.createdAt}
            canReport={isStudent && !own.has(review.id)}
            // Same two conditions as canReport: a student, and not their own
            // review. voteOnReview checks both again on the server.
            canVote={isStudent && !own.has(review.id)}
            voteSummary={
              extraVotes[review.id] ?? voteSummaries[review.id] ?? EMPTY_VOTE_SUMMARY
            }
          />
        ))}

        {/* 3. THE BUTTON. Gone entirely once everything is on screen, rather
               than sitting there disabled. */}
        {remaining > 0 ? (
          <div className="flex flex-col gap-2 pt-3 md:pt-0">
            <Button
              variant="ghost"
              loading={pending}
              onClick={loadMore}
              // Ghost is a text link that needs a tap target, so it carries no
              // horizontal padding here; min-h-11 comes from Button itself.
              className="self-start px-0"
            >
              {pending
                ? 'Loading reviews…'
                : extra.length === 0
                  ? `Show all ${block.reviewCount} reviews`
                  : `Show ${remaining} more`}
            </Button>

            {failed ? (
              <p className="text-[13px] text-slate">
                Could not load more reviews. Try again.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
