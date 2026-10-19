import type {
  ModerationDecision,
  ReportReason,
  ReviewStatus,
} from '@/lib/types'
import { prisma } from '@/lib/prisma'

/**
 * THE ANONYMITY RULE, ADMIN EDITION
 *
 * The admin is not an exception. Nothing in this file selects a review's
 * userId, email or name, and no query here uses include: { user: true }.
 * The queue is deliberately flattened into plain fields before it leaves
 * this file, so a later change to a Prisma model cannot quietly start
 * sending the writer to the browser.
 *
 * userId is selected for exactly one purpose: comparing it with the
 * viewing admin's id to work out `isOwn`. The comparison happens here, on
 * the server, and the column is dropped when the row is flattened. The
 * boolean leaves this file; the id never does.
 */

// The admin's own reviews ARE in the queue, marked `isOwn`. There is one
// admin, so leaving them out meant they sat PENDING forever with nothing
// to show that they had. He still cannot decide them: the actions refuse,
// and the card disables its buttons.
//
// This marks nothing he does not already know, because he wrote them. For
// any other admin looking at the same review, isOwn is false and the row
// is an ordinary one.

export type QueueReason = 'PENDING' | 'REPORTED' | 'AUTO_HIDDEN'

export type QueueReport = {
  id: string
  reason: ReportReason
  description: string | null
  createdAt: Date
}

export type QueueReview = {
  id: string
  status: ReviewStatus
  semester: string
  comment: string | null
  reportCount: number
  createdAt: Date

  // The teacher is public information. The writer is not.
  teacherName: string
  teacherSlug: string
  departmentCode: string
  courseCode: string
  courseName: string

  // The latest moderation verdict, and which cheap rules fired. Never the
  // numeric scores: those are not shown to any user, admin included.
  decision: ModerationDecision | null
  ruleFlags: string[]

  // Only the reports nobody has handled yet.
  reports: QueueReport[]

  // Why this review is in the queue at all. A review can be here for more
  // than one reason.
  reasons: QueueReason[]

  // True when the viewing admin wrote this review. A boolean, never the id
  // it was worked out from.
  isOwn: boolean
}

// High risk first, then the ones a human has to judge, then the rest.
const RISK_RANK: Record<ModerationDecision, number> = {
  HIGH_RISK: 0,
  SUSPICIOUS: 1,
  ERROR: 2,
  SPAM: 3,
  SAFE: 4,
}

const NO_DECISION_RANK = 5

// Enough to clear a backlog in one sitting. The queue is work to do, not a
// dashboard, so it never needs to show everything at once.
const MAX_QUEUE = 100

function riskRank(decision: ModerationDecision | null): number {
  return decision === null ? NO_DECISION_RANK : RISK_RANK[decision]
}

/**
 * Everything waiting for a decision:
 *
 *   - every PENDING review
 *   - every review with a report nobody has handled
 *   - every review the system auto-hid after reports
 *
 * Sorted by risk, then oldest first.
 */
