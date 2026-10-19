/**
 * The confidence-weighted rating, in ONE place.
 *
 * ------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ------------------------------------------------------------------
 *
 * The formula was written inline inside getTopRatedTeachers() in
 * server/teachers.ts, which was fine while the home page was its only
 * caller. The department page's "highest rated" sort is the second, and two
 * pages ranking teachers by two copies of one formula is two pages that
 * eventually disagree about who is best -- at which point one of them is
 * simply wrong and nobody can tell which.
 *
 * So the arithmetic lives here and both callers import it. If this changes,
 * it changes for both, which is the only safe way for it to change.
 *
 * ------------------------------------------------------------------
 * WHAT IT DOES
 * ------------------------------------------------------------------
 *
 *   weighted = (v / (v + m)) * R + (m / (v + m)) * C
 *
 *     R  the teacher's own avgOverall
 *     v  that teacher's studentCount -- DISTINCT STUDENTS, never reviews
 *     m  RANKING_PRIOR_STUDENTS, below
 *     C  the mean avgOverall across every rated teacher on the site
 *
 * It is the standard Bayesian shrinkage estimator: a teacher starts at the
 * site average and earns their own number as more distinct students review
 * them. Two 5.00s land near C; twenty-five 4.70s land near 4.70.
 *
 * ORDER ONLY, NEVER DISPLAYED. Every card shows the teacher's real
 * avgOverall, because that is what a reader believes the number to be. This
 * decides which card comes first and leaves no trace in the output.
 *
 * NOT FOR FILTERING either. It decides sequence, not eligibility -- a
 * teacher is in or out of a list for reasons that have nothing to do with
 * this number.
 *
 * Pure: no database, no I/O. C is supplied by the caller, from
 * server/ranking.ts getSiteMeanRating() or from rows the caller already has.
 */

/**
 * m: how many students' worth of evidence it takes before a teacher's own
 * average outweighs the site average in the ordering.
 *
 * At v = m the score sits exactly halfway between R and C. So 8 means a
 * teacher with 8 distinct students is ranked half on their own record and
 * half on the site's, 2 students is weighted 20/80 towards the site average,
 * and 24 students is 75/25 towards their own.
 *
 * WHY 8. It is the value min_students_for_ranking held before it was
 * lowered -- the number this project already considered "enough students to
 * believe a teacher's average on its own". Raising m flattens every list
 * towards C; lowering it lets small samples back to the top.
 *
 * Deliberately NOT a setting. min_students_for_ranking decides who is
 * eligible and is a judgement an admin makes; this is the shape of the
 * estimator, and a wrong value here is a silently bad ordering rather than a
 * visibly wrong list.
 */
export const RANKING_PRIOR_STUDENTS = 8

export function weightedRating(
  avgOverall: number,
  studentCount: number,
  siteMean: number
): number {
  const v = studentCount
  const m = RANKING_PRIOR_STUDENTS

  return (v / (v + m)) * avgOverall + (m / (v + m)) * siteMean
}
