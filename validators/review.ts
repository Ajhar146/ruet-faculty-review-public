import { z } from 'zod'
import { SEMESTERS } from '@/lib/semesters'

// Every rating is 1 to 5. The database has a CHECK constraint too; this is
// the friendly half of the same rule.
const rating = z.number().int().min(1).max(5)

export const COMMENT_MIN = 20
export const COMMENT_MAX = 2000

export const submitReviewSchema = z.object({
  teacherId: z.uuid(),

  // Picked from the list, so it is already a real code. normaliseCourseCode()
  // still runs on the server: this only rejects what is obviously not a code.
  courseCode: z.string().trim().min(3).max(20),

  // One of the ten positional terms, IMPORTED from lib/semesters.ts rather
  // than retyped, so this list and the dropdown can never disagree.
  //
  // This used to be z.string().min(3).max(10), which measured length and
  // nothing else: "Fall 2025" is nine characters and passed, which is how
  // the one malformed row got in. So would "hello" and "2026".
  //
  // It matters most for the eight year-long courses whose courses.semester
  // is NULL. The comparison in server/eligibility.ts is skipped for those,
  // so before this they had no format check at all.
  semester: z.enum(SEMESTERS),

  ratingTeaching: rating,
  ratingClarity: rating,
  ratingFairness: rating,
  ratingOverall: rating,

  // OPTIONAL. Ratings alone are a valid review. Either missing, empty, or
  // a real comment. Nothing in between.
  comment: z
    .string()
    .trim()
    .max(COMMENT_MAX, `Keep the comment under ${COMMENT_MAX} characters.`)
    .refine((value) => value.length === 0 || value.length >= COMMENT_MIN, {
      message: `Write at least ${COMMENT_MIN} characters, or leave the comment empty.`,
    })
    .optional(),

  // Not a boolean. false must fail, not pass through as "unchecked".
  agreedToGuidelines: z.literal(true),

  // Reviewer authorization recovery phrase, provided locally from browser storage.
  // The server uses this to authorize anonymous review management without storing user links.
  schoolKeyword: z
    .string()
    .trim()
    .min(1, 'Enter your school word to submit a review.')
    .max(64, 'The school word must be 64 characters or fewer.'),
})

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>

// Long enough for a course name, not just a code. "Object Oriented
// Programming Sessional" is 38 characters.
export const suggestQuerySchema = z.string().trim().max(60)

// A department short code, e.g. "CSE" or "Arch". Only used to narrow the
// suggestion list to the teacher's own department.
export const shortCodeSchema = z.string().trim().min(2).max(10)

// Three tries per review: the first submission plus two fixes. Enough to
// correct a real mistake, not enough to grind against the filter until
// something gets through.
export const MAX_SUBMITS = 3

/**
 * Sending a rejected review again.
 *
 * The ratings and the comment are all that may change. teacherId,
 * courseCode and semester are deliberately NOT in this schema: they are the
 * things eligibility was checked against, so they are read from the stored
 * row and anything resembling them in the request is ignored.
 */
export const resubmitReviewSchema = z.object({
  reviewId: z.uuid(),

  ratingTeaching: rating,
  ratingClarity: rating,
  ratingFairness: rating,
  ratingOverall: rating,

  comment: z
    .string()
    .trim()
    .max(COMMENT_MAX, `Keep the comment under ${COMMENT_MAX} characters.`)
    .refine((value) => value.length === 0 || value.length >= COMMENT_MIN, {
      message: `Write at least ${COMMENT_MIN} characters, or leave the comment empty.`,
    })
    .optional(),
})

export const APPEAL_MAX = 500

export const appealReviewSchema = z.object({
  reviewId: z.uuid(),
  appealText: z
    .string()
    .trim()
    .min(1, 'Write a line about why we should look at it again.')
    .max(APPEAL_MAX, `Keep the appeal under ${APPEAL_MAX} characters.`),
})
