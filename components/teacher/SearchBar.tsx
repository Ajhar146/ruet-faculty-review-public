'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { suggestTeachersAction } from '@/app/actions/search'
import { useClickOutside } from '@/lib/useClickOutside'
import type { TeacherSuggestion } from '@/server/teachers'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

/**
 * THE GOLD FOCUS BOUNDARY, for the search field and nothing else.
 *
 * The hero field has had it since it was built; this is the same ring, so a
 * search box looks the same on /teachers and on a department page as it does
 * on the home page. One constant rather than the string twice.
 *
 * `focus`, not `focus-visible`, to match the hero's `focus-within`: a focused
 * search field should look focused however it was reached, a click included.
 * Every other control on the site keeps FOCUS_RING above — ink, and keyboard
 * only. This is the search field's ring, not a new site-wide default.
 *
 * TWO THINGS TO KNOW IF YOU REVISIT THIS. Section 11 of the design system
 * says the focus ring is ink, 2px, so gold is a deliberate exception and the
 * hero made it first. And accent on the page background is 2.95:1, a hair
 * under the 3:1 WCAG asks for a non-text indicator — ink is 14.04:1. Both
 * are decisions about the accent token and the hero, not about this file:
 * changing SEARCH_FOCUS back to FOCUS_RING here and on the hero reverses it
 * everywhere in two edits.
 */
const SEARCH_FOCUS = 'focus:outline-2 focus:outline-offset-2 focus:outline-accent'

// Below two characters, "sh" matching 40 teachers is not a suggestion. The
// server enforces the same number.
const SUGGEST_AFTER = 2

// One request per pause in typing, not one per keystroke.
const DEBOUNCE_MS = 300

// Below this, the long placeholder is cut off mid-word. 640px is Tailwind's
// own sm breakpoint, so the class names below and this stay in step.
const NARROW = '(max-width: 639px)'

export type SearchBarProps = {
  // Current values. They go back in so a search keeps the filters.
  q?: string
  // A hidden field. On a department page it is that department's slug, so
  // the search lands on /teachers already filtered to it.
  dept?: string
  sort?: string
  // The department page says which department it will search.
  placeholder?: string
  // What that becomes at phone width, where the long one does not fit.
  shortPlaceholder?: string
  className?: string
  /**
   * 'hero' is the home page's one tall field: icon inside at the left, submit
   * button as the right end-cap, resting elevation, accent focus ring.
   *
   * WHY A VARIANT AND NOT JUST A RESTYLE. This component is also on /teachers
   * and on every department page, where it sits in a row beside two selects
   * and an Apply button. A 56px field would wreck that row, and those pages
   * are deliberately out of scope. 'inline' is byte-for-byte what every
   * caller had before this prop existed, and it is the default.
   */
  variant?: 'inline' | 'hero'
}

/**
 * Still a plain GET form. Submitting changes the URL, the URL is the state,
 * and it works with JavaScript off.
 *
 * The suggestion list is on top of that, not instead of it. Enter picks a
 * highlighted suggestion when the list is open; otherwise it submits the
 * search exactly as before.
 */
