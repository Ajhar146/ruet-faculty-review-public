import { unstable_cache } from 'next/cache'
import type { ModerationDecision, ReviewStatus } from '@/lib/types'
import { prisma } from '@/lib/prisma'
import { PUBLIC_CACHE_REVALIDATE_SECONDS, teacherTag } from '@/server/public-cache'

/**
 * THE ANONYMITY RULE
 *
 * Nothing in this file selects userId on a review anyone else can see, and
 * nothing here uses include: { user: true }. The writer of a review is not
 * something the browser is ever told.
 *
 * getMyReviews filters BY userId, which is different: it reads your own
 * rows. It still never returns the column.
 */

export type PublicReview = {
  id: string
  semester: string
  ratingOverall: number
  ratingTeaching: number
  ratingClarity: number
  ratingFairness: number
  comment: string | null
  createdAt: Date
}

export type CourseReviews = {
  course: {
    code: string
    name: string
    semester: string | null
  }
  avgOverall: number
  avgTeaching: number
  avgClarity: number
  avgFairness: number
  reviewCount: number
  // Distinct students behind those reviews. The display threshold counts
  // this, so three reviews from one student do not switch a rating on.
  studentCount: number
  // Newest first, at most three. reviewCount is the real total.
  reviews: PublicReview[]
}

// Only these ever count. A pending or hidden review is not public.
const PUBLIC = { status: 'PUBLISHED', deletedAt: null } as const

// TWO comments per course card. The card's job is to show what people said
// without becoming the whole page; the rest arrive ten at a time behind the
// button. It was three when the block was a heading and a list.
const PREVIEW_PER_COURSE = 2

/** How many reviews one press of "Show all" adds. */
export const REVIEW_BATCH = 10

/**
 * THE COLUMNS A REVIEW IS ALLOWED TO LEAVE THIS FILE WITH.
 *
 * One list, used by the previews and by the paged loader, so "no userId" is
 * a thing you check in a single place instead of auditing every query. There
 * is no userId here and there never will be.
 */
const PUBLIC_REVIEW_SELECT = {
  id: true,
  semester: true,
  ratingOverall: true,
  ratingTeaching: true,
  ratingClarity: true,
  ratingFairness: true,
  comment: true,
  createdAt: true,
} as const

/**
 * Newest first, with id breaking ties.
 *
 * The tiebreaker is what makes paging safe. Two reviews written in the same
 * millisecond have no defined order without it, so Postgres is free to
 * return them in a different order for the preview query and for a later
 * batch — which shows one review twice and silently drops another. Both
 * queries below use this, so they agree.
 */
const NEWEST_FIRST: { createdAt?: 'desc'; id?: 'desc' }[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
]

// The ceiling on rows read to build the previews. One query reads this many
// of the teacher's newest published reviews and the three-per-course
// previews are sliced out of them in memory.
//
// PAST THE CAP: a course whose most recent review is older than these 300
// shows no preview text, but its "Show all" button still works, because that
// reads the course directly. Its reviewCount and its four averages are also
// still exact, since those come from the groupBy, which is not capped — so
// the page understates nothing. At two previews per course, 300 rows covers
// a teacher with up to 150 courses before any of this can bite; the busiest
// teacher in the database has four.
const PREVIEW_SCAN_LIMIT = 300

function toAverage(value: number | null): number {
  return value === null ? 0 : Number(value)
}

/**
 * Every published review of a teacher, grouped by course.
 *
 * The per-course averages are computed here on read, not stored. A teacher
 * has a handful of courses, so the query stays small. Only the teacher
 * overall is denormalised onto Teacher, because the search page sorts on it.
 *
 * SHARED ACROSS REQUESTS (unstable_cache, tag teacher:{id}). What is stored
 * is exactly the CourseReviews[] below, which a signed-out stranger could
 * read off the page: course code/name/semester, four averages, two counts,
 * and per preview review its id, semester, four ratings, comment and date.
 * The userId the student count is grouped on never leaves readTeacherReviews.
 */
