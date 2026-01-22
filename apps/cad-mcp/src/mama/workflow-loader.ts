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
  tool_usage: {
    creation: Array<{ tool: string; when: string; example: string }>
    feedback: Array<{ tool: string; when: string }>
    recording: Array<{ tool: string; when: string; topics: string[] }>
  }
  checkpoints: Record<string, {
    condition: string
    record?: string
    options?: string[]
  }>
}

// ============================================================
// Cache
// ============================================================

let instructionsCache: string | null = null
let designHintsCache: DesignHintsData | null = null

/**
 * Clear all caches
 */
export function clearWorkflowCache(): void {
  instructionsCache = null
  designHintsCache = null
}

// ============================================================
// Loaders
// ============================================================

/**
 * Load workflow instructions from Markdown
 */
export function loadWorkflowInstructions(workflowId: string = 'cad-interior'): string | null {
  if (instructionsCache) return instructionsCache

  const instructionsPath = resolve(WORKFLOWS_DIR, workflowId, 'instructions.md')

  if (!existsSync(instructionsPath)) {
    logger.warn(`Workflow instructions not found: ${instructionsPath}`)
    return null
  }

  try {
    instructionsCache = readFileSync(instructionsPath, 'utf-8')
    logger.info(`Loaded workflow instructions: ${workflowId}`)
    return instructionsCache
  } catch (error) {
    logger.error(`Failed to load workflow instructions: ${error}`)
    return null
  }
}

/**
 * Load CAD-specific design hints from YAML
 */
export function loadDesignHintsData(workflowId: string = 'cad-interior'): DesignHintsData | null {
  if (designHintsCache) return designHintsCache

  const hintsPath = resolve(WORKFLOWS_DIR, workflowId, 'design-hints.yaml')

  if (!existsSync(hintsPath)) {
    logger.warn(`Design hints not found: ${hintsPath}`)
    return null
  }

  try {
    const content = readFileSync(hintsPath, 'utf-8')
    designHintsCache = parseYaml(content) as DesignHintsData
    logger.info(`Loaded design hints: ${workflowId}`)
    return designHintsCache
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
      const entryPath = resolve(WORKFLOWS_DIR, entry)
      if (statSync(entryPath).isDirectory()) {
        const instructionsPath = resolve(entryPath, 'instructions.md')
        if (existsSync(instructionsPath)) {
          workflows.push(entry)
        }
      }
    }

    return workflows
  } catch {
    return []
  }
}
