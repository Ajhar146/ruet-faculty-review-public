import { revalidateTag } from 'next/cache'

/**
 * The home page's two cross-request caches: the four totals (server/stats.ts)
 * and the Top rated grid (server/teachers.ts). Both are site-wide public data
 * and nothing else. Nothing that depends on who is asking may ever go in
 * either one.
 */
export const SITE_STATS_TAG = 'site-stats'
export const TOP_TEACHERS_TAG = 'top-teachers'

/**
 * One teacher page's public data: the profile and the course blocks
 * (server/teachers.ts, server/reviews.ts). Tagged by id, never by slug,
 * because the id is what every write path has in hand.
 */
export function teacherTag(teacherId: string): string {
  return `teacher:${teacherId}`
}

/**
 * Every cached teacher list: /teachers without a search, and each
 * department's sorted list (server/teachers.ts, server/departments.ts). One
 * tag for all of them, because one rating change can move a teacher in every
 * sort of every list they appear in.
 */
export const TEACHER_LIST_TAG = 'teacher-list'

// The ceiling on how stale either can be if an invalidation is missed (a
// script run outside Next, a new sign-up, a moderation that finished after
// its action had already returned).
export const PUBLIC_CACHE_REVALIDATE_SECONDS = 15 * 60

/**
 * Drops both caches. Call it AFTER the write has finished, from a server
 * action or a route handler, never from a render and never from a script
 * (revalidateTag throws outside a Next request).
 *
 * `expire: 0` means the next visitor gets fresh numbers, not the old ones
 * while a refresh happens in the background. updateTag would do the same but
 * throws in a route handler, and the retry-pending cron needs this too.
 *
 * Never throws. The review is already saved; a cache that could not be told
 * must not turn that into an error for the student. The 15-minute ceiling
 * still applies.
 *
 * With a teacherId it also drops that teacher's page data. The cron passes
 * none: every review it decides goes through recalculateTeacherRating, which
 * drops the teacher's tag itself.
 */
export function revalidatePublicTotals(teacherId?: string): void {
  tryRevalidate(() => {
    revalidateTag(SITE_STATS_TAG, { expire: 0 })
    revalidateTag(TOP_TEACHERS_TAG, { expire: 0 })
    if (teacherId) revalidateTag(teacherTag(teacherId), { expire: 0 })
  })
}

/**
 * Drops everything cached from a teacher's rating columns: that teacher's
 * page data and every teacher list. Called at the end of
 * recalculateTeacherRating, after its write.
 */
export function revalidateTeacherRatingCaches(teacherId: string): void {
  tryRevalidate(() => {
    revalidateTag(teacherTag(teacherId), { expire: 0 })
    revalidateTag(TEACHER_LIST_TAG, { expire: 0 })
  })
}

function tryRevalidate(run: () => void): void {
  try {
    run()
  } catch (error) {
    // Outside a Next request -- a `tsx` script calling
    // recalculateTeacherRating -- there is no cache in this process to drop,
    // and the 15-minute expiry covers the live site. Not an error worth a
    // line per teacher.
    if (error instanceof Error && error.message.includes('static generation store missing')) {
      return
    }
    console.error('[public-cache] could not revalidate', error)
  }
}
