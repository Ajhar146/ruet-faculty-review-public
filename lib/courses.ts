import { isValidSemester } from '@/lib/semesters'

// The most important function in phase 4.
//
// A student types the course code by hand, so the same course arrives as
// "cse3203", "CSE-3203" and "Cse  3203". If those reach the database as
// three rows, the unique index on (userId, teacherId, courseId, semester)
// stops working and one student can review the same teacher three times.
//
// This always runs on the SERVER, before any lookup or insert.

const SHAPE = /^[A-Z]{2,5} \d{3,4}$/

/**
 * The tidying half, with no shape test. Returns whatever it is given.
 *
 * This is the one place that knows - _ and . are separators. The search box
 * needs it for half-typed codes like "CSE 32", which are not valid codes
 * yet, so it cannot go through normaliseCourseCode().
 *
 * There are no server-only imports in this file, so a client component can
 * import this too. That is on purpose: the form and the server must agree.
 */
export function tidyCourseCode(input: string): string {
  return (
    input
      .trim()
      .toUpperCase()
      // A student may separate the two parts any way they like.
      .replace(/[-_.]/g, ' ')
      .replace(/\s+/g, ' ')
      // "CSE3203" has no separator at all. Put one space in. One digit is
      // allowed here so a partial code tidies up the same way; the shape
      // test below is what insists on three or four.
      .replace(/^([A-Z]{2,5})\s*(\d{1,4})$/, '$1 $2')
  )
}

/**
 * Returns the normalised code, always "CSE 3203" shape, or null when the
 * input is not a course code at all.
 */
export function normaliseCourseCode(input: string): string | null {
  const cleaned = tidyCourseCode(input)

  if (!SHAPE.test(cleaned)) return null
  return cleaned
}

/** "CSE 3203" -> "CSE". Always uppercase, because the code is. */
export function prefixOf(code: string): string {
  return code.split(' ')[0]
}

// Three prefixes are taught by a department whose short code is different.
// Everything else is taught by the department its own prefix names: CSE
// teaches CSE courses, MATH teaches MATH courses.
export const PREFIX_DEPARTMENT: Record<string, string> = {
  MES: 'ME',
  IPES: 'IPE',
  GCE: 'CME',
}

/** Which department teaches a course with this prefix. */
export function departmentForPrefix(prefix: string): string {
  return PREFIX_DEPARTMENT[prefix] ?? prefix
}

/**
 * The other direction: every prefix this department teaches. ME teaches ME
 * and MES, IPE teaches IPE and IPES, CME teaches CME and GCE. Everyone else
 * teaches only their own.
 *
 * Pass an UPPERCASE short code. Short codes are mixed case in the database.
 */
export function prefixesForDepartment(shortCode: string): string[] {
  const extra = Object.keys(PREFIX_DEPARTMENT).filter(
    (prefix) => PREFIX_DEPARTMENT[prefix] === shortCode
  )

  return [shortCode, ...extra]
}

// The first two digits of the number are the year and the semester.
const YEAR_AND_SEMESTER = /^[A-Z]{2,5} (\d)(\d)\d{1,2}$/

/**
 * A RUET course code carries the semester in digits 1 and 2 of the number:
 * "CSE 4101" is a 4-1 course, "CSE 3203" is 3-2, "MATH 1101" is 1-1.
 *
 * Takes a NORMALISED code. Returns null when those digits are not a real
 * semester: "CSE 9901" has no year 9, "CSE 4301" has no semester 3.
 */
export function semesterFromCode(code: string): string | null {
  const match = YEAR_AND_SEMESTER.exec(code)
  if (!match) return null

  const year = Number(match[1])
  const semester = Number(match[2])

  if (year < 1 || year > 4) return null
  if (semester < 1 || semester > 2) return null

  return `${year}-${semester}`
}

