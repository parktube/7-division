/**
 * MAMA Hook Registry
 *
 * Story 11.5: SessionStart Hook (onSessionInit)
 * Story 11.6: Dynamic Hint Injection (preToolList)
 * Story 11.7: ActionHints (postExecute)
 *
 * Hook system for LLM-agnostic event handling.
 * Reference: docs/adr/0018-llm-agnostic-hooks.md
 */

import { logger } from '../../logger.js'
import { executeSessionInit, type SessionInitResult } from './session-init.js'
import { executePreToolList, type ToolDefinition } from './pre-tool-list.js'
import {
  executePostExecute,
  formatActionHints,
} from './post-execute.js'
import type {
  ExecutionContext,
  CADToolResult,
  ActionHints,
} from '../types/action-hints.js'

// ============================================================
// Types
// ============================================================

export interface HookRegistry {
  onSessionInit: () => Promise<SessionInitResult>
  preToolList: (tools: ToolDefinition[]) => ToolDefinition[]
  postExecute: (context: ExecutionContext, result: CADToolResult) => CADToolResult
}

// ============================================================
// Registry Implementation
// ============================================================

/**
 * MAMA Hook Registry singleton
 *
 * Provides hook execution for the MAMA lifecycle events.
 */
class MAMAHookRegistry implements HookRegistry {
  private initialized = false

  /**
   * Initialize the hook registry
   */
  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    logger.info('MAMA HookRegistry initialized')
  }

  /**
   * Execute onSessionInit hook
   *
   * Called when a new session starts to load context.
   * Returns checkpoint, recent decisions, and formatted context.
   */
  async onSessionInit(): Promise<SessionInitResult> {
    logger.info('Executing onSessionInit hook')

    try {
      const result = await executeSessionInit()
      logger.info(`onSessionInit completed: mode=${result.contextMode}, decisions=${result.recentDecisions.length}`)
      return result
    } catch (error) {
      logger.error(`onSessionInit failed: ${error}`)
      // Return safe empty result on error
      return {
        checkpoint: null,
        recentDecisions: [],
        contextMode: 'hint',
        formattedContext: '',
        healthWarning: null,
      }
    }
  }

  /**
   * Execute preToolList hook
   *
   * Called when tools/list is requested.
   * Injects hints from DB into tool descriptions.
   */
  preToolList(tools: ToolDefinition[]): ToolDefinition[] {
    try {
      return executePreToolList(tools)
    } catch (error) {
      logger.error(`preToolList failed: ${error}`)
      // Return original tools on error
      return tools
    }
  }

  /**
   * Execute postExecute hook
   *
   * Called after a CAD tool execution completes.
   * Analyzes results and generates contextual action hints.
   */
  postExecute(context: ExecutionContext, result: CADToolResult): CADToolResult {
    try {
      return executePostExecute(context, result)
    } catch (error) {
      logger.error(`postExecute failed: ${error}`)
      // Return original result on error
      return result
    }
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const hookRegistry = new MAMAHookRegistry()

export { type SessionInitResult }
export { type ToolDefinition }
export {
  addHint,
  updateHint,
  deleteHint,
  listHints,
  invalidateHintCache,
  type AddHintParams,
  type UpdateHintParams,
  type HintRow,
} from './pre-tool-list.js'

// Post-execute exports
export { formatActionHints }
export type { ExecutionContext, CADToolResult, ActionHints }
