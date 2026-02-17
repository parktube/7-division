/**
 * WebMCP Tools - Export all tools
 */

import { getStatusTool } from './get-status'
import { getSceneSummaryTool } from './get-scene-summary'
import { getSelectionTool } from './get-selection'
import { selectEntitiesTool } from './select-entities'
import type { WebMcpToolDefinition } from '../types'

// Re-export individual tools
export { getStatusTool, getSceneSummaryTool, getSelectionTool, selectEntitiesTool }

/**
 * All WebMCP tools
 */
export const allTools: WebMcpToolDefinition[] = [
  getStatusTool,
  getSceneSummaryTool,
  getSelectionTool,
  selectEntitiesTool,
]
