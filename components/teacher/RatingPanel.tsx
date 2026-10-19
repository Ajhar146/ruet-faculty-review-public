import { StarRating } from '@/components/ui'
import { formatRating } from '@/lib/format'

export type RatingPanelProps = {
  reviewCount: number
  // From getSetting('min_students_for_display'). Below it, never a number.
  minStudentsForDisplay: number
  // Distinct students behind reviewCount.
  studentCount: number
  avgOverall: number | null
  avgTeaching: number | null
  avgClarity: number | null
  avgFairness: number | null
}

function Category({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[15px] text-slate">{label}</span>
      {value === null ? (
        <span className="text-[15px] text-slate">No rating yet</span>
      ) : (
        <StarRating value={value} readOnly label={label} />
      )}
    </div>
  )
}

export function RatingPanel({
  reviewCount,
  minStudentsForDisplay,
  studentCount,
  avgOverall,
  avgTeaching,
  avgClarity,
  avgFairness,
}: RatingPanelProps) {
  const showRating = avgOverall !== null && studentCount >= minStudentsForDisplay

  // Every teacher has zero reviews today, so this is what every profile
  // shows. The panel below it is built for phase 4.
  if (!showRating) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[16px] text-ink">
          Not enough reviews for a reliable rating.
        </p>
        <p className="text-[15px] text-slate">
          Ratings appear once a teacher has been reviewed by{' '}
          {minStudentsForDisplay} students.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-[40px] leading-none font-bold text-ink">
          {formatRating(avgOverall)}
        </span>
        <div className="flex flex-col gap-1">
          <StarRating value={avgOverall} readOnly label="Overall rating" />
          <span className="text-[13px] text-slate">
            {reviewCount === 1 ? '1 review' : `${reviewCount} reviews`}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Category label="Teaching" value={avgTeaching} />
        <Category label="Clarity" value={avgClarity} />
        <Category label="Fairness" value={avgFairness} />
      </div>
    </div>
  )
}
