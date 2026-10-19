import { prisma } from '@/lib/prisma'

/**
 * C: the mean avgOverall across every rated teacher on the site.
 *
 * SITE-WIDE, NEVER PER DEPARTMENT. The department page and the home page
 * have to shrink towards the same number, or "highest rated" would mean
 * something different on each and one of them would look wrong. A
 * department-local mean would also make a weak department's best teacher
 * outrank a strong department's, which is the opposite of what the sort
 * claims to say.
 *
 * ONLY TEACHERS WITH A RATING COUNT. avgOverall IS NULL is exactly "no
 * published reviews" -- recalculateTeacherRating() nulls the column when the
 * last one goes -- so this filter is the real test, not a proxy. Including
 * the unrated would drag C towards zero and flatten every ranking.
 *
 * ONE AGGREGATE, no rows. An AVG over an indexed boolean filter on 471 rows
 * is not worth caching, and a cache here would be the home-page stat band
 * mistake again: per-instance copies of a number, disagreeing.
 *
 * getTopRatedTeachers() does NOT call this. It derives the same mean from
 * rows it has already loaded for its own ranking, in one query rather than
 * two. The two methods are checked to agree; what must not be duplicated is
 * the FORMULA, and that lives in lib/ranking.ts.
 */
export async function getSiteMeanRating(): Promise<number | null> {
  const result = await prisma.teacher.aggregate({
    where: { isActive: true, avgOverall: { not: null } },
    _avg: { avgOverall: true },
  })

  const mean = result._avg.avgOverall

  // Null when no teacher on the site has a rating yet. A caller cannot
  // compute a weighted score without C, and should fall back to an ordering
  // that does not need one rather than invent a value.
  return mean === null ? null : Number(mean)
}
