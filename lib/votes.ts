import type { VoteValue } from '@/lib/types'

/**
 * The shape of a vote count, and nothing that can query one.
 *
 * ------------------------------------------------------------------
 * WHY THIS IS SEPARATE FROM server/votes.ts
 * ------------------------------------------------------------------
 *
 * CourseReviewBlock and VoteButtons are 'use client'. The first version of
 * this feature had them import EMPTY_VOTE_SUMMARY straight from
 * server/votes.ts, which imports lib/prisma, which imports `pg` -- so the
 * production build tried to bundle a Postgres driver for the browser and
 * failed with `Can't resolve 'dns'`.
 *
 * A type-only import would have been erased and caused no such thing. A
 * runtime VALUE drags its whole module graph with it. So the constant and the
 * types live here, in a file that imports nothing but a type, and the queries
 * stay on the server where they belong.
 *
 * If you add anything to this file, it must stay free of prisma, of
 * server-only modules, and of anything that reads a session.
 */

export type { VoteValue }

export type VoteSummary = {
  up: number
  down: number
  /** The VIEWER's own vote, or null. Never anybody else's. */
  mine: VoteValue | null
}

/**
 * Keyed by review id. A review with no votes is simply ABSENT, so a
 * zero-vote review costs no row in the database and no key here.
 *
 * A PLAIN OBJECT, NOT A Map, because this is handed to a client component as
 * a prop and an object keyed by uuid serialises as itself.
 */
export type VoteSummaries = Record<string, VoteSummary>

/** What a review with no votes shows: two zeroes and no pressed button. */
export const EMPTY_VOTE_SUMMARY: VoteSummary = { up: 0, down: 0, mine: null }
