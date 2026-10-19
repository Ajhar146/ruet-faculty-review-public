/**
 * How lists are ordered. Both constants live here and nowhere else.
 *
 * Neither order can be expressed as a Prisma `orderBy`: one is an arbitrary
 * sequence of short codes, the other needs the designation text normalised
 * before it can be ranked. So both are applied in TypeScript, and only ever
 * to a set of rows that was already loaded in full — 18 departments, or the
 * teachers of one department. Nothing here sorts a page of 471 teachers.
 */

// ---------------------------------------------------------------
// Departments
// ---------------------------------------------------------------

/**
 * The official RUET department codes, in order.
 *
 * The index IS the code: CE is 0, EEE is 1, and so on. Anything not on this
 * list — Mathematics, Chemistry, Physics, Humanities — has no official code
 * and sorts after all of them, by name.
 */
export const DEPARTMENT_ORDER = [
  'CE',
  'EEE',
  'ME',
  'CSE',
  'ETE',
  'IPE',
  'GCE',
  'URP',
  'ARCH',
  'MTE',
  'CHE',
  'BECM',
  'ECE',
  'MSE',
] as const

// Code 6 is GCE officially, but the database calls that department CME,
// taken from the cme.ruet.ac.bd subdomain. They are the same department, so
// both spellings get the same place. See docs/DATABASE.md section 5.
const CODE_ALIASES: Record<string, string> = { CME: 'GCE' }

// Anything without an official code sorts after every department that has
// one, and among themselves by name.
const UNRANKED = DEPARTMENT_ORDER.length

/** The place a short code holds, or UNRANKED when it has no official code. */
export function departmentRank(shortCode: string): number {
  // Short codes are mixed case in the database: "CSE", "Arch", "ChE".
  const code = shortCode.trim().toUpperCase()
  const official = CODE_ALIASES[code] ?? code

  const index = DEPARTMENT_ORDER.indexOf(official as (typeof DEPARTMENT_ORDER)[number])
  return index === -1 ? UNRANKED : index
}

/** For Array.sort. Official order first, then name for the rest. */
export function compareDepartments(
  a: { shortCode: string; nameEn: string },
  b: { shortCode: string; nameEn: string }
): number {
  const rank = departmentRank(a.shortCode) - departmentRank(b.shortCode)
  if (rank !== 0) return rank

  return a.nameEn.localeCompare(b.nameEn)
}

// ---------------------------------------------------------------
// Designations
// ---------------------------------------------------------------

/**
 * Seniority, highest first. The index is the rank.
 *
 * `match` is tested against the normalised designation, and the list is
 * searched in order, so the longer titles come first: "Associate Professor"
 * contains "professor", and would otherwise rank as one.
 */
const DESIGNATION_ORDER = [
  { label: 'Professor', match: ['professor'] },
  { label: 'Associate Professor', match: ['associate professor', 'assoc professor'] },
  { label: 'Assistant Professor', match: ['assistant professor', 'asst professor'] },
  { label: 'Lecturer', match: ['lecturer'] },
] as const

// Checked before the plain "professor" entry, for the same reason.
const SPECIFIC_FIRST = [2, 1, 3, 0] as const

// Anything we do not recognise goes last rather than being guessed at.
const UNKNOWN_DESIGNATION = DESIGNATION_ORDER.length

/**
 * The scrape has only the four full titles today, but a re-scrape could
 * bring "Prof." or "Asst. Professor", so the dots and the spacing are
 * stripped before anything is compared.
 */
function normalise(designation: string): string {
  return designation.toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
}

/** 0 for a Professor, rising with juniority. Unknown titles sort last. */
export function designationRank(designation: string): number {
  const text = normalise(designation)

  for (const index of SPECIFIC_FIRST) {
    if (DESIGNATION_ORDER[index].match.some((phrase) => text.includes(phrase))) {
      return index
    }
  }

  // "Prof" on its own, with no "associate" or "assistant" in front of it.
  if (text.includes('prof')) return 0

  return UNKNOWN_DESIGNATION
}

// ---------------------------------------------------------------
// Teachers within one department
// ---------------------------------------------------------------

export type TeacherOrderFields = {
  isHead: boolean
  designation: string
  avgOverall: number | null
  nameEn: string
}

/**
 * The head of department, then by seniority, then by rating.
 *
 * An unrated teacher sits after the rated ones **of their own designation**,
 * not at the very bottom: a new Professor is still a Professor. Every tie
 * ends at the name, so the order never wobbles between renders.
 */
export function compareTeachersInDepartment(
  a: TeacherOrderFields,
  b: TeacherOrderFields
): number {
  // a. The head first.
  if (a.isHead !== b.isHead) return a.isHead ? -1 : 1

  // b. Then seniority.
  const seniority = designationRank(a.designation) - designationRank(b.designation)
  if (seniority !== 0) return seniority

  // d. Rated before unrated, inside this designation.
  const aRated = a.avgOverall !== null
  const bRated = b.avgOverall !== null
  if (aRated !== bRated) return aRated ? -1 : 1

  // c. Highest rating first.
  if (aRated && bRated && a.avgOverall !== b.avgOverall) {
    return (b.avgOverall as number) - (a.avgOverall as number)
  }

  // e. And finally the name.
  return a.nameEn.localeCompare(b.nameEn)
}