export async function getTeacherReviews(teacherId: string): Promise<CourseReviews[]> {
  const blocks = await unstable_cache(
    () => readTeacherReviews(teacherId),
    ['teacher-reviews', teacherId],
    { revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS, tags: [teacherTag(teacherId)] }
  )()

  // The cache stores JSON, so a cached createdAt comes back as a string.
  // Turned back into a Date so the page renders exactly what it did before.
  return blocks.map((block) => ({
    ...block,
    reviews: block.reviews.map((review) => ({
      ...review,
      createdAt: new Date(review.createdAt),
    })),
  }))
}

async function readTeacherReviews(teacherId: string): Promise<CourseReviews[]> {
  const grouped = await prisma.review.groupBy({
    by: ['courseId'],
    where: { teacherId, ...PUBLIC },
    _count: { _all: true },
    _avg: {
      ratingOverall: true,
      ratingTeaching: true,
      ratingClarity: true,
      ratingFairness: true,
    },
  })

  if (grouped.length === 0) return []

  // How many distinct students per course. Grouped by (courseId, userId)
  // and counted here, so one query covers every course.
  //
  // The per-course AVERAGES above are untouched on purpose: a teacher who
  // is strong in one course and weak in another still shows exactly that,
  // review by review. Only the headline number on Teacher is per-student.
  //
  // userId is grouped on and immediately discarded. It never leaves this
  // function.
  const pairs = await prisma.review.groupBy({
    by: ['courseId', 'userId'],
    where: { teacherId, ...PUBLIC },
  })

  const studentsByCourse = new Map<string, number>()
  for (const row of pairs) {
    studentsByCourse.set(row.courseId, (studentsByCourse.get(row.courseId) ?? 0) + 1)
  }

  const courses = await prisma.course.findMany({
    where: { id: { in: grouped.map((row) => row.courseId) } },
    select: { id: true, code: true, name: true, semester: true },
  })

  const byId = new Map(courses.map((course) => [course.id, course]))

  // ONE query for every preview, not one per course.
  //
  // This used to be a findMany per course inside Promise.all: 2 + N queries,
  // measured at 6 for a teacher with four courses. The rows are read newest
  // first and grouped below, which gives the same three-per-course result
  // from a single round trip.
  //
  // courseId is selected here only to do that grouping. It is dropped before
  // anything is returned. No userId. Not now, not ever.
  const recent = await prisma.review.findMany({
    where: { teacherId, ...PUBLIC },
    orderBy: NEWEST_FIRST,
    take: PREVIEW_SCAN_LIMIT,
    // courseId is selected only to do the grouping below. It is dropped
    // before anything is returned.
    select: { courseId: true, ...PUBLIC_REVIEW_SELECT },
  })

  // Already newest first, so the first two of a course are its newest two
  // and nothing needs sorting again.
  const previewsByCourse = new Map<string, PublicReview[]>()

  for (const { courseId, ...review } of recent) {
    const forCourse = previewsByCourse.get(courseId)

    if (forCourse === undefined) {
      previewsByCourse.set(courseId, [review])
      continue
    }

    if (forCourse.length < PREVIEW_PER_COURSE) forCourse.push(review)
  }

  const blocks: CourseReviews[] = []

  grouped.forEach((row) => {
    const course = byId.get(row.courseId)
    if (!course) return

    blocks.push({
      course: { code: course.code, name: course.name, semester: course.semester },
      avgOverall: toAverage(row._avg.ratingOverall),
      avgTeaching: toAverage(row._avg.ratingTeaching),
      avgClarity: toAverage(row._avg.ratingClarity),
      avgFairness: toAverage(row._avg.ratingFairness),
      reviewCount: row._count._all,
      studentCount: studentsByCourse.get(row.courseId) ?? 0,
      // Empty only when every review of this course fell outside the scan
      // limit. The count and the averages above are still exact.
      reviews: previewsByCourse.get(row.courseId) ?? [],
    })
  })

  // Most reviewed first, then by code so the order never wobbles.
  return blocks.sort(
    (a, b) =>
      b.reviewCount - a.reviewCount || a.course.code.localeCompare(b.course.code)
  )
}

/**
 * One batch of a course's reviews, for the "Show all" button.
 *
 * Reads the course directly rather than the teacher's newest 300, so it works
 * for a course whose reviews all fall outside the preview scan.
 *
 * ANONYMITY. Same select as the previews, which has no userId, and the course
 * is matched through a relation filter so no id of any kind has to be handed
 * to the browser and back. Only PUBLISHED and not deleted, exactly as the
 * previews and the counts are — the button cannot reveal a pending or
 * rejected review.
 *
 * ONE query. `skip` is how many the caller is already showing.
 */
