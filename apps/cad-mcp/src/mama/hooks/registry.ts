/**
 * MAMA Hook Registry
 *
 * Story 11.5: SessionStart Hook (onSessionInit)
 *
 * Hook system for LLM-agnostic event handling.
 * Reference: docs/adr/0018-llm-agnostic-hooks.md
 */

import { logger } from '../../logger.js'
import { executeSessionInit, type SessionInitResult } from './session-init.js'

// ============================================================
// Types
// ============================================================

export interface HookRegistry {
  onSessionInit: () => Promise<SessionInitResult>
  // Future hooks:
  // preToolList: () => Promise<PreToolListResult>
  // postExecute: (result: ExecutionResult) => Promise<void>
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
      }
    }
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const hookRegistry = new MAMAHookRegistry()

export { type SessionInitResult }
