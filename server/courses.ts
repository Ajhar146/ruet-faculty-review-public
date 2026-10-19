import type { Course } from '@/lib/types'
import {
  courseSearchWhere,
  departmentForPrefix,
  prefixesForDepartment,
} from '@/lib/courses'
import { prisma } from '@/lib/prisma'

// At most eight rows under the box. More than that is a list to read, not
// a suggestion to pick.
export const SUGGESTION_LIMIT = 8

export type CourseOption = {
  code: string
  name: string
  // Null for the year-long courses: thesis, capstone, training.
  semester: string | null
  // PUBLISHED reviews of this course for the teacher being reviewed.
  reviewCount: number
}

/**
 * The two gates a course has to pass, as one Prisma filter:
 *
 *   a. it is in the student's department curriculum
 *   b. it is taught by the teacher's department
 *
 * Returns null when nothing can pass, so the caller stops early.
 *
 * FALLBACK: a department with no DepartmentCourse rows yet (ChE and CME
 * today) falls back to the old prefix rule for (a). Their students are not
 * locked out while their curriculum is missing.
 */
export async function curriculumWhere(
  departmentId: string,
  teacherDeptShortCode: string
): Promise<Record<string, unknown> | null> {
  // Short codes are mixed case in the database. Uppercase both sides.
  const teacherDepartment = teacherDeptShortCode.trim().toUpperCase()

  const curriculumRows = await prisma.departmentCourse.count({
    where: { departmentId },
  })

  if (curriculumRows > 0) {
    return {
      isActive: true,
      // (b) ME also teaches MES, IPE also teaches IPES, CME also GCE.
      prefix: { in: prefixesForDepartment(teacherDepartment) },
      // (a) the real curriculum, course by course.
      departments: { some: { departmentId } },
    }
  }

  const allowed = await prisma.departmentCoursePrefix.findMany({
    where: { departmentId },
    select: { prefix: true },
  })

  // Filtering the allowed prefixes by the mapping satisfies (a) and (b) at
  // once: what the student may review, narrowed to what this teacher teaches.
  const prefixes = allowed
    .map((row) => row.prefix)
    .filter((prefix) => departmentForPrefix(prefix).toUpperCase() === teacherDepartment)

  if (prefixes.length === 0) return null

  return { isActive: true, prefix: { in: prefixes } }
}

/**
 * For the course picker.
 *
 * Courses already reviewed for THIS teacher come first, most reviewed first,
 * because those are the ones the student is most likely to want. An empty
 * query returns only those, so the list is useful before any typing.
 */
export async function suggestCourses(
  departmentId: string,
  query: string,
  teacherDeptShortCode: string,
  teacherId: string
): Promise<CourseOption[]> {
  const where = await curriculumWhere(departmentId, teacherDeptShortCode)
  if (!where) return []

  const term = query.trim()

  // Which courses this teacher already has reviews for, and how many.
  // Only PUBLISHED and not deleted, the same rule ratings use.
  const reviewed = await prisma.review.groupBy({
    by: ['courseId'],
    where: { teacherId, status: 'PUBLISHED', deletedAt: null },
    _count: { _all: true },
  })

  const counts = new Map(reviewed.map((row) => [row.courseId, row._count._all]))
  const reviewedIds = [...counts.keys()]

  // The rule itself lives in lib/courses.ts, where it can be tested without
  // a database. "CSE41" and "CSE 4101" go through the same prefix match.
  const matches: Record<string, unknown> = courseSearchWhere(term)

  const reviewedRows =
    reviewedIds.length > 0
      ? await prisma.course.findMany({
          where: { ...where, ...matches, id: { in: reviewedIds } },
          take: SUGGESTION_LIMIT,
          select: { id: true, code: true, name: true, semester: true },
        })
      : []

  const top: CourseOption[] = reviewedRows
    .map((course) => ({
      code: course.code,
      name: course.name,
      semester: course.semester,
      reviewCount: counts.get(course.id) ?? 0,
    }))
    .sort((a, b) => b.reviewCount - a.reviewCount || a.code.localeCompare(b.code))

  // An empty query shows what has been reviewed for this teacher and nothing
  // else. No reviews yet means an empty list, as before.
  if (term.length === 0) return top

  const remaining = SUGGESTION_LIMIT - top.length
  if (remaining <= 0) return top

  const others = await prisma.course.findMany({
    where: {
      ...where,
      ...matches,
      ...(reviewedIds.length > 0 ? { id: { notIn: reviewedIds } } : {}),
    },
    orderBy: { code: 'asc' },
    take: remaining,
    select: { code: true, name: true, semester: true },
  })

  return [...top, ...others.map((course) => ({ ...course, reviewCount: 0 }))]
}

/**
 * Every course is imported from the real curriculum, so a code either
 * exists or the student picked something we do not have. Nobody creates a
 * course by typing any more.
 */
export async function findCourseByCode(code: string): Promise<Course | null> {
  // findFirst, not findUnique: a course an admin deactivated must not be
  // reviewable by typing its code, even though the code is still unique.
  return prisma.course.findFirst({ where: { code, isActive: true } })
}
