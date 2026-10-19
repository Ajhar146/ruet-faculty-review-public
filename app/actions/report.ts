'use server'

import { revalidatePath } from 'next/cache'
import { requireStudent } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hitLimit, isRateLimited, rateLimitMessage, recordRateLimitHit } from '@/lib/rate-limit'
import { revalidatePublicTotals } from '@/server/public-cache'
import { recalculateTeacherRating } from '@/server/ratings'
import { getSetting } from '@/server/settings'
import { reportReviewSchema } from '@/validators/report'
import { voteOnReviewSchema } from '@/validators/vote'
import { getVoteSummary } from '@/server/votes'
import type { VoteSummary } from '@/lib/votes'
import type { ActionResult } from './review'

// Five a day. Enough to flag what you read, not enough to bury a teacher
// you dislike.
const MAX_REPORTS_PER_DAY = 5
const ONE_DAY_MINUTES = 60 * 24

// Shown whether the review is missing, deleted, or never existed. The
// reporter learns nothing about which, because any difference between those
// answers is a way to probe the database.
const GENERIC_FAILURE = 'Something went wrong. Please try again.'

/**
 * A student reports one review.
 *
 * Reporting is a student tool. A teacher who thinks a review is false uses
 * /contact, which reaches a human, so this action refuses every role but
 * STUDENT — checked here, on the server, not only in the UI.
 *
 * The result never says anything about the review's state: not the report
 * count, not how close it is to being hidden, not whether this person has
 * already reported it, and never who wrote it.
 */
export async function reportReview(input: unknown): Promise<ActionResult> {
  // 1. Who is this, and is their ROLE allowed? A teacher is signed in. They
  //    still may not report.
  const user = await requireStudent()

  // 2. Validate on the server, even though the modal already did.
  const parsed = reportReviewSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? 'Please pick a reason and try again.' }
  }

  const { reviewId, reason } = parsed.data
  const description = parsed.data.description?.length ? parsed.data.description : null

  // 3. Load the review. userId is read to check ownership and nothing else;
  //    it never leaves the server. No `include: { user: true }`. Not once.
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      userId: true,
      teacherId: true,
      status: true,
      deletedAt: true,
      teacher: { select: { slug: true } },
    },
  })

  if (!review || review.deletedAt) return { ok: false, error: GENERIC_FAILURE }

  // 4. A server-side id comparison, and nothing more. The question is "is
  //    this mine", never "whose is this".
  if (review.userId === user.id) {
    return { ok: false, error: 'You cannot report your own review.' }
  }

  // 5. Going too fast? Counted here, spent in step 6.
  const bucket = `report:${user.id}`
  if (await isRateLimited(bucket, MAX_REPORTS_PER_DAY, ONE_DAY_MINUTES)) {
    return { ok: false, error: 'Too many requests. Please wait and try again.' }
  }

  // 6. The unique index on (reviewId, reporterId) is what stops a second
  //    report from the same person. Do not check first with findFirst: two
  //    clicks at the same moment would both pass that check.
  try {
    await prisma.reviewReport.create({
      data: { reviewId: review.id, reporterId: user.id, reason, description },
    })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {

      // Already reported by this person. Returns exactly what a first
      // report returns, down to spending the rate limit hit, so a second
      // attempt cannot be told apart from a first one.
      await recordRateLimitHit(bucket)
      return { ok: true }
    }

    throw error
  }

  // 7. The row exists, so now it counts.
  await recordRateLimitHit(bucket)

  const updated = await prisma.review.update({
    where: { id: review.id },
    data: { reportCount: { increment: 1 } },
    select: { reportCount: true, status: true, teacherId: true },
  })

  // 8. The threshold lives in the settings table, never in this file, so it
  //    can change without a deploy.
  const threshold = Number(await getSetting('auto_hide_report_count'))

  if (!Number.isFinite(threshold) || threshold < 1) {
    // A broken setting must not auto-hide at one report. Leave the review
    // alone and make the bad value loud, rather than acting on it.
    console.error('[report] auto_hide_report_count is not a usable number')
    return { ok: true }
  }

  // This is the safety net that works while the admin is asleep.
  if (updated.reportCount >= threshold && updated.status === 'PUBLISHED') {
    await prisma.review.update({
      where: { id: review.id },
      // Hidden, never deleted. The row stays for audit.
      data: { status: 'HIDDEN' },
    })

    // A hidden review stops counting, so the average moves. Only this
    // function writes those columns.
    await recalculateTeacherRating(updated.teacherId)

    // actorId is null because the system did it, not a person. If someone
    // complains in six months, this row is the only record there will be.
    await prisma.auditLog.create({
      data: {
        actorId: null,
        action: 'REVIEW_AUTO_HIDDEN',
        targetType: 'Review',
        targetId: review.id,
        meta: { reportCount: updated.reportCount, threshold },
      },
    })

    // TODO 5D: email the admin that a review was auto hidden. No email
    // service exists yet, and a mail failure must never stop the hide.

    revalidatePath(`/teachers/${review.teacher.slug}`)
    revalidatePublicTotals(updated.teacherId)
  }

  // 9. The same answer either way. The reporter is told nothing about what
  //    happened to the review.
  return { ok: true }
}

