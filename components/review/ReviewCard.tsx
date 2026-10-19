import { ReportButton } from '@/components/review/ReportButton'
import { VoteButtons } from '@/components/review/VoteButtons'
import { formatRating } from '@/lib/format'
import type { VoteSummary } from '@/lib/votes'

// Date only, never a time. A timestamp next to a comment narrows down who
// wrote it for anyone who knows when a class ended.
function formatDate(value: Date): string {
  return value.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// "21 Sep 2026". On a phone the date shares the top line, where the long
// month does not fit.
function formatDateShort(value: Date): string {
  return value.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export type ReviewCardProps = {
  // The id, and nothing else about the review's origin. It is what the
  // report action needs to find the row; it says nothing about who wrote it.
  reviewId: string
  courseCode: string
  semester: string
  ratingOverall: number
  ratingTeaching: number
  ratingClarity: number
  ratingFairness: number
  comment: string | null
  createdAt: Date
  // STUDENT only, and never on your own review. The page works this out;
  // this component is never told who wrote anything.
  canReport: boolean
  // Two counts and the VIEWER's own value. Never a voter id and never a
  // voter list -- see server/votes.ts.
  voteSummary: VoteSummary
  // Same conditions as canReport: a STUDENT, and not their own review.
  // voteOnReview re-checks both; this only decides whether to draw buttons.
  canVote: boolean
}

/**
 * A row in a list on a phone, the card it has always been from md.
 *
 * On a phone it carries no border and no padding box: the course heading
 * above it is already inside one, and two levels of border left almost no
 * width for the review itself. The list draws one thin line between rows.
 *
 * The course code is not repeated on a phone either. The heading three lines
 * up says it, and repeating it was what pushed the top line onto two.
 */
export function ReviewCard({
  reviewId,
  courseCode,
  semester,
  ratingOverall,
  ratingTeaching,
  ratingClarity,
  ratingFairness,
  comment,
  createdAt,
  canReport,
  voteSummary,
  canVote,
}: ReviewCardProps) {
  return (
    <article className="flex flex-col gap-3 py-4 md:rounded-card md:border md:border-line md:bg-paper md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* "Anonymous Student" is hardcoded. There is no name variable here
            and there never will be. */}
        <p className="text-[13px] text-slate md:text-[15px]">
          Anonymous Student
          {/* The course and the semester only from md, where the heading is
              further away and there is room for both. */}
          <span className="hidden md:inline">
            {' '}
            · {courseCode} · {semester}
          </span>
          <span className="md:hidden"> · {formatDateShort(createdAt)}</span>
        </p>

        {/* From md the overall rating is the number on the right, as before.
            On a phone it is folded into the ratings line below. */}
        <p className="hidden text-[20px] leading-none font-semibold text-ink md:block">
          {formatRating(ratingOverall)}
        </p>
      </div>

      {comment ? (
        <p className="text-[15px] leading-relaxed text-ink">{comment}</p>
      ) : null}

      <p className="text-[13px] text-slate">
        <span className="md:hidden">Overall {formatRating(ratingOverall)} · </span>
        Teaching {ratingTeaching} · Clarity {ratingClarity} · Fairness{' '}
        {ratingFairness}
      </p>

      {/* The date lives in the top line on a phone, so from md this row is
          date on the left and actions on the right. It is always present now,
          because the vote counts are information for every reader -- a
          signed-out visitor and a teacher see the numbers without buttons.

          VOTES AND REPORT ARE PUSHED APART, not sat next to each other.
          justify-between on the action group puts the counts at one end and
          Report at the other, because a downvote and a report mean different
          things: disagree with a review, versus it breaks the rules. If the
          two read as the same control, people downvote what they should
          report and the moderation signal is lost. Report keeps its wording
          and its quiet underlined-link styling; it is not a button. */}
      <div className="flex flex-wrap items-center gap-3 md:justify-between">
        <p className="hidden text-[13px] text-slate md:block">
          {formatDate(createdAt)}
        </p>

        {/* w-full on a phone so the two ends actually separate; w-auto from
            md, where the date already holds the left. gap-4 is the floor
            between them even when the row is narrow. */}
        <div className="flex w-full items-center justify-between gap-4 md:w-auto md:justify-end">
          <VoteButtons reviewId={reviewId} summary={voteSummary} canVote={canVote} />

          {canReport ? <ReportButton reviewId={reviewId} /> : null}
        </div>
      </div>
    </article>
  )
}
