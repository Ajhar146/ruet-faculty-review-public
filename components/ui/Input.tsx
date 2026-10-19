'use client'

import { useId } from 'react'
import type { ComponentPropsWithoutRef } from 'react'

export type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'className'> & {
  label: string
  hint?: string
  error?: string
  className?: string
}

export function Input({
  label,
  hint,
  error,
  required,
  id,
  className = '',
  ...rest
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={inputId} className="text-[15px] font-medium text-ink">
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

      <input
        {...rest}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-11 rounded-control border bg-paper px-3 py-0 text-[16px] text-ink shadow-resting placeholder:text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:text-[15px] ${
          error ? 'border-danger' : 'border-line'
        }`}
      />

      {error ? (
        <p id={errorId} className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
