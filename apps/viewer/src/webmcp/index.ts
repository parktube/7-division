/**
 * WebMCP Public API
 *
 * Chrome WebMCP Early Preview 통합
 * - 기본 OFF, opt-in toggle
 * - WebMCP API 없으면 no-op
 */

import { useSyncExternalStore, useCallback } from 'react'
import { hasWebMcp } from './model-context'
import { subscribe, getSnapshot, getServerSnapshot, setEnabled, toggleEnabled } from './store'
import { registerWebMcpTools, unregisterWebMcpTools } from './register'

export { hasWebMcp } from './model-context'

/**
 * Setup WebMCP on app initialization
 * Call this once in App.tsx
 */
export function setupWebMcp(): void {
  // If already enabled in localStorage, register tools
  if (getSnapshot() && hasWebMcp()) {
    updateToolRegistration(true)
  }
}

/**
 * Teardown WebMCP on app unmount
 * Call this in useEffect cleanup
 */
export function teardownWebMcp(): void {
  updateToolRegistration(false)
}

/**
 * Helper to update tool registration
 */
function updateToolRegistration(shouldRegister: boolean): void {
  if (shouldRegister) {
    registerWebMcpTools()
  } else {
    unregisterWebMcpTools()
  }
}

/**
 * Helper to sync tool registration with enabled state
 */
function syncToolRegistration(enabled: boolean): void {
  if (!hasWebMcp()) return
  updateToolRegistration(enabled)
}

/**
 * Hook for WebMCP toggle UI
 */
export function useWebMcpToggle() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const available = hasWebMcp()

  const toggle: () => boolean = useCallback(() => {
    const newValue = toggleEnabled()
    syncToolRegistration(newValue)
    return newValue
  }, [])

  const setWebMcpEnabled = useCallback((value: boolean) => {
    setEnabled(value)
    syncToolRegistration(value)
  }, [])

  return {
    enabled,
    available,
    toggle,
    setEnabled: setWebMcpEnabled,
  }
}
