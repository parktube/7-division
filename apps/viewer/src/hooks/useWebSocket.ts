import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import type { Scene } from '@/types/scene'
import { safeValidateMessage, type ConnectionData } from '@ai-native-cad/shared'
import {
  VIEWER_VERSION,
  checkVersionCompatibility,
  type VersionCompatibility,
} from '@/utils/version'

// Connection states
export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

// WebSocket configuration - try ports in order until one works
const WS_PORTS = [3001, 3002, 3003]
const INITIAL_RETRY_DELAY = 1000 // 1s
const MAX_RETRY_ATTEMPTS = 5 // 1s→2s→4s→8s→16s, then stop
const HEARTBEAT_INTERVAL = 10000 // 10s (server times out at 30s, so send more frequently)

// Find available WebSocket server
async function findAvailablePort(): Promise<string | null> {
  for (const port of WS_PORTS) {
    try {
      const url = `ws://localhost:${port}`
      const result = await testConnection(url)
      if (result) return url
    } catch {
      // Port not available, try next
    }
  }
  return null
}

function testConnection(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url)
      const timeout = setTimeout(() => {
        try { ws.close() } catch { /* ignore */ }
        resolve(false)
      }, 1000)

      ws.onopen = () => {
        clearTimeout(timeout)
        try { ws.close() } catch { /* ignore */ }
        resolve(true)
      }
      ws.onerror = () => {
        clearTimeout(timeout)
        try { ws.close() } catch { /* ignore */ }
        resolve(false)
      }
      ws.onclose = () => {
        // Silently handle close during test
      }
    } catch {
      resolve(false)
    }
  })
}

// Cached URL after successful discovery
let cachedWsUrl: string | null = null

// Global WebSocket reference - single connection shared by all hook instances
let globalWs: WebSocket | null = null
let globalRetryTimeout: ReturnType<typeof setTimeout> | null = null
let globalHeartbeatInterval: ReturnType<typeof setInterval> | null = null
let isConnecting = false // Prevent concurrent connect() calls

// Store for external store pattern (React 19 compatible)
interface WebSocketStore {
  scene: Scene | null
  selection: string[]
  connectionState: ConnectionState
  connectionData: ConnectionData | null
  versionStatus: VersionCompatibility | null
  isReadOnly: boolean // Major version mismatch → read-only mode (AC #4 of Story 9.8)
  error: string | null
  retryCount: number
  maxRetriesReached: boolean
  listeners: Set<() => void>
}

const initialStoreState = {
  scene: null,
  selection: [] as string[],
  connectionState: 'disconnected' as ConnectionState,
  connectionData: null as ConnectionData | null,
  versionStatus: null as VersionCompatibility | null,
  isReadOnly: false,
  error: null as string | null,
  retryCount: 0,
  maxRetriesReached: false,
}

const store: WebSocketStore = {
  ...initialStoreState,
  listeners: new Set(),
}

// For testing purposes only
export function __resetStoreForTesting() {
  Object.assign(store, initialStoreState)
  store.listeners.clear()
  // Reset global connection state
  if (globalWs) {
    globalWs.close()
    globalWs = null
  }
  if (globalRetryTimeout) {
    clearTimeout(globalRetryTimeout)
    globalRetryTimeout = null
  }
  if (globalHeartbeatInterval) {
    clearInterval(globalHeartbeatInterval)
    globalHeartbeatInterval = null
  }
  isConnecting = false
  cachedWsUrl = null
  emitChange()
}

// Cached snapshot for useSyncExternalStore
let cachedSnapshot: WebSocketStore | null = null

