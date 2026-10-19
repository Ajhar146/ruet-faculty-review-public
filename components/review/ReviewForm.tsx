'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import type { KeyboardEvent } from 'react'
import {
  capProblemAction,
  submitReview,
  suggestCoursesAction,
} from '@/app/actions/review'
import type { SubmitOutcome } from '@/app/actions/review'
import { AppealBox } from '@/components/review/AppealBox'
import { GuidelinesBox } from '@/components/review/GuidelinesBox'
import { ResubmitForm } from '@/components/review/ResubmitForm'
import { useSchoolKeyword } from '@/components/auth/SchoolKeywordGate'
import { Alert, Button, Input, Select, StarRating, Textarea } from '@/components/ui'
import {
  clearDraft,
  draftIsWorthKeeping,
  loadDraft,
  pruneExpiredDrafts,
  saveDraft,
} from '@/lib/reviewDraft'
import { SEMESTERS } from '@/lib/semesters'
import { useClickOutside } from '@/lib/useClickOutside'
import type { CourseOption } from '@/server/courses'
import { COMMENT_MAX, COMMENT_MIN, MAX_SUBMITS } from '@/validators/review'

// Three steps. The semester used to be a step of its own, but for all but
// eight courses it had nothing to answer: the course code carries it. It is
// now a line under the chosen course.
const STEPS = ['Course', 'Ratings', 'Your feedback']

const RATINGS = [
  { key: 'ratingTeaching', label: 'Teaching quality' },
  { key: 'ratingClarity', label: 'Concept clarity' },
  { key: 'ratingFairness', label: 'Fairness' },
  { key: 'ratingOverall', label: 'Overall' },
] as const

type RatingKey = (typeof RATINGS)[number]['key']

const SEMESTER_OPTIONS = SEMESTERS.map((value) => ({ value, label: value }))

// Two characters is enough to be worth a round trip. An empty box is a
// search of its own: the courses already reviewed for this teacher.
const SEARCH_AFTER = 2

// One request per pause in typing, not one per keystroke. The same wait the
// teacher search box uses.
const DEBOUNCE_MS = 300

// The draft is written this long after the last keystroke. localStorage is
// synchronous, so writing a 2000-character comment on every key press is
// work done on the main thread for nothing.
const DRAFT_SAVE_MS = 500

// Shown when a submit never got an answer: offline, a timeout, a 500. The
// point of the sentence is the middle clause.
const NETWORK_MESSAGE =
  'Something went wrong. Your review is still here, try again.'

function reviewLabel(count: number): string {
  return count === 1 ? '1 review' : `${count} reviews`
}

export type ReviewFormProps = {
  teacherId: string
  teacherSlug: string
  teacherName: string
  // Narrows the picker to courses this teacher's department teaches, so the
  // student never picks one canReview() will refuse.
  teacherDeptShortCode: string
}

