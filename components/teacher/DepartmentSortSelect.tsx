'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import {
  DEPARTMENT_SORTS,
  DEPARTMENT_SORT_LABELS,
  type DepartmentSort,
} from '@/lib/department-sort'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// The same field metrics FilterBar uses, copied as four utility classes
// rather than by importing that component.
//
// NOT FilterBar ITSELF. It hardcodes action="/teachers" and a Department
// select that would do nothing inside a department, and making it
// configurable would put the teachers page at risk for no gain here. One
// select that writes the URL is the whole requirement.
//
// h-11 is 44px, the tap-target floor in section 8b part 5. text-[16px] on a
// phone because anything smaller makes iOS zoom the page in when the select
// is tapped, and never zoom back out.
const FIELD =
  `h-11 w-full rounded-control border border-line bg-paper px-3 py-0 text-[16px] text-ink shadow-resting sm:w-auto md:text-[15px] ${FOCUS_RING}`

export type DepartmentSortSelectProps = {
  value: DepartmentSort
  className?: string
}

/**
 * One select that puts the chosen sort in the URL.
 *
 * THE URL IS THE STATE. A reload keeps the sort and the link can be sent to
 * someone else, which a component-local useState could not do. It is also
 * what makes the server the only thing that orders teachers -- the browser
 * never re-sorts a list it was given.
 *
 * router.replace, not push: choosing a sort is adjusting the current view,
 * not navigating somewhere new, so Back should leave the department rather
 * than walk through every sort the student tried.
 *
 * The default is written as an ABSENT param rather than ?sort=default, so
 * the normal view has a clean URL and the one a student shares says only
 * what they actually changed.
 */
export function DepartmentSortSelect({ value, className = '' }: DepartmentSortSelectProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function choose(next: string) {
    // Rebuilt from the current params, so anything else in the URL survives.
    const query = new URLSearchParams(params.toString())

    if (next === 'default') query.delete('sort')
    else query.set('sort', next)

    const search = query.toString()

    startTransition(() => {
      router.replace(search ? `?${search}` : '?', { scroll: false })
    })
  }

  return (
    // DESKTOP ONLY NOW. The phone gets the Sort sheet instead, so this no
    // longer needs to stack or to position itself -- the row it sits in
    // handles placement, and the row is inside Container, which owns the
    // gutter. No px of its own.
    <div className={`flex items-center gap-3 ${className}`}>
      <label htmlFor="department-sort" className="shrink-0 text-[15px] font-medium text-ink">
        Sort by
      </label>

      <select
        id="department-sort"
        name="sort"
        value={value}
        disabled={pending}
        onChange={(event) => choose(event.target.value)}
        className={FIELD}
      >
        {DEPARTMENT_SORTS.map((option) => (
          <option key={option} value={option}>
            {DEPARTMENT_SORT_LABELS[option]}
          </option>
        ))}
      </select>
    </div>
  )
}
