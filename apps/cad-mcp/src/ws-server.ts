/**
 * WebSocket Server for Viewer communication
 *
 * - Binds to 127.0.0.1:3002 by default (localhost only for security)
 * - Set CAD_WS_HOST=0.0.0.0 for WSL2 or LAN access
 * - Auto port discovery: 3002 → 3001 → 3003 (3002 first: Windows often has svchost on 3001)
 * - Broadcasts scene/selection updates to all connected clients
 * - Handles ping/pong heartbeat
 */

import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import { readFileSync } from 'fs'
import { writeFile, mkdir } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { logger } from './logger.js'
import {
  safeValidateMessage,
  type Scene,
  type ConnectionData,
  type SelectionUpdateData,
  type SketchUpdateData,
  type MCPCommandData,
} from './shared/index.js'
import { getStateDir } from './run-cad-code/constants.js'
import { readMainCode, preprocessCode } from './run-cad-code/utils.js'
import { runCadCode } from './sandbox/index.js'

// CAD Tool handlers
import { handleGlob } from './tools/glob.js'
import { handleRead } from './tools/read.js'
import { handleEdit } from './tools/edit.js'
import { handleWrite } from './tools/write.js'
import { handleLsp } from './tools/lsp.js'
import { handleBash } from './tools/bash.js'
import { getSharedExecutor } from './executor-instance.js'

// MAMA Tool handlers
import {
  handleMamaSave,
  handleMamaSearch,
  handleMamaUpdate,
  handleMamaLoadCheckpoint,
  handleMamaConfigure,
  handleMamaEditHint,
  handleMamaSetSkillLevel,
  handleMamaHealth,
  handleMamaGrowthReport,
  handleMamaRecommendModules,
  handleMamaWorkflow,
} from './mama/tools/index.js'

// Data directory for selection/sketch files (getter로 테스트 격리 지원)
function getSelectionFile(): string {
  return resolve(getStateDir(), 'selection.json')
}
function getSketchFile(): string {
  return resolve(getStateDir(), 'sketch.json')
}

async function ensureDataDir(): Promise<void> {
  const dataDir = getStateDir()
  if (ensuredDataDirPath === dataDir && ensuredDataDirPromise) {
    return ensuredDataDirPromise
  }

  ensuredDataDirPath = dataDir
  ensuredDataDirPromise = mkdir(dataDir, { recursive: true }).then(() => undefined)
  try {
    await ensuredDataDirPromise
  } catch (error) {
    ensuredDataDirPath = null
    ensuredDataDirPromise = null
    throw error
  }
}

let ensuredDataDirPath: string | null = null
let ensuredDataDirPromise: Promise<void> | null = null

// Host configuration: 127.0.0.1 (default, secure) or 0.0.0.0 (WSL2/LAN, opt-in)
const WS_HOST = process.env.CAD_WS_HOST === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1'

const DEFAULT_PORT = 3002  // 3002 first: Windows often has svchost on 3001
const DEFAULT_MAX_PORT = 3003
const PROTOCOL_VERSION = 1
const HEARTBEAT_INTERVAL_MS = 15000 // 15 seconds
const MAX_CLIENTS = 10 // Maximum concurrent connections (local tool, low risk)

export interface CADWebSocketServerOptions {
  /** Starting port (default: 3002) */
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

  // Write serialization to prevent race conditions (newer state overwritten by older)
  private selectionWriteChain: Promise<void> = Promise.resolve()
  private sketchWriteChain: Promise<void> = Promise.resolve()

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
        logger.info(`WebSocket server started on ws://${WS_HOST}:${port}`)
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
      // Default: 127.0.0.1 (secure), opt-in: 0.0.0.0 via CAD_WS_HOST env
      const wss = new WebSocketServer({
        host: WS_HOST,
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
   * Sends ping to all clients every 15 seconds (HEARTBEAT_INTERVAL_MS)
   * Clients that don't respond with pong before the next ping cycle are terminated
   * (effective timeout: 15-30 seconds depending on when last pong was received)
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const ws of this.clients) {
        if (ws.isAlive === false) {
          logger.warn('Client timed out (no pong in 15s cycle), terminating')
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
        logger.warn('Invalid message received', { raw: JSON.stringify(raw) })
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
        case 'selection_update':
          // Serialized async write (errors handled in method)
          this.handleSelectionUpdate(message.data)
          break
        case 'sketch_update':
          // Serialized async write (errors handled in method)
          this.handleSketchUpdate(message.data)
          break
        case 'mcp_command':
          // Execute MCP tool and send response
          this.handleMCPCommand(ws, message.data)
          break
        default:
          // Client shouldn't send scene_update, selection, etc.
          logger.warn(`Unexpected message type from client: ${message.type}`)
      }
    } catch (e) {
      logger.error(`Message parse error: ${e}`)
    }
  }

