import { unstable_cache } from 'next/cache'
import { compareDepartments, compareTeachersInDepartment } from '@/lib/ordering'
import { weightedRating } from '@/lib/ranking'
import { getSiteMeanRating } from '@/server/ranking'
import { getSetting } from '@/server/settings'
import type { DepartmentSort } from '@/lib/department-sort'
import { prisma } from '@/lib/prisma'
import { PUBLIC_CACHE_REVALIDATE_SECONDS, TEACHER_LIST_TAG } from '@/server/public-cache'

export type DepartmentWithCount = {
  id: string
  slug: string
  nameEn: string
  nameBn: string | null
  shortCode: string
  teacherCount: number
}

export type DepartmentTeacher = {
  slug: string
  nameEn: string
  nameBn: string | null
  designation: string
  isHead: boolean
  imageUrl: string | null
  avgOverall: number | null
  reviewCount: number
  // Distinct students. The display threshold counts these, not reviews.
  studentCount: number
  departmentShortCode: string
}

export type DepartmentDetail = DepartmentWithCount & {
  teachers: DepartmentTeacher[]
}

// CACHED ACROSS REQUESTS for an hour in the shared Data Cache. Departments
// and their teacher counts change only through scripts, so time is the only
// expiry; nothing in the app writes them. Public data only: nothing below may
// read cookies, headers or the session.
export const getDepartments = unstable_cache(readDepartments, ['departments'], {
  revalidate: 3600,
  tags: ['departments'],
})

async function readDepartments(): Promise<DepartmentWithCount[]> {
  // The count comes from _count, not a second query per department.
  const rows = await prisma.department.findMany({
    where: { isActive: true },
    // A tie-break only. The real order is compareDepartments() below, which
    // Prisma cannot express: an arbitrary sequence of 14 short codes is not
    // something you can write as an orderBy.
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameBn: true,
      shortCode: true,
      _count: { select: { teachers: { where: { isActive: true } } } },
    },
  })

  // Sorted here, not in SQL. These are 18 rows the page loads in full
  // either way, so there is nothing to save by pushing it down.
  return rows
    .map(({ _count, ...department }) => ({
      ...department,
      teacherCount: _count.teachers,
    }))
    .sort(compareDepartments)
}

/**
 * The department's name, for generateMetadata only.
 *
 * Its own query because the page calls getDepartmentBySlug(slug, sort) and
 * metadata called it with no sort, so the two never shared a result: every
 * visit loaded and sorted the whole teacher list twice. Same `where` as
 * getDepartmentBySlug, so the two agree on what exists.
 */
export async function getDepartmentMetaBySlug(
  slug: string
): Promise<{ nameEn: string } | null> {
  return prisma.department.findFirst({
    where: { slug, isActive: true },
    select: { nameEn: true },
  })
}

// Thrown, not returned, so a miss is never stored: unstable_cache does not
// keep a throw. An unknown slug costs one query and still 404s.
class DepartmentNotFound extends Error {}

/**
 * One department and its whole sorted teacher list.
 *
 * SHARED ACROSS REQUESTS per (slug, sort): unstable_cache, tag teacher-list,
 * dropped whenever a rating is recalculated. The page and every "Load more"
 * batch slice this same cached array, so the department is no longer read
 * and re-sorted on each click.
 *
 * Stored: DepartmentDetail -- id, slug, nameEn, nameBn, shortCode,
 * teacherCount, and per teacher slug, nameEn, nameBn, designation, isHead,
 * imageUrl, avgOverall, reviewCount, studentCount, departmentShortCode. All
 * of it is on the public card.
 *
 * min_students_for_display is read OUT HERE and made part of the key, so the
 * admin setting still takes effect at once (it only matters to 'rating').
 */
