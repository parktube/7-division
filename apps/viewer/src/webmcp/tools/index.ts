/**
 * WebMCP Tools - Export all tools
 */

// Phase 1: Read-only + UI tools
export { getStatusTool } from './get-status'
export { getSceneSummaryTool } from './get-scene-summary'
export { getSelectionTool } from './get-selection'
export { selectEntitiesTool } from './select-entities'

// CAD Tools
export { cadGlobTool } from './cad-glob'
export { cadReadTool } from './cad-read'
export { cadEditTool } from './cad-edit'
export { cadWriteTool } from './cad-write'
export { cadLspTool } from './cad-lsp'
export { cadBashTool } from './cad-bash'

// MAMA Tools
export { mamaSaveTool } from './mama-save'
export { mamaSearchTool } from './mama-search'
export { mamaUpdateTool } from './mama-update'
export { mamaLoadCheckpointTool } from './mama-load-checkpoint'
export { mamaConfigureTool } from './mama-configure'
export { mamaEditHintTool } from './mama-edit-hint'
export { mamaSetSkillLevelTool } from './mama-set-skill-level'
export { mamaHealthTool } from './mama-health'
export { mamaGrowthReportTool } from './mama-growth-report'
export { mamaRecommendModulesTool } from './mama-recommend-modules'
export { mamaWorkflowTool } from './mama-workflow'

import { getStatusTool } from './get-status'
import { getSceneSummaryTool } from './get-scene-summary'
import { getSelectionTool } from './get-selection'
import { selectEntitiesTool } from './select-entities'
import { cadGlobTool } from './cad-glob'
import { cadReadTool } from './cad-read'
import { cadEditTool } from './cad-edit'
import { cadWriteTool } from './cad-write'
import { cadLspTool } from './cad-lsp'
import { cadBashTool } from './cad-bash'
import { mamaSaveTool } from './mama-save'
import { mamaSearchTool } from './mama-search'
import { mamaUpdateTool } from './mama-update'
import { mamaLoadCheckpointTool } from './mama-load-checkpoint'
import { mamaConfigureTool } from './mama-configure'
import { mamaEditHintTool } from './mama-edit-hint'
import { mamaSetSkillLevelTool } from './mama-set-skill-level'
import { mamaHealthTool } from './mama-health'
import { mamaGrowthReportTool } from './mama-growth-report'
import { mamaRecommendModulesTool } from './mama-recommend-modules'
import { mamaWorkflowTool } from './mama-workflow'
import type { WebMcpToolDefinition } from '../types'

/**
 * All WebMCP tools (21 total: 4 Phase 1 + 6 CAD + 11 MAMA)
 */
export const allTools: WebMcpToolDefinition[] = [
  // Phase 1: Read-only + UI (4 tools)
  getStatusTool,
  getSceneSummaryTool,
  getSelectionTool,
  selectEntitiesTool,

  // CAD Tools (6 tools)
  cadGlobTool,
  cadReadTool,
  cadEditTool,
  cadWriteTool,
  cadLspTool,
  cadBashTool,

  // MAMA Tools (11 tools)
  mamaSaveTool,
  mamaSearchTool,
  mamaUpdateTool,
  mamaLoadCheckpointTool,
  mamaConfigureTool,
  mamaEditHintTool,
  mamaSetSkillLevelTool,
  mamaHealthTool,
  mamaGrowthReportTool,
  mamaRecommendModulesTool,
  mamaWorkflowTool,
]
