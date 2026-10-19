/**
 * A teacher's initials, for search only.
 *
 * A student remembers "MRUB" and not "Dr. Md. Rafiqul Uz Bari". This turns
 * the second into the first so the search can match it.
 *
 *   "Dr. Md. Rafiqul Uz Bari"   ->  MRUB
 *   "A. K. M. Minhazul Rahman"  ->  AKMMR
 *   "Prof. Dr. Mohammad Ali"    ->  MA
 *   "Md. Ali"                   ->  MA
 *
 * STORED, NOT COMPUTED AT QUERY TIME. The teacher search is filtered, sorted
 * and paginated in the database; computing this in JavaScript would mean
 * pulling all 471 teachers into memory first, which breaks the pagination the
 * moment there is a second page. It lives in a column with an index.
 *
 * NEVER SHOWN. It is a search key. It is not on a card, a row, a profile or a
 * result, and nothing selects it for display.
 *
 * Pure, so tests/teacher-initials.test.ts needs no database.
 */

/**
 * The only words that are titles. Everything else is part of the name.
 *
 * MD, MOHD, MOHAMMAD, MUHAMMAD, MST AND MOST ARE NOT ON THIS LIST, AND THAT
 * IS THE POINT. An earlier version of this file treated them as titles and
 * stripped them, which turned "Dr. Md. Rafiqul Uz Bari" into RUB. They are
 * names — a very large share of Bangladeshi given names begin with one — so
 * stripping them threw away the letter a student is most likely to type
 * first. If you are about to add one of them here, do not.
 *
 * Only ever removed from the START. "Dr. Rafiqul Dr Bari" keeps the second
 * Dr, because by then the scan has stopped at a piece that is a name.
 */
const TITLES = new Set([
  'dr',
  'prof',
  'professor',
  'engr',
  'eng',
  'mr',
  'mrs',
  'ms',
  'lt',
  'col',
])

/** The first LETTER, not the first character: "(Rtd)" gives R, not "(". */
function firstLetter(piece: string): string | null {
  const match = /\p{L}/u.exec(piece)
  return match ? match[0].toUpperCase() : null
}

export function teacherInitials(nameEn: string): string | null {
  // Dots are dropped rather than split on, so "A.K.M." is three pieces and
  // not three empty ones. Hyphens separate pieces the way spaces do, so
  // "Abu-Bakar" is two.
  const pieces = nameEn
    .replace(/\./g, ' ')
    .split(/[\s-]+/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0)

  // Remove titles from the front for as long as the next piece is one.
  // There is NO minimum length: "Dr. Bari" is B, and a one-letter value is
  // harmless because matchesAsInitials refuses a one-character query, so no
  // search can ever reach it.
  let start = 0
  while (start < pieces.length && TITLES.has(pieces[start].toLowerCase())) {
    start += 1
  }

  const initials = pieces
    .slice(start)
    .map(firstLetter)
    .filter((letter): letter is string => letter !== null)
    .join('')

  // NULL, NEVER "". An empty string in the column would be CONTAINED by every
  // query, so every nameless row would match every search.
  return initials.length > 0 ? initials : null
}

/**
 * Whether a typed query should be matched against the initials column.
 *
 * TWO OR MORE CHARACTERS, AND NO SPACES.
 *
 * A single letter is not an abbreviation — "S" would match the initials of
 * most of the faculty and bury the name matches a student actually wanted.
 * It is also what makes a one-letter stored value safe: a two-character
 * CONTAINS can never match a one-character column.
 *
 * A query with a space is a name, not initials. Somebody typing "Rafiqul Uz"
 * is spelling it out, and "MRUB" has no space in it, so a spaced query can
 * never be the thing this column holds.
 *
 * It only ever ADDS a branch to the search's OR. Everything that matched
 * before still matches; this cannot remove a result.
 */
export function matchesAsInitials(query: string): boolean {
  const term = query.trim()

  return term.length >= 2 && !/\s/.test(term)
}
