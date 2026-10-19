import { prisma } from '@/lib/prisma'

// The app reads settings, it never hardcodes them. These are only the
// fallbacks used when the row is missing, so the site still runs.
//
// Exported so a test can assert the caps are all still here with the values
// they are meant to have. Nothing reads it directly; use getSetting().
export const DEFAULTS: Record<string, string> = {
  reviews_enabled: 'true',
  maintenance_mode: 'false',

  // STUDENTS, not reviews. Three reviews from one student are one student's
  // opinion; these thresholds count distinct writers so that one person
  // cannot switch a rating on by reviewing the same teacher repeatedly.
  min_students_for_display: '4',
  min_students_for_ranking: '8',

  auto_hide_report_count: '5',

  // How many reviews one student may write: in a day across the whole
  // site, and for a single teacher for all time and per calendar month.
  max_reviews_per_day: '5',
  max_reviews_per_teacher: '8',
  max_reviews_per_teacher_month: '5',

  // And how many about ONE teacher in ONE day. The lifetime cap of eight
  // already limits the total, but nothing stopped all eight arriving in one
  // afternoon, which is what a bad week looks like from the teacher's side.
  max_reviews_per_teacher_day: '3',

  // How many DIFFERENT teachers one student may review for a single course.
  // At RUET a course is taught by one or two people, so two is the honest
  // ceiling; it is a setting and not a constant so it can go to 3 when a
  // teacher really did change mid-semester and a student is stuck.
  max_teachers_per_course: '2',

  pending_digest_day: '0',
}

const TTL_MS = 60_000

type CacheEntry = {
  value: string
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

export async function getSetting(key: string): Promise<string> {
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  let value = DEFAULTS[key] ?? ''

  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } })
    if (row) value = row.value
  } catch {
    // A database problem must never take a page down over a setting.
    // Fall through with the default.
  }

  cache.set(key, { value, expiresAt: Date.now() + TTL_MS })
  return value
}

/**
 * Drops one key from the cache so the next read goes to the database.
 *
 * setSetting() calls this. Without it an admin flips a toggle, nothing
 * changes for up to 60 seconds, and the switch looks broken.
 *
 * The cache lives in one server process. On Vercel another instance can
 * still serve the old value until its own 60 seconds are up.
 */
export function clearSettingCache(key: string): void {
  cache.delete(key)
}
