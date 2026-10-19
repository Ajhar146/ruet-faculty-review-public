'use client'

import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { formatRating } from '@/lib/format'

export type StarRatingProps = {
  value: number
  max?: number
  readOnly?: boolean
  onChange?: (value: number) => void
  label?: string
  className?: string
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`size-5 ${filled ? 'text-ink' : 'text-line'}`}
    >
      <path d="M10 1.6l2.55 5.17 5.7.83-4.13 4.02.98 5.68L10 14.62l-5.1 2.68.98-5.68L1.75 7.6l5.7-.83z" />
    </svg>
  )
}

export function StarRating({
  value,
  max = 5,
  readOnly = false,
  onChange,
  label = 'Rating',
  className = '',
}: StarRatingProps) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])

  if (readOnly) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <span className="inline-flex" aria-hidden="true">
          {Array.from({ length: max }, (_, index) => (
            <Star key={index} filled={index < Math.round(value)} />
          ))}
        </span>
        <span className="text-[13px] text-slate">
          {formatRating(value)} out of {max}
        </span>
      </span>
    )
  }

  function select(next: number) {
    onChange?.(next)
    buttonsRef.current[next - 1]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let next = value

    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(max, value + 1)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
      next = Math.max(1, value - 1)
    else if (event.key === 'Home') next = 1
    else if (event.key === 'End') next = max
    else return

    event.preventDefault()
    select(next)
  }

  return (
    // flex-wrap so the "3 out of 5" label drops below the stars when the
    // 44px targets below leave no room for it beside them. At md the stars
    // are small again and it fits on one line, as it always has.
    <span className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span role="radiogroup" aria-label={label} className="inline-flex">
        {Array.from({ length: max }, (_, index) => {
          const starValue = index + 1
          const checked = starValue === value
          return (
            <button
              key={starValue}
              ref={(node) => {
                buttonsRef.current[index] = node
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${starValue} out of ${max}`}
              tabIndex={checked || (value === 0 && index === 0) ? 0 : -1}
              onClick={() => select(starValue)}
              onKeyDown={handleKeyDown}
              className="rounded-control p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:p-0.5"
            >
              <Star filled={starValue <= value} />
            </button>
          )
        })}
      </span>
      <span className="text-[13px] text-slate">
        {value > 0 ? `${value} out of ${max}` : 'No rating chosen'}
      </span>
    </span>
  )
}
