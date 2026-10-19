import Image from 'next/image'
import Link from 'next/link'
import { LIFT } from './lift'
import { formatRating } from '@/lib/format'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// The photo slot, at every width -- this one does not change across
// breakpoints. The transformation budget on Vercel's free plan is a known
// risk, documented in next.config.ts.
const PHOTO = 64

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

export type TeacherTileProps = {
  slug: string
  nameEn: string
  departmentShortCode: string
  imageUrl: string | null
  avgOverall: number | null
  reviewCount: number
}

/**
 * THE FACES ARE THE DESIGN.
 *
 * 448 photos exist and they are the one visual asset this site owns. A site
 * about people should show people; this section is what stops the page
 * feeling like a list of numbers.
 *
 * THE CIRCLE AGAINST THE RECTANGLE IS DELIBERATE. A square photo in a square
 * card reads as a thumbnail; a circle reads as a face.
 *
 * ONE LINK, NO BUTTON. The whole card goes to the profile. A "View profile"
 * button inside a card that is already a link is two targets where a thumb
 * expects one.
 */
export function TeacherTile({
  slug,
  nameEn,
  departmentShortCode,
  imageUrl,
  avgOverall,
  reviewCount,
}: TeacherTileProps) {
  return (
    <Link
      href={`/teachers/${slug}`}
      className={`flex h-full flex-col gap-4 rounded-card border border-line bg-paper p-4 md:p-6 ${LIFT} ${FOCUS_RING}`}
    >
      <div className="flex items-center gap-3">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            width={PHOTO}
            height={PHOTO}
              // EXPLICIT, not left to the default. This section sits below the
            // hero and the whole departments grid, so no photo here is ever
            // the LCP — and the 5th and 6th tiles are display:none on a
            // phone, where a lazy image is never near the viewport and so is
            // never fetched. A phone must not pay for two photos it will not
            // show.
            loading="lazy"
            className="size-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          // No photo for 23 of the 471. An initial in the same circle, so the
          // row keeps its shape rather than collapsing.
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-mist text-[20px] font-semibold text-slate"
          >
            {nameEn.trim().charAt(0).toUpperCase()}
          </span>
        )}

        {/* min-w-0 so a long name wraps inside the card instead of pushing the
            photo off the left edge. */}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] leading-[1.3] font-semibold text-ink md:text-[20px] md:leading-[1.2]">
            {nameEn}
          </span>
          <span className="text-[13px] text-slate">{departmentShortCode}</span>
        </span>
      </div>

      {/* Below both, not beside them: at 360px there is no room for a photo, a
          name and a rating on one line. */}
      <span className="mt-auto flex flex-wrap items-baseline gap-x-2">
        <span className="inline-flex items-baseline gap-1 text-[20px] leading-none font-bold text-ink md:text-[24px]">
          {/* INK, NOT GOLD. The gold rule above each section is the only gold
              in the body of the page. */}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="size-4 shrink-0 translate-y-px"
          >
            <path d="M10 1.5l2.47 5.26 5.53.72-4.08 3.9 1.05 5.62L10 14.3l-4.97 2.7 1.05-5.62L2 7.48l5.53-.72L10 1.5Z" />
          </svg>
          {avgOverall === null ? '—' : formatRating(avgOverall)}
        </span>

        <span className="text-[13px] text-slate">
          {reviewCount === 1 ? '1 review' : `${reviewCount} reviews`}
        </span>
      </span>
    </Link>
  )
}
