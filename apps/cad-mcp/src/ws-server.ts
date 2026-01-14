/**
 * WebSocket Server for Viewer communication
 *
 * - Binds to 127.0.0.1:3001 (localhost only for security)
 * - Auto port discovery: 3001 → 3002 → 3003
 * - Broadcasts scene/selection updates to all connected clients
 * - Handles ping/pong heartbeat
 */

import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import { logger } from './logger.js'
import {
  safeValidateMessage,
  type Scene,
  type ConnectionData,
} from '@ai-native-cad/shared'

const DEFAULT_PORT = 3001
const MAX_PORT = 3003
const PROTOCOL_VERSION = 1
const MCP_VERSION = '0.1.0'

export interface WSServerState {
  scene: Scene | null
  selection: string[]
}

export class CADWebSocketServer {
  private wss: WebSocketServer | null = null
  private clients: Set<WebSocket> = new Set()
  private state: WSServerState = {
    scene: null,
    selection: [],
  }
  private port: number = DEFAULT_PORT

  /**
   * Start the WebSocket server
   * Tries ports 3001, 3002, 3003 until one is available
   */
  async start(): Promise<number> {
    for (let port = DEFAULT_PORT; port <= MAX_PORT; port++) {
      try {
        await this.tryPort(port)
        this.port = port
        logger.info(`WebSocket server started on ws://127.0.0.1:${port}`)
        return port
      } catch {
        if (port === MAX_PORT) {
          throw new Error(`All ports ${DEFAULT_PORT}-${MAX_PORT} are in use`)
        }
        logger.warn(`Port ${port} in use, trying ${port + 1}`)
      }
    }
    throw new Error('Failed to start WebSocket server')
  }

  private tryPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({
        host: '127.0.0.1',
        port,
      })

      wss.on('listening', () => {
        this.wss = wss
        this.setupHandlers()
        resolve()
      })

      wss.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(err)
        } else {
          reject(err)
        }
      })
    })
  }

  private setupHandlers(): void {
    if (!this.wss) return

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      logger.info(`Client connected from ${req.socket.remoteAddress}`)
      this.clients.add(ws)

      // Send initial state on connection
      this.sendConnectionMessage(ws)
      if (this.state.scene) {
        this.sendToClient(ws, {
          type: 'scene_update',
          data: { scene: this.state.scene },
          timestamp: Date.now(),
        })
      }
      if (this.state.selection.length > 0) {
        this.sendToClient(ws, {
          type: 'selection',
          data: { selected: this.state.selection },
          timestamp: Date.now(),
        })
      }

      ws.on('message', (data: Buffer) => {
        this.handleMessage(ws, data)
      })

      ws.on('close', () => {
        logger.info('Client disconnected')
        this.clients.delete(ws)
      })

      ws.on('error', (err) => {
        logger.error(`WebSocket error: ${err.message}`)
        this.clients.delete(ws)
      })
    })
  }

  private handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const raw = JSON.parse(data.toString())
      const message = safeValidateMessage(raw)

      if (!message) {
        logger.warn('Invalid message received:', raw)
        return
      }

      switch (message.type) {
        case 'ping':
          this.sendToClient(ws, {
            type: 'pong',
            data: {},
            timestamp: Date.now(),
          })
          break
        default:
          // Client shouldn't send scene_update, selection, etc.
          logger.warn(`Unexpected message type from client: ${message.type}`)
      }
    } catch (e) {
      logger.error(`Message parse error: ${e}`)
    }
  }

  private sendConnectionMessage(ws: WebSocket): void {
    const connectionData: ConnectionData = {
      mcpVersion: MCP_VERSION,
      protocolVersion: PROTOCOL_VERSION,
    }

    this.sendToClient(ws, {
      type: 'connection',
      data: connectionData,
      timestamp: Date.now(),
    })
  }

  private sendToClient(ws: WebSocket, message: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  /**
   * Broadcast scene update to all connected clients
   */
  broadcastScene(scene: Scene): void {
    this.state.scene = scene
    const message = {
      type: 'scene_update',
      data: { scene },
      timestamp: Date.now(),
    }
    this.broadcast(message)
  }

  /**
   * Broadcast selection update to all connected clients
   */
  broadcastSelection(selected: string[]): void {
    this.state.selection = selected
    const message = {
      type: 'selection',
      data: { selected },
      timestamp: Date.now(),
    }
    this.broadcast(message)
  }

  /**
   * Broadcast error to all connected clients
   */
  broadcastError(errorMessage: string, code?: string): void {
    const message = {
      type: 'error',
      data: { message: errorMessage, code },
      timestamp: Date.now(),
    }
    this.broadcast(message)
  }

  private broadcast(message: unknown): void {
    const json = JSON.stringify(message)
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json)
      }
    }
  }

  /**
   * Get current connection count
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * Get the port the server is listening on
   */
  getPort(): number {
    return this.port
  }

  /**
   * Stop the WebSocket server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        // Close all client connections
        for (const client of this.clients) {
          client.close()
        }
        this.clients.clear()

        this.wss.close(() => {
          this.wss = null
          logger.info('WebSocket server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}

// Singleton instance for use across the application
let serverInstance: CADWebSocketServer | null = null

export function getWSServer(): CADWebSocketServer {
  if (!serverInstance) {
    serverInstance = new CADWebSocketServer()
  }
  return serverInstance
}

export async function startWSServer(): Promise<number> {
  const server = getWSServer()
  return server.start()
}

export function stopWSServer(): Promise<void> {
  if (serverInstance) {
    return serverInstance.stop()
  }
  return Promise.resolve()
}