function emitChange() {
  cachedSnapshot = null // Invalidate cache to trigger re-render
  for (const listener of store.listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  store.listeners.add(listener)
  return () => store.listeners.delete(listener)
}

function getSnapshot(): WebSocketStore {
  // Return new object when version changes for React to detect changes
  if (!cachedSnapshot) {
    cachedSnapshot = { ...store }
  }
  return cachedSnapshot
}

function getServerSnapshot(): WebSocketStore {
  return getSnapshot()
}

export interface UseWebSocketResult {
  scene: Scene | null
  selection: string[]
  connectionState: ConnectionState
  connectionData: ConnectionData | null
  versionStatus: VersionCompatibility | null
  isReadOnly: boolean // Major version mismatch → read-only mode
  error: string | null
  retryCount: number
  maxRetriesReached: boolean
  reconnect: () => void
  sendPing: () => void
}

export function useWebSocket(): UseWebSocketResult {
  const mountedRef = useRef(true)

  // Subscribe to store changes (React 19 pattern)
  const storeState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const clearTimers = useCallback(() => {
    if (globalRetryTimeout) {
      clearTimeout(globalRetryTimeout)
      globalRetryTimeout = null
    }
    if (globalHeartbeatInterval) {
      clearInterval(globalHeartbeatInterval)
      globalHeartbeatInterval = null
    }
  }, [])

  const updateStore = useCallback((updates: Partial<WebSocketStore>) => {
    Object.assign(store, updates)
    emitChange()
  }, [])

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const raw = JSON.parse(event.data)
      const message = safeValidateMessage(raw)

      if (!message) {
        console.warn('[WS] Invalid message format:', raw)
        return
      }

      switch (message.type) {
        case 'scene_update':
          // Type assertion required: shared SceneSchema uses z.unknown() for geometry
          // Runtime safety ensured by Zod validation; see packages/shared/src/ws-messages.ts
          updateStore({ scene: message.data.scene as Scene })
          break
        case 'selection':
          updateStore({ selection: message.data.selected })
          break
        case 'connection': {
          const versionStatus = checkVersionCompatibility(
            VIEWER_VERSION,
            message.data.mcpVersion
          )
          // Major version mismatch → read-only mode (Story 9.8 AC #4)
          const isReadOnly = versionStatus.status === 'error'
          updateStore({
            connectionData: message.data,
            versionStatus,
            isReadOnly,
          })
          break
        }
        case 'error':
          updateStore({ error: message.data.message })
          break
        case 'pong':
          // Heartbeat response - connection is alive
          break
      }
    } catch (e) {
      console.error('[WS] Message parse error:', e)
    }
  }, [updateStore])

  const connect = useCallback(async () => {
    if (!mountedRef.current) return

    // Prevent concurrent connection attempts (multiple hook instances)
    if (isConnecting) return
    if (globalWs?.readyState === WebSocket.OPEN) return

    isConnecting = true
    clearTimers()
    updateStore({ connectionState: 'connecting', error: null })

    try {
      // Find available port if not cached
      if (!cachedWsUrl) {
        cachedWsUrl = await findAvailablePort()
        if (!cachedWsUrl) {
          isConnecting = false
          updateStore({
            connectionState: 'disconnected',
            error: 'No MCP server found on ports 3001-3003',
          })
          return
        }
        // Small delay after port discovery to let server stabilize
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      const ws = new WebSocket(cachedWsUrl)
      globalWs = ws

      ws.onopen = () => {
        isConnecting = false
        if (!mountedRef.current) return
        updateStore({
          connectionState: 'connected',
          error: null,
          retryCount: 0,
          maxRetriesReached: false,
        })

        // Start heartbeat
        globalHeartbeatInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ping',
              data: {},
              timestamp: Date.now(),
            }))
          }
        }, HEARTBEAT_INTERVAL)
      }

      ws.onmessage = handleMessage

      ws.onclose = () => {
        isConnecting = false
        globalWs = null
        if (!mountedRef.current) return
        clearTimers()

        const newRetryCount = store.retryCount + 1

        // Check if max retries reached (AC #2: max 5회)
        if (newRetryCount > MAX_RETRY_ATTEMPTS) {
          updateStore({
            connectionState: 'disconnected',
            maxRetriesReached: true,
            error: `Connection failed after ${MAX_RETRY_ATTEMPTS} attempts`,
          })
          return
        }

        updateStore({
          connectionState: 'disconnected',
          retryCount: newRetryCount,
        })

        // Exponential backoff: 1s→2s→4s→8s→16s
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, newRetryCount - 1)

        globalRetryTimeout = setTimeout(() => {
          if (mountedRef.current) {
            connect()
          }
        }, delay)
      }

      ws.onerror = () => {
        isConnecting = false
        if (!mountedRef.current) return
        updateStore({ error: 'WebSocket connection error' })
      }
    } catch (e) {
      isConnecting = false
      updateStore({
        connectionState: 'disconnected',
        error: e instanceof Error ? e.message : 'Connection failed',
      })
    }
  }, [clearTimers, handleMessage, updateStore])

  const reconnect = useCallback(() => {
    if (globalWs) {
      // Only close if not already closing/closed
      if (globalWs.readyState === WebSocket.OPEN ||
          globalWs.readyState === WebSocket.CONNECTING) {
        globalWs.close()
      }
      globalWs = null
    }
    clearTimers()
    // Reset cached URL to re-discover port
    cachedWsUrl = null
    isConnecting = false
    // Reset retry state for manual reconnect
    updateStore({ retryCount: 0, maxRetriesReached: false })
    // Small delay to ensure clean state
    setTimeout(() => connect(), 100)
  }, [connect, updateStore, clearTimers])

  const sendPing = useCallback(() => {
    if (globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({
        type: 'ping',
        data: {},
        timestamp: Date.now(),
      }))
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      // Don't close globalWs on unmount - other hook instances may still need it
      // Only clear timers if this is the last instance (handled by store listeners)
    }
  }, [connect])

  return {
    scene: storeState.scene,
    selection: storeState.selection,
    connectionState: storeState.connectionState,
    connectionData: storeState.connectionData,
    versionStatus: storeState.versionStatus,
    isReadOnly: storeState.isReadOnly,
    error: storeState.error,
    retryCount: storeState.retryCount,
    maxRetriesReached: storeState.maxRetriesReached,
    reconnect,
    sendPing,
  }
}
