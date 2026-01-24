/**
 * Workflow Loader
 *
 * BMAD 스타일 파일 기반 워크플로우 로드
 * - instructions.md: 대화 흐름 지침
 * - design-hints.yaml: CAD 특화 데이터
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parse as parseYaml } from 'yaml'
import { logger } from '../logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 워크플로우 기본 경로
const WORKFLOWS_DIR = resolve(__dirname, '../../assets/workflows')

// ============================================================
// Security Helpers
// ============================================================

/**
 * Validate workflowId to prevent path traversal attacks
 * Only allows alphanumeric characters, hyphens, and underscores
 */
function validateWorkflowId(workflowId: string): boolean {
  // Reject if contains path separators or parent directory references
  if (workflowId.includes('..') || workflowId.includes('/') || workflowId.includes('\\')) {
    return false
  }
  // Only allow alphanumeric, hyphens, and underscores
  return /^[a-zA-Z0-9_-]+$/.test(workflowId)
}

// ============================================================
// Types
// ============================================================

export interface CADDimensions {
  space_sizes: Record<string, { pixels: string; feel: string }>
  mezzanine_ratios: Array<{ ratio: string; usage: string; height_px: number }>
}

export interface IsometricShading {
  examples: Record<string, { top: string; left: string; right: string }>
}

export interface DesignHintsData {
  cad_dimensions: CADDimensions
  isometric_shading: IsometricShading
  z_order: {
    standard_order: string[]
    mezzanine_order: string[]
  }
  furniture_sizes: Record<string, Record<string, { w: number; d: number; h: number }>>
  // Optional fields - may not be present in all workflow YAML files
  tool_usage?: {
    creation: Array<{ tool: string; when: string; example: string }>
    feedback: Array<{ tool: string; when: string }>
    recording: Array<{ tool: string; when: string; topics: string[] }>
  }
  checkpoints?: Record<string, {
    condition: string
    record?: string
    options?: string[]
  }>
}

// ============================================================
// Cache (keyed by workflowId)
// ============================================================

const instructionsCache = new Map<string, string>()
const designHintsCache = new Map<string, DesignHintsData>()

/**
 * Clear all caches or specific workflow cache
 */
export function clearWorkflowCache(workflowId?: string): void {
  if (workflowId) {
    instructionsCache.delete(workflowId)
    designHintsCache.delete(workflowId)
  } else {
    instructionsCache.clear()
    designHintsCache.clear()
  }
}

// ============================================================
// Loaders
// ============================================================

/**
 * Load workflow instructions from Markdown
 */
export function loadWorkflowInstructions(workflowId: string = 'cad-interior'): string | null {
  // Path traversal protection
  if (!validateWorkflowId(workflowId)) {
    logger.error(`Invalid workflowId (path traversal attempt?): ${workflowId}`)
    return null
  }

  const cached = instructionsCache.get(workflowId)
  if (cached) return cached

  const instructionsPath = resolve(WORKFLOWS_DIR, workflowId, 'instructions.md')

  if (!existsSync(instructionsPath)) {
    logger.warn(`Workflow instructions not found: ${instructionsPath}`)
    return null
  }

  try {
    const content = readFileSync(instructionsPath, 'utf-8')
    instructionsCache.set(workflowId, content)
    logger.info(`Loaded workflow instructions: ${workflowId}`)
    return content
  } catch (error) {
    logger.error(`Failed to load workflow instructions: ${error}`)
    return null
  }
}

/**
 * Type guard for DesignHintsData
 */
function isValidDesignHintsData(data: unknown): data is DesignHintsData {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>

  // Check required top-level keys (furniture_sizes is at top level per interface)
  if (!('cad_dimensions' in obj) || !('isometric_shading' in obj) || !('z_order' in obj) || !('furniture_sizes' in obj)) {
    return false
  }

  // Validate cad_dimensions: space_sizes and mezzanine_ratios (per CADDimensions interface)
  const cad = obj.cad_dimensions
  if (!cad || typeof cad !== 'object') return false
  const cadObj = cad as Record<string, unknown>
  if (!('space_sizes' in cadObj) || !('mezzanine_ratios' in cadObj)) return false
  // Ensure space_sizes is object and mezzanine_ratios is array
  if (typeof cadObj.space_sizes !== 'object' || cadObj.space_sizes === null) return false
  if (!Array.isArray(cadObj.mezzanine_ratios)) return false

  // Validate isometric_shading: examples (per IsometricShading interface)
  const shading = obj.isometric_shading
  if (!shading || typeof shading !== 'object') return false
  const shadingObj = shading as Record<string, unknown>
  if (!('examples' in shadingObj)) return false

  // Validate z_order: standard_order and mezzanine_order (per DesignHintsData interface)
  const zOrder = obj.z_order
  if (!zOrder || typeof zOrder !== 'object') return false
  const zOrderObj = zOrder as Record<string, unknown>
  if (!('standard_order' in zOrderObj) || !('mezzanine_order' in zOrderObj)) return false
  if (!Array.isArray(zOrderObj.standard_order) || !Array.isArray(zOrderObj.mezzanine_order)) return false

  // Validate optional fields if present (tool_usage, checkpoints)
  if ('tool_usage' in obj && obj.tool_usage !== null && typeof obj.tool_usage !== 'object') return false
  if ('checkpoints' in obj && obj.checkpoints !== null && typeof obj.checkpoints !== 'object') return false

  return true
}

