import Link from 'next/link'
import { LIFT_TEXT } from './lift'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export type SectionHeaderProps = {
  title: string
  href: string
  linkLabel: string
}

/**
 * The motif that ties the page together: a short gold rule, the heading under
 * it, and the section's link pushed to the right of the same line.
 *
 * THE RULE IS THE ONLY GOLD IN THE BODY OF THE PAGE. The same accent token as
 * the line under the header and the one above the footer, so the three agree.
 * Nothing else here is gold — not the star on a rating, not a hover state.
 *
 * Left aligned, like everything else on the page and like the footer. A
 * centred heading here would be the one thing out of line.
 */
export function SectionHeader({ title, href, linkLabel }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* 32x3. Not a border on the heading: a separate element is the only
          way to get a rule that is shorter than the text above it. */}
      <div className="h-[3px] w-8 bg-accent" aria-hidden="true" />

      {/* items-baseline, so the heading and the link sit on the same line
          however different their sizes are. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-[20px] leading-[1.2] font-bold text-ink sm:text-[24px]">
          {title}
        </h2>

        <Link
          href={href}
          className={`inline-flex min-h-11 items-center gap-1 text-[13px] text-slate hover:text-ink hover:underline active:text-ink active:underline sm:text-[15px] ${LIFT_TEXT} ${FOCUS_RING}`}
        >
          {linkLabel}
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </div>
  )
}
