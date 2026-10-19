'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useClickOutside } from '@/lib/useClickOutside'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// text-[16px] on a phone: anything smaller and iOS zooms the page in when
// the select is tapped, and never zooms back out.
// shadow-resting: these are fields, not lines. A field inside the overlay
// sheet is not the nested elevation the rule warns about - that is about a
// card inside a card. See docs/DESIGN-SYSTEM.md section 5.
export const FILTER_FIELD_CLASS = `h-11 w-full rounded-control border border-line bg-paper px-3 py-0 text-[16px] text-ink shadow-resting sm:w-auto md:text-[15px] ${FOCUS_RING}`

// The internal name, kept so the two selects below read as they did.
const FIELD = FILTER_FIELD_CLASS

// Apply, shared by the built-in controls and any injected ones.
export const FILTER_APPLY_CLASS = `inline-flex min-h-11 w-full items-center justify-center rounded-control bg-ink px-5 text-[15px] font-medium text-paper hover:bg-brand-hover active:bg-brand-hover sm:w-auto ${FOCUS_RING}`

// A label above a control inside the sheet.
export const FILTER_LABEL_CLASS = 'text-[13px] font-medium text-ink sm:text-[15px]'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type DepartmentOption = {
  slug: string
  shortCode: string
  nameEn: string
}

export type FilterBarProps = {
  /** Only needed by the built-in Department select. */
  departments?: DepartmentOption[]
  q?: string
  dept?: string
  sort: string
  className?: string
  /**
   * Where the GET form submits. DEFAULTS TO '/teachers', so that page's
   * call site passes nothing and behaves exactly as before.
   */
  action?: string
  /** The sheet trigger's word. 'Filters' on /teachers, 'Sort' elsewhere. */
  triggerLabel?: string
  /**
   * The number on the trigger. Omitted means "count the built-in controls
   * the visitor set", which is what /teachers has always done.
   */
  activeCount?: number
  /**
   * Controls to put in the sheet INSTEAD of the built-in Department and
   * Sort selects. Style them with FILTER_FIELD_CLASS and
   * FILTER_LABEL_CLASS so one component cannot grow two looks.
   */
  children?: ReactNode
  /**
   * TRUE keeps this a sheet at EVERY width and hides the whole thing from
   * sm up.
   *
   * By default the sheet's markup becomes the inline row from sm -- that is
   * how /teachers shows Department / Sort / Apply on desktop with no second
   * component. A page that has its own desktop control needs the opposite,
   * or it would render two sort controls side by side.
   */
  sheetOnly?: boolean
  /** The form's DOM id, which aria-controls points at. */
  id?: string
}

const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'reviews', label: 'Most reviewed' },
]

// Name is the default, so sorting by it is not an active filter.
const DEFAULT_SORT = 'name'

/**
 * One dropdown for department, one for sort, and a button. Still a plain GET
 * form, so it works with the keyboard and the back button.
 *
 * On a phone it is a sheet: full width, anchored to the bottom, over a dimmed
 * backdrop. It used to be a small box hanging off the Filters button, which
 * ran past the right edge at 360px.
 *
 * From sm the sheet markup IS the inline row it has always been — static, no
 * backdrop, no border, always visible — so desktop is unchanged.
 */
