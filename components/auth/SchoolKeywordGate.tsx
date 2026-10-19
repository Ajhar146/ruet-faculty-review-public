'use client'

import { createContext, useContext, useEffect, useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import { bootstrapOwnership } from '@/app/actions/ownership'
import { Alert, Button, Input } from '@/components/ui'
import {
  clearStoredKeyword,
  getStoredKeyword,
  setStoredKeyword,
} from '@/lib/keyword-client'

export type SchoolKeywordContextValue = {
  keyword: string | null
  userId: string
  forgetKeyword: () => void
  setKeyword: (kw: string) => void
}

const SchoolKeywordContext = createContext<SchoolKeywordContextValue | null>(null)

export function useSchoolKeyword(): SchoolKeywordContextValue {
  const ctx = useContext(SchoolKeywordContext)
  if (!ctx) {
    throw new Error('useSchoolKeyword must be used within a SchoolKeywordGate')
  }
  return ctx
}

export type SchoolKeywordGateProps = {
  userId: string
  children: ReactNode
}

export function SchoolKeywordGate({ userId, children }: SchoolKeywordGateProps) {
  const [keyword, setKeywordState] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Read account-specific localStorage after client hydration
  useEffect(() => {
    const stored = getStoredKeyword(userId)
    setKeywordState(stored)
    setIsHydrated(true)
  }, [userId])

  function forgetKeyword() {
    clearStoredKeyword(userId)
    setKeywordState(null)
    setInputVal('')
    setError(null)
  }

  function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError(null)

    const raw = inputVal.trim().toLowerCase().replace(/\s+/g, '')

    if (!raw) {
      setError('Please enter your secret word.')
      return
    }

    if (raw.length > 64) {
      setError('The secret word must be 64 characters or fewer.')
      return
    }

    startTransition(async () => {
      try {
        const result = await bootstrapOwnership(raw)
        if (!result.ok) {
          setError(result.error)
          return
        }

        // Only after server bootstrap succeeds, persist to localStorage
        setStoredKeyword(userId, raw)
        setKeywordState(raw)
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  // Prevent flash or hydration mismatch while reading localStorage
  if (!isHydrated) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-slate text-[14px]">
        Loading account settings...
      </div>
    )
  }

  // Keyword is already set on this device for this account
  if (keyword) {
    return (
      <SchoolKeywordContext.Provider
        value={{
          keyword,
          userId,
          forgetKeyword,
          setKeyword: setKeywordState,
        }}
      >
        {children}
      </SchoolKeywordContext.Provider>
    )
  }

  // Keyword is missing: show setup prompt modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-card border border-line bg-paper p-6 shadow-raised md:p-8">
        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-1.5 self-start rounded-control bg-mist px-2.5 py-1 text-[12px] font-semibold tracking-wide text-brand uppercase">
            Privacy & Anonymity
          </span>
          <h2 className="text-[22px] font-bold text-ink">
            Your secret recovery word
          </h2>
          <p className="text-[14px] leading-relaxed text-slate">
            To keep your reviews decoupled from your student account while still allowing you to
            manage, edit, or delete them in the future, set a memorable <strong>secret authorization phrase</strong>.
          </p>
        </div>

        <div className="my-5 rounded-control border border-line bg-mist p-3.5 text-[13px] text-ink">
          <p className="font-semibold text-slate mb-1">Guidance:</p>
          <p className="text-slate leading-relaxed">
            Choose a distinctive, memorable phrase or secret word known only to you.
            Avoid trivially guessable values such as common district names, common school names, or short nicknames.
          </p>
        </div>

        <p className="mb-4 text-[12.5px] leading-relaxed text-black font-semibold">
          ⚠️ <strong>Important:</strong> Keep this phrase safe. Because review ownership is decoupled from your account, this secret is retained on your device and cannot be reset by site administrators.
        </p>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input
            label="Secret authorization phrase"
            hint="Single word or phrase. Lowercase, letters only."
            placeholder="Enter your secret phrase"
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value.toLowerCase().replace(/\s+/g, ''))
              setError(null)
            }}
            disabled={pending}
            autoFocus
          />

          {error ? <Alert variant="error">{error}</Alert> : null}

          <div className="mt-2 flex items-center justify-end gap-3">
            <Button type="submit" disabled={pending || !inputVal.trim()}>
              {pending ? 'Saving...' : 'Save & Continue'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
