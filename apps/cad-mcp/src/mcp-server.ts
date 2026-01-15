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
  DOMAIN_TOOLS,
  DOMAINS,
  DOMAIN_METADATA,
  FUNCTION_SIGNATURES,
  NEW_TOOLS,
  type ToolSchema,
  type DomainName,
} from './schema.js'
import { handleGlob } from './tools/glob.js'
import { handleRead } from './tools/read.js'
import { handleEdit, rollbackEdit } from './tools/edit.js'
import { handleWrite, rollbackWrite, getOriginalContent } from './tools/write.js'
import { getWSServer, startWSServer, stopWSServer } from './ws-server.js'
import { logger } from './logger.js'
import { runCadCode } from './sandbox/index.js'
import type { Scene } from './shared/index.js'
import { captureViewport } from './capture.js'
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, mkdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// package.json에서 버전 동적 로드 (하드코딩 방지)
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
)

// run-cad-code 모듈에서 공유 상수/유틸리티 가져오기 (CLI와 경로 통일)
import { SCENE_CODE_FILE, MODULES_DIR } from './run-cad-code/constants.js'
import { preprocessCode } from './run-cad-code/utils.js'

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

/**
 * Read main code file
 */
function readMainCode(): string {
  try {
    return existsSync(SCENE_CODE_FILE) ? readFileSync(SCENE_CODE_FILE, 'utf-8') : ''
  } catch {
    return ''
  }
}

/**
 * Write main code file
 */
function writeMainCode(code: string): void {
  const dir = dirname(SCENE_CODE_FILE)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(SCENE_CODE_FILE, code, 'utf-8')
}

/**
 * Get scene entity names from executor
 */
function getSceneEntities(exec: CADExecutor): string[] {
  try {
    const sceneJson = exec.exportScene()
    const scene = JSON.parse(sceneJson) as Scene
    return scene.entities?.map(e => e.metadata?.name).filter((n): n is string => !!n) || []
  } catch {
    return []
  }
}

const MCP_SERVER_NAME = 'ai-native-cad'
const MCP_SERVER_VERSION: string = packageJson.version

/**
 * Response Hints System - LLM에게 다음 행동 제안
 * SpineLift MCP 패턴 참고: 도구 응답에 contextual hints 추가
 */
const TOOL_HINTS: Record<string, string[]> = {
  // 핵심 도구 - 모드별 힌트
  run_cad_code_structure: [
    'file="main"으로 main 코드 읽기',
    'file="main", code="..."로 코드 저장',
  ],
  run_cad_code_read: [
    'code="..."로 이 파일에 저장',
    'code="+..."로 코드 추가',
  ],
  run_cad_code_execute: [
    '수정 시 reset 대신 기존 엔티티 직접 수정 (setFill, translate 등)',
    'file="main"과 함께 호출하면 코드가 저장됨',
    'capture로 결과 시각적 확인',
  ],
  run_cad_code_write: [
    '코드 추가: code="+새코드"',
    'capture로 결과 시각적 확인',
    'getEntity()로 좌표/크기 확인',
  ],
  run_cad_code_append: [
    '수정 시 reset 대신 기존 엔티티 직접 수정',
    'capture로 결과 시각적 확인',
  ],
  run_cad_code_edit: [
    'capture로 결과 시각적 확인',
    '추가 수정: old_code/new_code로 다른 부분도 수정 가능',
  ],
  // 기존 호환용
  run_cad_code: [
    '수정 시 reset 대신 기존 엔티티 직접 수정 (setFill, translate 등)',
    'capture로 결과 시각적 확인',
    'getEntity()로 좌표/크기 확인',
  ],

  // 탐색 도구
  describe: [
    'cad_code로 함수 실행',
    '다른 도메인도 탐색해보세요',
  ],
  list_domains: [
    `discovery(action='describe')로 함수 시그니처 확인`,
    'cad_code로 실제 실행',
  ],
  list_tools: [
    `discovery(action='describe')로 상세 시그니처 확인`,
  ],
  get_tool_schema: [
    'cad_code로 함수 실행',
  ],

  // 조회 도구
  get_scene_info: [
    `scene(action='overview')로 상세 구조 확인`,
    'cad_code + getEntity()로 특정 엔티티 조회',
  ],
  export_json: [
    `export(action='svg')로 벡터 이미지도 내보내기`,
  ],
  export_svg: [
    '파일로 저장하여 활용',
  ],

  // 세션 도구
  reset: [
    'cad_code로 새로운 씬 생성 시작',
  ],
  capture: [
    '이미지로 형태/레이아웃 파악',
    'getEntity()로 정확한 좌표 확인',
  ],
  get_selection: [
    'cad_code + getEntity()로 선택된 엔티티 상세 조회',
    '선택 기반 변환: translate, rotate, scale',
  ],

  // 모듈 도구
  save_module: [
    "cad_code에서 import 'module_name'으로 사용",
    `module(action='list')로 저장 확인`,
  ],
  list_modules: [
    `module(action='get')로 코드 내용 확인`,
    "cad_code에서 import 'name'으로 사용",
  ],
  get_module: [
    `module(action='save')로 수정 후 재저장`,
    "cad_code에서 import 'name'으로 사용",
  ],
  delete_module: [
    `module(action='list')로 남은 모듈 확인`,
  ],

  // 씬 조회 도구
  list_groups: [
    `scene(action='overview')로 전체 계층 구조 확인`,
    'cad_code + getEntity()로 그룹 상세 조회',
  ],
  overview: [
    'cad_code + getEntity()로 특정 엔티티 조회',
    '그룹 수정: translate, rotate, scale',
  ],
}

