'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ReviewStatus } from '@/lib/types'
import { logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth'
import { hitLimit, rateLimitMessage } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { revalidatePublicTotals } from '@/server/public-cache'
import { recalculateTeacherRating } from '@/server/ratings'
import { clearSettingCache } from '@/server/settings'
import type { ActionResult } from './review'

// The only keys that exist. An unknown key is rejected rather than
// created: a typo must not quietly add a setting that nothing reads, and a
// hostile caller must not be able to write arbitrary rows.
const SETTING_KEYS = [
  'reviews_enabled',
  'maintenance_mode',
  'min_students_for_display',
  'min_students_for_ranking',
  'auto_hide_report_count',
  'max_reviews_per_day',
  'max_reviews_per_teacher',
  'max_reviews_per_teacher_month',
  'max_reviews_per_teacher_day',
  'max_teachers_per_course',
  'pending_digest_day',
] as const

// A note to your future self, kept in the audit log. There is no note
// column on Review, and there should not be one: a reason for hiding a
// review is a record of an admin decision, not part of the review.
const NOTE_MAX = 500

const reviewIdSchema = z.object({ reviewId: z.uuid() })

const reviewIdWithNoteSchema = z.object({
  reviewId: z.uuid(),
  note: z.string().trim().max(NOTE_MAX, `Keep the note under ${NOTE_MAX} characters.`).optional(),
})

const reportIdSchema = z.object({ reportId: z.uuid() })

const setSettingSchema = z.object({
  key: z.enum(SETTING_KEYS, 'That is not a setting.'),
  // Short on purpose. Every setting is a boolean or a small number.
  value: z.string().trim().min(1).max(32),
})

/**
 * Who is acting, or why they may not.
 *
 * EVERY admin action starts here. The limit is not about the owner, who
 * cannot click sixty times a minute — it is about a STOLEN admin session
 * being scripted to publish or delete in bulk before anyone notices.
 *
 * requireAdmin() still runs first and still 404s a non-admin, so this adds
 * a ceiling rather than replacing the check.
 */
async function adminActor(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const admin = await requireAdmin()

  if (await hitLimit('adminAction', admin.id)) {
    return { ok: false, error: rateLimitMessage('adminAction') }
  }

  return { ok: true, id: admin.id }
}

function badInput(error: z.ZodError): ActionResult {
  return {
    ok: false,
    error: error.issues[0]?.message ?? 'Something went wrong. Please try again.',
  }
}

/** The review itself, once it is established that it may be acted on. */
type DecisionTarget = {
  id: string
  status: ReviewStatus
  teacherId: string
  teacherSlug: string
  publishedAt: Date | null
  appealedAt: Date | null
  appealHandledAt: Date | null
}

/**
 * A DISCRIMINATED UNION, on purpose.
 *
 * This used to be the inferred union of `{ error }` and `{ review }`, and
 * every caller narrowed it with `'error' in loaded`. The compiler did not
 * accept that narrowing: `loaded.error` came out as `string | undefined`,
 * which is not the `string` ActionResult asks for, and it failed the build
 * in six places.
 *
 * An explicit `ok` field is what makes the narrowing unambiguous. After
 * `if (!loaded.ok)` the compiler knows `error` is a string, and after it
 * knows `review` is present — with no assertion and no cast.
 */
type LoadedForDecision =
  | { ok: true; review: DecisionTarget }
  | { ok: false; error: string }

/**
 * Loads the one review an admin is about to act on, and refuses if it is
 * theirs.
 *
 * userId is read for that comparison and never returned. The question this
 * asks is "is this mine", never "whose is this".
 */
async function loadForDecision(
  reviewId: string,
  adminId: string
): Promise<LoadedForDecision> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      userId: true,
      status: true,
      teacherId: true,
      deletedAt: true,
      publishedAt: true,
      appealedAt: true,
      appealHandledAt: true,
      teacher: { select: { slug: true } },
    },
  })

  if (!review || review.deletedAt) {
    return { ok: false, error: 'Review not found.' }
  }

  // An admin who could publish their own review is not moderating, and
  // nobody else is watching.
  if (review.userId === adminId) {
    return { ok: false, error: "You can't moderate your own review." }
  }

  return {
    ok: true,
    review: {
      id: review.id,
      status: review.status,
      teacherId: review.teacherId,
      teacherSlug: review.teacher.slug,
      publishedAt: review.publishedAt,
      appealedAt: review.appealedAt,
      appealHandledAt: review.appealHandledAt,
    },
  }
}

