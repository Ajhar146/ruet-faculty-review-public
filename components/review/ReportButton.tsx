'use client'

import { useState } from 'react'
import { ReportModal } from '@/components/review/ReportModal'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export type ReportButtonProps = {
  reviewId: string
}

/**
 * The quiet link at the bottom of a review card.
 *
 * It is told the review id and nothing else. It never knows who wrote the
 * review, how many reports it has, or whether this reader has already
 * reported it. The page cannot leak what it was never given.
 */
export function ReportButton({ reviewId }: ReportButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* 44px TALL, STILL A LINK.
          It was a bare text link, so on a phone it was about 18px of tap
          target next to vote buttons that are correctly 44px -- well under
          the floor section 8b part 5 sets ("not 40, not 36").

          min-h-11 gives it the height. px-2.5 matches the vote buttons'
          horizontal padding so the tap area is comparable, and -mx-2.5
          cancels that padding in the LAYOUT: the box grows outward for a
          thumb while the text stays exactly where it was. That is what
          keeps 1280px pixel-identical -- the row there is already 44px tall
          because of the vote buttons, so the new height changes nothing
          either.

          STILL VISUALLY A LINK, deliberately: slate, underlined, no border
          and no background. Reporting a review and disagreeing with one are
          different acts, and the bordered vote buttons beside it must not
          be mistaken for the same control. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`-mx-2.5 inline-flex min-h-11 shrink-0 items-center px-2.5 text-[13px] text-slate underline ${FOCUS_RING}`}
      >
        Report
      </button>

      <ReportModal open={open} onClose={() => setOpen(false)} reviewId={reviewId} />
    </>
  )
}
