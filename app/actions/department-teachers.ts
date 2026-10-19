'use server'

import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { hitLimit, rateLimitMessage } from '@/lib/rate-limit'
import { getDepartmentTeachersPage } from '@/server/departments'
import { departmentSortSchema } from '@/lib/department-sort'
import type { DepartmentTeacher } from '@/server/departments'

/**
 * The only action behind "Load more" on a department page.
 *
 * WHY. A department with 66 teachers put 66 photos on one page. On mobile data
 * that is slow and it costs the student money. The page now sends 15 and the
 * rest arrive 15 at a time, only for the department someone actually opened.
 *
 * IT REQUIRES A SESSION. /departments/* sits under app/(app), whose layout
 * calls requireAuth, and a server action is reachable over HTTP without its
 * page — a gate on the page is not a gate on the action. See the header of
 * app/actions/course-reviews.ts for the time that was got wrong.
 *
 * No redirect: requireAuth() redirects, and a redirect thrown inside an action
 * called from a button becomes a navigation or an unhandled error rather than
 * something the list can show.
 */

type Result =
  | { ok: true; teachers: DepartmentTeacher[] }
  | { ok: false; error: string }

// One sentence for every refusal. The list shows its own message on !ok, so
// this is what ends up in a log — and it deliberately does not say whether the
// problem was the session, the input or the limit.
const REFUSED = 'Could not load more teachers. Please reload the page.'

const inputSchema = z.object({
  // A slug the page rendered, not anything a person typed.
  slug: z.string().trim().min(1).max(64),
  // AN ENUM, not a free string. This value decides how rows are ordered, so
  // it is checked against the three known sorts here rather than handed to
  // the query as whatever arrived. Defaulted so an older client that does
  // not send it keeps working.
  sort: departmentSortSchema.default('default'),
  // How many the caller is already showing. Capped so one call cannot ask
  // Postgres to count past an absurd offset.
  skip: z.number().int().min(0).max(10_000),
})

export async function loadMoreDepartmentTeachers(input: unknown): Promise<Result> {
  // THE GATE, before validation and before any read.
  const user = await getCurrentUser()
  if (!user || user.isBanned) return { ok: false, error: REFUSED }

  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: REFUSED }

  // Shares the typeahead's limit: same kind of call from the same kind of
  // page, and every caller is signed in so the user id is always there.
  if (await hitLimit('loadMore', user.id)) {
    return { ok: false, error: rateLimitMessage('loadMore') }
  }

  const { slug, skip, sort } = parsed.data

  // The same sort the page rendered with, so this batch continues that list
  // instead of starting a different one.
  return { ok: true, teachers: await getDepartmentTeachersPage(slug, skip, sort) }
}