export function SearchBar({
  q,
  dept,
  sort = 'name',
  placeholder = 'Search teacher, department or course...',
  shortPlaceholder = 'Search teachers',
  className = '',
  variant = 'inline',
}: SearchBarProps) {
  const router = useRouter()
  const listId = useId()
  const boxRef = useRef<HTMLDivElement>(null)

  const [value, setValue] = useState(q ?? '')
  const [results, setResults] = useState<TeacherSuggestion[]>([])
  const [searched, setSearched] = useState(false)
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  // Starts false so the server and the first client render agree. On a phone
  // it flips on mount, which changes placeholder text and nothing else.
  const [narrow, setNarrow] = useState(false)

  useClickOutside(boxRef, open, () => setOpen(false))

  useEffect(() => {
    const query = window.matchMedia(NARROW)
    setNarrow(query.matches)

    const onChange = (event: MediaQueryListEvent) => setNarrow(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const term = value.trim()

    if (term.length < SUGGEST_AFTER) {
      setResults([])
      setSearched(false)
      return
    }

    let live = true

    const timer = setTimeout(async () => {
      // The same dept the hidden field carries: the department page's own
      // slug, or the filter /teachers currently has applied. Undefined on
      // the home page, which searches everywhere.
      const result = await suggestTeachersAction(term, dept)
      if (!live) return
      setResults(result.ok ? (result.data ?? []) : [])
      setSearched(true)
      setActive(0)
      setOpen(true)
    }, DEBOUNCE_MS)

    return () => {
      live = false
      clearTimeout(timer)
    }
    // dept belongs here: it is read inside the effect, and leaving it out
    // meant a stale scope if this box ever stayed mounted while the
    // department changed.
  }, [value, dept])

  function go(teacher: TeacherSuggestion) {
    setOpen(false)
    router.push(`/teachers/${teacher.slug}`)
  }

  function handleKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }

    if (!open || results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => (current + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => (current - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      // Only when a suggestion is highlighted. Otherwise the form submits,
      // which is what Enter did before this existed.
      const teacher = results[active]
      if (teacher) {
        event.preventDefault()
        go(teacher)
      }
    }
  }

  const showList = open && searched
  const hero = variant === 'hero'

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form
        action="/teachers"
        method="get"
        role="search"
        className={
          hero
            ? // ONE OBJECT. The border, the radius and the elevation are on
              // this element, so the icon, the field and the button read as
              // three parts of one control rather than three controls.
              //
              // h-12 on a phone, h-14 (56px) from md. overflow-hidden lets
              // the button be a flush end-cap; the focus ring is an outline,
              // which draws outside the box and is not clipped by it.
              //
              // focus-within, not focus-visible on the input: the ring belongs
              // around the whole object, and it should show for a click as
              // well as for a tab, because a focused search field should look
              // focused however it was reached.
              'flex h-12 items-center gap-2 overflow-hidden rounded-control border border-line bg-paper pl-3 shadow-resting focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent md:h-14 md:gap-3 md:pl-4'
            : 'flex gap-2 sm:gap-3'
        }
      >
        <label htmlFor="teacher-search" className="sr-only">
          Search teachers
        </label>

        {/* Decoration: the label above is what a screen reader reads, and the
            button already has its own name. */}
        {hero ? (
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            className="size-5 shrink-0 text-slate"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="M13.5 13.5 18 18" />
          </svg>
        ) : null}

        <input
          id="teacher-search"
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeys}
          placeholder={narrow ? shortPlaceholder : placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && results.length > 0 ? `${listId}-${active}` : undefined
          }
          className={
            hero
              ? // No border, no radius, no ring: the wrapper owns all three.
                // min-w-0 so a long placeholder cannot push the button off the
                // right edge at 360px. 16px on a phone, or iOS zooms the page
                // in and never zooms back.
                'h-full min-w-0 flex-1 bg-transparent py-0 text-[16px] text-ink placeholder:text-slate focus-visible:outline-none md:text-[15px]'
              : `h-11 w-full rounded-control border border-line bg-paper px-3 py-0 text-[16px] text-ink shadow-resting placeholder:text-slate md:text-[15px] ${SEARCH_FOCUS}`
          }
        />

        {dept ? <input type="hidden" name="dept" value={dept} /> : null}
        {sort !== 'name' ? <input type="hidden" name="sort" value={sort} /> : null}

        {/* THE BUTTON STAYS, inside the field rather than beside it.
            Removing it and leaving Enter to submit was the other option. It
            is not taken: this is a plain GET form that has to work with
            JavaScript off, and on a phone a visible target is the only
            obvious way to submit — the keyboard's own Search key is there,
            but nothing on screen says so. Inside the field it costs no extra
            rectangle, which was the actual complaint. */}
        <button
          type="submit"
          aria-label="Search teachers"
          className={
            hero
              ? // The right end-cap. h-full makes it the full height of the
                // field, so it is a 46px target on a phone rather than a
                // small button floating inside a tall box.
                'inline-flex h-full shrink-0 items-center justify-center bg-ink px-4 text-[15px] font-medium text-paper hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-paper md:px-6'
              : `inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-control bg-ink text-[15px] font-medium text-paper hover:bg-brand-hover sm:w-auto sm:px-5 ${FOCUS_RING}`
          }
        >
          {/* The magnifier is only for the inline variant, where there is no
              icon inside the field. Two magnifiers in one control would be
              one too many. */}
          {hero ? null : (
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="size-5 sm:hidden"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="M13.5 13.5 18 18" />
            </svg>
          )}
          <span className={hero ? '' : 'hidden sm:inline'}>Search</span>
        </button>
      </form>

      {showList ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-2">
          {results.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Teachers"
              className="flex flex-col rounded-card border border-line bg-paper shadow-overlay"
            >
              {results.map((teacher, index) => (
                <li key={teacher.slug} role="none">
                  <button
                    type="button"
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onClick={() => go(teacher)}
                    onMouseEnter={() => setActive(index)}
                    className={`flex w-full flex-col gap-1 border-b border-line px-4 py-3 text-left last:border-b-0 active:bg-mist ${FOCUS_RING} ${
                      index === active ? 'bg-mist' : ''
                    }`}
                  >
                    <span className="text-[15px] font-medium text-ink">
                      {teacher.nameEn}
                    </span>
                    {teacher.nameBn ? (
                      <span className="bn text-[13px] text-slate">
                        {teacher.nameBn}
                      </span>
                    ) : null}
                    <span className="text-[13px] text-slate">
                      {teacher.designation} · {teacher.departmentShortCode}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-card border border-line bg-paper px-4 py-3 text-[15px] text-slate shadow-overlay">
              No match
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
