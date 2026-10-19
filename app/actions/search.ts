'use server'

import { requireAuth } from '@/lib/auth'
import { hitLimit, rateLimitMessage } from '@/lib/rate-limit'
import { suggestTeachers } from '@/server/teachers'
import type { TeacherSuggestion } from '@/server/teachers'
import { suggestDeptSchema, suggestQuerySchema } from '@/validators/search'
import type { ActionResult } from './review'

/**
 * The live list under the teacher search box.
 *
 * requireAuth(), like every other page: the site is closed, and a suggestion
 * box is not a hole in that. A signed-out caller is redirected to /login
 * before any query runs.
 *
 * Students and teachers both reach this. Reading is allowed for both roles,
 * so there is no requireStudent() here.
 */
export async function suggestTeachersAction(
  query: unknown,
  dept?: unknown
): Promise<ActionResult<TeacherSuggestion[]>> {
  const user = await requireAuth()

  // Per user, not per IP: everyone here is signed in, and a shared campus
  // network must not have one bot spend everybody's allowance.
  if (await hitLimit('suggest', user.id)) {
    return { ok: false, error: rateLimitMessage('suggest') }
  }

  const parsed = suggestQuerySchema.safeParse(query)

  // A bad query is not an error worth a message. It is an empty list.
  if (!parsed.success) return { ok: true, data: [] }

  // A department slug is public and narrows the search, so a bad one is not
  // a risk — it just falls back to searching every department.
  const scope = suggestDeptSchema.safeParse(dept)

  return {
    ok: true,
    data: await suggestTeachers(parsed.data, scope.success ? scope.data : undefined),
  }
}
