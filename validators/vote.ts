import { z } from 'zod'

/**
 * What voteOnReview accepts, and nothing else.
 *
 * NO userId. The voter is the session, never an argument: a userId in this
 * schema would let any signed-in student cast a vote as somebody else, and
 * would put a voter's identity into a request body where it could be logged.
 *
 * The value is the enum's two members, matched exactly. A string here would
 * let anything through to Prisma and fail at the database instead of at the
 * edge, with a message nobody wants to show a student.
 */
export const voteOnReviewSchema = z.object({
  reviewId: z.uuid(),
  value: z.enum(['UP', 'DOWN']),
})

export type VoteOnReviewInput = z.infer<typeof voteOnReviewSchema>
