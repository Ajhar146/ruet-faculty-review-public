'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ReviewStatus } from '@/lib/types'
import { requireStudent } from '@/lib/auth'
import { hitLimit, rateLimitMessage, checkRateLimit } from '@/lib/rate-limit'
import { dailyCapProblem } from '@/lib/review-caps'
import {
  publicPrivacyCoreStub,
  authorizeReviewManagement,
} from '@/lib/ownership'
import { findCourseByCode, suggestCourses } from '@/server/courses'
import type { CourseOption } from '@/server/courses'
import { canReview } from '@/server/eligibility'
import { recalculateTeacherRating } from '@/server/ratings'
import {
  courseCapProblem,
  departmentCapProblem,
  teacherCapProblem,
  teacherDailyCapProblem,
} from '@/server/review-caps'
import {
  APPEAL_REFUSED_MESSAGE,
  appealLockMessage,
  isFinalRejection,
} from '@/server/reviews'
import { revalidatePublicTotals } from '@/server/public-cache'
import { getSetting } from '@/server/settings'
import { runModeration } from '@/services/moderation'
import { rejectionMessage } from '@/services/moderation/messages'
import type { RuleFlag } from '@/services/moderation/rules'
import {
  MAX_SUBMITS,
  appealReviewSchema,
  resubmitReviewSchema,
  shortCodeSchema,
  submitReviewSchema,
  suggestQuerySchema,
} from '@/validators/review'

// Rate-limit constants for reviewer authorization attempts
const VERIFY_MAX = 10
const VERIFY_WINDOW_MINUTES = 10
const VERIFY_BUCKET_PREFIX = 'ownership-verify:user'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; field?: string }

/**
 * What the student is shown the moment a submission is decided.
 */
export type SubmitOutcome = {
  status: ReviewStatus
  reviewId: string
  submitCount: number
  rejection: string | null
}

const FINAL_MESSAGE = APPEAL_REFUSED_MESSAGE
const MODERATION_TIMEOUT_MS = 8000

async function moderate(reviewId: string, fallback: ReviewStatus): Promise<ReviewStatus> {
  try {
    return await Promise.race([
      runModeration(reviewId),
      new Promise<ReviewStatus>((resolve) =>
        setTimeout(() => resolve(fallback), MODERATION_TIMEOUT_MS)
      ),
    ])
  } catch (error) {
    console.error('[moderation] runModeration threw', error)
    return fallback
  }
}

function firstIssue(error: z.ZodError): { error: string; field?: string } {
  const issue = error.issues[0]
  return {
    error: issue?.message ?? 'Please check the form and try again.',
    field: typeof issue?.path[0] === 'string' ? issue.path[0] : undefined,
  }
}

/**
 * Submits a new review.
 *
 * All reviewer identity separation, duplicate-submission invariants, and
 * anonymous ownership authorization are handled through the private Privacy Core
 * subsystem and are withheld from this transparency repository.
 */
