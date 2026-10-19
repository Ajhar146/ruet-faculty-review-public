import Link from 'next/link'

export type PaginationProps = {
  page: number
  totalPages: number
  hrefFor: (page: number) => string
  className?: string
}

// px-2 on a phone, px-4 from sm. The whole control has to fit one row at
// 360px, and at 15px text "Previous" plus its old padding was 92px of the
// 312px available.
const STEP =
  'inline-flex min-h-11 items-center rounded-control border border-line bg-paper px-2 text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:px-4'

const NUMBER =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border bg-paper px-3 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

const ELLIPSIS = 'px-1 text-[15px] text-slate'

/**
 * Which page numbers to show.
 *
 * `neighbours` is how many pages either side of the current one are listed.
 * One on a wide screen, as it has always been. NONE on a phone: five 44px
 * numbers are 220px on their own, and with two buttons either side there is
 * no arrangement of 312px that fits them.
 */
function pageItems(
  page: number,
  totalPages: number,
  neighbours: number
): Array<number | 'gap'> {
  const wanted = [1, totalPages, page]

  for (let offset = 1; offset <= neighbours; offset += 1) {
    wanted.push(page - offset, page + offset)
  }

  const visible = [...new Set(wanted)]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((a, b) => a - b)

  const items: Array<number | 'gap'> = []
  let previous = 0

  for (const current of visible) {
    if (previous && current - previous > 1) items.push('gap')
    items.push(current)
    previous = current
  }

  return items
}

export function Pagination({ page, totalPages, hrefFor, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null

  const hasPrevious = page > 1
  const hasNext = page < totalPages

  // Two lists, because no single list is right at both widths. Whichever
  // one is hidden is display:none, so it is out of the accessibility tree
  // too and a screen reader is never offered the same page twice.
  function numbers(neighbours: number) {
    return pageItems(page, totalPages, neighbours).map((item, index) =>
      item === 'gap' ? (
        <span key={`gap-${index}`} className={ELLIPSIS} aria-hidden="true">
          &hellip;
        </span>
      ) : item === page ? (
        <span
          key={item}
          aria-current="page"
          className={`${NUMBER} border-ink bg-ink font-medium text-paper`}
        >
          {item}
        </span>
      ) : (
        <Link
          key={item}
          href={hrefFor(item)}
          aria-label={`Page ${item}`}
          className={`${NUMBER} border-line text-slate`}
        >
          {item}
        </Link>
      )
    )
  }

  return (
    // gap-1 on a phone, gap-2 from sm. flex-wrap stays as the safety net:
    // on something narrower than 360px this wraps rather than overflowing.
    <nav
      aria-label="Pagination"
      className={`flex flex-wrap items-center justify-center gap-1 sm:gap-2 ${className}`}
    >
      {hasPrevious ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={STEP}>
          <PreviousLabel />
        </Link>
      ) : (
        <span className={`${STEP} text-slate`} aria-disabled="true">
          <PreviousLabel />
        </span>
      )}

      <span className="flex items-center gap-1 sm:hidden">{numbers(0)}</span>
      <span className="hidden items-center gap-2 sm:flex">{numbers(1)}</span>

      {hasNext ? (
        <Link href={hrefFor(page + 1)} rel="next" className={STEP}>
          Next
        </Link>
      ) : (
        <span className={`${STEP} text-slate`} aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  )
}

/**
 * "Prev" on a phone, "Previous" from sm.
 *
 * Both are in the markup and one is hidden, the same way the teacher row
 * handles its two arrangements. The screen reader gets whichever is
 * displayed, and both say a real word rather than an arrow.
 */
function PreviousLabel() {
  return (
    <>
      <span className="sm:hidden">Prev</span>
      <span className="hidden sm:inline">Previous</span>
    </>
  )
}
