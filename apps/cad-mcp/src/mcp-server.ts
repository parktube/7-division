/**
 * MCP stdio Server for Claude Code integration
 *
 * Story 9.4: run_cad_code가 단일 MCP 진입점
 * - run_cad_code: JavaScript 코드 실행 (핵심 도구)
 * - describe: 도메인별 함수 설명 조회 (탐색용)
 * - list_domains/list_tools: 사용 가능한 함수 목록 (탐색용)
 * - export_json/export_svg: 씬 내보내기
 * - get_scene_info: 씬 상태 조회
 *
 * Broadcasts scene updates to WebSocket clients
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { CADExecutor } from './executor.js'
import {
  CAD_TOOLS,
  DOMAINS,
  DOMAIN_METADATA,
  FUNCTION_SIGNATURES,
  type ToolSchema,
  type DomainName,
} from './schema.js'
import { getWSServer, startWSServer } from './ws-server.js'
import { logger } from './logger.js'
import { runCadCode } from './sandbox/index.js'
import type { Scene } from './shared/index.js'
import { captureViewport } from './capture.js'
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 모듈 디렉토리 (viewer 기준)
const MODULES_DIR = resolve(__dirname, '../../viewer/.cad-modules')
const SELECTION_FILE = resolve(__dirname, '../../viewer/selection.json')

// 씬 영속성 파일 경로 (~/.ai-native-cad/scene.json)
const CAD_DATA_DIR = resolve(homedir(), '.ai-native-cad')
const SCENE_FILE = resolve(CAD_DATA_DIR, 'scene.json')

/**
 * Ensure CAD data directory exists
 */
function ensureCadDataDir(): void {
  if (!existsSync(CAD_DATA_DIR)) {
    mkdirSync(CAD_DATA_DIR, { recursive: true })
    logger.info(`Created CAD data directory: ${CAD_DATA_DIR}`)
  }
}

/**
 * Save current scene to file for persistence
 */
function saveScene(exec: CADExecutor): void {
  try {
    ensureCadDataDir()
    const sceneJson = exec.exportScene()
    writeFileSync(SCENE_FILE, sceneJson, 'utf-8')
    logger.debug('Scene saved to file')
  } catch (e) {
    logger.error(`Failed to save scene: ${e}`)
  }
}

/**
 * Load scene from file on MCP startup
 * Returns true if scene was restored
 */
function loadScene(exec: CADExecutor): boolean {
  try {
    if (!existsSync(SCENE_FILE)) {
      logger.debug('No saved scene file found')
      return false
    }

    const sceneJson = readFileSync(SCENE_FILE, 'utf-8')
    const scene = JSON.parse(sceneJson) as Scene

    // Restore entities to executor
    if (scene.entities && scene.entities.length > 0) {
      const result = exec.importScene(sceneJson)
      logger.info(`Scene restored: ${result.restored}/${scene.entities.length} entities`)
      if (result.errors.length > 0) {
        logger.warn(`Restore errors: ${result.errors.join(', ')}`)
      }
      return result.restored > 0
    }

    return false
  } catch (e) {
    logger.error(`Failed to load scene: ${e}`)
    return false
  }
}

function ensureModulesDir(): void {
  if (!existsSync(MODULES_DIR)) {
    mkdirSync(MODULES_DIR, { recursive: true })
  }
}

function getModulePath(name: string): string {
  return resolve(MODULES_DIR, `${name}.js`)
}

function getModuleList(): string[] {
  ensureModulesDir()
  try {
    return readdirSync(MODULES_DIR)
      .filter(f => f.endsWith('.js'))
      .map(f => f.replace('.js', ''))
  } catch {
    return []
  }
}

const MCP_SERVER_NAME = 'ai-native-cad'
const MCP_SERVER_VERSION = '0.1.0'

// Singleton executor for scene state
let executor: CADExecutor | null = null

function getExecutor(): CADExecutor {
  if (!executor) {
    executor = CADExecutor.create('mcp-scene')
  }
  return executor
}

/**
 * Convert internal tool schema to MCP format
 */
function toMCPToolSchema(tool: ToolSchema) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object' as const,
      properties: Object.fromEntries(
        Object.entries(tool.parameters.properties).map(([key, prop]) => [
          key,
          {
            type: prop.type,
            description: prop.description,
          },
        ])
      ),
      required: tool.parameters.required,
    },
  }
}

