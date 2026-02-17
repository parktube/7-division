/**
 * WebMCP Tools - Export all tools
 */

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

// Phase 1: Read-only + UI tools
export { getStatusTool, getSceneSummaryTool, getSelectionTool, selectEntitiesTool }

// CAD Tools
export { cadGlobTool, cadReadTool, cadEditTool, cadWriteTool, cadLspTool, cadBashTool }

// MAMA Tools
export {
  mamaSaveTool, mamaSearchTool, mamaUpdateTool, mamaLoadCheckpointTool,
  mamaConfigureTool, mamaEditHintTool, mamaSetSkillLevelTool,
  mamaHealthTool, mamaGrowthReportTool, mamaRecommendModulesTool, mamaWorkflowTool,
}

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
