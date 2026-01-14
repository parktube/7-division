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

// WebSocket configuration
const WS_URL = 'ws://127.0.0.1:3001'
const INITIAL_RETRY_DELAY = 1000 // 1s
const MAX_RETRY_DELAY = 30000 // 30s
const HEARTBEAT_INTERVAL = 30000 // 30s

// Store for external store pattern (React 19 compatible)
interface WebSocketStore {
  scene: Scene | null
  selection: string[]
  connectionState: ConnectionState
  connectionData: ConnectionData | null
  versionStatus: VersionCompatibility | null
  error: string | null
  listeners: Set<() => void>
}

const store: WebSocketStore = {
  scene: null,
  selection: [],
  connectionState: 'disconnected',
  connectionData: null,
  versionStatus: null,
  error: null,
  listeners: new Set(),
}

function emitChange() {
  for (const listener of store.listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  store.listeners.add(listener)
  return () => store.listeners.delete(listener)
}

function getSnapshot() {
  return store
}

function getServerSnapshot() {
  return store
}

export interface UseWebSocketResult {
  scene: Scene | null
  selection: string[]
  connectionState: ConnectionState
  connectionData: ConnectionData | null
  versionStatus: VersionCompatibility | null
  error: string | null
  reconnect: () => void
  sendPing: () => void
}

export function useWebSocket(): UseWebSocketResult {
  const wsRef = useRef<WebSocket | null>(null)
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  // Subscribe to store changes (React 19 pattern)
  const storeState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const clearTimers = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
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
          updateStore({
            connectionData: message.data,
            versionStatus,
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

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    clearTimers()
    updateStore({ connectionState: 'connecting', error: null })

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        updateStore({ connectionState: 'connected', error: null })
        retryDelayRef.current = INITIAL_RETRY_DELAY

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
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
        if (!mountedRef.current) return
        clearTimers()
        updateStore({ connectionState: 'disconnected' })

        // Exponential backoff retry
        const delay = retryDelayRef.current
        retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_DELAY)

        retryTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect()
          }
        }, delay)
      }

      ws.onerror = () => {
        if (!mountedRef.current) return
        updateStore({ error: 'WebSocket connection error' })
      }
    } catch (e) {
      updateStore({
        connectionState: 'disconnected',
        error: e instanceof Error ? e.message : 'Connection failed',
      })
    }
  }, [clearTimers, handleMessage, updateStore])

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    retryDelayRef.current = INITIAL_RETRY_DELAY
    connect()
  }, [connect])

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
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
      clearTimers()
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect, clearTimers])

  return {
    scene: storeState.scene,
    selection: storeState.selection,
    connectionState: storeState.connectionState,
    connectionData: storeState.connectionData,
    versionStatus: storeState.versionStatus,
    error: storeState.error,
    reconnect,
    sendPing,
  }
}