export function ReviewForm({
  teacherId,
  teacherSlug,
  teacherName,
  teacherDeptShortCode,
}: ReviewFormProps) {
  const { keyword } = useSchoolKeyword()
  const [step, setStep] = useState(0)

  const listId = useId()
  const pickerRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CourseOption[]>([])
  const [searched, setSearched] = useState(false)
  const [active, setActive] = useState(0)
  // Nothing counts until this is set. There is no free typing any more.
  const [selected, setSelected] = useState<CourseOption | null>(null)

  const [semester, setSemester] = useState('')

  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    ratingTeaching: 0,
    ratingClarity: 0,
    ratingFairness: 0,
    ratingOverall: 0,
  })

  const [comment, setComment] = useState('')
  const [agreed, setAgreed] = useState(false)

  // Set when an unsent draft was found and put back, so the student is told
  // rather than wondering why the form is already filled in.
  const [restored, setRestored] = useState(false)
  // Nothing is saved until the draft has been read, or the first save would
  // overwrite the draft with the empty form it is about to replace.
  const [draftChecked, setDraftChecked] = useState(false)

  const [error, setError] = useState<string | null>(null)
  // The whole outcome, not just the status: a rejected student is told why
  // here, on the page they are already on, rather than having to find
  // /my-reviews. Most of them never would.
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null)
  const [pending, startTransition] = useTransition()

  // RESTORE, once, before anything is saved.
  //
  // Runs in an effect rather than in useState, because localStorage does not
  // exist while the server renders this and the first client render has to
  // match what the server produced.
  useEffect(() => {
    // Housekeeping for every teacher, not just this one: a draft older than
    // seven days is a forgotten tab, and this is the only code that runs
    // often enough to clean them up.
    pruneExpiredDrafts()

    const draft = loadDraft(teacherId)

    if (draft) {
      if (draft.course) setSelected(draft.course)
      setSemester(draft.semester)
      setRatings(draft.ratings)
      setComment(draft.comment)
      setRestored(true)
    }

    setDraftChecked(true)
  }, [teacherId])

  // KEEP SAVING while they type.
  useEffect(() => {
    if (!draftChecked) return

    const draft = { course: selected, semester, ratings, comment }

    // An untouched form is not a draft. Without this, opening the page and
    // leaving would mean the next visit announced that nothing was restored.
    if (!draftIsWorthKeeping(draft)) return

    const timer = setTimeout(() => saveDraft(teacherId, draft), DRAFT_SAVE_MS)
    return () => clearTimeout(timer)
  }, [draftChecked, teacherId, selected, semester, ratings, comment])

  useEffect(() => {
    const term = query.trim()

    // An empty box is a real search: it returns the courses already reviewed
    // for this teacher, so the list is useful before any typing. One or two
    // characters in between is too little to be worth a round trip.
    if (selected || (term.length > 0 && term.length < SEARCH_AFTER)) {
      setResults([])
      setSearched(false)
      return
    }

    let live = true
    // Wait for a pause in typing. One request per word, not per keystroke.
    const timer = setTimeout(async () => {
      const result = await suggestCoursesAction(term, teacherDeptShortCode, teacherId)
      if (!live) return
      setResults(result.ok ? (result.data ?? []) : [])
      setSearched(true)
      setActive(0)
    }, DEBOUNCE_MS)

    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query, selected, teacherDeptShortCode, teacherId])

  // The course knows its own semester, so picking one fills the dropdown in.
  // A year-long course has none, and the student says when they took it.
  useEffect(() => {
    if (!selected) return
    setSemester(selected.semester ?? '')
  }, [selected])

  function choose(course: CourseOption) {
    setSelected(course)
    setQuery('')
    setResults([])
    setSearched(false)
    setError(null)
  }

  function handleSearchKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setQuery('')
      setResults([])
      setSearched(false)
      return
    }

    if (results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => (current + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => (current - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const course = results[active]
      if (course) choose(course)
    }
  }

  // A click anywhere outside the picker closes the list, the same way
  // Escape does. Nothing is selected by closing it.
  useClickOutside(pickerRef, results.length > 0 || searched, () => {
    setResults([])
    setSearched(false)
  })

  // Already ordered by the server: reviewed first, then the rest by code.
  const reviewedResults = results.filter((course) => course.reviewCount > 0)
  const otherResults = results.filter((course) => course.reviewCount === 0)

  function option(course: CourseOption, index: number) {
    return (
      <li key={course.code} role="none">
        <button
          type="button"
          id={`${listId}-${index}`}
          role="option"
          aria-selected={index === active}
          onClick={() => choose(course)}
          onMouseEnter={() => setActive(index)}
          className={`flex w-full flex-col gap-1 border-b border-line px-4 py-3 text-left last:border-b-0 active:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
            index === active ? 'bg-mist' : ''
          }`}
        >
          <span className="text-[15px] font-medium text-ink">{course.code}</span>
          <span className="text-[13px] text-slate">
            {course.name}
            {course.semester ? ` · ${course.semester}` : ''}
            {course.reviewCount > 0 ? ` · ${reviewLabel(course.reviewCount)}` : ''}
          </span>
        </button>
      </li>
    )
  }

  const commentLength = comment.trim().length
  const commentOk = commentLength === 0 || commentLength >= COMMENT_MIN

  const canContinue = [
    // The course, and the semester it implies. A year-long course has none
    // of its own, so its dropdown has to be answered before moving on.
    selected !== null && semester.length > 0,
    RATINGS.every((item) => ratings[item.key] > 0),
    // The comment and the confirmation are one step now, so both gate it.
    commentOk && commentLength <= COMMENT_MAX && agreed,
  ][step]

  function next() {
    setError(null)

    if (step > 0) {
      if (step < STEPS.length - 1) setStep(step + 1)
      return
    }

    if (!selected) return

    // Leaving the course step is the first moment the teachers-per-course cap
    // can be answered at all: until a course is picked there is nothing to
    // count. The department cap is asked in the same request. Together they
    // save four ratings and a comment.
    //
    // submitReview asks again at step 6b and that is the rule, so a failed
    // check here lets the student carry on rather than blocking someone the
    // cap would have allowed.
    startTransition(async () => {
      try {
        const result = await capProblemAction(selected.code, teacherId, keyword)
        if (result.ok && result.data) {
          setError(result.data)
          return
        }
      } catch {
        // Offline, or a 500. Carry on; the server still refuses if it must.
      }

      setStep(1)
    })
  }

  function back() {
    setError(null)
    if (step > 0) setStep(step - 1)
  }

  function send() {
    if (!selected) return
    setError(null)

    startTransition(async () => {
      try {
        const result = await submitReview({
          teacherId,
          courseCode: selected.code,
          semester,
          ...ratings,
          comment: commentLength > 0 ? comment.trim() : undefined,
          agreedToGuidelines: true,
          schoolKeyword: keyword ?? '',
        })

        if (!result.ok) {
          // The server answered and refused: a rate limit, an eligibility
          // problem, a validation message. Its own sentence says what to do,
          // and nothing in the form is touched, so the retry is the same
          // button.
          setError(result.error)
          return
        }

        // Accepted. The review is on the server now, whatever the moderator
        // decided about it, so the draft must go: offered back later it
        // would look like a review that never sent.
        clearDraft(teacherId, selected.code)
        setRestored(false)

        if (result.data) setOutcome(result.data)
      } catch {
        // No answer at all. Offline, a timeout, a 500 from the action. The
        // draft stays, every field stays, and Submit tries again.
        setError(NETWORK_MESSAGE)
      }
    })
  }

  // Never say which rule or which flag fired. The sentence from the
  // moderator says what to fix; naming the trigger would teach someone how
  // to get around it.
  if (outcome) {
    const attemptsLeft = MAX_SUBMITS - outcome.submitCount

    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-[24px] leading-[1.2] font-bold text-ink">
          {outcome.status === 'PUBLISHED'
            ? 'Your review has been published.'
            : outcome.status === 'REJECTED'
              ? 'Your review was not published.'
              : 'Your review has been received.'}
        </h2>

        {outcome.status === 'PENDING' ? (
          <p className="text-[16px] text-slate">
            We are still checking this review. It will appear shortly.
          </p>
        ) : null}

        {outcome.status === 'REJECTED' ? (
          <div className="flex flex-col gap-5">
            {/* The same sentence /my-reviews shows, from the same row. */}
            {outcome.rejection ? (
              <Alert variant="error">{outcome.rejection}</Alert>
            ) : null}

            {attemptsLeft > 0 ? (
              <>
                <p className="text-[16px] text-slate">
                  {attemptsLeft === 1
                    ? 'You can try 1 more time.'
                    : `You can try ${attemptsLeft} more times.`}
                </p>

                {/* The same component and the same action as /my-reviews.
                    onResult updates this screen in place, so a second
                    rejection is read here too. */}
                <ResubmitForm
                  reviewId={outcome.reviewId}
                  ratings={ratings}
                  comment={comment.trim() ? comment : null}
                  attemptsLeft={attemptsLeft}
                  onResult={setOutcome}
                />
              </>
            ) : (
              <>
                <p className="text-[16px] text-slate">
                  You have used all {MAX_SUBMITS} attempts for this review.
                </p>

                {/* Still offered when the attempts are gone. That is what an
                    appeal is for. A review that has just been decided cannot
                    be final yet, so there is no final case here. */}
                <AppealBox
                  reviewId={outcome.reviewId}
                  appealed={false}
                  attemptsLeft={attemptsLeft}
                />
              </>
            )}

            <a
              href="/guidelines"
              className="text-[15px] text-slate underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Read the guidelines
            </a>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button as="link" href={`/teachers/${teacherSlug}`}>
            {outcome.status === 'PUBLISHED'
              ? 'See it on the profile'
              : `Back to ${teacherName}`}
          </Button>

          {outcome.status === 'REJECTED' ? (
            <Button as="link" href="/my-reviews" variant="ghost">
              My reviews
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-slate">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
        <div className="h-1 rounded-control bg-mist" aria-hidden="true">
          <div
            className="h-1 rounded-control bg-ink transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {restored ? (
        <Alert>
          We put back the review you had not sent yet. Check it over before you
          submit.
        </Alert>
      ) : null}

      {step === 0 ? (
        <div ref={pickerRef} className="flex flex-col gap-4">
          {selected ? (
            <>
              {/* min-w-0 on the text and shrink-0 on the button: without
                  them a long course name pushes Change off the row at
                  360px instead of wrapping. */}
              <div className="flex items-start justify-between gap-3 rounded-card border border-line bg-paper p-4 md:gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[15px] font-medium text-ink">
                    {selected.code}
                  </span>
                  <span className="text-[13px] text-slate">
                    {selected.name}
                    {selected.semester ? ` · ${selected.semester}` : ''}
                  </span>
                </div>

                <Button
                  type="button"
                  className="shrink-0"
                  onClick={() => {
                    setSelected(null)
                    setSemester('')
                  }}
                >
                  Change
                </Button>
              </div>

              {selected.semester ? (
                // Not a question. The course code decided it, and eligibility
                // rejects a mismatch, so there is nothing here to answer.
                <p className="text-[13px] text-slate">
                  Semester: {selected.semester}, taken from the course code.
                </p>
              ) : (
                // The eight year-long courses. Thesis and training span both
                // halves, so the student says which half they took.
                <div className="flex flex-col gap-2">
                  <Select
                    label="Which semester?"
                    required
                    placeholder="Choose a semester"
                    options={SEMESTER_OPTIONS}
                    value={semester}
                    onChange={(event) => setSemester(event.target.value)}
                  />

                  <p className="text-[13px] text-slate">
                    This course runs all year. Pick the semester you took it.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <Input
                label="Which course?"
                required
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleSearchKeys}
                placeholder="Search by code or name"
                autoComplete="off"
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  results.length > 0 ? `${listId}-${active}` : undefined
                }
                hint="Pick your course from the list."
              />

              {results.length > 0 ? (
                <ul
                  id={listId}
                  role="listbox"
                  aria-label="Courses"
                  className="flex flex-col rounded-card border border-line bg-paper"
                >
                  {/* The server returns reviewed courses first, so the
                      global index below stays in step with the keyboard. */}
                  {reviewedResults.length > 0 ? (
                    <li
                      role="presentation"
                      className="border-b border-line px-4 py-2 text-[13px] text-slate"
                    >
                      Reviewed for this teacher
                    </li>
                  ) : null}

                  {reviewedResults.map((course, index) => option(course, index))}

                  {otherResults.length > 0 ? (
                    <li
                      role="presentation"
                      className="border-b border-line px-4 py-2 text-[13px] text-slate"
                    >
                      Other courses
                    </li>
                  ) : null}

                  {otherResults.map((course, index) =>
                    option(course, reviewedResults.length + index),
                  )}
                </ul>
              ) : null}

              {searched && results.length === 0 ? (
                <p className="text-[15px] text-slate">
                  No course found. Check the code, or try the course name.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-5">
          {RATINGS.map((item) => (
            <div key={item.key} className="flex flex-col gap-2">
              <span className="text-[15px] font-medium text-ink">{item.label}</span>
              <StarRating
                value={ratings[item.key]}
                label={item.label}
                onChange={(value) =>
                  setRatings((current) => ({ ...current, [item.key]: value }))
                }
              />
            </div>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          {/* The rules come BEFORE the box, not after it. A student who
              reads them once the review is written is being judged by them
              rather than writing to them. */}
          <GuidelinesBox />

          {/* A plain anchor, not a Link: a new tab, so a half-finished form
              is not thrown away to go and read the full page. */}
          <a
            href="/guidelines"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-slate underline hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Read the full guidelines
          </a>

          <Textarea
            label="Your feedback"
            hint="Optional. What was the teaching like? What could be better?"
            maxLength={COMMENT_MAX}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            error={
              commentOk
                ? undefined
                : `Write at least ${COMMENT_MIN} characters, or leave it empty.`
            }
          />

          <label className="flex items-start gap-3 text-[15px] text-ink">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1 size-4"
            />
            I confirm this is my own experience and follows these rules.
          </label>
        </div>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        {step > 0 ? (
          <Button type="button" onClick={back} disabled={pending}>
            Back
          </Button>
        ) : null}

        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next} disabled={!canContinue || pending}>
            Next
          </Button>
        ) : (
          <Button type="button" onClick={send} disabled={!canContinue || pending}>
            {pending ? 'Sending...' : 'Submit review'}
          </Button>
        )}
      </div>
    </div>
  )
}
