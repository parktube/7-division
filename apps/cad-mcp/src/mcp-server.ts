/**
 * MCP stdio Server for Claude Code integration
 *
 * Epic 10: Claude Code 패턴 완전 준수
 * - glob: 파일 목록 조회
 * - read: 파일 읽기
 * - edit: 파일 부분 수정
 * - write: 파일 전체 작성
 * - lsp: 코드 탐색 (도메인, 함수 스키마)
 * - bash: 명령 실행 (씬 조회, 내보내기, 초기화)
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
import { CAD_TOOLS, MAMA_TOOLS, type ToolSchema } from './schema.js'
import { handleGlob } from './tools/glob.js'
import {
  handleMamaSave,
  handleMamaSearch,
  handleMamaUpdate,
  handleMamaLoadCheckpoint,
  handleMamaConfigure,
  handleMamaEditHint,
  handleMamaSetSkillLevel,
  handleMamaHealth,
  type SaveArgs,
  type SearchArgs,
  type UpdateArgs,
  type ConfigureArgs,
  type EditHintArgs,
  type SetSkillLevelArgs,
  type HealthArgs,
} from './mama/tools/index.js'
import { shutdownMAMA } from './mama/index.js'
import { orchestrator } from './orchestrator.js'
import { handleRead } from './tools/read.js'
import { handleEdit, rollbackEdit } from './tools/edit.js'
import { handleWrite, rollbackWrite, getOriginalContent } from './tools/write.js'
import { handleLsp } from './tools/lsp.js'
import { handleBash, type BashCommand } from './tools/bash.js'
import { getWSServer, startWSServer, stopWSServer } from './ws-server.js'
import { logger } from './logger.js'
import { runCadCode } from './sandbox/index.js'
import type { Scene } from './shared/index.js'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
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

function getModulePath(name: string): string {
  return resolve(MODULES_DIR, `${name}.js`)
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
 * Epic 10: Claude Code 패턴 6개 도구
 * Epic 11: MAMA 5개 도구 추가
 */
function getAllMCPTools() {
  const cadTools = Object.values(CAD_TOOLS).map(toMCPToolSchema)
  const mamaTools = Object.values(MAMA_TOOLS).map(toMCPToolSchema)
  return [...cadTools, ...mamaTools]
}

/**
 * Restore scene from main.js after rollback
 * Returns true if scene was successfully restored
 *
 * Note: Validates code BEFORE reset and keeps fallback for runtime failures
 */
async function restoreSceneFromMainCode(exec: CADExecutor): Promise<boolean> {
  const origCode = readMainCode()
  if (!origCode) return false

  // Validate code BEFORE reset to avoid empty scene on failure
  const origPreprocessed = preprocessCode(origCode)
  if (origPreprocessed.errors.length > 0) return false

  // Backup current scene in case runtime execution fails
  const fallbackScene = exec.exportScene()

  // Now safe to reset since code is valid
  exec.exec('reset', {})
  const restoreResult = await runCadCode(exec, origPreprocessed.code, 'warn')

  if (!restoreResult.success) {
    // Runtime failure: restore from fallback
    logger.warn('restoreSceneFromMainCode: runtime failed, restoring fallback scene')
    exec.importScene(fallbackScene)
    return false
  }

  const sceneJson = exec.exportScene()
  const scene = JSON.parse(sceneJson) as Scene
  const wsServer = getWSServer()
  wsServer.broadcastScene(scene)
  saveScene(exec)
  return true
}

/**
 * Execute run_cad_code and broadcast results
 */
