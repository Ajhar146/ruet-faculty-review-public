'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { signOut } from '@/app/actions/auth'
import { Container } from './Container'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// focus-visible, never focus. A tap must not leave an outline behind.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// Every item in the menu is the same row: full width, left aligned, one
// size, a line between it and the next. A filled block in the middle of a
// list of links read as the only thing worth tapping.
const ROW = `flex min-h-12 w-full items-center text-[15px] text-ink hover:bg-mist active:bg-mist ${FOCUS_RING}`


// A plain string, not the Prisma enum: this is a client component and must
// never pull the database client into the browser bundle.
export type NavRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | null

export type MobileMenuProps = {
  role: NavRole
  // Independent of the role. A student admin is both, and sees both.
  isAdmin?: boolean
}

export function MobileMenu({ role, isAdmin = false }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const panel = panelRef.current

    function focusable() {
      return panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
    }

    const first = focusable()[0]
    if (first) first.focus()
    else panel?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }

      if (event.key !== 'Tab') return

      const items = focusable()
      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const firstItem = items[0]
      const lastItem = items[items.length - 1]

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      triggerRef.current?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        className={`inline-flex size-11 items-center justify-center rounded-control border border-line text-ink ${FOCUS_RING}`}
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
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          tabIndex={-1}
          className="fixed inset-0 z-50 overflow-y-auto bg-paper"
        >
          <Container>
            <div className="flex min-h-16 items-center border-b border-line">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className={`inline-flex items-center gap-2 text-[16px] leading-4 ${FOCUS_RING}`}
              >
                <img
                  src="/ruet-logo.svg"
                  alt=""
                  aria-hidden="true"
                  width={24}
                  height={28}
                  className="h-7 w-auto shrink-0"
                />
                <span>
                  <span className="font-bold text-ink">RUET</span>
                  <span className="font-bold text-slate">{' Faculty Review'}</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className={`ml-auto inline-flex size-11 items-center justify-center rounded-control border border-line text-ink ${FOCUS_RING}`}
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

            {/* The same items as the desktop header, in the same order,
                every one of them the same row. */}
            <nav
              aria-label="Account"
              className="flex flex-col divide-y divide-line py-2"
            >
              <Link href="/teachers" onClick={() => setOpen(false)} className={ROW}>
                Teachers
              </Link>

              {/* A teacher writes nothing, so they never get this one. */}
              {role === 'STUDENT' ? (
                <Link
                  href="/my-reviews"
                  onClick={() => setOpen(false)}
                  className={ROW}
                >
                  My reviews
                </Link>
              ) : null}

              {isAdmin ? (
                <Link href="/admin" onClick={() => setOpen(false)} className={ROW}>
                  Admin
                </Link>
              ) : null}

              {role ? (
                <form action={signOut}>
                  <button type="submit" className={ROW}>
                    Sign out
                  </button>
                </form>
              ) : null}
            </nav>
          </Container>
        </div>
      ) : null}
    </>
  )
}
