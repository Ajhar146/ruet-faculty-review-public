'use client'

import { useState, useTransition } from 'react'
import { voteOnReview } from '@/app/actions/report'
import type { VoteSummary } from '@/lib/votes'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

/**
 * TWO COUNTS, NEVER A NET SCORE.
 *
 * "12 agree · 3 disagree", not "+9". A single signed number next to somebody's
 * honest opinion reads as a verdict on it; two counts read as information. It
 * is also why there is no sorting, no "top review" badge and no colour-coded
 * total: the point is to inform a reader, not to rank the reviews.
 *
 * ORDERING IS NOT THIS COMPONENT'S BUSINESS. Reviews are newest-first and a
 * downvoted one keeps its place. Nothing here reports a position.
 *
 * NOBODY LEARNS WHO VOTED. This component is given two numbers and the
 * viewer's own value. There is no voter list in its props, so there is none
 * in the page source.
 *
 * ICONS, NOT EMOJI. Every other icon on the site is an inline SVG
 * (StarRating, SearchBar, the filter sheet's close button), and emoji render
 * at a different weight and colour on every platform. These inherit
 * currentColor so the pressed state actually changes them.
 */

export type VoteButtonsProps = {
  reviewId: string
  summary: VoteSummary
  /**
   * False for a teacher, an admin, a signed-out reader, and for the viewer's
   * own review. The counts still show — they are information for everyone —
   * but there is nothing to press.
   *
   * THIS IS NOT THE RULE. voteOnReview checks the role and the ownership
   * itself, because an action is reachable without its page.
   */
  canVote: boolean
}

function ThumbUp() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 shrink-0"
    >
      <path d="M6 9.5v7H3.5v-7zM6 9.5l3-6.5c1.2 0 2 .8 2 2v3h4.2c1 0 1.7.9 1.5 1.9l-1 5c-.1.7-.8 1.2-1.5 1.2H6" />
    </svg>
  )
}

function ThumbDown() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 shrink-0"
    >
      <path d="M6 10.5v-7H3.5v7zM6 10.5l3 6.5c1.2 0 2-.8 2-2v-3h4.2c1 0 1.7-.9 1.5-1.9l-1-5c-.1-.7-.8-1.2-1.5-1.2H6" />
    </svg>
  )
}

// min-h-11 is 44px, the floor section 8b part 5 sets for every tap target on
// a phone. px-2.5 keeps two of these plus the Report link inside 312px at
// 360px without wrapping.
const BASE = `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-[13px] ${FOCUS_RING}`

// Pressed is ink on mist with a full-strength border; idle is slate on paper.
// No accent: gold is the section rule and the active state of a field, and a
// vote is neither.
const IDLE = 'border-line bg-paper text-slate hover:text-ink'
const PRESSED = 'border-ink bg-mist font-medium text-ink'

// Not a button, for a reader who cannot vote. Same metrics so the row does
// not jump between a student's view and a teacher's.
const STATIC =
  'inline-flex min-h-11 shrink-0 items-center gap-1.5 px-0 text-[13px] text-slate'

/**
 * THE LAST ANSWER THE SERVER GAVE FOR EACH REVIEW, IN THIS TAB.
 *
 * Back/forward and the router cache re-mount this component with the props
 * the page was first rendered with, which predate any vote cast since. The
 * action toggles from what the DATABASE holds, so a stale "not voted" button
 * would turn a press of Agree into removing the agree. This keeps what is on
 * screen equal to what was last written, without a server render per vote.
 *
 * Memory only: never persisted, never sent anywhere, gone on reload. Signing
 * in is a full page load (the Google round trip), so it never outlives the
 * account that filled it.
 */
const lastKnownVotes = new Map<string, VoteSummary>()

export function VoteButtons({ reviewId, summary, canVote }: VoteButtonsProps) {
  // Seeded from the server -- or from this tab's last vote on this review,
  // which is newer -- and replaced by whatever the server returns next.
  // Never adjusted arithmetically in the browser: the count on screen is
  // always a count the database produced.
  const [state, setState] = useState<VoteSummary>(
    () => lastKnownVotes.get(reviewId) ?? summary
  )
  const [pending, startTransition] = useTransition()
  // THE REFUSAL, SHOWN. This used to be swallowed: on ok: false nothing
  // happened at all, so a rate limit, a refused vote and a dropped request
  // on patchy mobile data were indistinguishable from a dead button -- and
  // undebuggable from the outside, which is exactly what went wrong.
  const [error, setError] = useState<string | null>(null)

  function cast(value: 'UP' | 'DOWN') {
    // Cleared on the next interaction, so a stale message never sits under
    // a button that has since worked.
    setError(null)

    startTransition(async () => {
      try {
        const result = await voteOnReview({ reviewId, value })

        if (result.ok) {
          // data is optional on ActionResult, so guard it. ok with no data
          // means the vote was written and the counts did not come back:
          // leave what is on screen rather than claim a failure.
          if (result.data) {
            lastKnownVotes.set(reviewId, result.data)
            setState(result.data)
          }
          return
        }

        // The action already returns a sentence for every refusal -- the
        // rate-limit message, or "You cannot vote on your own review."
        // Showing its own words means the two cannot drift apart.
        setError(result.error)
      } catch {
        // The request never completed: offline, a 500, a dropped connection
        // mid-flight. There is no sentence from the server to show, so this
        // is the one message this component writes itself.
        setError('Could not save your vote.')
      }
    })
  }

  if (!canVote) {
    return (
      <p className={STATIC} aria-label={`${state.up} agree, ${state.down} disagree`}>
        <span className="inline-flex items-center gap-1.5">
          <ThumbUp />
          {state.up}
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          <ThumbDown />
          {state.down}
        </span>
      </p>
    )
  }

  return (
    // flex-col so a refusal can sit UNDER the buttons instead of beside
    // them, which would push Report off the edge at 360px. With no error the
    // wrapper has one child and the parent's items-center centres it exactly
    // as before, so nothing moves at any width until something fails.
    <div className="flex shrink-0 flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => cast('UP')}
          disabled={pending}
          // aria-pressed is what tells a screen reader this is a toggle and
          // which way it is set. The visual pressed state is the border.
          aria-pressed={state.mine === 'UP'}
          aria-label={`Agree with this review. ${state.up} so far.`}
          className={`${BASE} ${state.mine === 'UP' ? PRESSED : IDLE}`}
        >
          <ThumbUp />
          {state.up}
        </button>

        <button
          type="button"
          onClick={() => cast('DOWN')}
          disabled={pending}
          aria-pressed={state.mine === 'DOWN'}
          aria-label={`Disagree with this review. ${state.down} so far.`}
          className={`${BASE} ${state.mine === 'DOWN' ? PRESSED : IDLE}`}
        >
          <ThumbDown />
          {state.down}
        </button>
      </div>

      {/* The same shape every other inline error in this folder uses --
          components/review/EditableComment.tsx and DeleteReviewButton.tsx
          both render exactly this. role=status + aria-live so a screen
          reader is told, since the visual change is below the button it
          just pressed. */}
      {error ? (
        <p role="status" aria-live="polite" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
