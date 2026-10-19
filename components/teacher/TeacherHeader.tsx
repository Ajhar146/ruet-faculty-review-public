import Image from 'next/image'
import { Button } from '@/components/ui'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// 128px: the CSS box at its largest (md:size-32). 80px on a phone
// (size-20) is served from the same file.
const PHOTO_SIZE = 128

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

export type TeacherHeaderProps = {
  slug: string
  nameEn: string
  nameBn: string | null
  designation: string
  isHead: boolean
  imageUrl: string | null
  ruetProfileUrl: string | null
  departmentNameEn: string
  // Only a STUDENT may write. The page decides; this just draws the button.
  showWriteReview: boolean
  // Why the button is not there, when the reason is a cap this student has
  // reached. Null when there is nothing to explain.
  capMessage?: string | null
}

export function TeacherHeader({
  slug,
  nameEn,
  nameBn,
  designation,
  isHead,
  imageUrl,
  ruetProfileUrl,
  departmentNameEn,
  showWriteReview,
  capMessage = null,
}: TeacherHeaderProps) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          width={PHOTO_SIZE}
          height={PHOTO_SIZE}
          // The one photo above the fold on the whole site. Lazy loading it
          // would only delay the thing the page is about.
          priority
          className="size-20 shrink-0 rounded-full object-cover md:size-32"
        />
      ) : (
        // 23 teachers have no photo. A letter circle, never a broken image.
        <span
          aria-hidden="true"
          className="flex size-20 shrink-0 items-center justify-center rounded-full bg-mist text-[24px] font-semibold text-slate md:size-32 md:text-[40px]"
        >
          {nameEn.trim().charAt(0).toUpperCase()}
        </span>
      )}

      <div className="flex flex-1 flex-col gap-2">
        <h1 className="text-[22px] leading-[1.2] font-bold text-ink sm:text-[28px] md:text-[32px]">
          {nameEn}
        </h1>

        {nameBn ? (
          <p className="bn text-[15px] text-ink md:text-[16px]">{nameBn}</p>
        ) : null}

        <p className="text-[13px] text-slate md:text-[16px]">
          {isHead ? `${designation} · Head of department` : designation}
        </p>

        <p className="text-[13px] text-slate md:text-[16px]">{departmentNameEn}</p>

        {/* Six teachers have no profile URL. They get no link at all,
            not an anchor with an empty href. */}
        {ruetProfileUrl ? (
          <a
            href={ruetProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-[15px] text-ink underline ${FOCUS_RING}`}
          >
            View profile on the RUET website
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
      </div>

      {showWriteReview ? (
        <Button as="link" href={`/review/new?teacher=${slug}`}>
          Write a review
        </Button>
      ) : capMessage ? (
        // In place of the button, not beside it. Hiding the button is a
        // courtesy; submitReview refuses the same request on the server.
        <p className="max-w-[60ch] text-[13px] text-slate md:text-[15px]">{capMessage}</p>
      ) : null}
    </div>
  )
}
