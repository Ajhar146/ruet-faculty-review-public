import type { ReviewStatus } from '@/lib/types'

export const APPEAL_WAITING_MESSAGE =
  'We have received your appeal and an admin is reviewing it. You will see their decision here.'
export const APPEAL_REFUSED_MESSAGE =
  'An admin reviewed your appeal and kept this review rejected.'
export const APPEAL_DECIDED_MESSAGE =
  'An admin has already decided your appeal. This review cannot be changed again.'

/** Why this review is locked, or null when it is not locked. */
export function appealLockMessage(review: {
  status: ReviewStatus
  appealedAt: Date | string | null
  appealHandledAt: Date | string | null
}): string | null {
  if (review.appealedAt === null) return null
  if (review.appealHandledAt === null) return APPEAL_WAITING_MESSAGE
  return review.status === 'REJECTED'
    ? APPEAL_REFUSED_MESSAGE
    : APPEAL_DECIDED_MESSAGE
}