export async function getAdminQueue(adminId: string): Promise<QueueReview[]> {
  // Auto-hidden is not a status, it is a thing that happened. The audit log
  // is the record of it, so that is what we read.
  const autoHidden = await prisma.auditLog.findMany({
    where: { action: 'REVIEW_AUTO_HIDDEN', targetType: 'Review' },
    select: { targetId: true },
  })

  const autoHiddenIds = autoHidden
    .map((row) => row.targetId)
    .filter((id): id is string => id !== null)

  const autoHiddenSet = new Set(autoHiddenIds)

  const rows = await prisma.review.findMany({
    where: {
      // Never resurrect a review the student deleted.
      deletedAt: null,
      OR: [
        { status: 'PENDING' },
        { reports: { some: { handledAt: null } } },
        { id: { in: autoHiddenIds }, status: 'HIDDEN' },
      ],
    },
    select: {
      id: true,
      // Read only to compare with adminId below. Dropped in the mapping.
      userId: true,
      status: true,
      semester: true,
      comment: true,
      reportCount: true,
      createdAt: true,
      teacher: {
        select: {
          nameEn: true,
          slug: true,
          department: { select: { shortCode: true } },
        },
      },
      course: { select: { code: true, name: true } },
      moderation: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        // decision and ruleFlags only. `scores` is never read here.
        select: { decision: true, ruleFlags: true },
      },
      reports: {
        where: { handledAt: null },
        orderBy: { createdAt: 'asc' },
        // No reporterId. Who reported a review is as private as who wrote
        // it, and the admin does not need either to make a decision.
        select: { id: true, reason: true, description: true, createdAt: true },
      },
    },
    take: MAX_QUEUE,
  })

  const queue: QueueReview[] = rows.map((row) => {
    const latest = row.moderation[0] ?? null

    const reasons: QueueReason[] = []
    if (row.status === 'PENDING') reasons.push('PENDING')
    if (row.reports.length > 0) reasons.push('REPORTED')
    if (autoHiddenSet.has(row.id)) reasons.push('AUTO_HIDDEN')

    return {
      id: row.id,
      status: row.status,
      semester: row.semester,
      comment: row.comment,
      reportCount: row.reportCount,
      createdAt: row.createdAt,
      teacherName: row.teacher.nameEn,
      teacherSlug: row.teacher.slug,
      departmentCode: row.teacher.department.shortCode,
      courseCode: row.course.code,
      courseName: row.course.name,
      decision: latest?.decision ?? null,
      ruleFlags: latest?.ruleFlags ?? [],
      reports: row.reports,
      reasons,
      // The comparison is the last thing userId is used for. It is not
      // copied into the result.
      isOwn: row.userId === adminId,
    }
  })

  // Sorted here rather than in SQL: risk comes from the latest moderation
  // row, which Postgres cannot order on without a lateral join for 100
  // rows. Measure before making this clever.
  return queue.sort((a, b) => {
    const risk = riskRank(a.decision) - riskRank(b.decision)
    if (risk !== 0) return risk
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
}

// ---------------------------------------------------------------
// Appeals
// ---------------------------------------------------------------

export type AppealReview = {
  id: string
  semester: string
  comment: string | null

  ratingOverall: number
  ratingTeaching: number
  ratingClarity: number
  ratingFairness: number

  // How many times they have sent it. Three is the limit, so a 3 here means
  // the appeal is the only thing left to them.
  submitCount: number

  // What they wrote when they appealed, and when.
  appealText: string | null
  appealedAt: Date

  teacherName: string
  teacherSlug: string
  departmentCode: string
  courseCode: string
  courseName: string

  // The verdict they were given. The page turns these two into the sentence
  // the student actually read, with rejectionMessage().
  decision: ModerationDecision | null
  ruleFlags: string[]

  // True when the rejection reason was "allegation". Publishing one of these
  // can harm a named person, so the card asks before it does.
  isAllegation: boolean

  isOwn: boolean
}

/**
 * Whether this rejection was the "allegation" one.
 *
 * This mirrors reasonFor() in services/moderation/messages.ts, which is
 * module-private there. Flags win over the decision, because a rule
 * rejection never reached the AI and its stored decision is only the
 * nearest value the enum had. If that file ever exports its mapping, delete
 * this and use it.
 */
function isAllegationRejection(
  decision: ModerationDecision | null,
  ruleFlags: string[]
): boolean {
  if (ruleFlags.includes('BANNED_WORD')) return false
  if (['PHONE_NUMBER', 'EMAIL_ADDRESS', 'URL'].some((f) => ruleFlags.includes(f))) {
    return false
  }

  return decision === 'HIGH_RISK'
}

/**
 * Every appeal waiting for a decision. Oldest first, because the student has
 * been waiting longest and has nothing else left to try.
 *
 * Uses the (appealedAt, appealHandledAt) index. A handled appeal leaves this
 * list and cannot come back: appealedAt stays set, so there is no second one.
 *
 * Same anonymity rule as the queue. userId is read only to work out isOwn
 * and is dropped when the row is flattened.
 */
export async function getAppeals(adminId: string): Promise<AppealReview[]> {
  const rows = await prisma.review.findMany({
    where: {
      appealedAt: { not: null },
      appealHandledAt: null,
      // A student who appealed and then deleted the review has answered the
      // question themselves.
      deletedAt: null,
    },
    orderBy: { appealedAt: 'asc' },
    select: {
      id: true,
      userId: true,
      semester: true,
      comment: true,
      ratingOverall: true,
      ratingTeaching: true,
      ratingClarity: true,
      ratingFairness: true,
      submitCount: true,
      appealText: true,
      appealedAt: true,
      teacher: {
        select: {
          nameEn: true,
          slug: true,
          department: { select: { shortCode: true } },
        },
      },
      course: { select: { code: true, name: true } },
      moderation: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        // decision and ruleFlags only. The scores are never shown to anyone.
        select: { decision: true, ruleFlags: true },
      },
    },
  })

  return rows.map((row) => {
    const latest = row.moderation[0] ?? null
    const decision = latest?.decision ?? null
    const ruleFlags = latest?.ruleFlags ?? []

    return {
      id: row.id,
      semester: row.semester,
      comment: row.comment,
      ratingOverall: row.ratingOverall,
      ratingTeaching: row.ratingTeaching,
      ratingClarity: row.ratingClarity,
      ratingFairness: row.ratingFairness,
      submitCount: row.submitCount,
      appealText: row.appealText,
      // Not null: the query filtered on it.
      appealedAt: row.appealedAt as Date,
      teacherName: row.teacher.nameEn,
      teacherSlug: row.teacher.slug,
      departmentCode: row.teacher.department.shortCode,
      courseCode: row.course.code,
      courseName: row.course.name,
      decision,
      ruleFlags,
      isAllegation: isAllegationRejection(decision, ruleFlags),
      isOwn: row.userId === adminId,
    }
  })
}