/**
 * The two checks both appeal decisions share.
 *
 * An appeal that is already handled is gone from the section, so reaching
 * one means a stale page or a replayed request. Either way it is refused.
 */
function appealProblem(review: {
  appealedAt: Date | null
  appealHandledAt: Date | null
}): string | null {
  if (!review.appealedAt) return 'That review has not been appealed.'
  if (review.appealHandledAt) return 'That appeal has already been handled.'
  return null
}

function wrongStatus(expected: ReviewStatus): ActionResult {
  const text: Record<ReviewStatus, string> = {
    PENDING: 'This review is not waiting for a decision.',
    PUBLISHED: 'This review is not published.',
    HIDDEN: 'This review is not hidden.',
    REJECTED: 'This review was not rejected.',
  }

  return { ok: false, error: text[expected] }
}

// Both pages that can change because of a decision, and the home page's
// cached totals. Every caller runs this after its writes have finished.
function revalidate(teacherSlug: string, teacherId: string) {
  revalidatePath('/admin')
  revalidatePath(`/teachers/${teacherSlug}`)
  revalidatePublicTotals(teacherId)
}

/** PENDING -> PUBLISHED. */
export async function approveReview(input: unknown): Promise<ActionResult> {
  const actor = await adminActor()
  if (!actor.ok) return { ok: false, error: actor.error }
  const admin = { id: actor.id }

  const parsed = reviewIdSchema.safeParse(input)
  if (!parsed.success) return badInput(parsed.error)

  const loaded = await loadForDecision(parsed.data.reviewId, admin.id)
  if (!loaded.ok) return { ok: false, error: loaded.error }

  const { review } = loaded
  if (review.status !== 'PENDING') return wrongStatus('PENDING')

  await prisma.review.update({
    where: { id: review.id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  })

  // It counts now, so the average moves. Only this function writes those
  // columns.
  await recalculateTeacherRating(review.teacherId)

  await logAudit({
    actorId: admin.id,
    action: 'REVIEW_APPROVED',
    targetType: 'Review',
    targetId: review.id,
  })

  revalidate(review.teacherSlug, review.teacherId)
  return { ok: true }
}

/** PENDING -> REJECTED. The row stays. Nothing is ever hard deleted. */
export async function rejectReview(input: unknown): Promise<ActionResult> {
  const actor = await adminActor()
  if (!actor.ok) return { ok: false, error: actor.error }
  const admin = { id: actor.id }

  const parsed = reviewIdWithNoteSchema.safeParse(input)
  if (!parsed.success) return badInput(parsed.error)

  const loaded = await loadForDecision(parsed.data.reviewId, admin.id)
  if (!loaded.ok) return { ok: false, error: loaded.error }

  const { review } = loaded
  if (review.status !== 'PENDING') return wrongStatus('PENDING')

  await prisma.review.update({
    where: { id: review.id },
    data: { status: 'REJECTED' },
  })

  // A no-op for the average, since neither PENDING nor REJECTED counts.
  // Called anyway: every status change recalculates, with no exceptions to
  // remember.
  await recalculateTeacherRating(review.teacherId)

  await logAudit({
    actorId: admin.id,
    action: 'REVIEW_REJECTED',
    targetType: 'Review',
    targetId: review.id,
    meta: parsed.data.note ? { note: parsed.data.note } : undefined,
  })

  revalidate(review.teacherSlug, review.teacherId)
  return { ok: true }
}

/** PUBLISHED -> HIDDEN. */
export async function hideReview(input: unknown): Promise<ActionResult> {
  const actor = await adminActor()
  if (!actor.ok) return { ok: false, error: actor.error }
  const admin = { id: actor.id }

  const parsed = reviewIdWithNoteSchema.safeParse(input)
  if (!parsed.success) return badInput(parsed.error)

  const loaded = await loadForDecision(parsed.data.reviewId, admin.id)
  if (!loaded.ok) return { ok: false, error: loaded.error }

  const { review } = loaded
  if (review.status !== 'PUBLISHED') return wrongStatus('PUBLISHED')

  await prisma.review.update({
    where: { id: review.id },
    data: { status: 'HIDDEN' },
  })

  await recalculateTeacherRating(review.teacherId)

  await logAudit({
    actorId: admin.id,
    action: 'REVIEW_HIDDEN',
    targetType: 'Review',
    targetId: review.id,
    meta: parsed.data.note ? { note: parsed.data.note } : undefined,
  })

  revalidate(review.teacherSlug, review.teacherId)
  return { ok: true }
}

/** HIDDEN -> PUBLISHED. */
export async function unhideReview(input: unknown): Promise<ActionResult> {
  const actor = await adminActor()
  if (!actor.ok) return { ok: false, error: actor.error }
  const admin = { id: actor.id }

  const parsed = reviewIdSchema.safeParse(input)
  if (!parsed.success) return badInput(parsed.error)

  const loaded = await loadForDecision(parsed.data.reviewId, admin.id)
  if (!loaded.ok) return { ok: false, error: loaded.error }

  const { review } = loaded
  if (review.status !== 'HIDDEN') return wrongStatus('HIDDEN')

  const current = await prisma.review.findUnique({
    where: { id: review.id },
    select: { publishedAt: true },
  })

  await prisma.review.update({
    where: { id: review.id },
    data: {
      status: 'PUBLISHED',
      // It was published once before, so keep that date. Only a review
      // that somehow never had one gets today's.
      publishedAt: current?.publishedAt ?? new Date(),
    },
  })

  await recalculateTeacherRating(review.teacherId)

  await logAudit({
    actorId: admin.id,
    action: 'REVIEW_UNHIDDEN',
    targetType: 'Review',
    targetId: review.id,
  })

  revalidate(review.teacherSlug, review.teacherId)
  return { ok: true }
}

/**
 * Marks one report as handled. The review does not change, so no rating is
 * recalculated.
 */
export async function dismissReport(input: unknown): Promise<ActionResult> {
  const actor = await adminActor()
  if (!actor.ok) return { ok: false, error: actor.error }
  const admin = { id: actor.id }

  const parsed = reportIdSchema.safeParse(input)
  if (!parsed.success) return badInput(parsed.error)

  const report = await prisma.reviewReport.findUnique({
    where: { id: parsed.data.reportId },
    select: {
      id: true,
      handledAt: true,
      // For the ownership check only, and for the page to revalidate.
      review: {
        select: { userId: true, teacherId: true, teacher: { select: { slug: true } } },
      },
    },
  })

  if (!report) return { ok: false, error: 'Report not found.' }

  // The queue never shows the admin's own reviews, so this should be
  // unreachable. It is here because "should be" is not a check.
  if (report.review.userId === admin.id) {
    return { ok: false, error: "You can't moderate your own review." }
  }

  if (report.handledAt) return { ok: false, error: 'That report is already handled.' }

  await prisma.reviewReport.update({
    where: { id: report.id },
    data: { handledAt: new Date() },
  })

  await logAudit({
    actorId: admin.id,
    action: 'REPORT_DISMISSED',
    targetType: 'ReviewReport',
    targetId: report.id,
  })

  revalidate(report.review.teacher.slug, report.review.teacherId)
  return { ok: true }
}

/**
 * Changes one setting.
 *
 * The emergency switches live here: `reviews_enabled` stops new reviews,
 * `maintenance_mode` closes the site to everyone but an admin. Both are
 * data, not a deploy, so they work from a phone.
 */
export async function setSetting(input: unknown): Promise<ActionResult> {
  const actor = await adminActor()
  if (!actor.ok) return { ok: false, error: actor.error }
  const admin = { id: actor.id }

  const parsed = setSettingSchema.safeParse(input)
  if (!parsed.success) return badInput(parsed.error)

  const { key, value } = parsed.data

  // Read the old value first. Without it the audit log says what the
  // setting became but not what it was, which is the half that matters
  // when working out what changed and when.
  const before = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  })

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })

  // getSetting() caches for 60 seconds. Without this the toggle appears to
  // do nothing for a minute.
  clearSettingCache(key)

  await logAudit({
    actorId: admin.id,
    action: 'SETTING_CHANGED',
    targetType: 'Setting',
    targetId: key,
    meta: { key, from: before?.value ?? null, to: value },
  })

  revalidatePath('/admin')
  // maintenance_mode is read in the root layout, so every page's shell has
  // to be reconsidered, not just this one.
  revalidatePath('/', 'layout')

  return { ok: true }
}

