'use client'

import { useId } from 'react'
import type { ComponentPropsWithoutRef } from 'react'

export type SelectOption = {
  value: string
  label: string
}

export type SelectProps = Omit<ComponentPropsWithoutRef<'select'>, 'className'> & {
  label: string
  options: SelectOption[]
  hint?: string
  error?: string
  placeholder?: string
  className?: string
}

export function Select({
  label,
  options,
  hint,
  error,
  placeholder,
  required,
  id,
  className = '',
  ...rest
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const hintId = `${selectId}-hint`
  const errorId = `${selectId}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={selectId} className="text-[15px] font-medium text-ink">
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

      <select
        {...rest}
        id={selectId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-11 rounded-control border bg-paper px-3 py-0 text-[16px] text-ink shadow-resting focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:text-[15px] ${
          error ? 'border-danger' : 'border-line'
        }`}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error ? (
        <p id={errorId} className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
