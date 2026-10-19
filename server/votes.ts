import { prisma } from '@/lib/prisma'
import { EMPTY_VOTE_SUMMARY } from '@/lib/votes'
import type { VoteSummaries, VoteSummary } from '@/lib/votes'

/**
 * Vote counts for the reviews on one page, and the viewer's own vote.
 *
 * ------------------------------------------------------------------
 * COUNTS ONLY. NOBODY LEARNS WHO VOTED.
 * ------------------------------------------------------------------
 *
 * The groupBy below groups on reviewId and value and returns _count. No
 * userId is selected, so no voter identity exists in this process to leak.
 *
 * The ONE per-viewer fact that ships is the CALLER'S OWN vote, read with
 * `where: { userId: viewerId }` — a filter on the caller's own id, never a
 * lookup of somebody else's. It is what makes their own button show as
 * pressed. A caller cannot ask this function about another student: the
 * viewerId comes from the session at every call site, never from an argument
 * a browser controls.
 *
 * NEW FILE, deliberately not server/reviews.ts. That file owns which columns
 * a review may leave the server with and the newest-first ordering, and both
 * are load-bearing. Votes have no business near either, so they live here and
 * nothing in server/reviews.ts changes.
 *
 * NOTHING HERE FEEDS A RATING. No caller of this file writes to Teacher, and
 * recalculateTeacherRating does not import it. See the note on ReviewVote in
 * schema.prisma for why that separation is the whole design.
 *
 * NOTHING HERE ORDERS ANYTHING. The counts are returned as a lookup keyed by
 * review id. Reviews keep the newest-first order server/reviews.ts gives
 * them; a downvoted review does not move.
 */

/**
 * Keyed by review id. A review with no votes is simply ABSENT from the
 * object, so a zero-vote review costs no row and no key; callers fall back to
 * EMPTY_VOTE_SUMMARY.

 *
 * `viewerId` is null for anyone who is not a signed-in student, in which case
 * the second query is skipped entirely rather than run with a null filter.
 */
export async function getVoteSummaries(
  reviewIds: string[],
  viewerId: string | null
): Promise<VoteSummaries> {
  const summaries: VoteSummaries = {}

  // No reviews on the page means no queries at all.
  if (reviewIds.length === 0) return summaries

  const [grouped, own] = await Promise.all([
    // TWO GROUPING KEYS, NO userId. One row per (review, value) pair.
    prisma.reviewVote.groupBy({
      by: ['reviewId', 'value'],
      where: { reviewId: { in: reviewIds } },
      _count: { _all: true },
    }),

    // The caller's own votes, and only the caller's. Not a list of voters:
    // userId is the FILTER here, and reviewId and value are all that come
    // back.
    viewerId
      ? prisma.reviewVote.findMany({
          where: { reviewId: { in: reviewIds }, userId: viewerId },
          select: { reviewId: true, value: true },
        })
      : Promise.resolve([]),
  ])

  for (const row of grouped) {
    const current = summaries[row.reviewId] ?? { up: 0, down: 0, mine: null }
    if (row.value === 'UP') current.up = row._count._all
    else current.down = row._count._all
    summaries[row.reviewId] = current
  }

  for (const row of own) {
    const current = summaries[row.reviewId] ?? { up: 0, down: 0, mine: null }
    current.mine = row.value
    summaries[row.reviewId] = current
  }

  return summaries
}

/**
 * The counts for ONE review, after a vote has been written.
 *
 * Same rule as above: two counts and the caller's own value. The action
 * returns exactly this and nothing more.
 */
export async function getVoteSummary(
  reviewId: string,
  viewerId: string
): Promise<VoteSummary> {
  const summaries = await getVoteSummaries([reviewId], viewerId)
  return summaries[reviewId] ?? EMPTY_VOTE_SUMMARY
}
