import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket, __resetStoreForTesting } from '@/hooks/useWebSocket'
import { MockWebSocket } from '../setup'

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
    it('should connect to ws://127.0.0.1:3001', () => {
      renderHook(() => useWebSocket())

      const ws = MockWebSocket.getLastInstance()
      expect(ws?.url).toBe('ws://127.0.0.1:3001')
    })

    it('should transition to connected when WebSocket opens', () => {
      const { result, rerender } = renderHook(() => useWebSocket())

      const ws = MockWebSocket.getLastInstance()
      expect(ws).toBeDefined()

      act(() => {
        ws!.simulateOpen()
      })
      rerender()

      expect(result.current.connectionState).toBe('connected')
      expect(result.current.retryCount).toBe(0)
    })

    it('should set connectionState to connecting on connect', () => {
      const { result, rerender } = renderHook(() => useWebSocket())
      rerender()

      // connect() is called in useEffect, which sets state to 'connecting'
      expect(result.current.connectionState).toBe('connecting')
    })
  })

  describe('message handling', () => {
    it('should update scene on scene_update message', () => {
      const { result, rerender } = renderHook(() => useWebSocket())
      const ws = MockWebSocket.getLastInstance()!

      act(() => {
        ws.simulateOpen()
      })
      rerender()

      const mockScene = {
        entities: [{
          id: 'circle1',
          entity_type: 'Circle',
          geometry: {},
          transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
          style: {}
        }],
      }

      act(() => {
        ws.simulateMessage({
          type: 'scene_update',
          data: { scene: mockScene },
          timestamp: Date.now(),
        })
      })
      rerender()

      expect(result.current.scene).toEqual(mockScene)
    })

    it('should update selection on selection message', () => {
      const { result, rerender } = renderHook(() => useWebSocket())
      const ws = MockWebSocket.getLastInstance()!

      act(() => {
        ws.simulateOpen()
      })
      rerender()

      act(() => {
        ws.simulateMessage({
          type: 'selection',
          data: { selected: ['circle1', 'rect1'] },
          timestamp: Date.now(),
        })
      })
      rerender()

      expect(result.current.selection).toEqual(['circle1', 'rect1'])
    })

    it('should update connectionData on connection message', () => {
      const { result, rerender } = renderHook(() => useWebSocket())
      const ws = MockWebSocket.getLastInstance()!

      act(() => {
        ws.simulateOpen()
      })
      rerender()

      act(() => {
        ws.simulateMessage({
          type: 'connection',
          data: { mcpVersion: '1.0.0', protocolVersion: 1 },
          timestamp: Date.now(),
        })
      })
      rerender()

      expect(result.current.connectionData).toEqual({
        mcpVersion: '1.0.0',
        protocolVersion: 1,
      })
    })

    it('should update error on error message', () => {
      const { result, rerender } = renderHook(() => useWebSocket())
      const ws = MockWebSocket.getLastInstance()!

      act(() => {
        ws.simulateOpen()
      })
      rerender()

      act(() => {
        ws.simulateMessage({
          type: 'error',
          data: { message: 'Something went wrong' },
          timestamp: Date.now(),
        })
      })
      rerender()

      expect(result.current.error).toBe('Something went wrong')
    })

    it('should ignore invalid messages', () => {
      const { result, rerender } = renderHook(() => useWebSocket())
      const ws = MockWebSocket.getLastInstance()!
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      act(() => {
        ws.simulateOpen()
      })
      rerender()

      act(() => {
        ws.simulateMessage({
          type: 'invalid_type',
          data: {},
          timestamp: Date.now(),
        })
      })
      rerender()

      expect(consoleSpy).toHaveBeenCalled()
      expect(result.current.scene).toBeNull()

      consoleSpy.mockRestore()
    })
  })

  describe('reconnection (exponential backoff)', () => {
    it('should increment retryCount on connection close', () => {
      const { result, rerender } = renderHook(() => useWebSocket())
      const ws = MockWebSocket.getLastInstance()!

      act(() => {
        ws.simulateClose()
      })
      rerender()

      expect(result.current.retryCount).toBe(1)
      expect(result.current.connectionState).toBe('disconnected')
    })

    it('should attempt reconnection with exponential backoff', () => {
      const { rerender } = renderHook(() => useWebSocket())

      // First connection closes
      const ws1 = MockWebSocket.getLastInstance()!
      act(() => {
        ws1.simulateClose()
      })
      rerender()
      expect(MockWebSocket.getAllInstances().length).toBe(1)

      // Advance 1s for first retry
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      rerender()
      expect(MockWebSocket.getAllInstances().length).toBe(2)

      // Second connection closes
      const ws2 = MockWebSocket.getLastInstance()!
      act(() => {
        ws2.simulateClose()
      })
      rerender()

      // Advance 2s for second retry
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      rerender()
      expect(MockWebSocket.getAllInstances().length).toBe(3)

      // Third connection closes
      const ws3 = MockWebSocket.getLastInstance()!
      act(() => {
        ws3.simulateClose()
      })
      rerender()

      // Advance 4s for third retry
      act(() => {
        vi.advanceTimersByTime(4000)
      })
      rerender()
      expect(MockWebSocket.getAllInstances().length).toBe(4)
    })

    it('should stop retrying after MAX_RETRY_ATTEMPTS (5)', () => {
      const { result, rerender } = renderHook(() => useWebSocket())

      // Simulate failed connection attempts until maxRetriesReached
      // retryCount > MAX_RETRY_ATTEMPTS triggers maxRetriesReached
      // So we need 6 closes: initial + 5 retries + 1 final to trigger maxRetriesReached
      const delays = [1000, 2000, 4000, 8000, 16000] // 1s, 2s, 4s, 8s, 16s

      for (let i = 0; i < 6; i++) {
        const ws = MockWebSocket.getLastInstance()!
        act(() => {
          ws.simulateClose()
        })
        rerender()

        // Advance timer for exponential backoff if not last iteration
        if (i < 5) {
          const delay = delays[i]
          act(() => {
            vi.advanceTimersByTime(delay)
          })
          rerender()
        }
      }

      expect(result.current.maxRetriesReached).toBe(true)
      // retryCount stays at 5 when maxRetriesReached is triggered (not incremented further)
      expect(result.current.retryCount).toBe(5)
      expect(result.current.error).toContain('Connection failed after 5 attempts')
    })

    it('should reset retry count on successful connection', () => {
      const { result, rerender } = renderHook(() => useWebSocket())

      // First connection fails
      const ws1 = MockWebSocket.getLastInstance()!
      act(() => {
        ws1.simulateClose()
      })
      rerender()
      expect(result.current.retryCount).toBe(1)

      // Advance timer for retry
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      rerender()

      // Second connection succeeds
      const ws2 = MockWebSocket.getLastInstance()!
      act(() => {
        ws2.simulateOpen()
      })
      rerender()

      expect(result.current.retryCount).toBe(0)
      expect(result.current.connectionState).toBe('connected')
    })
  })

  describe('manual reconnect', () => {
    it('should allow manual reconnection', () => {
      const { result, rerender } = renderHook(() => useWebSocket())

      const ws1 = MockWebSocket.getLastInstance()!
      act(() => {
        ws1.simulateOpen()
      })
      rerender()
      expect(result.current.connectionState).toBe('connected')

      // Manually reconnect
      act(() => {
        result.current.reconnect()
      })
      rerender()

      expect(MockWebSocket.getAllInstances().length).toBe(2)
    })

    it('should reset maxRetriesReached on manual reconnect', () => {
      const { result, rerender } = renderHook(() => useWebSocket())

      // Exhaust retries (need 6 closes to trigger maxRetriesReached)
      const delays = [1000, 2000, 4000, 8000, 16000]
      for (let i = 0; i < 6; i++) {
        const ws = MockWebSocket.getLastInstance()!
        act(() => {
          ws.simulateClose()
        })
        rerender()

        if (i < 5) {
          const delay = delays[i]
          act(() => {
            vi.advanceTimersByTime(delay)
          })
          rerender()
        }
      }

      expect(result.current.maxRetriesReached).toBe(true)

      // Manual reconnect should reset state
      act(() => {
        result.current.reconnect()
      })
      rerender()

      expect(result.current.maxRetriesReached).toBe(false)
      expect(result.current.retryCount).toBe(0)
    })
  })

  describe('sendPing', () => {
    it('should send ping message when connected', () => {
      const { result, rerender } = renderHook(() => useWebSocket())

      const ws = MockWebSocket.getLastInstance()!
      const sendSpy = vi.spyOn(ws, 'send')

      act(() => {
        ws.simulateOpen()
      })
      rerender()

      act(() => {
        result.current.sendPing()
      })

      expect(sendSpy).toHaveBeenCalled()
      const sentData = JSON.parse(sendSpy.mock.calls[0][0] as string)
      expect(sentData.type).toBe('ping')
    })

    it('should not send ping when disconnected', () => {
      const { result } = renderHook(() => useWebSocket())

      const ws = MockWebSocket.getLastInstance()!
      const sendSpy = vi.spyOn(ws, 'send')

      // Don't open the connection
      act(() => {
        result.current.sendPing()
      })

      expect(sendSpy).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('should close WebSocket on unmount', () => {
      const { rerender, unmount } = renderHook(() => useWebSocket())

      const ws = MockWebSocket.getLastInstance()!
      const closeSpy = vi.spyOn(ws, 'close')

      act(() => {
        ws.simulateOpen()
      })
      rerender()

      unmount()

      expect(closeSpy).toHaveBeenCalled()
    })

    it('should clear timers on unmount', () => {
      const { rerender, unmount } = renderHook(() => useWebSocket())

      const ws = MockWebSocket.getLastInstance()!

      // Trigger reconnection timer
      act(() => {
        ws.simulateClose()
      })
      rerender()

      unmount()

      // Advance time - should not create new connections
      const instancesBeforeAdvance = MockWebSocket.getAllInstances().length
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      const instancesAfterAdvance = MockWebSocket.getAllInstances().length

      // No new instances should be created after unmount
      expect(instancesAfterAdvance).toBe(instancesBeforeAdvance)
    })
  })

  describe('heartbeat', () => {
    it('should start heartbeat interval on connection', () => {
      const { result, rerender } = renderHook(() => useWebSocket())
      const ws = MockWebSocket.getLastInstance()!
      const sendSpy = vi.spyOn(ws, 'send')

      act(() => {
        ws.simulateOpen()
      })
      rerender()

      expect(result.current.connectionState).toBe('connected')

      // Advance 30s to trigger heartbeat
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      // Should have sent a ping
      expect(sendSpy).toHaveBeenCalled()
      const sentData = JSON.parse(sendSpy.mock.calls[0][0] as string)
      expect(sentData.type).toBe('ping')
    })
  })
})
