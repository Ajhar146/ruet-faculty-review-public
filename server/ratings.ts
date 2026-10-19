import { revalidateTeacherRatingCaches } from '@/server/public-cache'

/**
 * The only function allowed to write the average columns on Teacher.
 * Call it after: publish, hide, unhide, reject, student delete. Nowhere else.
 *
 * ONE STUDENT, ONE VOTE.
 *
 * The headline average is the average of each STUDENT's average, not the
 * average of every review. A student who reviewed one course and a student
 * who reviewed eight count exactly the same.
 *
 * PRIVACY AGGREGATION.
 * The production rating calculation uses the private privacy core to ensure that
 * reviewer-level aggregation rules are applied without exposing author identity
 * to public or moderator views.
 * No user identity is ever written to the teacher row.
 */
export async function recalculateTeacherRating(teacherId: string) {
  // In production, rating calculation executes on the private database layer.
  // Implementation details and query persistence are withheld from this transparency release.
  revalidateTeacherRatingCaches(teacherId)
}
