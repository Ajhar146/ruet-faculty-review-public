/**
 * Public Persistence Contract
 *
 * This contract defines the conceptual public database boundary for the transparency release.
 * The production Prisma client, database credentials, pool configurations, and migrations
 * are intentionally withheld from this public repository.
 */

import type { PublicReview, CourseReviews } from '@/server/reviews'
import type { QueueReview } from '@/server/admin'

export interface PublicReviewRepository {
  /**
   * Retrieves public reviews for a teacher, aggregated by course.
   * Guarantees that public review payloads do not include author identities.
   */
  getTeacherReviews(teacherId: string): Promise<CourseReviews[]>

  /**
   * Paged retrieval of published reviews for a specific course.
   */
  getCourseReviews(courseId: string, limit: number, offset: number): Promise<PublicReview[]>
}

export interface ModeratorReviewRepository {
  /**
   * Retrieves reviews requiring moderation review.
   * Guarantees that queue payloads exclude author account identifiers and emails.
   */
  getModerationQueue(): Promise<QueueReview[]>
}
