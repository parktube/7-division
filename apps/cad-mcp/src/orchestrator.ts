/**
 * CAD Orchestrator
 *
 * Story 11.8: CADOrchestrator Hook Owner
 *
 * Central coordinator for MCP requests and MAMA hook execution.
 * Provides LLM-agnostic hook management ensuring consistent behavior
 * across Claude, OpenAI, Ollama, and other LLM providers.
 *
 * Reference: docs/adr/0018-llm-agnostic-hooks.md
 */

import { logger } from './logger.js'
import {
  initMAMA,
  hookRegistry,
  formatActionHints,
  type SessionInitResult,
  type ExecutionContext,
  type CADToolResult,
  type ToolDefinition,
} from './mama/index.js'

// ============================================================
// Types
// ============================================================

/** MCP request method types */
export type MCPMethod =
  | 'initialize'
  | 'tools/list'
  | 'tools/call'
  | 'resources/list'
  | 'resources/read'
  | 'prompts/list'
  | 'prompts/get'

/** MCP request structure */
export interface MCPRequest {
  method: MCPMethod
  params?: Record<string, unknown>
}

/** Tool call result */
export interface ToolCallResult {
  success: boolean
  data: unknown
  error?: string
  warnings?: string[]
  logs?: string[]
}

/** Initialize response with session context */
export interface InitializeResponse {
  protocolVersion: string
  capabilities: Record<string, unknown>
  serverInfo: {
    name: string
    version: string
  }
  sessionContext?: SessionInitResult
}

/** Tools list response */
export interface ToolsListResponse {
  tools: ToolDefinition[]
}

/** Tool call response with action hints */
export interface ToolCallResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
  actionHints?: string
}

// ============================================================
// CADOrchestrator Class
// ============================================================

/**
 * CADOrchestrator - Central hook coordinator
 *
 * Manages MAMA hook lifecycle and ensures LLM-agnostic behavior.
 * All MCP requests should be routed through this orchestrator.
 */
export class CADOrchestrator {
  private initialized = false
  private initFailed = false
  private lastInitAttempt: number | null = null
  private sessionContext: SessionInitResult | null = null

  /**
   * Initialize the orchestrator and MAMA module
   * Allows retry after failure with cooldown to prevent spam
   */
  async init(): Promise<void> {
    if (this.initialized) return

    // Cooldown: prevent retry spam (30 seconds)
    const RETRY_COOLDOWN_MS = 30_000
    if (this.initFailed && this.lastInitAttempt) {
      const elapsed = Date.now() - this.lastInitAttempt
      if (elapsed < RETRY_COOLDOWN_MS) {
        logger.debug(`Init retry blocked (cooldown: ${Math.ceil((RETRY_COOLDOWN_MS - elapsed) / 1000)}s remaining)`)
        return
      }
      logger.info('Retrying MAMA initialization after cooldown')
    }

    this.lastInitAttempt = Date.now()

    try {
      await initMAMA()
      this.initialized = true
      this.initFailed = false
      logger.info('CADOrchestrator initialized')
    } catch (error) {
      logger.error(`CADOrchestrator init failed: ${error}`)
      // Mark as failed - allows retry after cooldown
      this.initFailed = true
      // Don't set initialized = true, allowing retry
    }
  }

  /**
   * Check if init failed (for external inspection)
   */
  get hasInitFailed(): boolean {
    return this.initFailed
  }

  /**
   * Handle MCP initialize request
   *
   * Executes onSessionInit hook and returns session context.
   */
  async handleInitialize(): Promise<SessionInitResult | null> {
    try {
      await this.init()

      // Check if init failed (e.g., due to cooldown or persistent error)
      if (this.initFailed) {
        logger.warn('handleInitialize: init failed, returning null')
        return null
      }

      this.sessionContext = await hookRegistry.onSessionInit()
      logger.info(
        `Initialize: mode=${this.sessionContext.contextMode}, decisions=${this.sessionContext.recentDecisions.length}`
      )
      return this.sessionContext
    } catch (error) {
      logger.error(`handleInitialize hook error: ${error}`)
      // Return null on error - caller uses default behavior
      return null
    }
  }

  /**
   * Handle tools/list request
   *
   * Executes preToolList hook to inject hints into tool descriptions.
   */
  handleToolsList(tools: ToolDefinition[]): ToolDefinition[] {
    try {
      return hookRegistry.preToolList(tools)
    } catch (error) {
      logger.error(`handleToolsList hook error: ${error}`)
      // Return original tools on error
      return tools
    }
  }

  /**
   * Handle tools/call request
   *
   * Executes postExecute hook to generate action hints.
   *
   * @param toolName - Name of the tool being called
   * @param result - Tool execution result
   * @param context - Additional execution context
   * @returns Enhanced result with action hints
   */
  handleToolCall(
    toolName: string,
    result: ToolCallResult,
    context?: Partial<ExecutionContext>
  ): CADToolResult {
    try {
      const executionContext: ExecutionContext = {
        toolName,
        file: context?.file,
        entitiesCreated: context?.entitiesCreated,
        entityTypes: context?.entityTypes,
        code: context?.code,
      }

      const cadResult: CADToolResult = {
        success: result.success,
        data: result.data,
        error: result.error,
        warnings: result.warnings,
        logs: result.logs,
      }

      return hookRegistry.postExecute(executionContext, cadResult)
    } catch (error) {
      logger.error(`handleToolCall hook error: ${error}`)
      // Return original result on error
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        warnings: result.warnings,
        logs: result.logs,
      }
    }
  }

  /**
   * Format action hints for LLM consumption
   */
  formatHints(result: CADToolResult): string | undefined {
    if (!result.actionHints) return undefined
    try {
      return formatActionHints(result.actionHints)
    } catch (error) {
      logger.error(`formatHints error: ${error}`)
      return undefined
    }
  }

  /**
   * Get current session context
   */
  getSessionContext(): SessionInitResult | null {
    return this.sessionContext
  }

  /**
   * Check if orchestrator is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Reset orchestrator state (for testing)
   */
  reset(): void {
    this.initialized = false
    this.initFailed = false
    this.lastInitAttempt = 0
    this.sessionContext = null
  }
}

// ============================================================
// Singleton Export
// ============================================================

/** Global orchestrator instance */
export const orchestrator = new CADOrchestrator()