/**
 * The appeal succeeded: REJECTED -> PUBLISHED.
 *
 * REVIEW_APPROVED with `viaAppeal: true` in the meta, rather than a new
 * AuditAction value. A new enum value would be a migration, and the existing
 * one plus that flag says exactly what happened.
 */
export async function publishAppeal(input: unknown): Promise<ActionResult> {
  const actor = await adminActor()
  if (!actor.ok) return { ok: false, error: actor.error }
  const admin = { id: actor.id }

  const parsed = reviewIdSchema.safeParse(input)
  if (!parsed.success) return badInput(parsed.error)

  const loaded = await loadForDecision(parsed.data.reviewId, admin.id)
  if (!loaded.ok) return { ok: false, error: loaded.error }

  const { review } = loaded

  const problem = appealProblem(review)
  if (problem) return { ok: false, error: problem }

  if (review.status !== 'REJECTED') return wrongStatus('REJECTED')

  await prisma.review.update({
    where: { id: review.id },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      // Handled either way. appealedAt stays set, so there is no second one.
      appealHandledAt: new Date(),
    },
  })

  // It counts now, so the average moves.
  await recalculateTeacherRating(review.teacherId)

  await logAudit({
    actorId: admin.id,
    action: 'REVIEW_APPROVED',
    targetType: 'Review',
    targetId: review.id,
    meta: { viaAppeal: true },
  })

  revalidate(review.teacherSlug, review.teacherId)
  return { ok: true }
}

/**
 * The appeal failed. The status does not move; only the appeal closes.
 */
export async function keepRejected(input: unknown): Promise<ActionResult> {
  const actor = await adminActor()
  if (!actor.ok) return { ok: false, error: actor.error }
  const admin = { id: actor.id }

  const parsed = reviewIdSchema.safeParse(input)
  if (!parsed.success) return badInput(parsed.error)

  const loaded = await loadForDecision(parsed.data.reviewId, admin.id)
  if (!loaded.ok) return { ok: false, error: loaded.error }

  const { review } = loaded

  const problem = appealProblem(review)
  if (problem) return { ok: false, error: problem }

  if (review.status !== 'REJECTED') return wrongStatus('REJECTED')

  await prisma.review.update({
    where: { id: review.id },
    // Nothing but the appeal changes. No status, no publishedAt, and no
    // rating to recalculate, because nothing started or stopped counting.
    data: { appealHandledAt: new Date() },
  })

  await logAudit({
    actorId: admin.id,
    action: 'REVIEW_REJECTED',
    targetType: 'Review',
    targetId: review.id,
    meta: { viaAppeal: true },
  })

  revalidate(review.teacherSlug, review.teacherId)
  return { ok: true }
}
