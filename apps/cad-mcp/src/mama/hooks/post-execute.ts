/**
 * Post-Execute Hook
 *
 * Story 11.7: ActionHints (postExecute)
 *
 * Analyzes tool execution results and generates contextual action hints
 * for next steps, module suggestions, and save recommendations.
 */

import { logger } from '../../logger.js'
import type {
  ActionHints,
  ExecutionContext,
  CADToolResult,
} from '../types/action-hints.js'
import { detectEntityTypes, generateActionHints } from '../rules/index.js'
import { getAdaptiveHints, trackAction, getActionDomain } from '../mentoring.js'
import { trackImportsFromCode } from '../module-recommender.js'

// ============================================================
// Entity Name Extraction
// ============================================================

/** Pattern to extract entity names from CAD code */
const ENTITY_NAME_PATTERNS = [
  // Named entities: name: 'entity_name' or name: "entity_name"
  /name:\s*['"]([^'"]+)['"]/g,
  // Group names: group('name', ...)
  /group\s*\(\s*['"]([^'"]+)['"]/g,
  // Variable assignments that look like entity names
  /const\s+(\w+)\s*=\s*(?:draw|create|make)/g,
]

/** Pattern to extract CAD function calls for domain detection */
const CAD_FUNCTION_PATTERN = /\b(drawBox|drawCylinder|drawSphere|drawCircle|drawRect|drawPolygon|drawLine|drawPoint|translate|rotate|scale|mirror|group|ungroup|clone|union|subtract|intersect|select|find|getEntity)\s*\(/g

/**
 * Extract entity names from CAD code
 */
export function extractEntityNames(code: string): string[] {
  const names: string[] = []

  for (const pattern of ENTITY_NAME_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(code)) !== null) {
      if (match[1]) {
        names.push(match[1])
      }
    }
  }

  return [...new Set(names)]
}

/**
 * Extract CAD function calls from code for domain detection
 */
export function extractCadFunctions(code: string): string[] {
  const functions: string[] = []
  CAD_FUNCTION_PATTERN.lastIndex = 0
  let match
  while ((match = CAD_FUNCTION_PATTERN.exec(code)) !== null) {
    if (match[1]) {
      functions.push(match[1])
    }
  }
  return [...new Set(functions)]
}

/**
 * Extract entity names from result data
 */
export function extractFromResult(data: unknown): string[] {
  if (!data || typeof data !== 'object') return []

  const names: string[] = []
  const dataObj = data as Record<string, unknown>

  // Check for entities array
  if (Array.isArray(dataObj.entities)) {
    for (const entity of dataObj.entities) {
      if (typeof entity === 'string') {
        names.push(entity)
      } else if (entity && typeof entity === 'object') {
        const e = entity as Record<string, unknown>
        if (typeof e.name === 'string') names.push(e.name)
        if (typeof e.id === 'string') names.push(e.id)
      }
    }
  }

  // Check for created/modified arrays
  for (const key of ['created', 'modified', 'added']) {
    if (Array.isArray(dataObj[key])) {
      for (const item of dataObj[key]) {
        if (typeof item === 'string') names.push(item)
      }
    }
  }

  // Check for single entity
  if (typeof dataObj.entity === 'string') names.push(dataObj.entity)
  if (typeof dataObj.name === 'string') names.push(dataObj.name)

  return [...new Set(names)]
}

// ============================================================
// Tool Classification
// ============================================================

/** Tools that typically create entities */
const CREATIVE_TOOLS = new Set([
  'write',
  'edit',
  'ai-native-cad__write',
  'ai-native-cad__edit',
  'mcp__ai-native-cad__write',
  'mcp__ai-native-cad__edit',
])

/** Tools that are read-only (no hints needed) */
const READONLY_TOOLS = new Set([
  'read',
  'glob',
  'lsp',
  'bash',
  'ai-native-cad__read',
  'ai-native-cad__glob',
  'ai-native-cad__lsp',
  'ai-native-cad__bash',
  'mcp__ai-native-cad__read',
  'mcp__ai-native-cad__glob',
  'mcp__ai-native-cad__lsp',
  'mcp__ai-native-cad__bash',
])

/**
 * Check if tool should generate hints
 */