  /**
   * Handle selection update from viewer (Client → Server)
   * Saves selection data to ~/.ai-native-cad/selection.json
   * Serialized to prevent race conditions on rapid updates
   */
  private handleSelectionUpdate(data: SelectionUpdateData): void {
    this.selectionWriteChain = this.selectionWriteChain.then(async () => {
      try {
        await ensureDataDir()

        // Validate data structure before processing
        if (!Array.isArray(data.selected_entities) ||
            !Array.isArray(data.locked_entities) ||
            !Array.isArray(data.hidden_entities)) {
          throw new Error('Invalid selection data: arrays required for entity lists')
        }

        const selection = {
          selected_entities: data.selected_entities,
          locked_entities: data.locked_entities,
          hidden_entities: data.hidden_entities,
          timestamp: Date.now(),
        }
        await writeFile(getSelectionFile(), JSON.stringify(selection, null, 2), 'utf-8')
        logger.debug(`Selection saved: ${data.selected_entities.length} selected, ${data.hidden_entities.length} hidden, ${data.locked_entities.length} locked`)
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e)
        logger.error(`Failed to save selection: ${errorMsg}`)
      }
    })
  }

  /**
   * Handle sketch update from viewer (Client → Server)
   * Saves sketch data to ~/.ai-native-cad/sketch.json
   * Serialized to prevent race conditions on rapid updates
   */
  private handleSketchUpdate(data: SketchUpdateData): void {
    this.sketchWriteChain = this.sketchWriteChain.then(async () => {
      try {
        await ensureDataDir()
        const sketch = {
          strokes: data.strokes,
          timestamp: Date.now(),
        }
        await writeFile(getSketchFile(), JSON.stringify(sketch, null, 2), 'utf-8')
        logger.debug(`Sketch saved: ${data.strokes.length} strokes`)
      } catch (e) {
        logger.error(`Failed to save sketch: ${e}`)
      }
    })
  }

  /**
   * Handle MCP command execution from WebMCP
   * Maps tool names to handler functions and executes them
   */
  private async handleMCPCommand(ws: WebSocket, data: MCPCommandData): Promise<void> {
    const { id, tool, params } = data

    try {
      logger.info(`[WebMCP] Executing tool: ${tool}`)

      let result: unknown

      // Execute tool based on type
      // Cast params to any for handler calls since we trust WebMCP to send correct types
      const args = params as any

      switch (tool) {
        // CAD tools
        case 'glob':
          result = handleGlob(args)
          break
        case 'read':
          result = handleRead(args)
          break
        case 'edit':
          result = handleEdit(args)
          break
        case 'write': {
          const file = args.file

          // Perform write
          const writeResult = handleWrite(args)

          if (!writeResult.success) {
            result = writeResult
            break
          }

          // Execute main code after write (like MCP server)
          try {
            const exec = getSharedExecutor()
            const mainCode = readMainCode()
            
            // Preprocess imports
            const preprocessed = preprocessCode(mainCode)
            if (preprocessed.errors.length > 0) {
              result = {
                success: false,
                data: writeResult.data,
                error: preprocessed.errors[0]
              }
              break
            }

            // Reset scene (HMR style)
            exec.exec('reset', {})

            // Run code
            const execResult = await runCadCode(exec, preprocessed.code, 'warn')

            if (execResult.success) {
              // Broadcast scene to all clients
              const sceneJson = exec.exportScene()
              const scene = JSON.parse(sceneJson)
              this.broadcastScene(scene)

              result = {
                success: true,
                data: {
                  file,
                  created: writeResult.data.created,
                  written: true,
                },
                logs: execResult.logs,
                warnings: [...(writeResult.warnings || []), ...(execResult.warnings || [])].filter(Boolean)
              }
            } else {
              result = {
                success: false,
                data: writeResult.data,
                error: execResult.error,
                logs: execResult.logs,
                warnings: [...(writeResult.warnings || []), ...(execResult.warnings || [])].filter(Boolean)
              }
            }
          } catch (e) {
            result = {
              success: false,
              data: writeResult.data,
              error: e instanceof Error ? e.message : String(e)
            }
          }
          break
        }
        case 'lsp':
          result = handleLsp(args)
          break
        case 'bash': {
          // bash requires executor and onSceneChange callback
          const exec = getSharedExecutor()
          result = await handleBash(
            args,
            exec,
            () => {
              // On scene change, broadcast and save
              const sceneJson = exec.exportScene()
              const scene = JSON.parse(sceneJson) as Scene
              this.broadcastScene(scene)
            }
          )
          break
        }

        // MAMA tools (all async)
        case 'mama_save':
          result = await handleMamaSave(args)
          break
        case 'mama_search':
          result = await handleMamaSearch(args)
          break
        case 'mama_update':
          result = await handleMamaUpdate(args)
          break
        case 'mama_load_checkpoint':
          result = await handleMamaLoadCheckpoint()
          break
        case 'mama_configure':
          result = await handleMamaConfigure(args)
          break
        case 'mama_edit_hint':
          result = await handleMamaEditHint(args)
          break
        case 'mama_set_skill_level':
          result = await handleMamaSetSkillLevel(args)
          break
        case 'mama_health':
          result = await handleMamaHealth(args)
          break
        case 'mama_growth_report':
          result = await handleMamaGrowthReport(args)
          break
        case 'mama_recommend_modules':
          result = await handleMamaRecommendModules(args)
          break
        case 'mama_workflow':
          result = await handleMamaWorkflow(args)
          break

        default:
          throw new Error(`Unknown tool: ${tool}`)
      }

      // Send success response
      this.sendToClient(ws, {
        type: 'mcp_response',
        data: {
          id,
          result,
        },
        timestamp: Date.now(),
      })

      logger.info(`[WebMCP] Tool ${tool} completed successfully`)
    } catch (error) {
      // Send error response
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.sendToClient(ws, {
        type: 'mcp_response',
        data: {
          id,
          error: errorMessage,
        },
        timestamp: Date.now(),
      })

      logger.error(`[WebMCP] Tool ${tool} failed: ${errorMessage}`)
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

      const shutdownServer = () => {
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
      }

      // Wait for ongoing write operations to complete before shutting down
      Promise.all([this.selectionWriteChain, this.sketchWriteChain])
        .then(shutdownServer)
        .catch((error) => {
          logger.warn(`Error waiting for write chains during shutdown: ${error}`)
          // Still proceed with shutdown even if write operations failed
          shutdownServer()
        })
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

export async function stopWSServer(): Promise<void> {
  if (serverInstance) {
    await serverInstance.stop()
    serverInstance = null  // Reset for potential restart
  }
}