/**
 * Load CAD-specific design hints from YAML
 */
export function loadDesignHintsData(workflowId: string = 'cad-interior'): DesignHintsData | null {
  // Path traversal protection
  if (!validateWorkflowId(workflowId)) {
    logger.error(`Invalid workflowId (path traversal attempt?): ${workflowId}`)
    return null
  }

  const cached = designHintsCache.get(workflowId)
  if (cached) return cached

  const hintsPath = resolve(WORKFLOWS_DIR, workflowId, 'design-hints.yaml')

  if (!existsSync(hintsPath)) {
    logger.warn(`Design hints not found: ${hintsPath}`)
    return null
  }

  try {
    const content = readFileSync(hintsPath, 'utf-8')
    const parsed = parseYaml(content)

    if (!isValidDesignHintsData(parsed)) {
      logger.error(`Invalid design hints data structure: ${workflowId}`)
      return null
    }

    designHintsCache.set(workflowId, parsed)
    logger.info(`Loaded design hints: ${workflowId}`)
    return parsed
  } catch (error) {
    logger.error(`Failed to load design hints: ${error}`)
    return null
  }
}

// ============================================================
// Context for LLM
// ============================================================

/**
 * Get workflow context for LLM system prompt
 */
export function getWorkflowContextForLLM(
  currentPhase: string,
  workflowId: string = 'cad-interior'
): string {
  const instructions = loadWorkflowInstructions(workflowId)
  const hints = loadDesignHintsData(workflowId)

  const lines: string[] = []

  // Phase info
  lines.push(`## Current Phase: ${currentPhase}`)
  lines.push('')

  // Full instructions (LLM will follow)
  if (instructions) {
    lines.push('## Workflow Instructions')
    lines.push(instructions)
    lines.push('')
  }

  // CAD-specific data as reference
  if (hints) {
    lines.push('## CAD Reference Data')

    // Space sizes
    lines.push('### 공간 크기 가이드')
    for (const [size, data] of Object.entries(hints.cad_dimensions.space_sizes)) {
      lines.push(`- ${size}: ${data.pixels} (${data.feel})`)
    }
    lines.push('')

    // z-order
    lines.push('### z-order')
    lines.push(hints.z_order.standard_order.join(' → '))
    lines.push('')
  }

  return lines.join('\n')
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get isometric shading colors for a base color
 */
export function getIsometricShading(
  colorName: string,
  workflowId: string = 'cad-interior'
): { top: string; left: string; right: string } | null {
  const hints = loadDesignHintsData(workflowId)
  return hints?.isometric_shading?.examples?.[colorName] || null
}

/**
 * Get furniture size reference
 */
export function getFurnitureSize(
  category: string,
  type: string,
  workflowId: string = 'cad-interior'
): { w: number; d: number; h: number } | null {
  const hints = loadDesignHintsData(workflowId)
  return hints?.furniture_sizes?.[category]?.[type] || null
}

/**
 * Get checkpoint info for a phase
 */
export function getCheckpointInfo(
  phase: string,
  workflowId: string = 'cad-interior'
): { condition: string; record?: string; options?: string[] } | null {
  const hints = loadDesignHintsData(workflowId)
  return hints?.checkpoints?.[phase] || null
}

/**
 * List available workflows
 */
export function listAvailableWorkflows(): string[] {
  if (!existsSync(WORKFLOWS_DIR)) {
    return []
  }

  try {
    const entries = readdirSync(WORKFLOWS_DIR)
    const workflows: string[] = []

    for (const entry of entries) {
      // Filter entries that would fail validateWorkflowId (consistency with loader)
      if (!validateWorkflowId(entry)) continue

      const entryPath = resolve(WORKFLOWS_DIR, entry)
      if (statSync(entryPath).isDirectory()) {
        const instructionsPath = resolve(entryPath, 'instructions.md')
        if (existsSync(instructionsPath)) {
          workflows.push(entry)
        }
      }
    }

    return workflows
  } catch (error) {
    logger.error(`Failed to list available workflows: ${error}`)
    return []
  }
}