/**
 * Get hints for a tool response
 */
function getToolHints(toolName: string): string[] {
  return TOOL_HINTS[toolName] || ['overview로 현재 씬 상태 확인']
}

/**
 * Enrich response with contextual hints
 */
function enrichResponse(
  toolName: string,
  result: unknown,
  success: boolean
): { data: unknown; hints: string[] } {
  const hints = success
    ? getToolHints(toolName)
    : ['오류 확인 후 재시도', 'describe(domain)으로 함수 사용법 확인']

  return {
    data: result,
    hints,
  }
}

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
 * Preserves all JSON Schema fields (enum, items, default, etc.)
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
          // Spread entire property to preserve enum, items, default, etc.
          { ...prop },
        ])
      ),
      required: tool.parameters.required,
    },
  }
}

/**
 * Get all tools as MCP format
 * - 기존 도메인 도구 5개 (cad_code, discovery, scene, export, module)
 * - Epic 10 신규 도구 (glob, read, edit, write, lsp, bash)
 */
function getAllMCPTools() {
  return [
    ...Object.values(DOMAIN_TOOLS).map(toMCPToolSchema),
    ...Object.values(NEW_TOOLS).map(toMCPToolSchema),
  ]
}

/**
 * Execute run_cad_code and broadcast results (Story 9.4 AC #1)
 */