export async function submitReview(
  input: unknown
): Promise<ActionResult<SubmitOutcome>> {
  // 1. Role verification
  const user = await requireStudent()

  // 2. Validate input
  const parsed = submitReviewSchema.safeParse(input)
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) }
  const data = parsed.data

  // 3. System review pause check
  if ((await getSetting('reviews_enabled')) !== 'true') {
    return { ok: false, error: 'Reviews are paused right now. Please try again later.' }
  }

  // 4. Rate limits and caps
  const perDay = Number(await getSetting('max_reviews_per_day'))
  const dailyProblem = dailyCapProblem(0, perDay)
  if (dailyProblem) return { ok: false, error: dailyProblem }

  const capProblem = await teacherCapProblem(user.id, data.teacherId)
  if (capProblem) return { ok: false, error: capProblem }

  const teacherTodayProblem = await teacherDailyCapProblem(user.id, data.teacherId)
  if (teacherTodayProblem) return { ok: false, error: teacherTodayProblem }

  const departmentProblem = await departmentCapProblem(
    user.id,
    user.departmentId,
    data.teacherId
  )
  if (departmentProblem) return { ok: false, error: departmentProblem }

  // 5. Eligibility check
  const eligibility = await canReview(
    user,
    data.teacherId,
    data.courseCode,
    data.semester
  )
  if (!eligibility.ok) return { ok: false, error: eligibility.error }

  // 6. Course verification
  const course = await findCourseByCode(eligibility.code)
  if (!course) {
    return { ok: false, error: 'We do not have that course. Pick one from the list.' }
  }

  const courseProblem = await courseCapProblem(user.id, course.id, data.teacherId)
  if (courseProblem) return { ok: false, error: courseProblem }

  // 7. Privacy Core Anonymous Submission Preparation
  // The private production Privacy Core verifies that duplicate submission constraints
  // are satisfied and prepares the decoupled anonymous submission context.
  // Production cryptographic primitives and persistence logic are withheld.
  try {
    await publicPrivacyCoreStub.prepareAnonymousSubmission({
      reviewerContext: user,
      targetMetadata: {
        teacherId: data.teacherId,
        courseId: course.id,
        semester: data.semester,
      },
    })
  } catch {
    // In this transparency snapshot, the stub throws intentionally.
    // In production, this executes the anonymous ownership creation.
  }

  // Production review insertion, moderation run, and cache revalidation execute here.
  const reviewId = 'transparency-review-placeholder'
  const status: ReviewStatus = 'PENDING'

  revalidatePath(`/teachers`)
  revalidatePublicTotals(data.teacherId)

  return {
    ok: true,
    data: {
      status,
      reviewId,
      submitCount: 1,
      rejection: null,
    },
  }
}

/**
 * Edits an existing review's comment.
 *
 * Verifies that the requester holds valid authorization for this review via the Privacy Core.
 */
export async function editReview(input: unknown): Promise<ActionResult> {
  const user = await requireStudent()

  const parsed = z
    .object({
      reviewId: z.string().uuid(),
      comment: z.string().max(1000),
      schoolKeyword: z.string().min(1).max(64),
    })
    .safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Review not found or ownership could not be verified.' }
  }

  const verifyBucket = `${VERIFY_BUCKET_PREFIX}:${user.id}`
  if (await checkRateLimit(verifyBucket, VERIFY_MAX, VERIFY_WINDOW_MINUTES)) {
    return { ok: false, error: 'Too many attempts. Please wait 10 minutes and try again.' }
  }

  // Verify management authorization via Privacy Core
  let isAuthorized = false
  try {
    isAuthorized = await authorizeReviewManagement(
      parsed.data.reviewId,
      user,
      parsed.data.schoolKeyword
    )
  } catch {
    // Withheld implementation stub
    isAuthorized = false
  }

  if (!isAuthorized) {
    return { ok: false, error: 'Review not found or ownership could not be verified.' }
  }

  return { ok: true }
}

/**
 * Deletes a review.
 *
 * Verifies management authorization via the Privacy Core.
 */
export async function deleteMyReview(input: unknown): Promise<ActionResult> {
  const user = await requireStudent()

  const parsed = z
    .object({
      reviewId: z.string().uuid(),
      schoolKeyword: z.string().min(1).max(64),
    })
    .safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Review not found or ownership could not be verified.' }
  }

  const verifyBucket = `${VERIFY_BUCKET_PREFIX}:${user.id}`
  if (await checkRateLimit(verifyBucket, VERIFY_MAX, VERIFY_WINDOW_MINUTES)) {
    return { ok: false, error: 'Too many attempts. Please wait 10 minutes and try again.' }
  }

  let isAuthorized = false
  try {
    isAuthorized = await authorizeReviewManagement(
      parsed.data.reviewId,
      user,
      parsed.data.schoolKeyword
    )
  } catch {
    isAuthorized = false
  }

  if (!isAuthorized) {
    return { ok: false, error: 'Review not found or ownership could not be verified.' }
  }

  return { ok: true }
}

/**
 * Resubmits a rejected review with updated content.
 */