export async function getCourseReviewsPage(
  teacherId: string,
  courseCode: string,
  skip: number
): Promise<PublicReview[]> {
  return prisma.review.findMany({
    where: { teacherId, course: { code: courseCode }, ...PUBLIC },
    orderBy: NEWEST_FIRST,
    skip,
    take: REVIEW_BATCH,
    select: PUBLIC_REVIEW_SELECT,
  })
}

/**
 * Which of these reviews the viewer wrote, by id only.
 *
 * This reads the viewer's OWN rows, so it tells them nothing about anyone
 * else. It exists so the Report button can be hidden on your own review
 * without the page ever learning who wrote the others.
 */
export async function getOwnReviewIds(
  userId: string,
  teacherId: string
): Promise<string[]> {
  const rows = await prisma.review.findMany({
    where: { userId, teacherId, deletedAt: null },
    select: { id: true },
  })

  return rows.map((row) => row.id)
}

/**
 * A rejection a person has already upheld.
 *
 * REJECTED plus appealHandledAt means an admin read the appeal and left the
 * rejection standing. Those two columns together are the whole rule, so no
 * new column was needed.
 *
 * It ends the three attempts. Without that, a refused student could reword
 * the same review until the AI let it through, and the machine would be
 * overruling the person who had just said no.
 */
export function isFinalRejection(review: {
  status: ReviewStatus
  appealHandledAt: Date | null
}): boolean {
  return review.status === 'REJECTED' && review.appealHandledAt !== null
}

/**
 * THE APPEAL LOCK. Once a review has been appealed it can never be edited
 * or submitted again — not while the appeal waits, not after it is decided.
 *
 * appealedAt is the whole test. submitCount does not matter and neither
 * does appealHandledAt; those two only choose which sentence is shown.
 *
 * Without this, appealing was pointless. A student could appeal, edit the
 * text, resubmit, and the AI would publish it while an admin was still
 * holding the appeal — leaving a dead appeal in the admin's list and the
 * machine quietly overruling the person who was about to decide.
 *
 * One function, used by the page AND by both actions, so what the card
 * offers and what the server allows cannot drift apart.
 */

export {
  APPEAL_WAITING_MESSAGE,
  APPEAL_REFUSED_MESSAGE,
  APPEAL_DECIDED_MESSAGE,
  appealLockMessage,
} from '@/lib/appeal'

// A rejected student is told why, and the reason comes from the latest
// ModerationResult row. Nothing is stored twice: rejectionMessage() turns
// these two fields into the sentence.
export type MyReviewVerdict = {
  decision: ModerationDecision
  ruleFlags: string[]
}

export type MyReview = {
  id: string
  status: ReviewStatus
  semester: string
  ratingOverall: number
  ratingTeaching: number
  ratingClarity: number
  ratingFairness: number
  comment: string | null
  createdAt: Date

  // How many times it has been sent for a decision, and whether the one
  // appeal has been used. Both decide what the page offers.
  submitCount: number
  appealedAt: Date | null
  // Set when an admin decided the appeal, either way. With status REJECTED
  // it means the rejection is final.
  appealHandledAt: Date | null

  teacher: { nameEn: string; slug: string }
  course: { code: string; name: string }
  verdict: MyReviewVerdict | null
}

/**
 * The student's own reviews, every status, newest first. Deleted ones stay
 * out: the row survives for audit, but they asked for it to be gone.
 */
export async function getMyReviews(userId: string): Promise<MyReview[]> {
  const rows = await prisma.review.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      semester: true,
      ratingOverall: true,
      ratingTeaching: true,
      ratingClarity: true,
      ratingFairness: true,
      comment: true,
      createdAt: true,
      submitCount: true,
      appealedAt: true,
      appealHandledAt: true,
      teacher: { select: { nameEn: true, slug: true } },
      course: { select: { code: true, name: true } },
      moderation: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        // decision and ruleFlags only. `scores` is never shown to a
        // student, and the numbers would invite an argument about them.
        select: { decision: true, ruleFlags: true },
      },
    },
  })

  return rows.map(({ moderation, ...review }) => ({
    ...review,
    verdict: moderation[0] ?? null,
  }))
}