// ---------------------------------------------------------------
// Voting
// ---------------------------------------------------------------

/**
 * A student says whether they agree with a review.
 *
 * ------------------------------------------------------------------
 * THIS IS NOT REPORTING AND IT IS NOT A RATING
 * ------------------------------------------------------------------
 *
 * It shares this file with reportReview because they are the two things a
 * reader can do to someone else's review, and keeping them side by side is
 * how the difference stays obvious. Nothing in reportReview above was
 * changed.
 *
 * A VOTE NEVER REACHES A RATING. This action writes exactly one table,
 * review_votes. It does not call recalculateTeacherRating, it does not touch
 * Teacher, and it has NO eligibility check -- any signed-in student may vote
 * on a course they never took. That last point is precisely why a vote must
 * never be allowed near avgOverall: one-student-one-vote is a property of
 * ratings, and it holds only because voting is kept this far from them.
 *
 * A VOTE NEVER REORDERS ANYTHING. Reviews stay newest-first. The single
 * critical review among twelve positive ones is the one a junior most needs
 * to read, and nothing here can push it down.
 *
 * WHAT IT RETURNS: two counts and the caller's own value. No voter id, no
 * voter list, no "who voted" of any kind. See server/votes.ts.
 *
 * IDEMPOTENT IN THE USEFUL SENSE:
 *   no vote yet       -> create
 *   same value again  -> delete  (pressing again un-votes)
 *   opposite value    -> update
 *
 * The unique index on (reviewId, userId) is what makes that safe under two
 * taps at once: the upsert cannot produce a second row, so the worst a race
 * can do is land on the state the second tap asked for.
 */
export async function voteOnReview(
  input: unknown
): Promise<ActionResult<VoteSummary>> {
  // 1. ROLE FIRST, exactly as reportReview does it. A teacher or an admin is
  //    signed in and may read every review; neither may vote on one.
  const user = await requireStudent()

  // 2. Server-side validation, whatever the button sent.
  const parsed = voteOnReviewSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: GENERIC_FAILURE }

  const { reviewId, value } = parsed.data

  // 3. Going too fast. Same helper and same shape as every other action.
  if (await hitLimit('vote', user.id)) {
    return { ok: false, error: rateLimitMessage('vote') }
  }

  // 4. The review has to exist and be readable. userId is selected ONLY to
  //    compare with the caller's own id in step 5 and never returned -- the
  //    question is "is this mine", never "whose is this".
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, userId: true, status: true, deletedAt: true },
  })

  // Deleted, missing, or not published: one answer for all three, so the
  // response cannot be used to probe which reviews exist.
  if (!review || review.deletedAt || review.status !== 'PUBLISHED') {
    return { ok: false, error: GENERIC_FAILURE }
  }

  // 5. NOT YOUR OWN. The page hides the buttons on the viewer's own reviews;
  //    this is the rule, because the action is reachable without the page.
  if (review.userId === user.id) {
    return { ok: false, error: 'You cannot vote on your own review.' }
  }

  // 6. Create, switch, or un-vote. Read first, then one write: the unique
  //    index means a racing second tap cannot insert a duplicate, and both
  //    taps asked for the same end state anyway.
  const existing = await prisma.reviewVote.findUnique({
    where: { reviewId_userId: { reviewId: review.id, userId: user.id } },
    select: { id: true, value: true },
  })

  if (!existing) {
    await prisma.reviewVote.create({
      data: { reviewId: review.id, userId: user.id, value },
    })
  } else if (existing.value === value) {
    // Pressing the same button again clears the vote. The row is DELETED
    // rather than set to a third "none" value, which is why the enum has
    // only two: absence is the absence of an opinion.
    //
    // This is a vote, not a review. Rule 7 is about review text and is not
    // in play here; no review row is touched by this action at all.
    await prisma.reviewVote.delete({ where: { id: existing.id } })
  } else {
    await prisma.reviewVote.update({
      where: { id: existing.id },
      data: { value },
    })
  }

  // 7. Read the counts back from the database rather than adjusting a number
  //    in memory, so what the button shows is what is actually stored.
  return { ok: true, data: await getVoteSummary(review.id, user.id) }
}
