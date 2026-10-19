import type { ModerationDecision } from '@/lib/types'
import type { RuleFlag } from './rules'

/**
 * What a rejected student is told, and why this file exists.
 *
 * Nobody reviews these by hand any more, so the sentence the student reads
 * is the whole of the feedback they get. Each one says what to do next,
 * because a rejected review is meant to be fixed and sent again, not
 * argued about.
 *
 * None of them says which word or which rule fired. Telling someone
 * exactly what tripped the filter teaches them how to get around it.
 *
 * The message is not stored anywhere. It is derived from the
 * ModerationResult row, so the row is what the student is really being
 * shown, and one row can never disagree with the sentence beside it.
 */

// The five reasons, and the only five. A closed set, so nothing can invent
// a sixth that has no sentence to go with it.
export type RejectionReason =
  | 'language'
  | 'contact'
  | 'spam'
  | 'attack'
  | 'allegation'

const SENTENCES: Record<RejectionReason, string> = {
  language:
    'Your review uses language we do not allow. Please read the guidelines and rewrite it.',
  contact:
    'Reviews cannot contain phone numbers, email addresses or links. Please remove them and submit again.',
  spam: 'This does not look like a review of a course. Please write about the teaching.',
  attack:
    'Reviews cannot contain personal insults. Write about the teaching, not the person.',
  allegation:
    'We cannot publish accusations we have no way to check, such as claims about money or misconduct. Please write about your experience of the course instead.',
}

const CONTACT_FLAGS: RuleFlag[] = ['PHONE_NUMBER', 'EMAIL_ADDRESS', 'URL']

/**
 * Rule flags are read BEFORE the decision, and that order matters.
 *
 * A rule rejection never reached the AI, so its row carries no real verdict
 * and `decision` is only the closest value the enum has. The flags are the
 * true reason on those rows, so they win.
 */
function reasonFor(
  decision: ModerationDecision,
  ruleFlags: RuleFlag[]
): RejectionReason | null {
  if (ruleFlags.includes('BANNED_WORD')) return 'language'
  if (CONTACT_FLAGS.some((flag) => ruleFlags.includes(flag))) return 'contact'

  switch (decision) {
    case 'SPAM':
      return 'spam'
    case 'SUSPICIOUS':
      return 'attack'
    case 'HIGH_RISK':
      return 'allegation'
    // SAFE was published. ERROR means nobody decided, so there is nothing
    // to tell the student yet beyond "still being checked".
    default:
      return null
  }
}

/**
 * The sentence for one ModerationResult row, or null when that row is not
 * a rejection.
 */
export function rejectionMessage(
  decision: ModerationDecision,
  ruleFlags: RuleFlag[]
): string | null {
  const reason = reasonFor(decision, ruleFlags)
  return reason === null ? null : SENTENCES[reason]
}