export async function getDepartmentBySlug(
  slug: string,
  // OPTIONAL, defaulting to the page's own order. generateMetadata and any
  // other caller pass nothing and get exactly what they got before.
  sort: DepartmentSort = 'default'
): Promise<DepartmentDetail | null> {
  const minStudentsForDisplay =
    sort === 'rating' ? Number(await getSetting('min_students_for_display')) : 0

  try {
    return await unstable_cache(
      () => readDepartmentBySlug(slug, sort, minStudentsForDisplay),
      ['department-teachers', slug, sort, String(minStudentsForDisplay)],
      { revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS, tags: [TEACHER_LIST_TAG] }
    )()
  } catch (error) {
    if (error instanceof DepartmentNotFound) return null
    throw error
  }
}

async function readDepartmentBySlug(
  slug: string,
  sort: DepartmentSort,
  minStudentsForDisplay: number
): Promise<DepartmentDetail> {
  const department = await prisma.department.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameBn: true,
      shortCode: true,
      _count: { select: { teachers: { where: { isActive: true } } } },
      teachers: {
        where: { isActive: true },
        // Head first and names in order are what SQL can do. The seniority
        // step needs the designation text normalised before it can be
        // ranked, so compareTeachersInDepartment() finishes the job below on
        // the rows of this one department.
        orderBy: [{ isHead: 'desc' }, { nameEn: 'asc' }],
        select: {
          slug: true,
          nameEn: true,
          nameBn: true,
          designation: true,
          isHead: true,
          imageUrl: true,
          avgOverall: true,
          reviewCount: true,
          studentCount: true,
        },
      },
    },
  })

  if (!department) throw new DepartmentNotFound()

  const { _count, teachers, ...rest } = department

  const detail: DepartmentDetail = {
    ...rest,
    teacherCount: _count.teachers,
    teachers: teachers
      .map((teacher) => ({
        ...teacher,
        // Prisma returns Decimal. A Server Component cannot pass that to a
        // client, and nothing here needs more than two decimal places.
        avgOverall: teacher.avgOverall === null ? null : Number(teacher.avgOverall),
        departmentShortCode: rest.shortCode,
      }))
      // Head, then seniority, then rating, then name. One department's
      // teachers are already loaded in full, so this sorts what is here and
      // never pulls extra rows to do it.
      //
      // THE SLUG IS THE TIE-BREAKER, and the page below is batched, which is
      // what makes it matter. compareTeachersInDepartment ends at the name,
      // so two teachers with the SAME name compare equal and their order
      // would be decided by whatever Prisma happened to return. Batch 2 could
      // then repeat one of them and skip the other. Slugs are unique, so
      // adding one here makes the order total.
      .sort((a, b) => compareTeachersInDepartment(a, b) || a.slug.localeCompare(b.slug)),
  }

  if (sort === 'default') return detail

  // READ ONLY WHEN NEEDED. 'reviews' sorts on a column already in hand, so
  // this does not run for it, and 'default' never reaches here at all. The
  // display threshold arrives as an argument (see getDepartmentBySlug).
  const siteMean = sort === 'rating' ? await getSiteMeanRating() : null

  return {
    ...detail,
    teachers: orderForSort(detail.teachers, sort, { siteMean, minStudentsForDisplay }),
  }
}

/**
 * Re-orders one department's already-ordered list for a chosen sort.
 *
 * THE DEFAULT IS UNTOUCHED. 'default' returns the array exactly as
 * getDepartmentBySlug built it -- head, then seniority, then rating, then
 * name, with the slug tiebreak. A student sees that until they choose
 * otherwise, and nothing below runs.
 *
 * EVERY SORT STAYS TOTAL. Each comparator falls through to
 * compareTeachersInDepartment and then the slug, which is unique, so no two
 * teachers ever compare equal. That is not tidiness: the list is served in
 * batches of fifteen cut from this array, and two teachers comparing equal
 * means Postgres' row order decides which batch they land in -- one can
 * appear twice while another is skipped.
 */
