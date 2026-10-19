/**
 * Public Domain Types
 *
 * Handcrafted domain types for public transparency release.
 * These types replace internal ORM-generated database client models.
 */

export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'HIDDEN'

export type ModerationDecision = 'ALLOW' | 'BLOCK' | 'FLAG' | 'AUTO_HIDDEN'

export type Role = 'STUDENT' | 'TEACHER' | 'MODERATOR' | 'ADMIN'

export type ReportReason =
  | 'ABUSE'
  | 'INAPPROPRIATE'
  | 'SPAM'
  | 'HARASSMENT'
  | 'FALSE_INFORMATION'
  | 'OTHER'

export type VoteValue = 'UP' | 'DOWN'

export type AuditAction =
  | 'REVIEW_SUBMIT'
  | 'REVIEW_EDIT'
  | 'REVIEW_DELETE'
  | 'REVIEW_MODERATE'
  | 'REVIEW_APPEAL'
  | 'REPORT_HANDLE'

export interface Course {
  id: string
  code: string
  name: string
  departmentId: string
  semester: string | null
  createdAt: Date
  updatedAt: Date
}