async function executeRunCadCode(
  code: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const exec = getExecutor()

  try {
    // Import 전처리: import 'module' → 모듈 코드로 치환
    const preprocessed = preprocessCode(code)
    if (preprocessed.errors.length > 0) {
      return {
        success: false,
        error: preprocessed.errors[0],
      }
    }

    // Run JavaScript code in QuickJS sandbox
    const result = await runCadCode(exec, preprocessed.code, 'warn')

    // Export scene and broadcast to WebSocket clients only on success
    // (AC #1: "WebSocket으로 Viewer에 브로드캐스트")
    if (result.success) {
      const sceneJson = exec.exportScene()
      const scene = JSON.parse(sceneJson) as Scene
      const wsServer = getWSServer()
      wsServer.broadcastScene(scene)
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
        // ============================================================
        // 도메인 도구 (SpineLift 패턴) - 5개
        // ============================================================

        // === discovery: 함수 탐색 도메인 ===
        case 'discovery': {
          const action = (args as Record<string, unknown>)?.action as string
          const domain = (args as Record<string, unknown>)?.domain as string | undefined
          const toolName = (args as Record<string, unknown>)?.name as string | undefined

          switch (action) {
            case 'list_domains': {
              const domainList = Object.entries(DOMAIN_METADATA).map(([name, meta]) => ({
                name,
                description: meta.description,
                functionCount: DOMAINS[name as DomainName].length,
              }))
              const enriched = enrichResponse('list_domains', domainList, true)
              return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
            }
            case 'describe': {
              if (!domain || !(domain in DOMAINS)) {
                return {
                  content: [{ type: 'text', text: `Unknown domain: ${domain}. Available: ${Object.keys(DOMAINS).join(', ')}` }],
                  isError: true,
                }
              }
              const domainFunctions = DOMAINS[domain as DomainName]
              const signatures = domainFunctions.map((fn) => ({ name: fn, ...FUNCTION_SIGNATURES[fn] }))
              const enriched = enrichResponse('describe', { domain, description: DOMAIN_METADATA[domain as DomainName].description, functions: signatures }, true)
              return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
            }
            case 'list_tools': {
              if (domain) {
                if (!(domain in DOMAINS)) {
                  return { content: [{ type: 'text', text: `Unknown domain: ${domain}` }], isError: true }
                }
                const enriched = enrichResponse('list_tools', DOMAINS[domain as DomainName], true)
                return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
              }
              const enriched = enrichResponse('list_tools', DOMAINS, true)
              return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
            }
            case 'get_schema': {
              if (!toolName || !(toolName in FUNCTION_SIGNATURES)) {
                return { content: [{ type: 'text', text: `Unknown function: ${toolName}` }], isError: true }
              }
              const enriched = enrichResponse('get_tool_schema', { name: toolName, ...FUNCTION_SIGNATURES[toolName] }, true)
              return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
            }
            case 'request': {
              const description = (args as Record<string, unknown>)?.description as string
              const rationale = (args as Record<string, unknown>)?.rationale as string
              logger.info(`Tool request: ${JSON.stringify({ name: toolName, description, rationale })}`)
              return { content: [{ type: 'text', text: JSON.stringify({ message: 'Tool request logged', request: { name: toolName, description, rationale } }, null, 2) }] }
            }
            default:
              return { content: [{ type: 'text', text: `Unknown discovery action: ${action}` }], isError: true }
          }
        }

        // === scene: 씬 조회 도메인 ===
        case 'scene': {
          const action = (args as Record<string, unknown>)?.action as string
          const exec = getExecutor()

          switch (action) {
            case 'info': {
              const result = executeQueryTool('get_scene_info', {})
              if (result.success) {
                const enriched = enrichResponse('get_scene_info', result.result, true)
                return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
              }
              return { content: [{ type: 'text', text: result.error || 'Failed' }], isError: true }
            }
            case 'overview': {
              const result = exec.exec('list_entities', {})
              if (result.success && result.data) {
                try {
                  const entities = JSON.parse(result.data)
                  const rootEntities = entities.filter((e: { parent?: string }) => !e.parent)
                  const buildTree = (items: { name: string; type: string; children?: string[] }[]): object[] => {
                    return items.map(item => ({
                      name: item.name,
                      type: item.type,
                      children: item.children ? buildTree(entities.filter((e: { name: string }) => item.children?.includes(e.name))) : undefined,
                    }))
                  }
                  const tree = buildTree(rootEntities)
                  const enriched = enrichResponse('overview', { tree, totalCount: entities.length }, true)
                  return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
                } catch {
                  return { content: [{ type: 'text', text: result.data }] }
                }
              }
              return { content: [{ type: 'text', text: result.error || 'Failed' }], isError: true }
            }
            case 'groups': {
              const result = exec.exec('list_entities', {})
              if (result.success && result.data) {
                try {
                  const entities = JSON.parse(result.data)
                  const groups = entities.filter((e: { type: string }) => e.type === 'Group')
                  const enriched = enrichResponse('list_groups', groups, true)
                  return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
                } catch {
                  return { content: [{ type: 'text', text: result.data }] }
                }
              }
              return { content: [{ type: 'text', text: result.error || 'Failed' }], isError: true }
            }
            case 'selection': {
              try {
                if (!existsSync(SELECTION_FILE)) {
                  const enriched = enrichResponse('get_selection', { selected: [], locked: [], hidden: [] }, true)
                  return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
                }
                const data = JSON.parse(readFileSync(SELECTION_FILE, 'utf-8'))
                const enriched = enrichResponse('get_selection', { selected: data.selected_entities || [], locked: data.locked_entities || [], hidden: data.hidden_entities || [] }, true)
                return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
              } catch (e) {
                return { content: [{ type: 'text', text: `Failed: ${e instanceof Error ? e.message : e}` }], isError: true }
              }
            }
            case 'draw_order': {
              const groupName = (args as Record<string, unknown>)?.group as string || ''
              const result = exec.exec('get_draw_order', { group_name: groupName })
              if (result.success && result.data) {
                const order = JSON.parse(result.data)
                const enriched = enrichResponse('get_draw_order', {
                  level: groupName || 'root',
                  order,
                  count: order.length,
                  hint: '배열 왼쪽이 뒤(먼저 그림), 오른쪽이 앞(나중 그림)',
                }, true)
                return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
              }
              return { content: [{ type: 'text', text: result.error || 'Failed to get draw order' }], isError: true }
            }
            case 'reset': {
              const result = exec.exec('reset', {})
              if (result.success) {
                const sceneJson = exec.exportScene()
                const scene = JSON.parse(sceneJson) as Scene
                const wsServer = getWSServer()
                wsServer.broadcastScene(scene)
                saveScene(exec)
                const enriched = enrichResponse('reset', { success: true, message: 'Scene reset' }, true)
                return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
              }
              return { content: [{ type: 'text', text: result.error || 'Failed' }], isError: true }
            }
            default:
              return { content: [{ type: 'text', text: `Unknown scene action: ${action}` }], isError: true }
          }
        }

        // === export: 내보내기 도메인 ===
        case 'export': {
          const action = (args as Record<string, unknown>)?.action as string
          const exec = getExecutor()

          switch (action) {
            case 'json': {
              const result = executeQueryTool('export_json', {})
              if (result.success) {
                const enriched = enrichResponse('export_json', result.result, true)
                return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
              }
              return { content: [{ type: 'text', text: result.error || 'Failed' }], isError: true }
            }
            case 'svg': {
              const result = exec.exec('export_svg', {})
              if (result.success && result.data) {
                const hints = getToolHints('export_svg')
                return { content: [{ type: 'text', text: `${result.data}\n\n💡 Hints: ${hints.join(', ')}` }] }
              }
              return { content: [{ type: 'text', text: result.error || 'Failed' }], isError: true }
            }
            case 'capture': {
              const clearSketch = (args as Record<string, unknown>)?.clearSketch as boolean
              try {
                const result = await captureViewport()
                if (result.success && result.path) {
                  const enriched = enrichResponse('capture', { success: true, path: result.path, clearSketch: clearSketch || false }, true)
                  return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
                }
                return { content: [{ type: 'text', text: result.error || 'Capture failed' }], isError: true }
              } catch (e) {
                return { content: [{ type: 'text', text: `Capture failed: ${e instanceof Error ? e.message : e}` }], isError: true }
              }
            }
            default:
              return { content: [{ type: 'text', text: `Unknown export action: ${action}` }], isError: true }
          }
        }

        // === module: 모듈 관리 도메인 ===
        case 'module': {
          const action = (args as Record<string, unknown>)?.action as string
          const moduleName = (args as Record<string, unknown>)?.name as string | undefined
          const code = (args as Record<string, unknown>)?.code as string | undefined

          switch (action) {
            case 'save': {
              if (!moduleName || !code) {
                return { content: [{ type: 'text', text: 'Error: name and code required' }], isError: true }
              }
              try {
                ensureModulesDir()
                const modulePath = getModulePath(moduleName)
                writeFileSync(modulePath, code, 'utf-8')
                const enriched = enrichResponse('save_module', { success: true, name: moduleName, path: modulePath }, true)
                return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
              } catch (e) {
                return { content: [{ type: 'text', text: `Failed: ${e instanceof Error ? e.message : e}` }], isError: true }
              }
            }
            case 'list': {
              const modules = getModuleList()
              const enriched = enrichResponse('list_modules', { modules, count: modules.length }, true)
              return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
            }
            case 'get': {
              if (!moduleName) {
                return { content: [{ type: 'text', text: 'Error: name required' }], isError: true }
              }
              const modulePath = getModulePath(moduleName)
              if (!existsSync(modulePath)) {
                return { content: [{ type: 'text', text: `Module not found: ${moduleName}` }], isError: true }
              }
              const moduleCode = readFileSync(modulePath, 'utf-8')
              const enriched = enrichResponse('get_module', { name: moduleName, code: moduleCode }, true)
              return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
            }
            case 'delete': {
              if (!moduleName) {
                return { content: [{ type: 'text', text: 'Error: name required' }], isError: true }
              }
              const modulePath = getModulePath(moduleName)
              if (!existsSync(modulePath)) {
                return { content: [{ type: 'text', text: `Module not found: ${moduleName}` }], isError: true }
              }
              try {
                unlinkSync(modulePath)
                const enriched = enrichResponse('delete_module', { success: true, deleted: moduleName }, true)
                return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
              } catch (e) {
                return { content: [{ type: 'text', text: `Failed: ${e instanceof Error ? e.message : e}` }], isError: true }
              }
            }
            default:
              return { content: [{ type: 'text', text: `Unknown module action: ${action}` }], isError: true }
          }
        }

        // === cad_code / run_cad_code: 코드 에디터 (핵심 도구) ===
        case 'cad_code':
        case 'run_cad_code': {
          const file = (args as Record<string, unknown>)?.file as string | undefined
          const code = (args as Record<string, unknown>)?.code as string | undefined
          const oldCode = (args as Record<string, unknown>)?.old_code as string | undefined
          const newCode = (args as Record<string, unknown>)?.new_code as string | undefined
          const exec = getExecutor()

          // Mode 1: 프로젝트 구조 (file/code 둘 다 없음)
          if (!file && !code) {
            const modules = getModuleList()
            const mainCode = readMainCode()
            const entities = getSceneEntities(exec)
            const enriched = enrichResponse('run_cad_code_structure', {
              success: true,
              files: ['main', ...modules],
              main: mainCode || '// 빈 프로젝트입니다. file="main", code="..." 로 코드를 작성하세요.',
              entities,
            }, true)
            return {
              content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }],
            }
          }

          // Mode 6: 부분 수정 (file + old_code + new_code) - Mode 2보다 먼저 체크
          if (file && oldCode !== undefined && newCode !== undefined) {
            let fileCode: string
            if (file === 'main') {
              fileCode = readMainCode()
            } else {
              const modPath = getModulePath(file)
              if (!existsSync(modPath)) {
                return {
                  content: [{ type: 'text', text: JSON.stringify({
                    success: false,
                    error: `'${file}' 파일을 찾을 수 없습니다.`,
                    availableFiles: ['main', ...getModuleList()],
                  }, null, 2) }],
                  isError: true,
                }
              }
              fileCode = readFileSync(modPath, 'utf-8')
            }

            // old_code가 파일에 존재하는지 확인
            if (!fileCode.includes(oldCode)) {
              return {
                content: [{ type: 'text', text: JSON.stringify({
                  success: false,
                  error: `old_code를 찾을 수 없습니다.`,
                  file,
                  old_code: oldCode,
                  hint: 'file을 먼저 읽어서 정확한 코드를 확인하세요.',
                }, null, 2) }],
                isError: true,
              }
            }

            // 교체 수행 (모든 일치 항목 교체)
            const updatedCode = fileCode.replaceAll(oldCode, newCode)

            // 저장
            if (file === 'main') {
              writeMainCode(updatedCode)
            } else {
              writeFileSync(getModulePath(file), updatedCode, 'utf-8')
            }

            // main 재실행
            const mainCode = readMainCode()
            const result = await executeRunCadCode(mainCode)

            if (result.success) {
              const enriched = enrichResponse('run_cad_code_edit', {
                success: true,
                file,
                mode: 'edit',
                replaced: { old: oldCode, new: newCode },
                entities: getSceneEntities(exec),
              }, true)
              return {
                content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }],
              }
            } else {
              // 실패 시 롤백
              if (file === 'main') {
                writeMainCode(fileCode)
              } else {
                writeFileSync(getModulePath(file), fileCode, 'utf-8')
              }
              const enriched = enrichResponse('run_cad_code_edit', {
                success: false,
                file,
                mode: 'edit',
                error: result.error,
                hint: '코드 실행 실패로 변경이 롤백되었습니다.',
              }, false)
              return {
                content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }],
                isError: true,
              }
            }
          }

          // Mode 2: 파일 읽기 (file만 있고 code 없음)
          if (file && !code) {
            let fileCode: string
            if (file === 'main') {
              fileCode = readMainCode()
            } else {
              const modPath = getModulePath(file)
              if (!existsSync(modPath)) {
                return {
                  content: [{ type: 'text', text: JSON.stringify({
                    success: false,
                    error: `'${file}' 파일을 찾을 수 없습니다.`,
                    availableFiles: ['main', ...getModuleList()],
                  }, null, 2) }],
                  isError: true,
                }
              }
              fileCode = readFileSync(modPath, 'utf-8')
            }
            const enriched = enrichResponse('run_cad_code_read', {
              success: true,
              file,
              code: fileCode,
            }, true)
            return {
              content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }],
            }
          }

          // Mode 3: 코드 실행만 (code만 있고 file 없음) - 저장 안 함
          if (!file && code) {
            const result = await executeRunCadCode(code)
            if (result.success) {
              const enriched = enrichResponse('run_cad_code_execute', result.result, true)
              return {
                content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }],
              }
            } else {
              const enriched = enrichResponse('run_cad_code_execute', { error: result.error }, false)
              return {
                content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }],
                isError: true,
              }
            }
          }

          // Mode 4 & 5: 파일 쓰기/추가 (file + code)
          if (file && code) {
            const isAppend = code.startsWith('+')
            const actualCode = isAppend ? code.slice(1) : code
            let finalCode: string

            if (file === 'main') {
              if (isAppend) {
                const existing = readMainCode()
                finalCode = existing ? `${existing}\n${actualCode}` : actualCode
              } else {
                finalCode = actualCode
              }
              writeMainCode(finalCode)
            } else {
              // 모듈 파일
              ensureModulesDir()
              const modPath = getModulePath(file)
              if (isAppend) {
                const existing = existsSync(modPath) ? readFileSync(modPath, 'utf-8') : ''
                finalCode = existing ? `${existing}\n${actualCode}` : actualCode
              } else {
                finalCode = actualCode
              }
              writeFileSync(modPath, finalCode, 'utf-8')
            }

            // 저장 후 main 실행 (모듈 변경 시에도 main 재실행)
            const mainCode = readMainCode()
            const result = await executeRunCadCode(mainCode)
            const hintKey = isAppend ? 'run_cad_code_append' : 'run_cad_code_write'

            if (result.success) {
              const enriched = enrichResponse(hintKey, {
                success: true,
                file,
                mode: isAppend ? 'append' : 'write',
                entities: getSceneEntities(exec),
              }, true)
              return {
                content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }],
              }
            } else {
              const enriched = enrichResponse(hintKey, {
                success: false,
                file,
                mode: isAppend ? 'append' : 'write',
                error: result.error,
              }, false)
              return {
                content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }],
                isError: true,
              }
            }
          }

          // Fallback (shouldn't reach here)
          return {
            content: [{ type: 'text', text: 'Error: Invalid parameter combination' }],
            isError: true,
          }
        }


        // ============================================================
        // Epic 10 신규 도구
        // ============================================================

        // === glob: 파일 목록 조회 ===
        case 'glob': {
          const pattern = (args as Record<string, unknown>)?.pattern as string | undefined
          const result = handleGlob({ pattern })
          if (result.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            }
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: true,
          }
        }

        case 'read': {
          const file = (args as Record<string, unknown>)?.file as string
          const result = handleRead({ file })
          if (result.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            }
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: true,
          }
        }

        case 'edit': {
          const file = (args as Record<string, unknown>)?.file as string
          const oldCode = (args as Record<string, unknown>)?.old_code as string
          const newCode = (args as Record<string, unknown>)?.new_code as string

          // Store original content for rollback
          let originalContent: string | undefined
          try {
            if (file === 'main') {
              originalContent = readMainCode()
            } else {
              const modPath = getModulePath(file)
              if (existsSync(modPath)) {
                originalContent = readFileSync(modPath, 'utf-8')
              }
            }
          } catch {
            // Will be caught by handleEdit
          }

          // Perform edit
          const editResult = handleEdit({ file, old_code: oldCode, new_code: newCode })

          if (!editResult.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(editResult, null, 2) }],
              isError: true,
            }
          }

          // Execute main code after edit
          const mainCode = readMainCode()
          const execResult = await executeRunCadCode(mainCode)

          if (execResult.success) {
            const response = {
              success: true,
              data: {
                file,
                replaced: true,
                entities: getSceneEntities(exec),
              },
              warnings: editResult.warnings,
            }
            return {
              content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
            }
          } else {
            // Rollback on execution failure
            if (originalContent !== undefined) {
              rollbackEdit(file, originalContent)
            }
            const response = {
              success: false,
              data: {
                file,
                replaced: false,
              },
              warnings: editResult.warnings,
              error: execResult.error,
              hint: '코드 실행 실패로 변경이 롤백되었습니다.',
            }
            return {
              content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
              isError: true,
            }
          }
        }

        case 'write': {
          const file = (args as Record<string, unknown>)?.file as string
          const code = (args as Record<string, unknown>)?.code as string

          // Store original content for rollback (null if file doesn't exist)
          const originalContent = getOriginalContent(file)

          // Perform write
          const writeResult = handleWrite({ file, code })

          if (!writeResult.success) {
            return {
              content: [{ type: 'text', text: JSON.stringify(writeResult, null, 2) }],
              isError: true,
            }
          }

          // Execute main code after write
          const mainCode = readMainCode()
          const execResult = await executeRunCadCode(mainCode)

          if (execResult.success) {
            const response = {
              success: true,
              data: {
                file,
                created: writeResult.data.created,
                entities: getSceneEntities(exec),
              },
              warnings: writeResult.warnings,
            }
            return {
              content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
            }
          } else {
            // Rollback on execution failure
            rollbackWrite(file, originalContent)
            const response = {
              success: false,
              data: {
                file,
                created: false,
              },
              warnings: writeResult.warnings,
              error: execResult.error,
              hint: '코드 실행 실패로 변경이 롤백되었습니다.',
            }
            return {
              content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
              isError: true,
            }
          }
        }

        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown tool: ${name}. Available: cad_code, discovery, scene, export, module, glob, read, edit, write`,
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
  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`)
    try {
      await stopWSServer()
      logger.info('Cleanup complete, exiting')
      process.exit(0)
    } catch (e) {
      logger.error(`Error during shutdown: ${e}`)
      process.exit(1)
    }
  }

  // Register signal handlers
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  try {
    await startMCPServer()
  } catch (e) {
    logger.error(`MCP server error: ${e}`)
    await stopWSServer().catch(() => {}) // Best effort cleanup
    process.exit(1)
  }
}
