import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container } from '@/components/layout/Container'
import { DepartmentTeacherList } from '@/components/teacher/DepartmentTeacherList'
import { DepartmentSortSelect } from '@/components/teacher/DepartmentSortSelect'
import {
  FilterBar,
  FILTER_FIELD_CLASS,
  FILTER_LABEL_CLASS,
} from '@/components/teacher/FilterBar'
import { SearchBar } from '@/components/teacher/SearchBar'
import { EmptyState } from '@/components/ui'
import {
  DEPARTMENT_PAGE_SIZE,
  getDepartmentBySlug,
  getDepartmentMetaBySlug,
} from '@/server/departments'
import { getSetting } from '@/server/settings'
import {
  DEPARTMENT_SORTS,
  DEPARTMENT_SORT_LABELS,
  parseDepartmentSort,
} from '@/lib/department-sort'

type DepartmentPageProps = {
  params: Promise<{ slug: string }>
  // NEW. This page had no URL state at all before the sort.
  searchParams: Promise<{ sort?: string }>
}

export async function generateMetadata({
  params,
}: DepartmentPageProps): Promise<Metadata> {
  const department = await getDepartmentMetaBySlug((await params).slug)
  if (!department) return {}

  return {
    title: `${department.nameEn} | RUET Faculty Review`,
  }
}

export default async function DepartmentPage({
  params,
  searchParams,
}: DepartmentPageProps) {
  // Anything unrecognised falls back to the page's own order rather than
  // erroring, so an edited or stale ?sort= is harmless.
  const sort = parseDepartmentSort((await searchParams).sort)

  const department = await getDepartmentBySlug((await params).slug, sort)

  // An unknown slug is a 404, never a blank page.
  if (!department) notFound()

  const minStudentsForDisplay = Number(await getSetting('min_students_for_display'))

  return (
    <main>
      <Container className="py-8 md:py-20">
        <div className="flex flex-col gap-3">
          <h1 className="text-[24px] leading-[1.2] font-bold text-ink sm:text-[32px] md:text-[48px]">
            {department.nameEn}
          </h1>

          {department.nameBn ? (
            <p className="bn text-[16px] text-ink">{department.nameBn}</p>
          ) : null}

          <p className="text-[13px] text-slate md:text-[16px]">
            {department.shortCode} ·{' '}
            {department.teacherCount === 1
              ? '1 teacher'
              : `${department.teacherCount} teachers`}
          </p>
        </div>

        {/* Searching here keeps the student in this department: the hidden
            dept field lands them on /teachers?q=...&dept=<slug>. */}
        {/* ONE ROW AT EVERY WIDTH, inside the same Container as the heading
            above and the cards below, with no px of its own -- so its left
            and right edges are theirs exactly.

            PHONE:   [ search ][icon][ Sort ]
            DESKTOP: [ search ][Search]        Sort by [ select ]

            items-center so the input, the button and the select share a
            centre line. sm: is the breakpoint SearchBar and FilterBar
            already switch on; no new one is introduced. */}
        <div className="mt-6 flex items-center gap-2 sm:gap-3 md:mt-8">
          {/* NO MAX WIDTH. There was a sm:max-w-[560px] here and it was the
              mistake: the input stopped at 560px while ml-auto below shoved
              the sort control to the far right, leaving ~376px of nothing
              between them on a wide screen. The input flexes freely again.

              min-w-0 stays. It is what lets the input shrink BELOW its
              placeholder at 360px instead of pushing the buttons off the
              edge, and it is doing a different job from the cap. */}
          <SearchBar
            dept={department.slug}
            placeholder={`Search teachers in ${department.nameEn}`}
            className="min-w-0 flex-1"
          />

          {department.teachers.length > 0 ? (
            <>
              {/* PHONE: the same sheet /teachers uses, as the same component
                  in its sheetOnly configuration -- not a second copy. It
                  hides itself from sm.

                  "Sort", not "Filters": there is one control here and it
                  sorts. The count beside it is marked exactly as /teachers
                  marks active filters, so the two pages read as one site. */}
              <FilterBar
                sheetOnly
                id="department-sort-sheet"
                action={`/departments/${department.slug}`}
                triggerLabel="Sort"
                activeCount={sort === 'default' ? 0 : 1}
                sort={sort}
                className="shrink-0"
              >
                <div className="flex flex-col gap-2">
                  <label htmlFor="sheet-sort" className={FILTER_LABEL_CLASS}>
                    Sort by
                  </label>
                  <select
                    id="sheet-sort"
                    name="sort"
                    defaultValue={sort}
                    className={FILTER_FIELD_CLASS}
                  >
                    {DEPARTMENT_SORTS.map((option) => (
                      <option key={option} value={option}>
                        {DEPARTMENT_SORT_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>
              </FilterBar>

              {/* DESKTOP: no ml-auto, no justify-between, no spacer. The
                  three controls are one group in source order, separated
                  only by the row's own gap -- the same gap that already
                  sits between the input and the Search button. The sort
                  control simply follows the Search button. */}
              <div className="hidden shrink-0 sm:block">
                <DepartmentSortSelect value={sort} />
              </div>
            </>
          ) : null}
        </div>

        {department.teachers.length === 0 ? (
          <div className="mt-8 md:mt-12">
            <EmptyState
              heading="No teachers listed"
              message="This department has no teachers in the database yet."
            />
          </div>
        ) : (
          /* FIFTEEN IN THE HTML, the rest behind the button. A department with
             66 teachers used to put 66 photos on one page, which on mobile
             data is slow and costs the student money.

             The whole ordered list is still built on the server — the
             seniority step cannot be done in SQL — so this slice and every
             later batch come out of the same array and cannot disagree. */
          <DepartmentTeacherList
            // KEYED ON THE SORT. Changing it remounts this component, which
            // drops the batches already loaded and starts again from the
            // first fifteen. Without the key React keeps the old `extra`
            // state and the new order would have the previous sort's rows
            // appended to it.
            key={sort}
            slug={department.slug}
            sort={sort}
            initial={department.teachers.slice(0, DEPARTMENT_PAGE_SIZE)}
            total={department.teacherCount}
            minStudentsForDisplay={minStudentsForDisplay}
          />
        )}
      </Container>
    </main>
  )
}
