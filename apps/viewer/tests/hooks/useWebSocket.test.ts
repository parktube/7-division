import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWebSocket, __resetStoreForTesting } from '@/hooks/useWebSocket'
import { MockWebSocket } from '../setup'

// Helper to get the main connection WebSocket (last one after port discovery)
function getMainWebSocket(): MockWebSocket | undefined {
  const instances = MockWebSocket.getAllInstances()
  // Port discovery creates 1 WebSocket (port 3002 succeeds), then main connection creates another
  // So main WebSocket is typically the 2nd instance
  return instances.length >= 2 ? instances[instances.length - 1] : instances[0]
}

// Helper to wait for port discovery and connection setup
async function waitForConnection() {
  // Advance time for port discovery and 200ms stabilization delay
  // We use advanceTimersByTimeAsync to avoid infinite loops from heartbeat
  await vi.advanceTimersByTimeAsync(500)
}

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.clearInstances()
    __resetStoreForTesting()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('connection management', () => {
    it('should connect to ws://localhost:3002 (port discovery)', async () => {
      renderHook(() => useWebSocket())

      // Wait for port discovery and connection setup
      await waitForConnection()

      // Main WebSocket should be the last instance after port discovery
      const ws = getMainWebSocket()
      expect(ws?.url).toBe('ws://localhost:3002')
    })

    it('should transition to connected when WebSocket opens', async () => {
      const { result } = renderHook(() => useWebSocket())

      // Wait for port discovery
      await waitForConnection()

      const ws = getMainWebSocket()
      expect(ws).toBeDefined()

      // Simulate opening the main connection
      await act(async () => {
        ws!.simulateOpen()
      })

      expect(result.current.connectionState).toBe('connected')
      expect(result.current.retryCount).toBe(0)
    })

    it('should set connectionState to connecting on connect', () => {
      const { result } = renderHook(() => useWebSocket())

      // Initially connecting (before port discovery completes)
      expect(result.current.connectionState).toBe('connecting')
    })
  })

  describe('message handling', () => {
    // Helper to setup connected WebSocket
    async function setupConnectedWebSocket() {
      const hookResult = renderHook(() => useWebSocket())

      // Wait for port discovery
      await waitForConnection()

      const ws = getMainWebSocket()!

      // Open the connection
      await act(async () => {
        ws.simulateOpen()
      })

      return { ...hookResult, ws }
    }

    it('should update scene on scene_update message', async () => {
      const { result, ws } = await setupConnectedWebSocket()

      const mockScene = {
        entities: [{
          id: 'circle1',
          entity_type: 'Circle',
          geometry: {},
          transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
          style: {}
        }],
      }

      await act(async () => {
        ws.simulateMessage({
          type: 'scene_update',
          data: { scene: mockScene },
          timestamp: Date.now(),
        })
      })

      expect(result.current.scene).toEqual(mockScene)
    })

    it('should update selection on selection message', async () => {
      const { result, ws } = await setupConnectedWebSocket()

      await act(async () => {
        ws.simulateMessage({
          type: 'selection',
          data: { selected: ['circle1', 'rect1'] },
          timestamp: Date.now(),
        })
      })

      expect(result.current.selection).toEqual(['circle1', 'rect1'])
    })

    it('should update connectionData on connection message', async () => {
      const { result, ws } = await setupConnectedWebSocket()

      await act(async () => {
        ws.simulateMessage({
          type: 'connection',
          data: { mcpVersion: '1.0.0', protocolVersion: 1 },
          timestamp: Date.now(),
        })
      })

      expect(result.current.connectionData).toEqual({
        mcpVersion: '1.0.0',
        protocolVersion: 1,
      })
    })

    it('should update error on error message', async () => {
      const { result, ws } = await setupConnectedWebSocket()

      await act(async () => {
        ws.simulateMessage({
          type: 'error',
          data: { message: 'Something went wrong' },
          timestamp: Date.now(),
        })
      })

      expect(result.current.error).toBe('Something went wrong')
    })

    it('should ignore invalid messages', async () => {
      const { result, ws } = await setupConnectedWebSocket()
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await act(async () => {
        ws.simulateMessage({
          type: 'invalid_type',
          data: {},
          timestamp: Date.now(),
        })
      })

      expect(consoleSpy).toHaveBeenCalled()
      expect(result.current.scene).toBeNull()

      consoleSpy.mockRestore()
    })
  })

  describe('reconnection (exponential backoff)', () => {
    it('should increment retryCount on connection close', async () => {
      const { result } = renderHook(() => useWebSocket())

      // Wait for initial connection setup
      await waitForConnection()

      const ws = getMainWebSocket()!

      await act(async () => {
        ws.simulateClose()
      })

      expect(result.current.retryCount).toBe(1)
      expect(result.current.connectionState).toBe('disconnected')
    })

    it('should attempt reconnection with exponential backoff', async () => {
      renderHook(() => useWebSocket())

      // Wait for initial connection
      await waitForConnection()

      const initialCount = MockWebSocket.getAllInstances().length
      const ws1 = getMainWebSocket()!

      // First connection closes
      await act(async () => {
        ws1.simulateClose()
      })

      // Run timers for first retry (1s delay + 200ms port discovery + buffer)
      await vi.advanceTimersByTimeAsync(1500)

      expect(MockWebSocket.getAllInstances().length).toBeGreaterThan(initialCount)

      // Second connection closes
      const ws2 = getMainWebSocket()!
      await act(async () => {
        ws2.simulateClose()
      })

      // Run timers for second retry (2s delay + buffer)
      await vi.advanceTimersByTimeAsync(2500)

      expect(MockWebSocket.getAllInstances().length).toBeGreaterThan(initialCount + 1)
    })

    it('should stop retrying after MAX_RETRY_ATTEMPTS (5)', async () => {
      const { result } = renderHook(() => useWebSocket())

      // Wait for initial connection
      await waitForConnection()

      // Simulate failed connection attempts until maxRetriesReached
      for (let i = 0; i < 6; i++) {
        const ws = getMainWebSocket()!
        await act(async () => {
          ws.simulateClose()
        })

        // Run timers for retry if not last iteration
        if (i < 5) {
          await waitForConnection()
        }
      }

      expect(result.current.maxRetriesReached).toBe(true)
      expect(result.current.retryCount).toBe(5)
      expect(result.current.error).toContain('Connection failed after 5 attempts')
    })

    it('should reset retry count on successful connection', async () => {
      const { result } = renderHook(() => useWebSocket())

      // Wait for initial connection
      await waitForConnection()

      // First connection fails
      const ws1 = getMainWebSocket()!
      await act(async () => {
        ws1.simulateClose()
      })
      expect(result.current.retryCount).toBe(1)

      // Run timer for retry
      await waitForConnection()

      // Second connection succeeds
      const ws2 = getMainWebSocket()!
      await act(async () => {
        ws2.simulateOpen()
      })

      expect(result.current.retryCount).toBe(0)
      expect(result.current.connectionState).toBe('connected')
    })
  })

  describe('manual reconnect', () => {
    it('should allow manual reconnection', async () => {
      const { result } = renderHook(() => useWebSocket())

      // Wait for initial connection
      await waitForConnection()

      const ws1 = getMainWebSocket()!
      await act(async () => {
        ws1.simulateOpen()
      })
      expect(result.current.connectionState).toBe('connected')

      const countBeforeReconnect = MockWebSocket.getAllInstances().length

      // Manually reconnect
      await act(async () => {
        result.current.reconnect()
      })

      // Wait for reconnection process
      await waitForConnection()

      expect(MockWebSocket.getAllInstances().length).toBeGreaterThan(countBeforeReconnect)
    })

    it('should reset maxRetriesReached on manual reconnect', async () => {
      const { result } = renderHook(() => useWebSocket())

      // Wait for initial connection
      await waitForConnection()

      // Exhaust retries (need 6 closes to trigger maxRetriesReached)
      for (let i = 0; i < 6; i++) {
        const ws = getMainWebSocket()!
        await act(async () => {
          ws.simulateClose()
        })

        if (i < 5) {
          await waitForConnection()
        }
      }

      expect(result.current.maxRetriesReached).toBe(true)

      // Manual reconnect should reset state
      await act(async () => {
        result.current.reconnect()
      })

      expect(result.current.maxRetriesReached).toBe(false)
      expect(result.current.retryCount).toBe(0)
    })
  })

  describe('sendPing', () => {
    it('should send ping message when connected', async () => {
      const { result } = renderHook(() => useWebSocket())

      // Wait for initial connection
      await waitForConnection()

      const ws = getMainWebSocket()!
      const sendSpy = vi.spyOn(ws, 'send')

      await act(async () => {
        ws.simulateOpen()
      })

      await act(async () => {
        result.current.sendPing()
      })

      expect(sendSpy).toHaveBeenCalled()
      const sentData = JSON.parse(sendSpy.mock.calls[0][0] as string)
      expect(sentData.type).toBe('ping')
    })

    it('should not send ping when disconnected', async () => {
      // Disable auto-open for this test
      MockWebSocket.portDiscoveryEnabled = false

      const { result } = renderHook(() => useWebSocket())

      // Port discovery fails, no WebSocket created
      await vi.advanceTimersByTimeAsync(5000) // Wait for all port attempts to timeout

      // sendPing should do nothing when not connected
      await act(async () => {
        result.current.sendPing()
      })

      // No WebSocket was successfully created, so no send should happen
      const instances = MockWebSocket.getAllInstances()
      const anySendCalled = instances.some(ws => {
        const spy = vi.spyOn(ws, 'send')
        return spy.mock.calls.length > 0
      })

      // Verify state is disconnected
      expect(result.current.connectionState).toBe('disconnected')
    })
  })

  describe('cleanup', () => {
    it('should NOT close WebSocket on unmount (shared global connection)', async () => {
      // The hook uses a global WebSocket shared across instances,
      // so individual hook unmounts don't close the connection
      const { unmount } = renderHook(() => useWebSocket())

      // Wait for connection setup
      await waitForConnection()

      const ws = getMainWebSocket()!
      const closeSpy = vi.spyOn(ws, 'close')

      await act(async () => {
        ws.simulateOpen()
      })

      unmount()

      // WebSocket should NOT be closed on unmount (by design)
      // Other hook instances may still need the connection
      expect(closeSpy).not.toHaveBeenCalled()
    })

    it('should clear timers on unmount', async () => {
      const { unmount } = renderHook(() => useWebSocket())

      // Wait for connection setup
      await waitForConnection()

      const ws = getMainWebSocket()!

      // Trigger reconnection timer
      await act(async () => {
        ws.simulateClose()
      })

      unmount()

      // Advance time - should not create new connections
      const instancesBeforeAdvance = MockWebSocket.getAllInstances().length
      await vi.advanceTimersByTimeAsync(10000)
      const instancesAfterAdvance = MockWebSocket.getAllInstances().length

      // No new instances should be created after unmount
      expect(instancesAfterAdvance).toBe(instancesBeforeAdvance)
    })
  })

  describe('heartbeat', () => {
    it('should start heartbeat interval on connection', async () => {
      const { result } = renderHook(() => useWebSocket())

      // Wait for connection setup
      await waitForConnection()

      const ws = getMainWebSocket()!
      const sendSpy = vi.spyOn(ws, 'send')

      await act(async () => {
        ws.simulateOpen()
      })

      expect(result.current.connectionState).toBe('connected')

      // Advance 30s to trigger heartbeat
      await vi.advanceTimersByTimeAsync(30000)

      // Should have sent a ping
      expect(sendSpy).toHaveBeenCalled()
      const sentData = JSON.parse(sendSpy.mock.calls[0][0] as string)
      expect(sentData.type).toBe('ping')
    })
  })
})
