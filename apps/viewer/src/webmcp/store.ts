/**
 * WebMCP Settings Store
 *
 * localStorage 기반 enabled 상태 관리 (기본 OFF, opt-in)
 * useSyncExternalStore 패턴으로 React 통합
 */

const STORAGE_KEY = 'webmcp.enabled'

/**
 * Store state
 */
interface WebMcpStore {
  enabled: boolean
  listeners: Set<() => void>
}

const store: WebMcpStore = {
  enabled: loadEnabled(),
  listeners: new Set(),
}

/**
 * Load enabled state from localStorage
 */
function loadEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

/**
 * Notify all listeners of state change
 */
function emitChange(): void {
  for (const listener of store.listeners) {
    listener()
  }
}

/**
 * Subscribe to store changes (for useSyncExternalStore)
 */
export function subscribe(listener: () => void): () => void {
  store.listeners.add(listener)
  return () => store.listeners.delete(listener)
}

/**
 * Get current snapshot (for useSyncExternalStore)
 */
export function getSnapshot(): boolean {
  return store.enabled
}

/**
 * Get server snapshot (SSR, always false)
 */
export function getServerSnapshot(): boolean {
  return false
}

/**
 * Set enabled state
 */
export function setEnabled(enabled: boolean): void {
  store.enabled = enabled
  if (typeof localStorage !== 'undefined') {
    if (enabled) {
      localStorage.setItem(STORAGE_KEY, 'true')
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }
  emitChange()
}

/**
 * Toggle enabled state
 */
export function toggleEnabled(): boolean {
  const newValue = !store.enabled
  setEnabled(newValue)
  return newValue
}
