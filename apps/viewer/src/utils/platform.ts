export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false

  // Modern API (Chrome 90+, Edge 90+)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any
  if (nav.userAgentData?.platform) {
    return nav.userAgentData.platform === 'macOS'
  }

  // Fallback for Safari and older browsers
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform)
}

export function isModifierKey(e: React.MouseEvent | React.KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' &&
         'cadAPI' in window &&
         window.cadAPI !== undefined
}
