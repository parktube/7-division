/**
 * WebMCP Tools - Export all tools
 */

export { getStatusTool } from './get-status'
export { getSceneSummaryTool } from './get-scene-summary'
export { getSelectionTool } from './get-selection'
export { selectEntitiesTool } from './select-entities'

import { getStatusTool } from './get-status'
import { getSceneSummaryTool } from './get-scene-summary'
import { getSelectionTool } from './get-selection'
import { selectEntitiesTool } from './select-entities'
import type { WebMcpToolDefinition } from '../types'

/**
 * All WebMCP tools
 */
export const allTools: WebMcpToolDefinition[] = [
  getStatusTool,
  getSceneSummaryTool,
  getSelectionTool,
  selectEntitiesTool,
]
