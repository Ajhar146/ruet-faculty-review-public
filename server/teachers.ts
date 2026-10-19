import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { getDepartments } from '@/server/departments'
import {
  PUBLIC_CACHE_REVALIDATE_SECONDS,
  TEACHER_LIST_TAG,
  TOP_TEACHERS_TAG,
  teacherTag,
} from '@/server/public-cache'
import { matchesAsInitials } from '@/lib/teacher-initials'
import { nameMatchScore } from '@/lib/name-similarity'
import { weightedRating } from '@/lib/ranking'
import type { SearchParams } from '@/validators/search'

export const PAGE_SIZE = 24

function toRating(value: number | { toString(): string } | null): number | null {
  return value === null ? null : Number(value)
}


export type TeacherCardData = {
  slug: string
  nameEn: string
  nameBn: string | null
  designation: string
  isHead: boolean
  imageUrl: string | null
  avgOverall: number | null
  reviewCount: number
  // Distinct students who reviewed this teacher. The display and ranking
  // thresholds count THIS, not reviewCount.
  studentCount: number
  departmentId: string
}

export type SearchResult = {
  teachers: TeacherCardData[]
  total: number
  page: number
  totalPages: number
}

// select, not include. Only what the card needs leaves the server.
//
// departmentId, not a nested department select. A nested select makes Prisma
// run a second query against departments, and when the page has no rows that
// query is `WHERE id IN (NULL)`. The caller already loads the department list
// for the filter, so it can turn the id into a short code without asking the
// database again.
//
// ONE CONSTANT, because the substring path and the fuzzy path both read it. Two
// copies of a select is how a column ends up shipping from one path and not
// the other.
const CARD_SELECT = {
  slug: true,
  nameEn: true,
  nameBn: true,
  designation: true,
  isHead: true,
  imageUrl: true,
  avgOverall: true,
  reviewCount: true,
  studentCount: true,
  departmentId: true,
} as const

/**
 * How close two names have to be before the fuzzy half of the search calls
 * them a match. pg_trgm's similarity(): 0 is nothing in common, 1 identical.
 *
 * ONE CONSTANT, read in one place -- the raw query below. A threshold copied
 * into two branches is a threshold that gets tuned in one of them.
 *
 * 0.3 is the starting point, deliberately not pg_trgm's own default of 0.3
 * by coincidence: it is the value to tune once there are real queries to look
 * at. For reference, on this database "manhaz" scores 0.4 against "Minhazul".
 *
 * RAISING IT is the safe direction. Lowering it does not find more of what a
 * student meant, it returns most of the department for every query -- and a
 * miss is better than a page of noise, because a student can retype a name
 * but cannot un-see twenty wrong ones.
 */
export const FUZZY_SIMILARITY_THRESHOLD = 0.3

/**
 * Shorter than this, no fuzzy matching at all.
 *
 * At one or two characters everything is similar to everything: "ab" scores
 * above 0.3 against a large share of 471 names, so the fuzzy half would bury
 * the substring matches it is supposed to supplement. Substring search still
 * works at any length; this only gates the trigram half.
 */
const FUZZY_MIN_CHARS = 3

/**
 * WITHOUT A QUERY the list is the same for every viewer, so it is shared
 * across requests per (department filter, sort, page): unstable_cache, tag
 * teacher-list, dropped whenever a rating is recalculated. A search (?q=)
 * always runs live.
 *
 * Only a real department slug (or none) is cached. dept is any string up to
 * 20 characters, and a made-up one must not mint a cache entry; it runs live
 * and finds nothing, exactly as before.
 *
 * Stored: SearchResult -- per teacher slug, nameEn, nameBn, designation,
 * isHead, imageUrl, avgOverall, reviewCount, studentCount, departmentId; plus
 * total, page, totalPages. All of it is on the public card.
 */
export async function searchTeachers(params: SearchParams): Promise<SearchResult> {
  if (params.q) return readTeachers(params)

  const dept = params.dept ?? ''
  if (dept && !(await getDepartments()).some((d) => d.slug === dept)) {
    return readTeachers(params)
  }

  return unstable_cache(
    () => readTeachers({ ...params, q: undefined }),
    ['teacher-list', dept, params.sort, String(params.page)],
    { revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS, tags: [TEACHER_LIST_TAG] }
  )()
}

