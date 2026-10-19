'use client'

import { useState, useTransition } from 'react'
import { loadMoreDepartmentTeachers } from '@/app/actions/department-teachers'
import type { DepartmentSort } from '@/lib/department-sort'
import { TeacherCard } from '@/components/teacher/TeacherCard'
import { Button } from '@/components/ui'
import type { DepartmentTeacher } from '@/server/departments'

export type DepartmentTeacherListProps = {
  slug: string
  /** The first batch, rendered on the server. */
  initial: DepartmentTeacher[]
  /** Every active teacher in the department, not how many are loaded. */
  total: number
  minStudentsForDisplay: number
  /**
   * The sort the page rendered with, forwarded to the Load more action so
   * batch 2 continues this list rather than the default one.
   *
   * The page also KEYS this component on it, so changing the sort remounts
   * and the accumulated batches reset to the first fifteen.
   */
  sort: DepartmentSort
}

/**
 * A department's teachers, fifteen at a time.
 *
 * THE SAME SHAPE AS THE COURSE REVIEWS on a teacher's profile: a server
 * action, a button that says how many are left, a loading state, and the
 * button gone once everything is shown. Two load-more patterns on one site
 * would be worse than either.
 *
 * ONE NUMBER FOR BOTH WIDTHS. The server cannot know the screen size, and
 * sending a different batch to a phone would mean the list behaved
 * differently depending on where it was opened.
 *
 * THE ORDER IS SETTLED ON THE SERVER. Each batch is a slice of the same
 * ordered list, and that order ends at the slug, which is unique — so no
 * teacher can arrive twice while another is skipped. See
 * getDepartmentTeachersPage.
 */
export function DepartmentTeacherList({
  slug,
  initial,
  total,
  minStudentsForDisplay,
  sort,
}: DepartmentTeacherListProps) {
  const [extra, setExtra] = useState<DepartmentTeacher[]>([])
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()

  // Belt and braces. The ordering is total, but a duplicate slug must never
  // render twice if one ever appeared.
  const seen = new Set(initial.map((teacher) => teacher.slug))
  const shown = [
    ...initial,
    ...extra.filter((teacher) => {
      if (seen.has(teacher.slug)) return false
      seen.add(teacher.slug)
      return true
    }),
  ]

  const remaining = Math.max(0, total - shown.length)

  function loadMore() {
    setFailed(false)

    startTransition(async () => {
      try {
        const result = await loadMoreDepartmentTeachers({ slug, skip: shown.length, sort })

        if (!result.ok || result.teachers.length === 0) {
          // A refusal and an empty batch both mean "not now". The button
          // stays, so the reader can try again rather than being stuck.
          setFailed(true)
          return
        }

        setExtra((current) => [...current, ...result.teachers])
      } catch {
        // Offline, or a 500.
        setFailed(true)
      }
    })
  }

  return (
    <>
      {/* The same grid the page has always used: a divided list on a phone,
          two columns of cards from md. */}
      <div className="mt-4 grid grid-cols-1 divide-y divide-line md:mt-12 md:grid-cols-2 md:gap-4 md:divide-y-0">
        {shown.map((teacher) => (
          <TeacherCard
            key={teacher.slug}
            {...teacher}
            minStudentsForDisplay={minStudentsForDisplay}
          />
        ))}
      </div>

      {remaining > 0 ? (
        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="ghost"
            loading={pending}
            onClick={loadMore}
            // Ghost is a text link that needs a tap target, so no horizontal
            // padding here; min-h-11 comes from Button itself.
            className="self-start px-0"
          >
            {pending
              ? 'Loading teachers…'
              : `Load ${Math.min(remaining, 15)} more of ${remaining}`}
          </Button>

          {failed ? (
            <p className="text-[13px] text-slate">
              Could not load more teachers. Try again.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
