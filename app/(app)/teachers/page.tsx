import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/layout/Container'
import { FilterBar } from '@/components/teacher/FilterBar'
import { SearchBar } from '@/components/teacher/SearchBar'
import { TeacherCard } from '@/components/teacher/TeacherCard'
import { Alert, Button, EmptyState, Pagination } from '@/components/ui'
import { getCurrentUser } from '@/lib/auth'
import { hitLimit, rateLimitMessage } from '@/lib/rate-limit'
import { getDepartments } from '@/server/departments'
import { getSetting } from '@/server/settings'
import { searchTeachers } from '@/server/teachers'
import { parseSearchParams } from '@/validators/search'

export const metadata: Metadata = {
  title: 'Teachers | RUET Faculty Review',
}

type TeachersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TeachersPage({ searchParams }: TeachersPageProps) {
  const params = parseSearchParams(await searchParams)

  // Only a SEARCH is limited, not browsing. Paging through the catalogue is
  // an indexed read; a query is a LIKE across 471 rows plus a count, which
  // is the expensive thing a scraper would walk.
  //
  // Checked before the query runs, so a blocked request costs nothing.
  const user = await getCurrentUser()
  const searchBlocked =
    params.q !== undefined && params.q.length > 0 && user !== null
      ? await hitLimit('search', user.id)
      : false

  const [result, departments, threshold] = await Promise.all([
    // A blocked search returns the unfiltered first page rather than an
    // error page: the message below says what happened, and the rest of the
    // page still works.
    searchTeachers(searchBlocked ? { ...params, q: undefined, page: 1 } : params),
    getDepartments(),
    getSetting('min_students_for_display'),
  ])

  const minStudentsForDisplay = Number(threshold)

  // The department list is already loaded for the filter, so the cards
  // get their short code from here instead of a second database query.
  const shortCodeById = new Map(departments.map((d) => [d.id, d.shortCode]))

  // A page number past the end counts too: there is nothing to show and
  // the way out is the same button.
  const isFiltered = Boolean(params.q || params.dept || params.page > 1)

  // Page numbers are links, so the back button works and a result page
  // can be shared. Everything else in the URL comes along.
  function hrefForPage(page: number) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.dept) query.set('dept', params.dept)
    if (params.sort !== 'name') query.set('sort', params.sort)
    if (page > 1) query.set('page', String(page))

    const queryString = query.toString()
    return queryString ? `/teachers?${queryString}` : '/teachers'
  }

  // Clearing the search keeps the department and the sort order.
  const clearSearchQuery = new URLSearchParams()
  if (params.dept) clearSearchQuery.set('dept', params.dept)
  if (params.sort !== 'name') clearSearchQuery.set('sort', params.sort)
  const clearSearchHref = clearSearchQuery.toString()
    ? `/teachers?${clearSearchQuery.toString()}`
    : '/teachers'

  return (
    <main>
      <Container className="py-8 md:py-20">
        <div className="flex flex-col gap-3">
          <h1 className="text-[24px] leading-[1.2] font-bold text-ink sm:text-[32px] md:text-[48px]">
            Teachers
          </h1>
          <p className="text-[13px] text-slate md:text-[16px]">
            Search by name, designation or department.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 md:mt-8 md:gap-4">
          {/* On a phone these share one row: the search box, and Filters
              beside it. From sm they stack as two full rows, as before. */}
          <div className="flex items-start gap-2 sm:flex-col sm:gap-4">
            {/* Its own form, above the filters. Submitting it keeps the
                department and the sort through the hidden fields. */}
            <SearchBar
              q={params.q}
              dept={params.dept}
              sort={params.sort}
              className="min-w-0 flex-1 sm:w-full sm:flex-none"
            />

            <FilterBar
              departments={departments}
              q={params.q}
              dept={params.dept}
              sort={params.sort}
              className="shrink-0 sm:w-full"
            />
          </div>

          {params.q ? (
            <p className="flex flex-wrap items-center gap-3 text-[15px] text-slate">
              <span>
                Showing results for &ldquo;<span className="text-ink">{params.q}</span>&rdquo;
              </span>
              <Link
                href={clearSearchHref}
                className="text-slate underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Clear
              </Link>
            </p>
          ) : null}
        </div>

        {searchBlocked ? (
          <div className="mt-8 md:mt-12">
            <Alert variant="warning">{rateLimitMessage('search')}</Alert>
          </div>
        ) : null}

        {result.teachers.length === 0 ? (
          <div className="mt-8 md:mt-12">
            <EmptyState
              heading="No teachers found"
              message="Try a different spelling, or clear the filters."
              action={
                isFiltered ? (
                  <Button as="link" href="/teachers">
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <p className="mt-8 text-[13px] text-slate">
              {result.total === 1 ? '1 teacher' : `${result.total} teachers`}
              {result.totalPages > 1
                ? ` · page ${result.page} of ${result.totalPages}`
                : ''}
            </p>

            <div className="mt-2 grid grid-cols-1 divide-y divide-line md:mt-4 md:grid-cols-2 md:gap-4 md:divide-y-0">
              {result.teachers.map((teacher) => (
                <TeacherCard
                  key={teacher.slug}
                  slug={teacher.slug}
                  nameEn={teacher.nameEn}
                  nameBn={teacher.nameBn}
                  designation={teacher.designation}
                  isHead={teacher.isHead}
                  imageUrl={teacher.imageUrl}
                  avgOverall={teacher.avgOverall}
                  reviewCount={teacher.reviewCount}
                  departmentShortCode={shortCodeById.get(teacher.departmentId) ?? ''}
                  studentCount={teacher.studentCount}
                  minStudentsForDisplay={minStudentsForDisplay}
                />
              ))}
            </div>

            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              hrefFor={hrefForPage}
              className="mt-8 md:mt-12"
            />
          </>
        )}
      </Container>
    </main>
  )
}
