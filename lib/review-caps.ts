/**
 * Review Caps and Rate Limits
 *
 * Enforces submission limits and anti-spam constraints.
 * Specific privacy-core queries and anonymous reviewer aggregation logic are
 * implemented by the private production Privacy Core and are omitted from
 * this transparency release.
 */

export const SITE_TIME_ZONE = 'Asia/Dhaka'

export type DepartmentCapInput = {
  reviewsWritten: number
  coursesInCurriculum: number
  teachersPerCourse: number
  shortCode: string
}

export function courseTeacherCapMessage(cap: number): string {
  return `You can only review up to ${cap} teachers for this course.`
}

export function courseTeacherCapProblem(
  alreadyReviewed: readonly string[],
  teacherId: string,
  cap: number
): string | null {
  if (alreadyReviewed.includes(teacherId)) return null
  return alreadyReviewed.length >= cap ? courseTeacherCapMessage(cap) : null
}

export function departmentCapMessage(input: DepartmentCapInput): string {
  return `You have reached the submission limit for ${input.shortCode}.`
}

export function departmentCapProblem(input: DepartmentCapInput): string | null {
  const cap = input.coursesInCurriculum * input.teachersPerCourse
  return input.reviewsWritten >= cap ? departmentCapMessage(input) : null
}

export function dayStart(now: Date): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

export function countsTowardToday(createdAt: Date, now: Date): boolean {
  return createdAt.getTime() >= dayStart(now).getTime()
}

export function dailyCapProblem(writtenToday: number, cap: number): string | null {
  return writtenToday >= cap ? `You have reached your daily review limit of ${cap}.` : null
}

export function teacherDailyCapProblem(writtenToday: number, cap: number): string | null {
  return writtenToday >= cap
    ? `You can only submit ${cap} review${cap === 1 ? '' : 's'} for this teacher per day.`
    : null
}
