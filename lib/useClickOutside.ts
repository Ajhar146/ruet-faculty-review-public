'use client'

import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Closes a suggestion list when the next click lands anywhere else.
 *
 * pointerdown, not click: a click fires after mouseup, so a list that closes
 * on click would still be open while the page under it was being pressed.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void
) {
  useEffect(() => {
    if (!active) return

    function handle(event: PointerEvent) {
      const element = ref.current
      if (!element) return
      if (event.target instanceof Node && element.contains(event.target)) return
      onOutside()
    }

    document.addEventListener('pointerdown', handle)
    return () => document.removeEventListener('pointerdown', handle)
  }, [ref, active, onOutside])
}