/**
 * "21" and "2-1" both mean the semester 2-1. Anything else means nothing.
 *
 * ONLY WHEN THE TERM IS NOTHING BUT THE DIGITS. "CSE41" is deliberately not a
 * semester search: it already finds every CSE 41xx course through the code
 * prefix, and treating it as a semester as well would drag in EEE 4-1 and
 * every other department, which is not what the student asked for.
 *
 * THE LIST OF VALID VALUES IS NOT WRITTEN HERE. isValidSemester reads
 * SEMESTERS in lib/semesters.ts, which is the one place the ten real
 * semesters are named — 1-1 through 5-2, with 5-1 and 5-2 for Architecture.
 * "13", "99" and "00" are not among them and fall through to the ordinary
 * code and name search.
 */
export function semesterFromSearchTerm(term: string): string | null {
  // Spaces, hyphens, dots and underscores are all ways of typing the same
  // thing: "2-1", "2 1" and "21" are one query.
  const digits = term.trim().replace(/[\s\-_.]+/g, '')

  if (!/^\d{2}$/.test(digits)) return null

  const semester = `${digits[0]}-${digits[1]}`

  return isValidSemester(semester) ? semester : null
}

/**
 * The filter behind the course picker's suggestions.
 *
 * ONE RULE, NO SPECIAL CASE FOR YEARS OR TERMS. The typed term is tidied to
 * the stored "CSE 4101" shape and matched as a PREFIX of the code, so a
 * half-typed code and a year-and-term prefix are the same thing:
 *
 *   "CSE41"  "cse 41"  "CSE-41"  "cse41"   all tidy to "CSE 41"
 *   "CSE 41" is a prefix of "CSE 4101", so the whole of 4-1 comes back
 *   "CSE4101" tidies to "CSE 4101" and finds that one course
 *   "CSE" tidies to "CSE" and finds the department, as it always did
 *
 * IT NEEDS NO SEMESTER LOGIC. Checked against all 1094 rows: the two digits
 * after the prefix agree with the `semester` column everywhere it is set, so
 * the code already carries the term and a prefix match on it is enough.
 *
 * The name search is kept alongside it: a student who remembers "algorithms"
 * and not the number still finds the course.
 *
 * Extracted from suggestCourses so the rule can be read and tested on its
 * own — it used to work as a side effect of tidyCourseCode's regex, which is
 * a thing that is true until somebody edits the regex.
 */
export function courseSearchWhere(term: string) {
  const query = term.trim()

  // No term is not "match everything": the caller shows the courses already
  // reviewed for this teacher instead.
  if (query.length === 0) return {}

  // The digits as typed, with separators removed: "2-1" and "21" are one.
  const digits = query.replace(/[\s\-_.]+/g, '')
  const semester = semesterFromSearchTerm(query)

  return {
    OR: [
      // A half-typed code cannot go through normaliseCourseCode(), which
      // insists on a complete one, so it is only tidied.
      { code: { startsWith: tidyCourseCode(query), mode: 'insensitive' as const } },
      { name: { contains: query, mode: 'insensitive' as const } },
      // A BARE YEAR AND SEMESTER: "21" or "2-1" finds every 2-1 course.
      //
      // TWO BRANCHES, NOT ONE, because the digits mean two things:
      //
      //   semester = "2-1"        the term the student is asking about
      //   code CONTAINS "21"      CSE 3210, CSE 4121, CSE 4211 — courses
      //                           whose NUMBER happens to hold those digits
      //
      // The code branch above this is startsWith, and no course code starts
      // with a digit, so without the CONTAINS one a bare "21" would find
      // nothing by code at all. Both sets are wanted; they are branches of
      // ONE OR in ONE query, so Postgres returns each course once and there
      // is nothing to de-duplicate.
      //
      // The semester branch matches the `semester` COLUMN rather than digits
      // in the code, which is both simpler and more correct: checked across
      // all 1094 rows the column and the code agree everywhere the column is
      // set, and the column also handles ARCH 5-1, which semesterFromCode
      // cannot read because it caps the year at 4.
      //
      // Neither branch fires unless the term is a VALID semester, so "13",
      // "99" and "00" fall through to the ordinary code and name search.
      ...(semester
        ? [
            { semester },
            { code: { contains: digits, mode: 'insensitive' as const } },
          ]
        : []),
    ],
  }
}
