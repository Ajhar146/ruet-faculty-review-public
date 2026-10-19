'use client'

/**
 * Client-Side Recovery Material Storage Helper
 *
 * Provides local device retention for reviewer authorization material.
 * Specific internal storage key prefixes, normalization algorithms, and
 * derivation chains are withheld from this public transparency repository.
 */

const LOCAL_STORAGE_KEY = 'reviewer_authorization_material'

export function getStoredKeyword(_userId?: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(LOCAL_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredKeyword(_userId: string, keyword: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, keyword)
  } catch {
    // Ignore storage write errors in restricted browser contexts
  }
}

export function clearStoredKeyword(_userId?: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY)
  } catch {
    // Ignore
  }
}
