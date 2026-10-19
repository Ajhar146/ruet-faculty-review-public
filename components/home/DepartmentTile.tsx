import Link from 'next/link'
import { LIFT } from './lift'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export type DepartmentTileProps = {
  slug: string
  shortCode: string
  nameEn: string
  teacherCount: number
}

/**
 * THE CODE IS THE DESIGN.
 *
 * CSE, EEE, ME are good typography on their own and they belong to this site,
 * so the short code carries the whole card and nothing else has to. The full
 * name is support, not the subject.
 *
 * EQUAL HEIGHTS. h-full plus a flex column, with the count pushed down by
 * mt-auto, so a two-line department name does not make one card taller than
 * the two beside it. line-clamp-2 is the other half: a name long enough for a
 * third line is cut rather than allowed to set the row height.
 */
export function DepartmentTile({
  slug,
  shortCode,
  nameEn,
  teacherCount,
}: DepartmentTileProps) {
  return (
    <Link
      href={`/departments/${slug}`}
      className={`flex h-full flex-col gap-1 rounded-card border border-line bg-paper p-4 md:p-6 ${LIFT} ${FOCUS_RING}`}
    >
      {/* The dominant element. 22px on a phone, 28px from sm — the "big
          section heading" step, which is the largest the scale has below a
          page title. */}
      <span className="text-[22px] leading-[1.2] font-bold text-ink sm:text-[28px]">
        {shortCode}
      </span>

      <span className="line-clamp-2 text-[13px] text-slate">{nameEn}</span>

      {/* mt-auto is what makes the bottom line sit on the bottom of every card
          in the row rather than directly under a name of whatever length. */}
      <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] text-slate">
        {teacherCount === 1 ? '1 teacher' : `${teacherCount} teachers`}
        <span aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  )
}
