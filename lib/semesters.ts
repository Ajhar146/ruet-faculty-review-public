// RUET semesters are positions in a four year degree, not dates. A student
// says "3-1", meaning third year, first semester. The label carries no year,
// so nothing here depends on the calendar.

export const SEMESTERS = [
  '1-1',
  '1-2',
  '2-1',
  '2-2',
  '3-1',
  '3-2',
  '4-1',
  '4-2',
  // Architecture is a five year course. Nobody else will pick these.
  '5-1',
  '5-2',
] as const

export type Semester = (typeof SEMESTERS)[number]

/** True only for one of the eight. The form is a convenience, not the gate. */
export function isValidSemester(value: string): boolean {
  return (SEMESTERS as readonly string[]).includes(value)
}