// ---------------------------------------------------------------
// Teacher sign-ins
// ---------------------------------------------------------------

export type TeacherSignIns = {
  /** How many TEACHER accounts exist. */
  count: number
  /** The latest lastLoginAt among them, or null if none has ever signed in. */
  mostRecent: Date | null
}

/**
 * How many teachers have signed in at least once, and when the last one did.
 *
 * WHY THE COUNT MEANS THAT. A teacher row is created on first Google sign-in
 * -- see the upsert in app/api/auth/google/callback/route.ts -- so there is no
 * such thing as a teacher account that has never logged in. Counting the
 * accounts IS counting the teachers who have been here.
 *
 * THE DATE IS THE USEFUL HALF. "12" says little on its own; "12, most recent
 * 2 days ago" says whether teachers are watching right now, which changes how
 * carefully a borderline review wants handling this week.
 *
 * A COUNT AND A MAX, NOTHING ELSE. One aggregate, no findMany, no select: no
 * teacher name, email or id is read into this process, so there is none on the
 * screen and none in the page source. The two numbers cannot be widened into
 * a list of who.
 *
 * READ LIVE ON EVERY REQUEST, AND DELIBERATELY NOT CACHED. It does NOT go
 * through getSiteStats() in server/stats.ts: that function held its result in
 * a module-level variable, which on Vercel means one copy per serverless
 * instance, each warmed at a different moment -- so the public band showed
 * numbers that moved both ways between refreshes. Reusing it would have
 * copied that bug onto this page. Two aggregates on a page only one person
 * opens are free; do not add a cache here.
 *
 * isBanned is NOT filtered out, unlike the public student count. That number
 * claims an audience, so a banned account would overstate it. This one
 * answers "how many teachers have been here", and a teacher who was later
 * banned still signed in.
 */
export async function getTeacherSignIns(): Promise<TeacherSignIns> {
  // ONE round trip. _count and _max together, so the two numbers cannot
  // disagree about which rows they were read from.
  const result = await prisma.user.aggregate({
    where: { role: 'TEACHER' },
    _count: { _all: true },
    _max: { lastLoginAt: true },
  })

  return {
    count: result._count._all,
    // Null when no teacher has signed in, and also if every teacher row
    // somehow had a null lastLoginAt. The page renders no date either way
    // rather than an empty slot where one would go.
    mostRecent: result._max.lastLoginAt,
  }
}
