import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WebSocket } from 'ws'
import { CADWebSocketServer } from '../src/ws-server.js'
import type { Scene } from '@ai-native-cad/shared'

describe('CADWebSocketServer', () => {
  let server: CADWebSocketServer

  beforeEach(() => {
    server = new CADWebSocketServer()
  })

  afterEach(async () => {
    await server.stop()
  })

  describe('start/stop', () => {
    it('should start on default port 3001', async () => {
      const port = await server.start()
      expect(port).toBe(3001)
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
})