/**
 * Get all tools as MCP format
 */
function getAllMCPTools() {
  return Object.values(CAD_TOOLS).map(toMCPToolSchema)
}

/**
 * Execute run_cad_code and broadcast results (Story 9.4 AC #1)
 */
async function executeRunCadCode(
  code: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const exec = getExecutor()

  try {
    // Run JavaScript code in QuickJS sandbox
    const result = await runCadCode(exec, code, 'warn')

    // Export scene and broadcast to WebSocket clients (AC #1: "WebSocket으로 Viewer에 브로드캐스트")
    const sceneJson = exec.exportScene()
    const scene = JSON.parse(sceneJson) as Scene
    const wsServer = getWSServer()
    wsServer.broadcastScene(scene)

    // Save scene to file for persistence (씬 영속성)
    if (result.success) {
      saveScene(exec)
    }

    if (result.success) {
      return {
        success: true,
        result: {
          entitiesCreated: result.entitiesCreated,
          logs: result.logs,
          warnings: result.warnings,
        },
      }
    } else {
      return { success: false, error: result.error || 'Code execution failed' }
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { success: false, error }
  }
}

/**
 * Execute a simple query tool (no scene modification)
 */
function executeQueryTool(
  name: string,
  args: Record<string, unknown>
): { success: boolean; result?: unknown; error?: string } {
  const exec = getExecutor()

  try {
    const result = exec.exec(name, args)
    if (result.success) {
      return { success: true, result: result.data ? JSON.parse(result.data) : result }
    } else {
      return { success: false, error: result.error || 'Unknown error' }
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { success: false, error }
  }
}

/**
 * Create and start the MCP server
 */
export async function createMCPServer(): Promise<Server> {
  // Initialize executor and restore scene FIRST (before WS server starts)
  const exec = getExecutor()
  const restored = loadScene(exec)

  // Set initial scene state on WS server BEFORE starting (prevents flickering)
  const sceneJson = exec.exportScene()
  const scene = JSON.parse(sceneJson) as Scene
  const wsServer = getWSServer()
  wsServer.setInitialScene(scene)

  // NOW start WebSocket server (clients get restored scene immediately on connect)
  const wsPort = await startWSServer()
  logger.info(`WebSocket server ready on port ${wsPort}`)

  if (restored) {
    logger.info('Scene restored from saved file')
  }

  const server = new Server(
    {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: getAllMCPTools(),
    }
  })

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        // === 핵심 도구: run_cad_code (Story 9.4 단일 진입점) ===
        case 'run_cad_code': {
          const code = (args as Record<string, unknown>)?.code as string
          if (!code) {
            return {
              content: [{ type: 'text', text: 'Error: code parameter is required' }],
              isError: true,
            }
          }
          const result = await executeRunCadCode(code)
          if (result.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(result.result, null, 2) }],
            }
          } else {
            return {
              content: [{ type: 'text', text: result.error || 'Code execution failed' }],
              isError: true,
            }
          }
        }

        // === 탐색용 도구들 ===
        case 'describe': {
          const domain = (args as Record<string, unknown>)?.domain as string
          if (!domain || !(domain in DOMAINS)) {
            return {
              content: [{
                type: 'text',
                text: `Unknown domain: ${domain}. Available: ${Object.keys(DOMAINS).join(', ')}`,
              }],
              isError: true,
            }
          }
          const domainFunctions = DOMAINS[domain as DomainName]
          const signatures = domainFunctions.map((fn) => ({
            name: fn,
            ...FUNCTION_SIGNATURES[fn],
          }))
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                domain,
                description: DOMAIN_METADATA[domain as DomainName].description,
                functions: signatures,
              }, null, 2),
            }],
          }
        }

        case 'list_domains': {
          const domainList = Object.entries(DOMAIN_METADATA).map(([name, meta]) => ({
            name,
            description: meta.description,
            functionCount: DOMAINS[name as DomainName].length,
          }))
          return {
            content: [{ type: 'text', text: JSON.stringify(domainList, null, 2) }],
          }
        }

        case 'list_tools': {
          const domain = (args as Record<string, unknown>)?.domain as string | undefined
          if (domain) {
            if (!(domain in DOMAINS)) {
              return {
                content: [{
                  type: 'text',
                  text: `Unknown domain: ${domain}. Available: ${Object.keys(DOMAINS).join(', ')}`,
                }],
                isError: true,
              }
            }
            return {
              content: [{ type: 'text', text: JSON.stringify(DOMAINS[domain as DomainName], null, 2) }],
            }
          }
          // Return all functions grouped by domain
          return {
            content: [{ type: 'text', text: JSON.stringify(DOMAINS, null, 2) }],
          }
        }

        case 'get_tool_schema': {
          const toolName = (args as Record<string, unknown>)?.name as string
          if (!toolName || !(toolName in FUNCTION_SIGNATURES)) {
            const allFunctions = Object.keys(FUNCTION_SIGNATURES)
            return {
              content: [{
                type: 'text',
                text: `Unknown function: ${toolName}. Available functions: ${allFunctions.join(', ')}`,
              }],
              isError: true,
            }
          }
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ name: toolName, ...FUNCTION_SIGNATURES[toolName] }, null, 2),
            }],
          }
        }

        case 'request_tool': {
          const toolRequest = args as Record<string, unknown>
          logger.info(`Tool request: ${JSON.stringify(toolRequest)}`)
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                message: 'Tool request logged. Developer will review.',
                request: toolRequest,
              }, null, 2),
            }],
          }
        }

        // === 조회/내보내기 도구들 ===
        case 'get_scene_info': {
          const result = executeQueryTool('get_scene_info', {})
          if (result.success) {
            return { content: [{ type: 'text', text: JSON.stringify(result.result, null, 2) }] }
          } else {
            return { content: [{ type: 'text', text: result.error || 'Failed' }], isError: true }
          }
        }

        case 'export_json': {
          const result = executeQueryTool('export_json', {})
          if (result.success) {
            return { content: [{ type: 'text', text: JSON.stringify(result.result, null, 2) }] }
          } else {
            return { content: [{ type: 'text', text: result.error || 'Failed' }], isError: true }
          }
        }

        case 'export_svg': {
          // SVG는 JSON이 아니므로 직접 executor 호출
          const exec = getExecutor()
          const result = exec.exec('export_svg', {})
          if (result.success && result.data) {
            return { content: [{ type: 'text', text: result.data }] }
          } else {
            return { content: [{ type: 'text', text: result.error || 'Failed to export SVG' }], isError: true }
          }
        }

        // === 세션 관리 도구 ===
        case 'reset': {
          const exec = getExecutor()
          const result = exec.exec('reset', {})
          if (result.success) {
            // Broadcast empty scene to viewers
            const sceneJson = exec.exportScene()
            const scene = JSON.parse(sceneJson) as Scene
            const wsServer = getWSServer()
            wsServer.broadcastScene(scene)
            // Clear saved scene file (reset = start fresh)
            saveScene(exec)
            return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Scene reset' }) }] }
          } else {
            return { content: [{ type: 'text', text: result.error || 'Failed to reset' }], isError: true }
          }
        }

        case 'capture': {
          const clearSketch = (args as Record<string, unknown>)?.clearSketch as boolean
          try {
            const result = await captureViewport()
            if (result.success && result.path) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    path: result.path,
                    message: 'Viewport captured. Use Read tool to view the image.',
                    clearSketch: clearSketch || false,
                  }, null, 2),
                }],
              }
            } else {
              return { content: [{ type: 'text', text: result.error || 'Capture failed' }], isError: true }
            }
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e)
            return { content: [{ type: 'text', text: `Capture failed: ${error}` }], isError: true }
          }
        }

        case 'get_selection': {
          try {
            if (!existsSync(SELECTION_FILE)) {
              return { content: [{ type: 'text', text: JSON.stringify({ selected: [], locked: [], hidden: [] }) }] }
            }
            const data = JSON.parse(readFileSync(SELECTION_FILE, 'utf-8'))
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  selected: data.selected_entities || [],
                  locked: data.locked_entities || [],
                  hidden: data.hidden_entities || [],
                }, null, 2),
              }],
            }
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e)
            return { content: [{ type: 'text', text: `Failed to get selection: ${error}` }], isError: true }
          }
        }

        // === 모듈 관리 도구 ===
        case 'save_module': {
          const moduleName = (args as Record<string, unknown>)?.name as string
          const code = (args as Record<string, unknown>)?.code as string
          if (!moduleName || !code) {
            return { content: [{ type: 'text', text: 'Error: name and code are required' }], isError: true }
          }
          try {
            ensureModulesDir()
            const modulePath = getModulePath(moduleName)
            writeFileSync(modulePath, code, 'utf-8')
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: true, name: moduleName, path: modulePath }, null, 2),
              }],
            }
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e)
            return { content: [{ type: 'text', text: `Failed to save module: ${error}` }], isError: true }
          }
        }

        case 'list_modules': {
          const modules = getModuleList()
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ modules, count: modules.length }, null, 2),
            }],
          }
        }

        case 'get_module': {
          const moduleName = (args as Record<string, unknown>)?.name as string
          if (!moduleName) {
            return { content: [{ type: 'text', text: 'Error: name is required' }], isError: true }
          }
          const modulePath = getModulePath(moduleName)
          if (!existsSync(modulePath)) {
            return { content: [{ type: 'text', text: `Module not found: ${moduleName}` }], isError: true }
          }
          const code = readFileSync(modulePath, 'utf-8')
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ name: moduleName, code }, null, 2),
            }],
          }
        }

        case 'delete_module': {
          const moduleName = (args as Record<string, unknown>)?.name as string
          if (!moduleName) {
            return { content: [{ type: 'text', text: 'Error: name is required' }], isError: true }
          }
          const modulePath = getModulePath(moduleName)
          if (!existsSync(modulePath)) {
            return { content: [{ type: 'text', text: `Module not found: ${moduleName}` }], isError: true }
          }
          try {
            unlinkSync(modulePath)
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: true, deleted: moduleName }, null, 2),
              }],
            }
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e)
            return { content: [{ type: 'text', text: `Failed to delete module: ${error}` }], isError: true }
          }
        }

        // === 씬 조회 도구 ===
        case 'list_groups': {
          const exec = getExecutor()
          const result = exec.exec('list_entities', {})
          if (result.success && result.data) {
            try {
              const entities = JSON.parse(result.data)
              const groups = entities.filter((e: { type: string }) => e.type === 'Group')
              return { content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }] }
            } catch {
              return { content: [{ type: 'text', text: result.data }] }
            }
          }
          return { content: [{ type: 'text', text: result.error || 'Failed' }], isError: true }
        }

        case 'overview': {
          const exec = getExecutor()
          const result = exec.exec('list_entities', {})
          if (result.success && result.data) {
            try {
              const entities = JSON.parse(result.data)
              // 트리 구조로 변환
              const rootEntities = entities.filter((e: { parent?: string }) => !e.parent)
              const buildTree = (items: { name: string; type: string; children?: string[] }[]): object[] => {
                return items.map(item => ({
                  name: item.name,
                  type: item.type,
                  children: item.children
                    ? buildTree(entities.filter((e: { name: string }) => item.children?.includes(e.name)))
                    : undefined,
                }))
              }
              const tree = buildTree(rootEntities)
              return { content: [{ type: 'text', text: JSON.stringify({ tree, totalCount: entities.length }, null, 2) }] }
            } catch {
              return { content: [{ type: 'text', text: result.data }] }
            }
          }
          return { content: [{ type: 'text', text: result.error || 'Failed' }], isError: true }
        }

        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown tool: ${name}. Use run_cad_code to execute CAD operations, or describe/list_domains/list_tools to explore available functions.`,
            }],
            isError: true,
          }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      return {
        content: [{ type: 'text', text: `Error: ${error}` }],
        isError: true,
      }
    }
  })

  return server
}

/**
 * Start MCP server with stdio transport
 */
export async function startMCPServer(): Promise<void> {
  const server = await createMCPServer()
  const transport = new StdioServerTransport()

  logger.info('Starting MCP server on stdio...')

  await server.connect(transport)

  logger.info('MCP server connected')
}

/**
 * CLI entry point for MCP server
 */
export async function runMCPServer(): Promise<void> {
  try {
    await startMCPServer()
  } catch (e) {
    logger.error(`MCP server error: ${e}`)
    process.exit(1)
  }
}
