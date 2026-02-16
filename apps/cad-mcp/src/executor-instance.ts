/**
 * Shared CAD Executor Instance
 *
 * Provides a single executor instance shared between MCP server and WebSocket server
 */

import { CADExecutor } from './executor.js'

let executor: CADExecutor | null = null

/**
 * Get or create the shared executor instance
 */
export function getSharedExecutor(): CADExecutor {
  if (!executor) {
    executor = CADExecutor.create('shared-scene')
  }
  return executor
}

/**
 * Reset the executor (for testing)
 */
export function resetExecutor(): void {
  executor = null
}
