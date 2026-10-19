import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { PUBLIC_CACHE_REVALIDATE_SECONDS, SITE_STATS_TAG } from '@/server/public-cache'

/**
 * The four numbers on the home page.
 *
 * ------------------------------------------------------------------
 * CACHED ACROSS REQUESTS, IN THE SHARED DATA CACHE. NOT PER INSTANCE.
 * ------------------------------------------------------------------
 *
 * There used to be a one-hour module-level cache here, the same shape as the
 * one in server/settings.ts. It made the band move BACKWARDS: each serverless
 * instance held its own snapshot, so two refreshes on two instances could
 * show two different ages of the same counts. Never go back to that.
 *
 * unstable_cache is a different thing. On Vercel it is one Data Cache shared
 * by every instance, so every visitor reads the same snapshot and the band
 * cannot move backwards between refreshes. It is dropped by tag
 * (revalidatePublicTotals in server/public-cache.ts) the moment a review is
 * published, hidden, rejected, edited or deleted, and expires after 15
 * minutes regardless. The one count that is not invalidated on write is
 * studentsSignedUp, which can lag a new sign-up by up to 15 minutes.
 *
 * NOTHING REQUEST-SPECIFIC MAY BE READ INSIDE readSiteStats. No cookies(),
 * no headers(), no session: unstable_cache throws on those at runtime, and
 * the result is shared with every visitor.
 *
 * PRIVACY. `studentsSignedUp` is a site-wide total and nothing else. It is
 * never broken down by department, by year, or by anything else: on a campus
 * this small a narrow count identifies people. "1 student in URP reviewed a
 * teacher" is a name to anyone who knows the year.
 *
 * Every number here is a COUNT. Not one of these queries returns a row, an
 * id or an email into this process, so there is nothing for a page to leak
 * even by accident.
 */

// Below this, the strip is not shown at all and this returns null.
//
// A strip reading "7 reviews from 4 students" tells a visitor the site is
// dead, which is worse than showing nothing — the whole point of the strip
// is that other people are already here.
//
// ------------------------------------------------------------------
// NOTHING READS THIS ANY MORE.
// ------------------------------------------------------------------
//
// It used to gate the home page's four-number band: below it getSiteStats
// returned null and the band was not rendered, so a nearly-empty site did not
// advertise how empty it was. That gate was removed by decision — the band
// now shows from day one, zeros included.
//
// It is left here, unused, pending a decision on whether to delete it or
// point it at something else. It is a constant and not a row in
// system_settings, so it was never changeable from the admin page anyway.
//
// If you are reading this because you want a threshold: there is no caller to
// add one to. Wire it up deliberately or delete it.
export const MIN_REVIEWS_FOR_STATS = 50

export type SiteStats = {
  // PUBLISHED and not deleted. Pending, rejected and hidden reviews are not
  // "reviews" to a visitor; they cannot read any of them.
  reviews: number
  // STUDENT accounts that exist, not accounts that have written. Role
  // STUDENT only and not banned, so the admin and any TEACHER account are
  // excluded — counting those would inflate a number about students with
  // people who are not students.
  //
  // Renamed from `students`, which meant writers. The two numbers are
  // different and a page reading one while meaning the other is the kind of
  // mistake nobody notices.
  studentsSignedUp: number
  // Teachers with at least one published review.
  teachers: number
  // DISTINCT courses with at least one published review.
  //
  // PUBLISHED only, unlike the caps. A cap counts a rejected review because
  // the student did use a submission; this card is about what a visitor can
  // actually open and read, and a rejected review is not something they can
  // read. A deleted one does not keep its course counted either.
  //
  // Replaced `departments`, which counted departments with a reviewed
  // teacher. Courses is the more useful number: 18 departments is a ceiling
  // the site reaches almost at once, while courses keeps growing and is what
  // a student is actually looking for.
  coursesReviewed: number
}

// Published, still there. Used by three of the four counts, so it is written
// once.
const PUBLISHED = { status: 'PUBLISHED', deletedAt: null } as const

/**
 * How many student accounts exist.
 *
 * AN AGGREGATE AND NOTHING ELSE. It returns one integer. There is no query
 * here that could be widened into a list, and nothing it returns can be
 * clicked through to a person — which is the whole point of showing a total
 * at all. If this ever needs to become a breakdown, it does not: on a campus
 * this small a narrow count identifies people.
 *
 * Role STUDENT only, so the admin account and any TEACHER account are out.
 * Banned accounts are out too: they cannot sign in, so counting them would
 * claim an audience the site does not have.
 */
async function countStudentAccounts(): Promise<number> {
  return prisma.user.count({
    where: { role: 'STUDENT', isBanned: false },
  })
}

/**
 * The four numbers. Always, whatever they are, including four zeros.
 *
 * NO THRESHOLD ANY MORE. This used to return null below
 * MIN_REVIEWS_FOR_STATS so a nearly-empty site did not advertise how empty it
 * was. That gate is gone by decision: the band shows from day one.
 *
 * null now means ONE thing — the counts could not be read. It is not a
 * judgement about the numbers, and the home page renders nothing in that
 * case rather than four dashes.
 *
 * Never throws. A failed count hides the band; it does not take down the most
 * visited page on the site.
 *
 * The failure is caught OUTSIDE the cache on purpose: readSiteStats throws,
 * unstable_cache does not store a throw, and so one failed read cannot hide
 * the band for fifteen minutes.
 */
const readSiteStats = unstable_cache(
  async (): Promise<SiteStats> => {
    const [reviews, studentsSignedUp, teachers, coursesReviewed] = await Promise.all([
      prisma.review.count({ where: PUBLISHED }),

      countStudentAccounts(),

      prisma.teacher.count({ where: { reviews: { some: PUBLISHED } } }),

      // `some` is what makes this DISTINCT: it counts COURSE rows that have
      // at least one matching review, never the reviews themselves, so a
      // course with twenty reviews counts once. Still an aggregate — no id
      // and no row leaves the database.
      prisma.course.count({ where: { reviews: { some: PUBLISHED } } }),
    ])

    return { reviews, studentsSignedUp, teachers, coursesReviewed }
  },
  ['site-stats'],
  { revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS, tags: [SITE_STATS_TAG] }
)

export async function getSiteStats(): Promise<SiteStats | null> {
  try {
    return await readSiteStats()
  } catch (error) {
    // The next visit simply tries again. Nothing is remembered, so one failed
    // query cannot hide the band for an hour the way it used to.
    console.error('[stats] could not read the site totals', error)
    return null
  }
}
