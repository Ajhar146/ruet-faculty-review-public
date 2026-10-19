'use client'

import { useId, useState } from 'react'
import type { ChangeEvent, ComponentPropsWithoutRef } from 'react'

export type TextareaProps = Omit<ComponentPropsWithoutRef<'textarea'>, 'className'> & {
  label: string
  hint?: string
  error?: string
  maxLength?: number
  className?: string
}

export function Textarea({
  label,
  hint,
  error,
  maxLength,
  required,
  id,
  className = '',
  onChange,
  ...rest
}: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const hintId = `${textareaId}-hint`
  const errorId = `${textareaId}-error`
  const countId = `${textareaId}-count`

  const initial = String(rest.value ?? rest.defaultValue ?? '')
  const [count, setCount] = useState(initial.length)
  const overLimit = maxLength !== undefined && count > maxLength

  const describedBy =
    [hint ? hintId : null, error ? errorId : null, maxLength ? countId : null]
      .filter(Boolean)
      .join(' ') || undefined

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setCount(event.target.value.length)
    onChange?.(event)
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={textareaId} className="text-[15px] font-medium text-ink">
        {label}
        {required ? (
          <span className="text-danger">
            {' '}
            *<span className="sr-only"> required</span>
          </span>
        ) : null}
      </label>

      {hint ? (
        <p id={hintId} className="text-[13px] text-slate">
          {hint}
        </p>
      ) : null}

      <textarea
        {...rest}
        id={textareaId}
        rows={rest.rows ?? 5}
        required={required}
        onChange={handleChange}
        aria-invalid={error || overLimit ? true : undefined}
        aria-describedby={describedBy}
        className={`rounded-control border bg-paper px-3 py-1.5 text-[16px] leading-relaxed text-ink shadow-resting placeholder:text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:text-[15px] ${
          error || overLimit ? 'border-danger' : 'border-line'
        }`}
      />

      <div className="flex items-start justify-between gap-4">
        {error ? (
          <p id={errorId} className="text-[13px] text-danger">
            {error}
          </p>
        ) : (
          <span />
        )}

        {maxLength !== undefined ? (
          <p
            id={countId}
            aria-live="polite"
            className={`text-[13px] ${overLimit ? 'text-danger' : 'text-slate'}`}
          >
            {count} of {maxLength} characters
          </p>
        ) : null}
      </div>
    </div>
  )
}
