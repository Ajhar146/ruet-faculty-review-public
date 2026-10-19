import type { CourseOption } from '@/server/courses'

/**
 * An unsent review, kept in the browser so a dropped connection does not
 * throw away what a student typed.
 *
 * WHY THIS EXISTS. Most of these are written on mobile data on a campus. A
 * submit that fails takes the whole form with it, and nobody writes the same
 * review twice. The site runs on reviews, so losing one to a flaky signal is
 * the most expensive bug on the page.
 *
 * WHAT IS STORED. Only this student's own unsent text: the course they
 * picked, the semester, four ratings and the comment. Never anything about
 * another student, never a user id, and never a review that has already been
 * accepted — the draft is deleted the moment a submit comes back ok,
 * whatever the moderation decision was.
 *
 * Every read and write is wrapped. localStorage throws in a private window
 * and can be blocked outright, and a form that cannot save a draft must
 * still work perfectly.
 */

// Namespaced so it cannot collide with anything else on the origin.
const PREFIX = 'ruet:review-draft:'

// Older than this and it is not a draft any more, it is a forgotten tab.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type ReviewDraftRatings = {
  ratingTeaching: number
  ratingClarity: number
  ratingFairness: number
  ratingOverall: number
}

export type ReviewDraft = {
  // Null while they are still searching. The key carries the course code
  // once one is chosen, so a student with two half-written reviews for the
  // same teacher keeps both.
  course: CourseOption | null
  semester: string
  ratings: ReviewDraftRatings
  comment: string
  savedAt: number
}

/**
 * One key per teacher and course, as specified. Before a course is picked
 * there is nothing to key on, so those drafts share the teacher's empty
 * slot and move to their own key as soon as a course is chosen.
 */
function keyFor(teacherId: string, courseCode: string | null): string {
  return `${PREFIX}${teacherId}:${courseCode ?? ''}`
}

function isRatings(value: unknown): value is ReviewDraftRatings {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.ratingTeaching === 'number' &&
    typeof candidate.ratingClarity === 'number' &&
    typeof candidate.ratingFairness === 'number' &&
    typeof candidate.ratingOverall === 'number'
  )
}

/**
 * Anything could be under this key: another version of the app wrote it, or
 * a person typed it in the console. Checked field by field rather than cast,
 * so a malformed draft is dropped instead of crashing the form.
 */
function parse(raw: string): ReviewDraft | null {
  let value: unknown

  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Record<string, unknown>

  if (typeof candidate.savedAt !== 'number') return null
  if (typeof candidate.semester !== 'string') return null
  if (typeof candidate.comment !== 'string') return null
  if (!isRatings(candidate.ratings)) return null

  let course: CourseOption | null = null

  if (candidate.course !== null && typeof candidate.course === 'object') {
    const row = candidate.course as Record<string, unknown>
    if (typeof row.code !== 'string' || typeof row.name !== 'string') return null

    course = {
      code: row.code,
      name: row.name,
      semester: typeof row.semester === 'string' ? row.semester : null,
      reviewCount: typeof row.reviewCount === 'number' ? row.reviewCount : 0,
    }
  }

  return {
    course,
    semester: candidate.semester,
    ratings: candidate.ratings,
    comment: candidate.comment,
    savedAt: candidate.savedAt,
  }
}

/** Every stored key, or an empty list when storage is unavailable. */
function allKeys(): string[] {
  try {
    const keys: string[] = []

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key !== null && key.startsWith(PREFIX)) keys.push(key)
    }

    return keys
  } catch {
    return []
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing to do. A draft that cannot be deleted will expire.
  }
}

/** Deletes every draft past MAX_AGE_MS, for every teacher. */
export function pruneExpiredDrafts(now = Date.now()): void {
  for (const key of allKeys()) {
    let raw: string | null = null

    try {
      raw = localStorage.getItem(key)
    } catch {
      return
    }

    // Unreadable or stale. Either way it is not coming back.
    const draft = raw === null ? null : parse(raw)
    if (draft === null || now - draft.savedAt > MAX_AGE_MS) remove(key)
  }
}

/**
 * The newest usable draft for this teacher, across every course.
 *
 * The form asks before a course is chosen, so it cannot know which key to
 * look under. Reading all of this teacher's drafts and taking the most
 * recent is what lets the course itself be restored.
 */
export function loadDraft(teacherId: string, now = Date.now()): ReviewDraft | null {
  const prefix = `${PREFIX}${teacherId}:`
  let newest: ReviewDraft | null = null

  for (const key of allKeys()) {
    if (!key.startsWith(prefix)) continue

    let raw: string | null = null

    try {
      raw = localStorage.getItem(key)
    } catch {
      return null
    }

    const draft = raw === null ? null : parse(raw)

    if (draft === null || now - draft.savedAt > MAX_AGE_MS) {
      remove(key)
      continue
    }

    if (newest === null || draft.savedAt > newest.savedAt) newest = draft
  }

  return newest
}

/**
 * True when there is anything worth keeping.
 *
 * Opening the form and leaving must not create a draft, or the next visit
 * would announce that an empty one was restored.
 */
export function draftIsWorthKeeping(draft: Omit<ReviewDraft, 'savedAt'>): boolean {
  if (draft.course !== null) return true
  if (draft.comment.trim().length > 0) return true

  return Object.values(draft.ratings).some((value) => value > 0)
}

export function saveDraft(
  teacherId: string,
  draft: Omit<ReviewDraft, 'savedAt'>,
  now = Date.now()
): void {
  try {
    localStorage.setItem(
      keyFor(teacherId, draft.course?.code ?? null),
      JSON.stringify({ ...draft, savedAt: now })
    )
  } catch {
    // Full, blocked, or private browsing. The form carries on; the only
    // thing lost is the safety net.
  }
}

/**
 * Called the moment a submit is accepted.
 *
 * Two keys go, not one. The obvious one is the course just submitted. The
 * other is the teacher's empty slot, written while they were still choosing
 * a course: left behind, it would be offered back later as a draft for a
 * review that is already on the server.
 *
 * A draft for a DIFFERENT course by the same teacher is left alone. That is
 * a second review they have not finished, and it is still theirs.
 */
export function clearDraft(teacherId: string, courseCode: string | null): void {
  remove(keyFor(teacherId, courseCode))
  remove(keyFor(teacherId, null))
}