async function readTeachers(params: SearchParams): Promise<SearchResult> {
  const where: Record<string, unknown> = {
    isActive: true,
    ...(params.dept && { department: { slug: params.dept } }),
    ...(params.q && {
      OR: [
        { nameEn: { contains: params.q, mode: 'insensitive' } },
        { nameBn: { contains: params.q } },
        { designation: { contains: params.q, mode: 'insensitive' } },
        // "CSE" and "Computer Science" have to find teachers too. The
        // page promises search by department.
        { department: { shortCode: { contains: params.q, mode: 'insensitive' } } },
        { department: { nameEn: { contains: params.q, mode: 'insensitive' } } },
        // INITIALS: "RUB" finds "Dr. Md. Rafiqul Uz Bari". CONTAINS, not
        // startsWith, so "MR" still finds "AKMMR". Only for a query of two
        // or more characters with no spaces — see matchesAsInitials. One
        // more branch on the OR; nothing that matched before stops matching.
        ...(matchesAsInitials(params.q)
          ? [{ initials: { contains: params.q, mode: 'insensitive' as const } }]
          : []),
      ],
    }),
  }

  // nulls: 'last' matters. Every avgOverall is null today, and Postgres
  // sorts NULL first, so without it "highest rated" lists unrated teachers.
  const orderBy: Array<Record<string, unknown>> =
    params.sort === 'rating'
      ? [{ avgOverall: { sort: 'desc', nulls: 'last' } }, { reviewCount: 'desc' }]
      : params.sort === 'reviews'
        ? [{ reviewCount: 'desc' }, { nameEn: 'asc' }]
        : [{ nameEn: 'asc' }]

  // ------------------------------------------------------------------
  // THE FUZZY HALF. Substring first, trigram second, never interleaved.
  // ------------------------------------------------------------------
  //
  // Stage A is the query above, unchanged: name, designation, department and
  // initials, by CONTAINS. Everything that matched before this existed still
  // matches, in the same order.
  //
  // Stage B is pg_trgm similarity over the same name columns, and it only
  // ever sees rows stage A did not return. So a student who typed the name
  // correctly cannot be pushed below someone else's guess -- the two groups
  // are concatenated, not merged and re-sorted.
  //
  // IDS FIRST, ROWS AFTER. The combined order has to exist before a page can
  // be cut out of it, and ids are cheap: 471 rows, one column. The card
  // columns are then read for the 24 ids that page actually shows.
  const term = params.q?.trim() ?? ''

  if (term.length >= FUZZY_MIN_CHARS) {
    // A department filter has to narrow the fuzzy half too, or filtering to
    // CSE would quietly widen back out to every department.
    const departmentId = params.dept
      ? ((
          await prisma.department.findUnique({
            where: { slug: params.dept },
            select: { id: true },
          })
        )?.id ?? null)
      : null

    // A dept slug that matches nothing returns nothing, which is what the
    // Prisma `where` above already does for the substring half.
    const deptMissing = Boolean(params.dept) && departmentId === null

    const [exact, fuzzy] = await Promise.all([
      prisma.teacher.findMany({ where, orderBy, select: { id: true } }),

      deptMissing
        ? Promise.resolve([] as { id: string; nameEn: string; score: number }[])
        : // word_similarity, NOT similarity. This was measured, not assumed.
          //
          // similarity() compares two WHOLE strings, so it divides by the
          // union of both trigram sets -- and a full name is long. "manhaz"
          // against "A. K. M. Minhazul Rahman" scores 0.167 that way and was
          // missed entirely, as was "rohman" against the same row, even
          // though a human reads both as obvious matches.
          //
          // word_similarity(query, target) instead scores the query against
          // the best-matching continuous extent of words INSIDE the target:
          // the same two pairs score 0.300 and 0.429. Argument order matters
          // and is not symmetric -- query first, column second.
          //
          // NOT strict_word_similarity, which demands whole-word boundaries:
          // it scores "manhaz" against "Minhazul" at 0.231 and would still
          // miss it, because a student's misspelling rarely ends on a word
          // boundary.
          //
          // GREATEST over both name columns, so an English query and a Bangla
          // one are judged the same way. COALESCE because nameBn is nullable
          // and word_similarity(x, NULL) is NULL, which would make GREATEST
          // null and drop the row.
          //
          // Parameterised throughout -- the term reaches Postgres as a bind
          // value, never as concatenated SQL.
          prisma.$queryRaw<{ id: string; nameEn: string; score: number }[]>`
            SELECT
              id,
              "nameEn",
              GREATEST(
                word_similarity(${term}, "nameEn"),
                word_similarity(${term}, COALESCE("nameBn", ''))
              ) AS score
            FROM teachers
            WHERE "isActive" = true
              AND (CAST(${departmentId} AS uuid) IS NULL
                   OR "departmentId" = CAST(${departmentId} AS uuid))
              AND GREATEST(
                word_similarity(${term}, "nameEn"),
                word_similarity(${term}, COALESCE("nameBn", ''))
              ) >= ${FUZZY_SIMILARITY_THRESHOLD}
            ORDER BY score DESC, "nameEn" ASC
          `,
    ])

    const exactIds = exact.map((row) => row.id)
    const seen = new Set(exactIds)

    // RELEVANCE DECIDES THE FUZZY ORDER, and pg_trgm's score is not the
    // relevance a reader means. SQL already returns these by word_similarity
    // DESC; this re-sorts them by subsequence match, which is what puts
    // "A. K. M. Minhazul Rahman" first for "manhaz" instead of fourth. See
    // lib/name-similarity.ts for the measurements.
    //
    // RE-SORTING ONLY, never re-filtering: every row here already passed the
    // threshold in SQL, so this cannot add or drop a result. word_similarity
    // stays as the tiebreak, then name, so the order is deterministic.
    const rankedFuzzy = fuzzy
      .filter((row) => !seen.has(row.id))
      .map((row) => ({ ...row, relevance: nameMatchScore(term, row.nameEn) }))
      .sort(
        (a, b) =>
          b.relevance - a.relevance ||
          b.score - a.score ||
          a.nameEn.localeCompare(b.nameEn, 'en')
      )

    // Stage A first, always. Someone who typed the name correctly is never
    // below someone else's guess, whatever either scores.
    const orderedIds = [...exactIds, ...rankedFuzzy.map((row) => row.id)]

    const total = orderedIds.length
    const pageIds = orderedIds.slice((params.page - 1) * PAGE_SIZE, params.page * PAGE_SIZE)

    // One query for the page's rows. `id: { in: [...] }` comes back in
    // whatever order Postgres likes, so it is re-sorted into pageIds order
    // below -- the ordering lives in orderedIds, not in this query.
    const rows =
      pageIds.length === 0
        ? []
        : await prisma.teacher.findMany({
            where: { id: { in: pageIds } },
            select: { id: true, ...CARD_SELECT },
          })

    // id is the key and is destructured out of the value in the same step, so
    // it never reaches the card object.
    const byId = new Map(rows.map(({ id, ...card }) => [id, card]))

    return {
      teachers: pageIds
        .map((id) => byId.get(id))
        .filter((card): card is NonNullable<typeof card> => card !== undefined)
        .map(({ avgOverall, ...teacher }) => ({
          ...teacher,
          avgOverall: avgOverall === null ? null : Number(avgOverall),
        })),
      total,
      page: params.page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    }
  }

  // Rows and count at the same time, not one after the other.
  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: CARD_SELECT,
    }),
    prisma.teacher.count({ where }),
  ])

  return {
    teachers: teachers.map(({ avgOverall, ...teacher }) => ({
      ...teacher,
      // Prisma returns Decimal, which a component cannot render.
      avgOverall: avgOverall === null ? null : Number(avgOverall),
    })),
    total,
    page: params.page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

export type TeacherProfile = {
  // The form on /review/new posts this, so the profile has to carry it.
  id: string
  slug: string
  nameEn: string
  nameBn: string | null
  designation: string
  isHead: boolean
  imageUrl: string | null
  ruetProfileUrl: string | null
  reviewCount: number
  studentCount: number
  avgOverall: number | null
  avgTeaching: number | null
  avgClarity: number | null
  avgFairness: number | null
  department: {
    slug: string
    nameEn: string
    shortCode: string
  }
}

// Thrown, not returned, so a miss is never stored: unstable_cache does not
// keep a throw. A mistyped slug costs one query, as it always did, and does
// not occupy the cache for fifteen minutes.
class TeacherNotFound extends Error {}

// slug -> id. Shared across requests: a slug only changes through scripts.
const teacherIdBySlug = unstable_cache(
  async (slug: string): Promise<string> => {
    // findFirst, not findUnique: an inactive teacher must 404 as well.
    const row = await prisma.teacher.findFirst({
      where: { slug, isActive: true },
      select: { id: true },
    })
    if (!row) throw new TeacherNotFound()
    return row.id
  },
  ['teacher-id-by-slug'],
  { revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS }
)

// Wrapped in cache() because the page and generateMetadata both ask for
// the same teacher. Without it one page load runs the lookups twice.
//
// THE PROFILE IS SHARED ACROSS REQUESTS (unstable_cache, tag teacher:{id}).
// Every field below is public: what a signed-out stranger would see on the
// page. Nothing about the viewer, nothing about who wrote a review.
export const getTeacherBySlug = cache(
  async (slug: string): Promise<TeacherProfile | null> => {
    let id: string
    try {
      id = await teacherIdBySlug(slug)
    } catch (error) {
      if (error instanceof TeacherNotFound) return null
      throw error
    }

    return unstable_cache(() => readTeacherProfile(id), ['teacher-profile', id], {
      revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS,
      tags: [teacherTag(id)],
    })()
  }
)

async function readTeacherProfile(id: string): Promise<TeacherProfile | null> {
    // findFirst, not findUnique: an inactive teacher must 404 as well.
    const teacher = await prisma.teacher.findFirst({
      where: { id, isActive: true },
      // select, not include. Only what the profile shows leaves the server.
      select: {
        id: true,
        slug: true,
        nameEn: true,
        nameBn: true,
        designation: true,
        isHead: true,
        imageUrl: true,
        ruetProfileUrl: true,
        reviewCount: true,
        studentCount: true,
        avgOverall: true,
        avgTeaching: true,
        avgClarity: true,
        avgFairness: true,
        department: { select: { slug: true, nameEn: true, shortCode: true } },
      },
    })

    if (!teacher) return null

    const { avgOverall, avgTeaching, avgClarity, avgFairness, ...rest } = teacher

    return {
      ...rest,
      avgOverall: toRating(avgOverall),
      avgTeaching: toRating(avgTeaching),
      avgClarity: toRating(avgClarity),
      avgFairness: toRating(avgFairness),
    }
}

// Two characters before anything is suggested, and never more than eight
// rows. Both numbers are here so the server enforces them, not the box.
export const SUGGEST_MIN_CHARS = 2
export const TEACHER_SUGGESTION_LIMIT = 8

export type TeacherSuggestion = {
  slug: string
  nameEn: string
  nameBn: string | null
  designation: string
  departmentShortCode: string
}

/**
 * For the live list under the search box.
 *
 * THE SEARCH RUNS IN THE DATABASE. 471 teachers are never sent to the
 * browser to be filtered there, however small that number looks.
 *
 * Both names are matched: nameEn case-insensitively, nameBn as typed, since
 * Bangla has no case. Every nameBn is null today, so that arm matches
 * nothing yet and costs nothing.
 *
 * `departmentSlug` scopes the search to one department, for the department
 * pages and for a filtered /teachers. It is part of the WHERE clause, not a
 * filter applied to the results: narrowing after the fact would still read
 * every matching teacher, and would hand back fewer than eight rows whenever
 * the first eight across the site were from somewhere else.
 */
export async function suggestTeachers(
  query: string,
  departmentSlug?: string
): Promise<TeacherSuggestion[]> {
  const term = query.trim()

  // The box waits for two characters as well. This is the one that counts.
  if (term.length < SUGGEST_MIN_CHARS) return []

  const rows = await prisma.teacher.findMany({
    where: {
      isActive: true,
      // Absent means every department, which is the home page and an
      // unfiltered /teachers.
      ...(departmentSlug ? { department: { slug: departmentSlug } } : {}),
      OR: [
        { nameEn: { contains: term, mode: 'insensitive' } },
        { nameBn: { contains: term } },
        // The same rule as the full search. Without it, typing "RUB" would
        // show no suggestions and then find the teacher on Enter, which
        // reads as a broken box.
        ...(matchesAsInitials(term)
          ? [{ initials: { contains: term, mode: 'insensitive' as const } }]
          : []),
      ],
    },
    orderBy: { nameEn: 'asc' },
    take: TEACHER_SUGGESTION_LIMIT,
    // Only what the row shows. No id, no rating, no counts.
    select: {
      slug: true,
      nameEn: true,
      nameBn: true,
      designation: true,
      department: { select: { shortCode: true } },
    },
  })

  const substring = rows.map((row) => ({
    slug: row.slug,
    nameEn: row.nameEn,
    nameBn: row.nameBn,
    designation: row.designation,
    departmentShortCode: row.department.shortCode,
  }))

  // ------------------------------------------------------------------
  // THE FUZZY HALF, same rule and SAME CONSTANT as the full search.
  // ------------------------------------------------------------------
  //
  // This box is what students actually use -- they type and pick, they
  // rarely press Search -- so it had the greater need of the two and was the
  // one missing it. "manhaz" showed an empty dropdown and then found the
  // teacher on Enter, which reads as a broken box.
  //
  // FUZZY_SIMILARITY_THRESHOLD is imported, not retyped. One number, one
  // place: two copies would be tuned in one of them.
  //
  // ONLY WHEN THERE IS ROOM. A full dropdown of substring matches is already
  // the best answer, so the fuzzy query does not run at all -- the common
  // case costs nothing. FUZZY_MIN_CHARS also applies, so a two-character
  // query stays substring-only even though the box accepts it.
  if (substring.length >= TEACHER_SUGGESTION_LIMIT || term.length < FUZZY_MIN_CHARS) {
    return substring
  }

  const departmentId = departmentSlug
    ? ((
        await prisma.department.findUnique({
          where: { slug: departmentSlug },
          select: { id: true },
        })
      )?.id ?? null)
    : null

  if (departmentSlug && departmentId === null) return substring

  const already = new Set(substring.map((row) => row.slug))

  const fuzzy = await prisma.$queryRaw<
    {
      slug: string
      nameEn: string
      nameBn: string | null
      designation: string
      departmentShortCode: string
      score: number
    }[]
  >`
    SELECT
      t.slug,
      t."nameEn",
      t."nameBn",
      t.designation,
      d."shortCode" AS "departmentShortCode",
      GREATEST(
        word_similarity(${term}, t."nameEn"),
        word_similarity(${term}, COALESCE(t."nameBn", ''))
      ) AS score
    FROM teachers t
    JOIN departments d ON d.id = t."departmentId"
    WHERE t."isActive" = true
      AND (CAST(${departmentId} AS uuid) IS NULL
           OR t."departmentId" = CAST(${departmentId} AS uuid))
      AND GREATEST(
        word_similarity(${term}, t."nameEn"),
        word_similarity(${term}, COALESCE(t."nameBn", ''))
      ) >= ${FUZZY_SIMILARITY_THRESHOLD}
    ORDER BY score DESC, t."nameEn" ASC
    LIMIT ${TEACHER_SUGGESTION_LIMIT * 4}
  `

  // Re-ranked by subsequence match, exactly as the full search does, so the
  // two paths put the same teacher at the top for the same query.
  const ranked = fuzzy
    .filter((row) => !already.has(row.slug))
    .map((row) => ({ ...row, relevance: nameMatchScore(term, row.nameEn) }))
    .sort(
      (a, b) =>
        b.relevance - a.relevance ||
        b.score - a.score ||
        a.nameEn.localeCompare(b.nameEn, 'en')
    )

  // Substring matches keep the top of the list. The fuzzy ones only fill
  // what is left of the eight rows.
  return [
    ...substring,
    ...ranked.slice(0, TEACHER_SUGGESTION_LIMIT - substring.length).map((row) => ({
      slug: row.slug,
      nameEn: row.nameEn,
      nameBn: row.nameBn,
      designation: row.designation,
      departmentShortCode: row.departmentShortCode,
    })),
  ]
}

// Six fit two rows of three on the home page. The rest are one link away.
// Six, so the home page can show four on a phone and six from md — the
// same counts as the departments grid beside it.
export const TOP_RATED_LIMIT = 6

/**
 * The home page "Top rated teachers" grid.
 *
 * ------------------------------------------------------------------
 * ORDERED BY A CONFIDENCE-WEIGHTED SCORE, NOT BY avgOverall
 * ------------------------------------------------------------------
 *
 * min_students_for_ranking is 2. A plain `ORDER BY avgOverall DESC` at that
 * threshold puts a teacher with two 5.00 reviews above one with twenty-five
 * averaging 4.70 — so the block fills up with the LEAST reviewed teachers on
 * the site, under a heading that promises the opposite. That is what this
 * replaces.
 *
 *   weighted = (v / (v + m)) * R + (m / (v + m)) * C
 *
 *     R  the teacher's own avgOverall
 *     v  that teacher's studentCount (distinct students, never reviews)
 *     m  RANKING_PRIOR_STUDENTS, in lib/ranking.ts
 *     C  the mean avgOverall across every rated teacher, computed below
 *
 * It is the standard Bayesian shrinkage estimator: a teacher starts at the
 * site average and earns their own number as more distinct students review
 * them. Two 5.00s land near C; twenty-five 4.70s land near 4.70.
 *
 * IT IS A SORT KEY AND NOTHING ELSE. It is never returned, never rendered,
 * and never written anywhere. The number on the card is still the teacher's
 * real avgOverall, because that is what a reader thinks it is.
 *
 * NOT WRITTEN TO THE DATABASE. recalculateTeacherRating() remains the only
 * thing that writes an average column on Teacher. This is computed on read,
 * every time, from columns that function already maintains.
 *
 * `minStudents` still comes from getSetting('min_students_for_ranking'), so
 * the threshold changes in the database and not in a deploy.
 *
 * Returns an empty array when nobody qualifies, which is how the caller
 * knows to render nothing at all.
 */

// THE FORMULA AND THE PRIOR MOVED TO lib/ranking.ts, because the department
// page's "highest rated" sort is now a second caller. Two copies of one
// ranking formula is two pages that eventually disagree about who is best,
// with no way to tell which one is wrong. See that file for what the numbers
// mean and why m is 8.

// CACHED ACROSS REQUESTS in the shared Data Cache, keyed on minStudents, and
// dropped by tag whenever a rating can have moved (revalidatePublicTotals in
// server/public-cache.ts). Public data only: nothing below may read cookies,
// headers or the session, and nothing about the viewer may be added to it.
export const getTopRatedTeachers = unstable_cache(
  readTopRatedTeachers,
  ['top-teachers'],
  { revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS, tags: [TOP_TEACHERS_TAG] }
)

async function readTopRatedTeachers(
  minStudents: number
): Promise<TeacherCardData[]> {
  // ONE QUERY DOING TWO JOBS. Every rated teacher is read so C can be the
  // site's own mean computed in this same pass, and the eligible subset is
  // filtered out of those same rows below. With 471 teachers this is a small
  // in-memory sort; doing it in SQL would need a window function to see the
  // whole-site mean from inside a filtered query.
  //
  // avgOverall IS NULL is exactly "no published reviews" —
  // recalculateTeacherRating() nulls the column when the last one goes — so
  // this filter is the "at least one published review" test, not a proxy.
  const rated = await prisma.teacher.findMany({
    where: {
      isActive: true,
      avgOverall: { not: null },
    },
    // The same fields the card needs, and nothing else. departmentId, not a
    // nested select: the home page already has the department list loaded
    // and turns the id into a short code without a second query.
    select: {
      slug: true,
      nameEn: true,
      nameBn: true,
      designation: true,
      isHead: true,
      imageUrl: true,
      avgOverall: true,
      reviewCount: true,
      studentCount: true,
      departmentId: true,
    },
  })

  // Nobody has been reviewed yet, so there is no site average to shrink
  // towards and nothing to rank.
  if (rated.length === 0) return []

  // C, from every rated teacher — not from the eligible ones, which would
  // make the prior depend on the threshold it is meant to correct for.
  const siteMean =
    rated.reduce((sum, teacher) => sum + Number(teacher.avgOverall), 0) / rated.length

  const eligible = rated.filter((teacher) => teacher.studentCount >= minStudents)

  const scored = eligible.map((teacher) => ({
    teacher,
    weighted: weightedRating(Number(teacher.avgOverall), teacher.studentCount, siteMean),
  }))

  // DETERMINISTIC, so the grid does not shuffle between two requests that
  // read the same rows. Score, then more students, then name: every pair of
  // teachers differs on one of the three, and the last is unique.
  scored.sort(
    (a, b) =>
      b.weighted - a.weighted ||
      b.teacher.studentCount - a.teacher.studentCount ||
      a.teacher.nameEn.localeCompare(b.teacher.nameEn, 'en')
  )

  // weighted is dropped here. It decided the order and leaves no trace.
  return scored.slice(0, TOP_RATED_LIMIT).map(({ teacher }) => {
    const { avgOverall, ...rest } = teacher
    return { ...rest, avgOverall: toRating(avgOverall) }
  })
}
