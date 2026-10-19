import Image from 'next/image'
import Link from 'next/link'
import { formatRating } from '@/lib/format'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// width and height are the CSS box at its largest, so the space is reserved
// before the file arrives and the layout never jumps. 40px on a phone
// (size-10), 64px from md (size-16) -- both served from the same file.
const PHOTO_SIZE = 64

// NO `sizes` PROP, DELIBERATELY. It used to be here and it was costing the
// image quota.
//
// next/image treats `sizes` as "this is responsive": get-img-props.js
// getWidths() returns ALL of allSizes -- deviceSizes + imageSizes, 15 widths
// by default -- and the px-only string here made that worse, because the
// `vw` branch that would have filtered the list never matched. One photo
// could be transformed at 15 widths instead of 2.
//
// Without it, a numeric `width` takes the fixed path: [width, width * 2],
// snapped into allSizes. Two widths, a 1x/2x srcset, and the browser picks
// on device pixel ratio.
//
// THE PHOTO IS STILL SHARP AT EVERY BREAKPOINT, because width below is the
// LARGEST size this photo ever renders at, so 2x covers the densest screen
// at that size -- and a smaller breakpoint asks for fewer CSS pixels than
// the same file already provides.

export type TeacherCardProps = {
  slug: string
  nameEn: string
  nameBn: string | null
  designation: string
  isHead: boolean
  imageUrl: string | null
  avgOverall: number | null
  reviewCount: number
  // Distinct students. The threshold below counts these, not reviews.
  studentCount: number
  departmentShortCode: string
  // From getSetting('min_students_for_display'). Below it, no number.
  minStudentsForDisplay: number
  // Set only in a ranked list, such as Top rated teachers. Shown on a phone,
  // where the list is a list; from md the card looks as it always has.
  rank?: number
  // A ranked list is six rows long, so there is room for a name to take two
  // lines. "Md. Rakibul Hasan Kh..." reads as broken.
  wrapName?: boolean
}

/**
 * A list row on a phone, a card from md upward.
 *
 * On a phone it is 40px of photo, one line of name, one line of designation
 * and department, and the rating against the right edge. No border and no
 * rounding: the list that holds these draws one thin line between rows, so
 * six of them fit on a 360px screen instead of two.
 */
export function TeacherCard({
  slug,
  nameEn,
  nameBn,
  designation,
  isHead,
  imageUrl,
  avgOverall,
  reviewCount,
  studentCount,
  departmentShortCode,
  minStudentsForDisplay,
  rank,
  wrapName = false,
}: TeacherCardProps) {
  const showRating = avgOverall !== null && studentCount >= minStudentsForDisplay

  // Both numbers: "12 reviews from 8 students" says what the average rests
  // on. On a phone the row has no space for the long form, so the rating
  // keeps the short one and the card shows the full sentence from md.
  const reviews = reviewCount === 1 ? '1 review' : `${reviewCount} reviews`
  const students = studentCount === 1 ? '1 student' : `${studentCount} students`

  const rating = showRating ? `${formatRating(avgOverall)} · ${reviews}` : null
  const ratingLong = showRating
    ? `${formatRating(avgOverall)} · ${reviews} from ${students}`
    : null

  return (
    <Link
      href={`/teachers/${slug}`}
      // ELEVATION FROM md ONLY. On a phone this is a row in a divided list
      // with no border and no radius - the list draws the lines - so a shadow
      // here would be a thing floating with nothing to float. From md it is a
      // card, and then it rests and lifts like every other card.
      className={`flex items-center gap-3 py-3 hover:bg-mist active:bg-mist md:items-start md:gap-4 md:rounded-card md:border md:border-line md:bg-paper md:p-6 md:shadow-resting md:transition-shadow md:hover:shadow-raised motion-reduce:transition-none ${FOCUS_RING}`}
    >
      {/* The position in the ranking, before the photo. */}
      {rank !== undefined ? (
        <span className="w-4 shrink-0 text-[13px] text-slate md:hidden">{rank}</span>
      ) : null}

      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          width={PHOTO_SIZE}
          height={PHOTO_SIZE}
          // Below the fold on every page that uses this row.
          loading="lazy"
          className="size-10 shrink-0 rounded-full object-cover md:size-16"
        />
      ) : (
        // 23 teachers have no photo. A letter circle, never a broken image.
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mist text-[15px] font-semibold text-slate md:size-16 md:text-[20px]"
        >
          {nameEn.trim().charAt(0).toUpperCase()}
        </span>
      )}

      {/* min-w-0 is what lets the name truncate instead of pushing the
          rating off the row. */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-1">
        {/* One line on a phone. "A. K. M. Minhazul Rahman" gets an ellipsis
            rather than two lines. It wraps normally again at md. */}
        <span
          className={`text-[15px] leading-[1.3] font-semibold text-ink md:overflow-visible md:text-[20px] md:leading-[1.2] md:whitespace-normal ${
            // line-clamp sets display and -webkit-line-clamp, which
            // md:overflow-visible below does NOT undo, so the clamp has to be
            // turned off explicitly or desktop would clamp too.
            wrapName ? 'line-clamp-2 md:line-clamp-none' : 'truncate'
          }`}
        >
          {nameEn}
        </span>

        {nameBn ? (
          <span className="bn hidden text-[15px] text-ink md:block">{nameBn}</span>
        ) : null}

        {/* Designation and department share a line on a phone, and split
            back onto two at md. */}
        <span className="truncate text-[13px] text-slate md:hidden">
          {isHead ? `${designation} · Head of department` : designation} ·{' '}
          {departmentShortCode}
        </span>

        <span className="hidden text-[15px] text-slate md:block">
          {isHead ? `${designation} · Head of department` : designation}
        </span>
        <span className="hidden text-[13px] text-slate md:block">
          {departmentShortCode}
        </span>

        {/* At md the rating is a line in the column, as before. Nothing at
            all when there is none to show. */}
        {ratingLong ? (
          <span className="hidden text-[15px] text-ink md:block">{ratingLong}</span>
        ) : (
          <span className="hidden text-[15px] text-slate md:block">No rating yet</span>
        )}
      </span>

      {/* On a phone the rating sits against the right edge, and an unrated
          teacher shows nothing rather than a line saying so. */}
      {rating ? (
        <span className="shrink-0 text-[13px] text-ink md:hidden">{rating}</span>
      ) : null}
    </Link>
  )
}
