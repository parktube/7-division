export function isMac(): boolean {
  return typeof navigator !== 'undefined' &&
         /Mac|iPod|iPhone|iPad/.test(navigator.platform)
}

export function isModifierKey(e: React.MouseEvent | React.KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' &&
         'cadAPI' in window &&
         window.cadAPI !== undefined
}