export function FilterBar({
  departments = [],
  q,
  dept,
  sort,
  className = '',
  action = '/teachers',
  triggerLabel = 'Filters',
  activeCount: activeCountProp,
  children,
  sheetOnly = false,
  id = 'teacher-filters',
}: FilterBarProps) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLFormElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // From sm there is no sheet to close, and the row must stay put.
  useClickOutside(boxRef, open, () => setOpen(false))

  useEffect(() => {
    if (!open) return

    const sheet = sheetRef.current
    const first = sheet?.querySelector<HTMLElement>(FOCUSABLE)

    // Focus moves in when it opens, and back to the button when it closes.
    if (first) first.focus()
    else sheet?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      triggerRef.current?.focus()
    }
  }, [open])

  // What the button reports. The count is of filters the visitor set, not of
  // controls that exist.
  const activeCount = activeCountProp ?? (dept ? 1 : 0) + (sort !== DEFAULT_SORT ? 1 : 0)

  return (
    // sheetOnly hides the whole thing from sm, because a page using that mode
    // has its own desktop control. Joined rather than interpolated so the
    // default configuration produces a class string with no stray spaces --
    // byte-identical to what /teachers rendered before this prop existed.
    <div ref={boxRef} className={[sheetOnly ? 'sm:hidden' : '', className].filter(Boolean).join(' ')}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={id}
        // sm:hidden only when the sheet becomes the inline row. In sheetOnly
        // mode the wrapper above is already hidden from sm, so the trigger
        // must stay visible for the widths that remain.
        className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-control border border-line bg-paper px-4 text-[15px] font-medium text-ink shadow-resting active:bg-mist ${sheetOnly ? '' : 'sm:hidden'} ${FOCUS_RING}`}
      >
        {triggerLabel}
        {activeCount > 0 ? ` (${activeCount})` : ''}
      </button>

      {/* The dimmed page behind the sheet. A phone only, and only while open.
          Tapping it closes, like Escape and the close button. */}
      {open ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Close ${triggerLabel.toLowerCase()}`}
          onClick={() => setOpen(false)}
          className={`fixed inset-0 z-40 cursor-default bg-ink/40 ${sheetOnly ? '' : 'sm:hidden'}`}
        />
      ) : null}

      {/* Always in the DOM so the slide can transition: `display` cannot be
          animated, `transform` can. `invisible` keeps the closed sheet out of
          the tab order and out of the accessibility tree. */}
      {/* EVERY SHEET PROPERTY NEEDS AN sm: RESET, and bg-paper was the one
          that did not have one. The result was a white strip behind the
          Department / Sort by / Apply row on /teachers, spanning the whole
          container width while the controls inside it packed to the left —
          so it read as a panel escaping past the Search button above.

          sm:bg-transparent, not sm:bg-canvas: the row has no surface of its
          own, it sits on the page. Repainting it with the page colour would
          work today and be wrong the moment this row is ever placed on
          anything else. Each select keeps its own bg-paper from FIELD, which
          is what makes the fields read as fields.

          If you add another sheet-only class below, give it an sm: reset in
          the same string or this comes back. */}
      <form
        ref={sheetRef}
        id={id}
        action={action}
        method="get"
        tabIndex={-1}
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-t-card border-t border-line bg-paper p-6 shadow-overlay transition-transform duration-200 motion-reduce:transition-none ${
          open ? 'translate-y-0' : 'invisible translate-y-full'
        } ${
          // THE sm: RESETS ARE WHAT MAKE THIS A DESKTOP ROW. Dropping them in
          // sheetOnly mode is the whole difference between the two
          // configurations: the form then stays a bottom sheet at every width
          // it is rendered at, and the wrapper hides it from sm.
          sheetOnly
            ? ''
            : 'sm:static sm:visible sm:z-auto sm:max-h-none sm:translate-y-0 sm:flex-row sm:items-end sm:gap-3 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:transition-none'
        }`}
      >
        {q ? <input type="hidden" name="q" value={q} /> : null}

        {/* The sheet needs a title and a way out. Neither exists in the
            inline row, so both are hidden from sm. */}
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <p className="text-[20px] leading-[1.2] font-bold text-ink">Filters</p>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close filters"
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-line text-ink active:bg-mist ${FOCUS_RING}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="size-5"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* INJECTED CONTROLS WIN. A caller that passes children gets those
            instead of Department and Sort -- one component, two
            configurations, rather than a second copy of the sheet. */}
        {children ?? (
          <>
          <div className="flex flex-col gap-2">
            <label htmlFor="filter-dept" className="text-[13px] font-medium text-ink sm:text-[15px]">
              Department
            </label>
            <select id="filter-dept" name="dept" defaultValue={dept ?? ''} className={FIELD}>
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.slug} value={department.slug}>
                  {department.shortCode} — {department.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="filter-sort" className="text-[13px] font-medium text-ink sm:text-[15px]">
              Sort by
            </label>
            <select id="filter-sort" name="sort" defaultValue={sort} className={FIELD}>
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          </>
        )}

        {/* Full width and last in the sheet, so a thumb finds it without
            scrolling anything. The inline row keeps it beside the fields. */}
        <button
          type="submit"
          className={FILTER_APPLY_CLASS}
        >
          Apply
        </button>
      </form>
    </div>
  )
}