function orderForSort(
  teachers: DepartmentTeacher[],
  sort: DepartmentSort,
  context: { siteMean: number | null; minStudentsForDisplay: number }
): DepartmentTeacher[] {
  if (sort === 'default') return teachers

  const rest = (a: DepartmentTeacher, b: DepartmentTeacher) =>
    compareTeachersInDepartment(a, b) || a.slug.localeCompare(b.slug)

  if (sort === 'reviews') {
    return [...teachers].sort((a, b) => b.reviewCount - a.reviewCount || rest(a, b))
  }

  // ---- 'rating' ----
  //
  // No teacher on the site has a rating yet, so there is no C to shrink
  // towards and no meaningful order to produce. Fall back rather than invent
  // a mean.
  if (context.siteMean === null) return teachers

  const siteMean = context.siteMean

  // RULE: a teacher whose rating is WITHHELD must not sort above one whose
  // rating is shown.
  //
  // min_students_for_display is 4. A teacher with two students and a 5.00
  // has their number hidden on the card -- but if they sorted to the top of
  // "highest rated", anyone could infer it was high. The ordering would leak
  // exactly what the display refuses to show. So there are two tiers and the
  // shown ones come first, always.
  //
  // This also handles unrated teachers: avgOverall IS NULL means no
  // published reviews, so they are never in the first tier and can never
  // lead the list. That is the NULLS LAST rule, enforced by tiering rather
  // than by trusting a SQL default -- Postgres sorts NULL as LARGER, so a
  // plain ORDER BY avgOverall DESC would put every unrated teacher first and
  // a student choosing "highest rated" would see a screen of "No rating
  // yet".
  const isDisplayed = (t: DepartmentTeacher) =>
    t.avgOverall !== null && t.studentCount >= context.minStudentsForDisplay

  return [...teachers].sort((a, b) => {
    const aShown = isDisplayed(a)
    const bShown = isDisplayed(b)

    if (aShown !== bShown) return aShown ? -1 : 1

    // Within the shown tier, the SAME weighted score the home page's Top
    // rated block uses -- imported, never re-derived, so the two pages
    // cannot disagree about who is best. It decides order only and is never
    // returned; the card still shows the teacher's real average.
    if (aShown && bShown) {
      const scored =
        weightedRating(a.avgOverall as number, a.studentCount, siteMean) -
        weightedRating(b.avgOverall as number, b.studentCount, siteMean)

      if (scored !== 0) return -scored
    }

    // The withheld tier keeps the page's normal order, and that order is NOT
    // rating-free: compareTeachersInDepartment orders by seniority and THEN
    // by rating (lib/ordering.ts step c). So within one designation, a
    // withheld teacher's position still carries a hint of their rating.
    //
    // That is pre-existing -- it is exactly what the default view has always
    // done -- so this sort adds no new inference. It is recorded here rather
    // than glossed over: closing it means ordering this tier by name alone,
    // which is a change to the default view too and therefore a separate
    // decision.
    return rest(a, b)
  })
}

/** How many teachers a department page shows before "Load more". */
export const DEPARTMENT_PAGE_SIZE = 15

/**
 * One batch of a department's teachers, in the page's own order.
 *
 * IT SLICES THE SAME ORDERED LIST THE PAGE BUILT, which is why the batches
 * cannot disagree with each other. The order cannot be done in SQL: the
 * seniority step ranks normalised designation text, so the rows have to be in
 * memory before they can be sorted — skip/take in the query would hand back
 * fifteen rows ordered by name and then sort only those, which is a different
 * list every time.
 *
 * The cost of re-reading one department is one indexed query over at most 66
 * rows. The saving this exists for is the fifty photos the BROWSER no longer
 * downloads, not database work.
 */
export async function getDepartmentTeachersPage(
  slug: string,
  skip: number,
  // THE SAME SORT THE PAGE USED. Without it batch 2 would be the next
  // fifteen of the DEFAULT order while batch 1 was sorted -- teachers
  // repeating and others never appearing.
  sort: DepartmentSort = 'default'
): Promise<DepartmentTeacher[]> {
  const department = await getDepartmentBySlug(slug, sort)
  if (!department) return []

  return department.teachers.slice(skip, skip + DEPARTMENT_PAGE_SIZE)
}
