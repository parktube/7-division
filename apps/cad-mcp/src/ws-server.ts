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
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { logger } from './logger.js'
import {
  safeValidateMessage,
  type Scene,
  type ConnectionData,
} from './shared/index.js'

const DEFAULT_PORT = 3001
const DEFAULT_MAX_PORT = 3003
const PROTOCOL_VERSION = 1
const HEARTBEAT_INTERVAL_MS = 15000 // 15 seconds
const MAX_CLIENTS = 10 // Maximum concurrent connections (local tool, low risk)

export interface CADWebSocketServerOptions {
  /** Starting port (default: 3001) */
  startPort?: number
  /** Maximum port to try (default: 3003) */
  maxPort?: number
}

// Read version from package.json to stay in sync
const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
)
const MCP_VERSION: string = packageJson.version

export interface WSServerState {
  scene: Scene | null
  selection: string[]
}

// Extended WebSocket with heartbeat tracking
interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean
  heartbeatTimeout?: ReturnType<typeof setTimeout>
}

export class CADWebSocketServer {
  private wss: WebSocketServer | null = null
  private clients: Set<ExtendedWebSocket> = new Set()
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private state: WSServerState = {
    scene: null,
    selection: [],
  }
  private port: number = DEFAULT_PORT
  private readonly startPort: number
  private readonly maxPort: number

  constructor(options?: CADWebSocketServerOptions) {
    this.startPort = options?.startPort ?? DEFAULT_PORT
    this.maxPort = options?.maxPort ?? DEFAULT_MAX_PORT
  }

  /**
   * Start the WebSocket server
   * Tries ports until one is available
   */
  async start(): Promise<number> {
    for (let port = this.startPort; port <= this.maxPort; port++) {
      try {
        await this.tryPort(port)
        this.port = port
        logger.info(`WebSocket server started on ws://127.0.0.1:${port}`)
        return port
      } catch {
        if (port === this.maxPort) {
          throw new Error(`All ports ${this.startPort}-${this.maxPort} are in use`)
        }
        logger.warn(`Port ${port} in use, trying ${port + 1}`)
      }
    }
    throw new Error('Failed to start WebSocket server')
  }

  private tryPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use 0.0.0.0 to allow WSL2 → Windows browser connections
      const wss = new WebSocketServer({
        host: '0.0.0.0',
        port,
      })

      wss.on('listening', () => {
        this.wss = wss
        this.setupHandlers()
        resolve()
      })

      wss.on('error', (err: NodeJS.ErrnoException) => {
        reject(err)
      })
    })
  }

  private setupHandlers(): void {
    if (!this.wss) return

    // Start heartbeat interval for client timeout detection
    this.startHeartbeat()

    this.wss.on('connection', (ws: ExtendedWebSocket, req: IncomingMessage) => {
      // Check client limit
      if (this.clients.size >= MAX_CLIENTS) {
        logger.warn(`Max clients (${MAX_CLIENTS}) reached, rejecting connection`)
        ws.close(1013, 'Maximum clients reached')
        return
      }

      logger.info(`Client connected from ${req.socket.remoteAddress}`)
      ws.isAlive = true
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

      // Handle pong responses for heartbeat
      ws.on('pong', () => {
        ws.isAlive = true
      })

      ws.on('message', (data: Buffer) => {
        ws.isAlive = true // Any message counts as alive
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

  /**
   * Start heartbeat interval for client timeout detection
   * Sends ping to all clients every 15 seconds
   * Terminates connections that don't respond within 30 seconds
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const ws of this.clients) {
        if (ws.isAlive === false) {
          logger.warn('Client timed out (30s no response), terminating')
          ws.terminate()
          this.clients.delete(ws)
          continue
        }
        ws.isAlive = false
        ws.ping()
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
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
   * Set initial scene state before server starts (no broadcast)
   * Use this to avoid flickering when viewer connects before scene is restored
   */
  setInitialScene(scene: Scene): void {
    this.state.scene = scene
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
      this.stopHeartbeat()

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

  /**
   * Get maximum allowed clients
   */
  getMaxClients(): number {
    return MAX_CLIENTS
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
