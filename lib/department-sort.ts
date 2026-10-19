import { z } from 'zod'

/**
 * How a department page's teacher list is ordered.
 *
 * ONE DEFINITION, read by four places: the page (from searchParams), the
 * query that applies it, the Load more action that validates it, and the
 * select that sets it. A sort that means one thing to the page and another
 * to the action is how batch 2 ends up ordered differently from batch 1.
 *
 * NOT the teachers page's sort. That one is in validators/search.ts, has a
 * different set of options, and is deliberately left alone -- this page has
 * its own default ordering that the teachers page does not.
 */
export const DEPARTMENT_SORTS = ['default', 'reviews', 'rating'] as const

export type DepartmentSort = (typeof DEPARTMENT_SORTS)[number]

export const DEPARTMENT_SORT_LABELS: Record<DepartmentSort, string> = {
  default: 'Department order',
  reviews: 'Most reviewed',
  rating: 'Highest rated',
}

/**
 * AN ENUM, NOT A STRING, and this is the schema the Load more action
 * validates against. A free string reaching the query would be a value
 * nothing checked deciding how rows are ordered.
 */
export const departmentSortSchema = z.enum(DEPARTMENT_SORTS)

/**
 * Anything unrecognised becomes 'default'.
 *
 * A bad ?sort= is not an error page. A student who edits the URL, or follows
 * a link from a future version of the site, gets the list in its normal
 * order rather than a crash.
 */
export function parseDepartmentSort(value: unknown): DepartmentSort {
  const parsed = departmentSortSchema.safeParse(value)
  return parsed.success ? parsed.data : 'default'
}