export function shouldGenerateHints(toolName: string): boolean {
  // Normalize tool name
  const normalized = toolName.replace(/^mcp__/, '').replace(/^ai-native-cad__/, '')

  // Read-only tools don't need hints
  if (READONLY_TOOLS.has(toolName) || READONLY_TOOLS.has(normalized)) {
    return false
  }

  // Creative tools always get hints
  if (CREATIVE_TOOLS.has(toolName) || CREATIVE_TOOLS.has(normalized)) {
    return true
  }

  // Default: generate hints for unknown tools
  return true
}

// ============================================================
// Post-Execute Hook
// ============================================================

/**
 * Execute post-execute hook to generate action hints
 */
export function executePostExecute(
  context: ExecutionContext,
  result: CADToolResult
): CADToolResult {
  // Skip if tool shouldn't generate hints
  if (!shouldGenerateHints(context.toolName)) {
    return result
  }

  // Skip if execution failed
  if (!result.success) {
    return result
  }

  try {
    // Track module usage from import statements (Story 11.19)
    if (context.code) {
      trackImportsFromCode(context.code)
    }

    // Collect entity names from multiple sources
    const entitiesFromCode = context.code
      ? extractEntityNames(context.code)
      : []
    const entitiesFromResult = extractFromResult(result.data)
    const entitiesFromContext = context.entitiesCreated || []

    const allEntities = [
      ...new Set([
        ...entitiesFromCode,
        ...entitiesFromResult,
        ...entitiesFromContext,
      ]),
    ]

    // Detect entity types
    const entityTypes =
      context.entityTypes || detectEntityTypes(allEntities)

    // Skip if no entities detected
    if (allEntities.length === 0 && entityTypes.length === 0) {
      return result
    }

    // Extract CAD function calls for domain detection
    const cadFunctions = context.code
      ? extractCadFunctions(context.code)
      : []

    // Track each CAD function call as an action (for adaptive mentoring)
    for (const func of cadFunctions) {
      trackAction(func)
    }

    // Determine primary domain from CAD functions (not entity types)
    const primaryDomain = cadFunctions.length > 0
      ? getActionDomain(cadFunctions[0])
      : 'general'

    // Generate action hints
    const hints = generateActionHints({
      entityTypes,
      entitiesCreated: allEntities,
      toolName: context.toolName,
      code: context.code,
    })

    // Only add hints if there's something to suggest
    if (
      hints.nextSteps.length === 0 &&
      hints.moduleHints.length === 0 &&
      !hints.saveSuggestion
    ) {
      return result
    }

    const actionHints: ActionHints = {}

    if (hints.nextSteps.length > 0) {
      // Apply adaptive hints based on skill level
      actionHints.nextSteps = getAdaptiveHints(hints.nextSteps, primaryDomain)
    }

    if (hints.moduleHints.length > 0) {
      actionHints.moduleHints = hints.moduleHints
    }

    if (hints.saveSuggestion) {
      actionHints.saveSuggestion = hints.saveSuggestion
    }

    logger.debug(
      `postExecute: Generated ${hints.nextSteps.length} next steps, ${hints.moduleHints.length} module hints for ${context.toolName}`
    )

    return {
      ...result,
      actionHints,
    }
  } catch (error) {
    // Don't fail the result if hint generation fails
    logger.warn(
      `postExecute: Failed to generate hints - ${error instanceof Error ? error.message : String(error)}`
    )
    return result
  }
}

/**
 * Format action hints for LLM consumption
 */
export function formatActionHints(hints: ActionHints): string {
  const lines: string[] = []

  if (hints.nextSteps && hints.nextSteps.length > 0) {
    lines.push('📋 Suggested Next Steps:')
    for (const step of hints.nextSteps) {
      const optional = step.optional ? ' (선택)' : ''
      lines.push(`  • ${step.description}${optional}`)
      lines.push(`    → ${step.relevance}`)
    }
  }

  if (hints.moduleHints && hints.moduleHints.length > 0) {
    lines.push('')
    lines.push('🔧 Related Modules:')
    for (const hint of hints.moduleHints) {
      lines.push(`  • ${hint}`)
    }
  }

  if (hints.saveSuggestion) {
    lines.push('')
    lines.push('💾 Save Suggestion:')
    lines.push(`  Topic: ${hints.saveSuggestion.topic}`)
    lines.push(`  Reason: ${hints.saveSuggestion.reason}`)
  }

  return lines.join('\n')
}
