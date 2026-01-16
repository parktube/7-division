import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import { CADWebSocketServer } from '../src/ws-server.js'
import type { Scene } from '../src/shared/index.js'

// Use different port range for tests to avoid conflicts with running MCP server
const TEST_PORT = 4001
const TEST_MAX_PORT = 4003

describe('CADWebSocketServer', () => {
  let server: CADWebSocketServer

  beforeEach(() => {
    server = new CADWebSocketServer({ startPort: TEST_PORT, maxPort: TEST_MAX_PORT })
  })

  afterEach(async () => {
    await server.stop()
  })

  describe('start/stop', () => {
    it('should start on configured port', async () => {
      const port = await server.start()
      expect(port).toBe(TEST_PORT)
    })

    it('should stop gracefully', async () => {
      await server.start()
      await server.stop()
      expect(server.getClientCount()).toBe(0)
    })
  })

  describe('client connections', () => {
    it('should accept client connections', async () => {
      const port = await server.start()

      const client = new WebSocket(`ws://127.0.0.1:${port}`)

      await new Promise<void>((resolve) => {
        client.on('open', () => {
          expect(server.getClientCount()).toBe(1)
          client.close()
          resolve()
        })
      })
    })

    it('should send connection message on connect', async () => {
      const port = await server.start()

      const client = new WebSocket(`ws://127.0.0.1:${port}`)
      const messages: unknown[] = []

      await new Promise<void>((resolve) => {
        client.on('message', (data) => {
          const msg = JSON.parse(data.toString())
          messages.push(msg)
          if (msg.type === 'connection') {
            expect(msg.data.mcpVersion).toBe('0.1.0')
            expect(msg.data.protocolVersion).toBe(1)
            client.close()
            resolve()
          }
        })
      })
    })

    it('should respond to ping with pong', async () => {
      const port = await server.start()

      const client = new WebSocket(`ws://127.0.0.1:${port}`)

      await new Promise<void>((resolve) => {
        let receivedConnection = false
        client.on('open', () => {
          // Wait for connection message first
        })
        client.on('message', (data) => {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'connection') {
            receivedConnection = true
            // Send ping after connection
            client.send(JSON.stringify({
              type: 'ping',
              data: {},
              timestamp: Date.now(),
            }))
          } else if (msg.type === 'pong' && receivedConnection) {
            expect(msg.type).toBe('pong')
            client.close()
            resolve()
          }
        })
      })
    })
  })

  describe('broadcasting', () => {
    it('should broadcast scene updates to all clients', async () => {
      const port = await server.start()

      const client1 = new WebSocket(`ws://127.0.0.1:${port}`)
      const client2 = new WebSocket(`ws://127.0.0.1:${port}`)

      // Wait for both to connect
      await Promise.all([
        new Promise<void>((resolve) => client1.on('open', resolve)),
        new Promise<void>((resolve) => client2.on('open', resolve)),
      ])

      // Skip connection messages
      let client1Ready = false
      let client2Ready = false
      client1.on('message', (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'connection') client1Ready = true
      })
      client2.on('message', (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'connection') client2Ready = true
      })

      // Wait for connection messages
      await new Promise((r) => setTimeout(r, 50))

      const scene: Scene = {
        entities: [],
        name: 'test-scene',
      }

      const received: unknown[] = []

      client1.on('message', (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'scene_update') received.push(msg)
      })
      client2.on('message', (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'scene_update') received.push(msg)
      })

      server.broadcastScene(scene)

      // Wait for messages
      await new Promise((r) => setTimeout(r, 50))

      expect(received.length).toBe(2)

      client1.close()
      client2.close()
    })

    it('should broadcast selection updates', async () => {
      const port = await server.start()

      const client = new WebSocket(`ws://127.0.0.1:${port}`)

      await new Promise<void>((resolve) => client.on('open', resolve))

      const selection = ['entity1', 'entity2']
      let receivedSelection: string[] = []

      client.on('message', (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'selection') {
          receivedSelection = msg.data.selected
        }
      })

      server.broadcastSelection(selection)

      // Wait for message
      await new Promise((r) => setTimeout(r, 50))

      expect(receivedSelection).toEqual(selection)

      client.close()
    })
  })

  describe('port auto-discovery', () => {
    it('should try next port when default port is in use', async () => {
      // Occupy TEST_PORT with a blocking server
      const blockingServer = new WebSocketServer({ host: '127.0.0.1', port: TEST_PORT })

      await new Promise<void>((resolve) => {
        blockingServer.on('listening', resolve)
      })

      try {
        // CADWebSocketServer should fallback to TEST_PORT + 1
        const port = await server.start()
        expect(port).toBe(TEST_PORT + 1)
      } finally {
        // Wait for close to complete
        await new Promise<void>((resolve) => {
          blockingServer.close(() => resolve())
        })
      }
    })

    it('should throw when all ports are in use', async () => {
      // Occupy all test ports
      const blockingServers: WebSocketServer[] = []

      for (let p = TEST_PORT; p <= TEST_MAX_PORT; p++) {
        const ws = new WebSocketServer({ host: '127.0.0.1', port: p })
        await new Promise<void>((resolve) => ws.on('listening', resolve))
        blockingServers.push(ws)
      }

      try {
        await expect(server.start()).rejects.toThrow(`All ports ${TEST_PORT}-${TEST_MAX_PORT} are in use`)
      } finally {
        // Wait for all servers to close
        await Promise.all(
          blockingServers.map(ws => new Promise<void>(resolve => ws.close(() => resolve())))
        )
      }
    })
  })

  describe('error handling', () => {
    it('should handle invalid JSON messages gracefully', async () => {
      const port = await server.start()

      const client = new WebSocket(`ws://127.0.0.1:${port}`)

      await new Promise<void>((resolve) => client.on('open', resolve))

      // Wait for connection message
      await new Promise((r) => setTimeout(r, 50))

      // Send invalid JSON
      client.send('not valid json')

      // Server should not crash, client should still be connected
      await new Promise((r) => setTimeout(r, 50))
      expect(server.getClientCount()).toBe(1)

      client.close()
    })

    it('should handle invalid message types gracefully', async () => {
      const port = await server.start()

      const client = new WebSocket(`ws://127.0.0.1:${port}`)

      await new Promise<void>((resolve) => client.on('open', resolve))

      // Wait for connection message
      await new Promise((r) => setTimeout(r, 50))

      // Send invalid message type (valid JSON but invalid schema)
      client.send(JSON.stringify({
        type: 'unknown_type',
        data: {},
        timestamp: Date.now(),
      }))

      // Server should not crash (use >= 1 to handle external clients like viewer)
      await new Promise((r) => setTimeout(r, 50))
      expect(server.getClientCount()).toBeGreaterThanOrEqual(1)

      client.close()
    })

    it('should broadcast error messages', async () => {
      const port = await server.start()

      const client = new WebSocket(`ws://127.0.0.1:${port}`)

      await new Promise<void>((resolve) => client.on('open', resolve))

      let errorReceived = false
      client.on('message', (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'error') {
          expect(msg.data.message).toBe('Test error')
          expect(msg.data.code).toBe('TEST_CODE')
          errorReceived = true
        }
      })

      // Wait for connection message
      await new Promise((r) => setTimeout(r, 50))

      server.broadcastError('Test error', 'TEST_CODE')

      await new Promise((r) => setTimeout(r, 50))
      expect(errorReceived).toBe(true)

      client.close()
    })
  })

  describe('client limit', () => {
    it('should expose max clients value', () => {
      expect(server.getMaxClients()).toBe(10)
    })
  })
})
