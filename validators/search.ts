import { z } from 'zod'

// Never pass a raw query param to Prisma. Everything goes through here.
export const searchParamsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  dept: z.string().max(20).optional(),
  sort: z.enum(['rating', 'reviews', 'name']).default('name'),
  page: z.coerce.number().int().min(1).max(100).default(1),
})

export type SearchParams = z.infer<typeof searchParamsSchema>

// A bad param is not an error page. Fall back to the defaults and show
// the first page of everything.
export function parseSearchParams(input: unknown): SearchParams {
  const parsed = searchParamsSchema.safeParse(input)
  if (parsed.success) return parsed.data

  return { q: undefined, dept: undefined, sort: 'name', page: 1 }
}

// What the suggestion box may send. Trimmed and capped before it reaches a
// query, like every other param in this file.
export const suggestQuerySchema = z.string().trim().max(100)

// The department the box is scoped to, when it is on a department page or a
// filtered /teachers. Same rule as the `dept` search param above, because it
// is the same value: a department slug. Anything else, including a missing
// one, means "every department".
export const suggestDeptSchema = z.string().max(20).optional()
