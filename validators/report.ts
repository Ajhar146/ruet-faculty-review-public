import { z } from 'zod'

// Long enough to explain, short enough that nobody writes an essay a human
// then has to read before every decision.
export const DESCRIPTION_MAX = 500

// These must match `enum ReportReason` in prisma/schema.prisma, in order.
//
// Written out rather than imported from the generated Prisma client: the
// modal is a client component, and the Prisma client must never reach the
// browser bundle.
export const REPORT_REASONS = [
  'PERSONAL_ATTACK',
  'HARASSMENT',
  'FALSE_ALLEGATION',
  'PERSONAL_INFO',
  'SPAM',
  'IRRELEVANT',
  'OTHER',
] as const

export type ReportReasonValue = (typeof REPORT_REASONS)[number]

// What the student reads. Sentence case, words a first year knows, and each
// one describes the review rather than accusing the person who wrote it.
export const REPORT_REASON_LABELS: Record<ReportReasonValue, string> = {
  PERSONAL_ATTACK: 'It insults the teacher instead of the teaching',
  HARASSMENT: 'It is harassment or a threat',
  FALSE_ALLEGATION: 'It accuses someone of something that did not happen',
  PERSONAL_INFO: 'It gives a phone number, an address, or names a student',
  SPAM: 'It is spam or an advertisement',
  IRRELEVANT: 'It is not about the teaching or the course',
  OTHER: 'Something else',
}

export const reportReviewSchema = z.object({
  reviewId: z.uuid(),

  // Not a plain string. An unknown reason must fail here, not reach the
  // database and get rejected by the enum with a Prisma message.
  reason: z.enum(REPORT_REASONS, 'Pick a reason.'),

  // Optional, and empty is the same as missing.
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX, `Keep it under ${DESCRIPTION_MAX} characters.`)
    .optional(),
})

export type ReportReviewInput = z.infer<typeof reportReviewSchema>