async function executeRunCadCode(
  code: string
): Promise<{ success: boolean; result?: unknown; logs?: string[]; warnings?: string[]; error?: string }> {
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

    // HMR 스타일: 유효한 코드일 때만 reset하여 transform 누적 방지
    exec.exec('reset', {})

    // Run JavaScript code in QuickJS sandbox
    const result = await runCadCode(exec, preprocessed.code, 'warn')

    // Export scene and broadcast to WebSocket clients only on success
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
        logs: result.logs,
        warnings: result.warnings,
        result: {
          entitiesCreated: result.entitiesCreated,
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
 * Create and start the MCP server
 */
export async function createMCPServer(): Promise<Server> {
  // Initialize CADOrchestrator and MAMA (Epic 11, Story 11.8)
  let sessionContext = ''
  try {
    // Use orchestrator for LLM-agnostic hook management
    const hookResult = await orchestrator.handleInitialize()

    if (hookResult) {
      sessionContext = hookResult.formattedContext
      logger.info(`MAMA initialized via orchestrator: mode=${hookResult.contextMode}, decisions=${hookResult.recentDecisions.length}`)

      if (sessionContext) {
        // Output session context for Claude to see
        logger.info(`SessionStart context (${hookResult.contextMode} mode):\n${sessionContext}`)
      }
    }
  } catch (err) {
    logger.warn(`Orchestrator initialization failed (non-fatal): ${err}`)
  }

  // Initialize executor
  const exec = getExecutor()
  let restored = false

  // Story 10.10: main.js 우선 실행, scene.json 폴백
  // 1차: main.js 실행으로 복원 시도
  if (existsSync(SCENE_CODE_FILE)) {
    try {
      const mainCode = readFileSync(SCENE_CODE_FILE, 'utf-8')
      const preprocessed = preprocessCode(mainCode)
      if (preprocessed.errors.length === 0) {
        const result = await runCadCode(exec, preprocessed.code, 'warn')
        if (result.success) {
          restored = true
          logger.info('Scene restored from main.js')
        } else {
          logger.warn(`main.js execution failed: ${result.error}`)
        }
      } else {
        logger.warn(`main.js preprocess failed: ${preprocessed.errors[0]}`)
      }
    } catch (e) {
      logger.warn(`main.js load failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 2차: main.js 실패/없음 시 scene.json 폴백
  if (!restored) {
    restored = loadScene(exec)
    if (restored) {
      logger.info('Scene restored from scene.json (fallback)')
    }
  }

  // Set initial scene state on WS server BEFORE starting (prevents flickering)
  const sceneJson = exec.exportScene()
  const scene = JSON.parse(sceneJson) as Scene
  const wsServer = getWSServer()
  wsServer.setInitialScene(scene)

  // NOW start WebSocket server (clients get restored scene immediately on connect)
  const wsPort = await startWSServer()
  logger.info(`WebSocket server ready on port ${wsPort}`)

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

  // Handle list tools request with dynamic hint injection (Story 11.8)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = getAllMCPTools()

    // Apply preToolList hook via orchestrator (LLM-agnostic)
    const enhancedTools = orchestrator.handleToolsList(
      tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      }))
    )

    // Convert back to MCP format
    return {
      tools: enhancedTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.parameters,
      })),
    }
  })

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        // ============================================================
        // Claude Code 패턴 6개 도구
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

        // === read: 파일 읽기 ===
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

        // === edit: 파일 부분 수정 ===
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
          } catch (err) {
            // Intentionally ignored: handleEdit will validate and return proper error
            // This try-catch is only for pre-loading original content for rollback
            logger.debug(`[edit] Failed to read original content: ${err instanceof Error ? err.message : String(err)}`);
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

          // Merge warnings from both edit and execution
          const allWarnings = [
            ...(editResult.warnings || []),
            ...(execResult.warnings || []),
          ]

          if (execResult.success) {
            // Apply postExecute hook via orchestrator (Story 11.8)
            const entities = getSceneEntities(exec)
            const cadResult = orchestrator.handleToolCall(
              'edit',
              { success: true, data: { file, entities } },
              { toolName: 'edit', file, entitiesCreated: entities, code: newCode }
            )

            const response = {
              success: true,
              data: {
                file,
                replaced: true,
                entities,
              },
              logs: execResult.logs,
              warnings: allWarnings.length > 0 ? allWarnings : undefined,
              actionHints: orchestrator.formatHints(cadResult),
            }
            return {
              content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
            }
          } else {
            // Rollback on execution failure
            if (originalContent !== undefined) {
              rollbackEdit(file, originalContent)
            }

            // Story 10.10: Restore scene from main.js
            const sceneRestored = await restoreSceneFromMainCode(exec)

            const response = {
              success: false,
              data: {
                file,
                replaced: false,
                sceneRestored,
              },
              warnings: allWarnings.length > 0 ? allWarnings : undefined,
              error: execResult.error,
              hint: sceneRestored
                ? 'Code execution failed. Changes rolled back. Scene restored to previous state.'
                : 'Code execution failed. Changes rolled back.',
            }
            return {
              content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
              isError: true,
            }
          }
        }

        // === write: 파일 전체 작성 ===
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
            // Apply postExecute hook via orchestrator (Story 11.8)
            const entities = getSceneEntities(exec)
            const cadResult = orchestrator.handleToolCall(
              'write',
              { success: true, data: { file, entities } },
              { toolName: 'write', file, entitiesCreated: entities, code }
            )

            const combinedWarnings = [...(writeResult.warnings || []), ...(execResult.warnings || [])]
            const response = {
              success: true,
              data: {
                file,
                created: writeResult.data.created,
                entities,
              },
              logs: execResult.logs,
              warnings: combinedWarnings.length > 0 ? combinedWarnings : undefined,
              actionHints: orchestrator.formatHints(cadResult),
            }
            return {
              content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
            }
          } else {
            // Rollback on execution failure
            rollbackWrite(file, originalContent)

            // Story 10.10: Restore scene from main.js
            const sceneRestored = await restoreSceneFromMainCode(exec)

            const combinedWarnings = [...(writeResult.warnings || []), ...(execResult.warnings || [])]
            const response = {
              success: false,
              data: {
                file,
                created: false,
                sceneRestored,
              },
              warnings: combinedWarnings.length > 0 ? combinedWarnings : undefined,
              error: execResult.error,
              hint: sceneRestored
                ? 'Code execution failed. Changes rolled back. Scene restored to previous state.'
                : 'Code execution failed. Changes rolled back.',
            }
            return {
              content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
              isError: true,
            }
          }
        }

        // === lsp: 코드 탐색 ===
        case 'lsp': {
          const operation = (args as Record<string, unknown>)?.operation as string
          const domain = (args as Record<string, unknown>)?.domain as string | undefined
          const funcName = (args as Record<string, unknown>)?.name as string | undefined
          const file = (args as Record<string, unknown>)?.file as string | undefined

          const result = handleLsp({
            operation: operation as 'domains' | 'describe' | 'schema' | 'symbols',
            domain,
            name: funcName,
            file,
          })

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

        // === bash: 명령 실행 ===
        case 'bash': {
          const command = (args as Record<string, unknown>)?.command as BashCommand
          const name = (args as Record<string, unknown>)?.name as string | undefined
          const group = (args as Record<string, unknown>)?.group as string | undefined
          const clearSketch = (args as Record<string, unknown>)?.clearSketch as boolean | undefined

          const exec = getExecutor()
          const result = await handleBash(
            { command, name, group, clearSketch },
            exec,
            () => {
              // On scene change (reset), broadcast and save
              const sceneJson = exec.exportScene()
              const scene = JSON.parse(sceneJson) as Scene
              const wsServer = getWSServer()
              wsServer.broadcastScene(scene)
              saveScene(exec)
            }
          )

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

        // ============================================================
        // MAMA 도구 (Epic 11)
        // ============================================================

        // === mama_save: Save decision or checkpoint ===
        case 'mama_save': {
          const saveArgs = args as unknown as SaveArgs
          const result = await handleMamaSave(saveArgs)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        }

        // === mama_search: Semantic search for decisions ===
        case 'mama_search': {
          const searchArgs = args as unknown as SearchArgs
          const result = await handleMamaSearch(searchArgs)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        }

        // === mama_update: Update decision outcome ===
        case 'mama_update': {
          const updateArgs = args as unknown as UpdateArgs
          const result = await handleMamaUpdate(updateArgs)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        }

        // === mama_load_checkpoint: Resume from checkpoint ===
        case 'mama_load_checkpoint': {
          const result = await handleMamaLoadCheckpoint()
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        }

        // === mama_configure: View/modify configuration ===
        case 'mama_configure': {
          const configArgs = args as unknown as ConfigureArgs
          const result = await handleMamaConfigure(configArgs)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        }

        // === mama_edit_hint: Manage dynamic hints ===
        case 'mama_edit_hint': {
          const editHintArgs = args as unknown as EditHintArgs
          const result = await handleMamaEditHint(editHintArgs)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        }

        // === mama_set_skill_level: Set skill level for adaptive mentoring ===
        case 'mama_set_skill_level': {
          const skillArgs = args as unknown as SetSkillLevelArgs
          const result = await handleMamaSetSkillLevel(skillArgs)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        }

        // === mama_health: Graph health metrics (Story 11.11) ===
        case 'mama_health': {
          const healthArgs = args as unknown as HealthArgs
          const result = await handleMamaHealth(healthArgs)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          }
        }

        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown tool: ${name}. Available: glob, read, edit, write, lsp, bash, mama_save, mama_search, mama_update, mama_load_checkpoint, mama_configure, mama_edit_hint, mama_set_skill_level, mama_health`,
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
      // Shutdown MAMA (Epic 11)
      shutdownMAMA()
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
