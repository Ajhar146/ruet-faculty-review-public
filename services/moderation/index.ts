import type { ModerationDecision, ReviewStatus } from '@/lib/types'
import { prisma } from '@/lib/prisma'
import { recalculateTeacherRating } from '@/server/ratings'
import { moderateComment } from './ai'
import type { ModerationScores } from './ai'
import { runRuleChecks } from './rules'
import type { RuleFlag } from './rules'

/**
 * THE TWO RULES THAT MATTER
 *
 * 1. Nothing waits for a human. One person runs this site and cannot read
 *    comments daily, so every review that gets a decision gets it here and
 *    now. A rejected student is told what to fix and sends it again. A
 *    review nobody ever looks at is worse than a review decided by a rule.
 *
 * 2. Nothing publishes on error. That has not changed and must not.
 *
 * So PENDING now means exactly one thing: the AI could not be reached, so
 * nobody has decided yet. A retry picks those up later. No other path in
 * this file may leave a review PENDING.
 *
 * Every decision writes a ModerationResult row. For a rejection that row
 * is not bookkeeping: it is what the student is shown as the reason, via
 * rejectionMessage() in ./messages.
 *
 * There are no emails here. One email per flagged review is one email a day
 * nobody reads. The only mail is a weekly digest and a failure alert, both
 * elsewhere.
 */

// The rule checks never called an AI, so there is no model to name.
const RULES_ONLY = 'rules'

// A phone number, an email address or a link. None of them belongs in a
// review, and none of them is a judgement call, so none of them is worth
// paying the AI to look at.
const CONTACT_FLAGS: RuleFlag[] = ['PHONE_NUMBER', 'EMAIL_ADDRESS', 'URL']

type Outcome = {
  status: ReviewStatus
  decision: ModerationDecision
  scores: ModerationScores | null
  ruleFlags: RuleFlag[]
  model: string
  latencyMs: number | null
  error: string | null
}

async function record(reviewId: string, outcome: Outcome) {
  await prisma.moderationResult.create({
    data: {
      reviewId,
      decision: outcome.decision,
      // Never shown to a student. Kept so a decision can be explained later.
      scores: outcome.scores ?? {},
      ruleFlags: outcome.ruleFlags,
      model: outcome.model,
      latencyMs: outcome.latencyMs,
      error: outcome.error,
    },
  })
}

/**
 * Decides what happens to one review and writes the result down.
 *
 * Returns the status the review ended on, which is what the student is
 * told. A ModerationResult row is written on every path, including the ones
 * that never called the AI.
 */
export async function runModeration(reviewId: string): Promise<ReviewStatus> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    // No userId. Moderation decides about text, not about people.
    select: { id: true, status: true, comment: true, teacherId: true },
  })

  // Nothing to moderate and nothing to publish.
  if (!review) return 'PENDING'

  const comment = review.comment?.trim() ?? ''

  // a. Ratings alone cannot be abusive.
  if (comment.length === 0) {
    await apply(review.id, review.status, 'PUBLISHED', review.teacherId)

    await record(review.id, {
      status: 'PUBLISHED',
      decision: 'SAFE',
      scores: null,
      ruleFlags: [],
      model: RULES_ONLY,
      latencyMs: null,
      error: null,
    })

    return 'PUBLISHED'
  }

  const ruleFlags = runRuleChecks(comment)

  // b. A clear slur is certain, not a judgement call. No AI, no queue.
  //
  //    The enum has no value for "a rule rejected this", so these rows
  //    store HIGH_RISK as the nearest thing it has. ruleFlags is the real
  //    reason, and rejectionMessage() reads the flags before the decision
  //    for exactly that reason.
  if (ruleFlags.includes('BANNED_WORD')) {
    return rejectByRule(review.id, review.status, review.teacherId, ruleFlags)
  }

  // c. Contact details. Also certain: there is no innocent reason for a
  //    phone number in a review about teaching.
  if (CONTACT_FLAGS.some((flag) => ruleFlags.includes(flag))) {
    return rejectByRule(review.id, review.status, review.teacherId, ruleFlags)
  }

  // d. REPEATED_CHARS and ALL_CAPS reach here on purpose. Shouting is not
  //    abuse, and "sirrrrr" is not spam, so neither one decides anything by
  //    itself. They are carried into the row below as context for the
  //    verdict the AI gives.
  const output = await moderateComment(comment)

  const status: ReviewStatus =
    output.decision === 'SAFE'
      ? 'PUBLISHED'
      : // ERROR is not a verdict. Nobody decided, so nothing changes except
        // that it waits for a retry.
        output.decision === 'ERROR'
        ? 'PENDING'
        : // SPAM, SUSPICIOUS and HIGH_RISK are all a no. The student gets a
          // different sentence for each, from the decision on this row.
          'REJECTED'

  await record(review.id, {
    status,
    decision: output.decision,
    scores: output.scores,
    ruleFlags,
    model: output.model,
    latencyMs: output.latencyMs,
    error: output.error,
  })

  if (status === 'PENDING') {
    return keepPending(review.id, review.status, review.teacherId)
  }

  await apply(review.id, review.status, status, review.teacherId)
  return status
}

/**
 * A rejection the rules made on their own, before any AI call.
 */
async function rejectByRule(
  reviewId: string,
  current: ReviewStatus,
  teacherId: string,
  ruleFlags: RuleFlag[]
): Promise<ReviewStatus> {
  await apply(reviewId, current, 'REJECTED', teacherId)

  await record(reviewId, {
    status: 'REJECTED',
    decision: 'HIGH_RISK',
    scores: null,
    ruleFlags,
    model: RULES_ONLY,
    latencyMs: null,
    error: null,
  })

  return 'REJECTED'
}

/**
 * The AI could not be reached. The review waits, and a retry will decide it.
 *
 * A review that was PUBLISHED and is now being checked again has to stop
 * counting while it waits. A review already PENDING needs no write at all.
 */
async function keepPending(
  reviewId: string,
  current: ReviewStatus,
  teacherId: string
): Promise<ReviewStatus> {
  if (current !== 'PENDING') {
    await prisma.review.update({
      where: { id: reviewId },
      data: { status: 'PENDING', publishedAt: null },
    })

    await recalculateTeacherRating(teacherId)
  }

  return 'PENDING'
}

async function apply(
  reviewId: string,
  current: ReviewStatus,
  next: ReviewStatus,
  teacherId: string
) {
  if (current === next) return

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      status: next,
      // Only a published review has a published date.
      publishedAt: next === 'PUBLISHED' ? new Date() : null,
    },
  })

  // The averages must follow the status. Only this function writes them.
  await recalculateTeacherRating(teacherId)
}
