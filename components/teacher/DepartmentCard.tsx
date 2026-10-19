import Link from 'next/link'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export type DepartmentCardProps = {
  slug: string
  nameEn: string
  shortCode: string
  teacherCount: number
}

export function DepartmentCard({
  slug,
  nameEn,
  shortCode,
  teacherCount,
}: DepartmentCardProps) {
  return (
    <Link
      href={`/departments/${slug}`}
      // Resting at rest, raised on hover. hover:bg-mist is kept exactly as it
      // was: the lift is in addition to the colour change, not instead of it.
      // transition-shadow so it reads as a response rather than a jump, and
      // motion-reduce turns that off for anyone who asked for less movement.
      className={`flex flex-col gap-1 rounded-card border border-line bg-paper p-4 shadow-resting transition-shadow hover:bg-mist hover:shadow-raised active:bg-mist motion-reduce:transition-none md:p-6 ${FOCUS_RING}`}
    >
      {/* Three lines, each starting at the left edge. Inline after the code
          gave the name a ragged hanging indent whenever it wrapped. */}
      <span className="flex flex-col gap-1">
        <span className="text-[15px] font-bold text-ink sm:text-[28px] sm:leading-[1.2]">
          {shortCode}
        </span>
        <span className="text-[13px] text-slate sm:text-[15px] sm:text-ink">
          {nameEn}
        </span>
      </span>

      <span className="text-[13px] text-slate">
        {teacherCount === 1 ? '1 teacher' : `${teacherCount} teachers`}
      </span>
    </Link>
  )
}
