import type { MouseEvent, KeyboardEvent } from 'react'

// Cache isMac result to avoid recomputing on every call
let cachedIsMac: boolean | null = null

export function isMac(): boolean {
  if (cachedIsMac !== null) return cachedIsMac

  if (typeof navigator === 'undefined') {
    cachedIsMac = false
    return false
  }

  // Modern API (Chrome 90+, Edge 90+)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any
  if (nav.userAgentData?.platform) {
    cachedIsMac = nav.userAgentData.platform === 'macOS'
    return cachedIsMac
  }

  // Fallback for Safari and older browsers
  cachedIsMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  return cachedIsMac
}

export function isModifierKey(e: MouseEvent | KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' &&
         'cadAPI' in window &&
         window.cadAPI !== undefined
}