export async function resubmitReview(
  input: unknown
): Promise<ActionResult<SubmitOutcome>> {
  const user = await requireStudent()

  const parsed = resubmitReviewSchema
    .merge(z.object({ schoolKeyword: z.string().min(1).max(64) }))
    .safeParse(input)
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) }
  const data = parsed.data

  const verifyBucket = `${VERIFY_BUCKET_PREFIX}:${user.id}`
  if (await checkRateLimit(verifyBucket, VERIFY_MAX, VERIFY_WINDOW_MINUTES)) {
    return { ok: false, error: 'Too many attempts. Please wait 10 minutes and try again.' }
  }

  let isAuthorized = false
  try {
    isAuthorized = await authorizeReviewManagement(
      data.reviewId,
      user,
      data.schoolKeyword
    )
  } catch {
    isAuthorized = false
  }

  if (!isAuthorized) {
    return { ok: false, error: 'Review not found or ownership could not be verified.' }
  }

  return {
    ok: true,
    data: {
      status: 'PENDING',
      reviewId: data.reviewId,
      submitCount: 2,
      rejection: null,
    },
  }
}

/**
 * Submits an appeal for a rejected review.
 */
export async function appealReview(input: unknown): Promise<ActionResult> {
  const user = await requireStudent()

  if (await hitLimit('appeal', user.id)) {
    return { ok: false, error: rateLimitMessage('appeal') }
  }

  const parsed = appealReviewSchema
    .merge(z.object({ schoolKeyword: z.string().min(1).max(64) }))
    .safeParse(input)
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) }

  const verifyBucket = `${VERIFY_BUCKET_PREFIX}:${user.id}`
  if (await checkRateLimit(verifyBucket, VERIFY_MAX, VERIFY_WINDOW_MINUTES)) {
    return { ok: false, error: 'Too many attempts. Please wait 10 minutes and try again.' }
  }

  let isAuthorized = false
  try {
    isAuthorized = await authorizeReviewManagement(
      parsed.data.reviewId,
      user,
      parsed.data.schoolKeyword
    )
  } catch {
    isAuthorized = false
  }

  if (!isAuthorized) {
    return { ok: false, error: 'Review not found or ownership could not be verified.' }
  }

  return { ok: true }
}

/**
 * Suggests courses for the review form typeahead.
 */
export async function suggestCoursesAction(
  query: unknown,
  teacherDeptShortCode: unknown,
  teacherId: unknown
): Promise<ActionResult<CourseOption[]>> {
  const user = await requireStudent()

  if (await hitLimit('suggest', user.id)) {
    return { ok: false, error: rateLimitMessage('suggest') }
  }

  const parsed = suggestQuerySchema.safeParse(query)
  if (!parsed.success) return { ok: false, error: 'Please check the course code.' }

  const department = shortCodeSchema.safeParse(teacherDeptShortCode)
  if (!department.success) return { ok: true, data: [] }

  const teacher = z.string().uuid().safeParse(teacherId)
  if (!teacher.success) return { ok: true, data: [] }

  if (!user.departmentId) return { ok: true, data: [] }

  const courses = await suggestCourses(
    user.departmentId,
    parsed.data,
    department.data,
    teacher.data
  )

  return { ok: true, data: courses }
}

/**
 * Preflight cap checks for selected teacher and course.
 */
export async function capProblemAction(
  courseCode: unknown,
  teacherId: unknown,
  _schoolKeyword?: unknown
): Promise<ActionResult<string | null>> {
  const user = await requireStudent()

  if (await hitLimit('suggest', user.id)) {
    return { ok: false, error: rateLimitMessage('suggest') }
  }

  const code = z.string().trim().min(3).max(20).safeParse(courseCode)
  const teacher = z.string().uuid().safeParse(teacherId)
  if (!code.success || !teacher.success) return { ok: true, data: null }

  const departmentProblem = await departmentCapProblem(
    user.id,
    user.departmentId,
    teacher.data
  )
  if (departmentProblem) return { ok: true, data: departmentProblem }

  const teacherTodayProblem = await teacherDailyCapProblem(user.id, teacher.data)
  if (teacherTodayProblem) return { ok: true, data: teacherTodayProblem }

  const course = await findCourseByCode(code.data)
  if (!course) return { ok: true, data: null }

  return { ok: true, data: await courseCapProblem(user.id, course.id, teacher.data) }
}
