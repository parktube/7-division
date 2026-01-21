/**
 * Reasoning Parser Module
 *
 * Story 11.2: 결정 저장 + Reasoning Graph
 * Parses reasoning field for relationship patterns:
 * - builds_on: decision_xxx
 * - debates: decision_xxx
 * - synthesizes: [id1, id2]
 */

import { logger } from '../logger.js'

// ============================================================
// Types
// ============================================================

export type EdgeType = 'supersedes' | 'builds_on' | 'debates' | 'synthesizes'

export interface ParsedEdge {
  type: EdgeType
  targetId: string
}

export interface ParseResult {
  edges: ParsedEdge[]
  warnings: string[]
}

// ============================================================
// Patterns
// ============================================================

// builds_on: decision_xxx 또는 builds_on: decision_xxx_abc123
const BUILDS_ON_PATTERN = /builds_on:\s*(decision_[\w]+)/gi

// debates: decision_xxx
const DEBATES_PATTERN = /debates:\s*(decision_[\w]+)/gi

// synthesizes: [id1, id2] 또는 synthesizes: [id1, id2, id3]
const SYNTHESIZES_PATTERN = /synthesizes:\s*\[([\w,\s_]+)\]/gi

// Decision ID validation pattern
const DECISION_ID_PATTERN = /^decision_[\w]+$/

// ============================================================
// Parser Functions
// ============================================================

/**
 * Parse builds_on patterns from reasoning text
 *
 * @param reasoning - Reasoning text to parse
 * @returns Array of target decision IDs
 */
function parseBuildsOn(reasoning: string): string[] {
  const ids: string[] = []
  let match

  // Reset lastIndex for global regex
  BUILDS_ON_PATTERN.lastIndex = 0

  while ((match = BUILDS_ON_PATTERN.exec(reasoning)) !== null) {
    const id = match[1].trim()
    if (id && DECISION_ID_PATTERN.test(id)) {
      ids.push(id)
    }
  }

  return [...new Set(ids)] // Deduplicate
}

/**
 * Parse debates patterns from reasoning text
 *
 * @param reasoning - Reasoning text to parse
 * @returns Array of target decision IDs
 */
function parseDebates(reasoning: string): string[] {
  const ids: string[] = []
  let match

  // Reset lastIndex for global regex
  DEBATES_PATTERN.lastIndex = 0

  while ((match = DEBATES_PATTERN.exec(reasoning)) !== null) {
    const id = match[1].trim()
    if (id && DECISION_ID_PATTERN.test(id)) {
      ids.push(id)
    }
  }

  return [...new Set(ids)] // Deduplicate
}

/**
 * Parse synthesizes patterns from reasoning text
 *
 * @param reasoning - Reasoning text to parse
 * @returns Array of target decision IDs
 */
function parseSynthesizes(reasoning: string): string[] {
  const ids: string[] = []
  let match

  // Reset lastIndex for global regex
  SYNTHESIZES_PATTERN.lastIndex = 0

  while ((match = SYNTHESIZES_PATTERN.exec(reasoning)) !== null) {
    const idList = match[1].trim()
    // Split by comma and clean up
    const splitIds = idList.split(',').map((id) => id.trim())

    for (const id of splitIds) {
      if (id && DECISION_ID_PATTERN.test(id)) {
        ids.push(id)
      }
    }
  }

  return [...new Set(ids)] // Deduplicate
}

/**
 * Parse all relationship patterns from reasoning text
 *
 * @param reasoning - Reasoning text to parse
 * @returns ParseResult with edges and warnings
 */
export function parseReasoning(reasoning: string | null | undefined): ParseResult {
  const result: ParseResult = {
    edges: [],
    warnings: [],
  }

  if (!reasoning || typeof reasoning !== 'string') {
    return result
  }

  try {
    // Parse builds_on
    const buildsOnIds = parseBuildsOn(reasoning)
    for (const targetId of buildsOnIds) {
      result.edges.push({ type: 'builds_on', targetId })
    }

    // Parse debates
    const debatesIds = parseDebates(reasoning)
    for (const targetId of debatesIds) {
      result.edges.push({ type: 'debates', targetId })
    }

    // Parse synthesizes
    const synthesizesIds = parseSynthesizes(reasoning)
    for (const targetId of synthesizesIds) {
      result.edges.push({ type: 'synthesizes', targetId })
    }

    // Check for malformed patterns and warn
    // Only warn if there's a pattern that looks like it should be a relationship but doesn't match
    const potentialBuildsOn = reasoning.match(/builds_on:\s*([^\s,\n]+)/gi)
    if (potentialBuildsOn) {
      for (const match of potentialBuildsOn) {
        const idMatch = match.match(/builds_on:\s*(decision_[\w]+)/i)
        if (!idMatch) {
          result.warnings.push(`Malformed builds_on pattern found: ${match}`)
          logger.warn(`Malformed builds_on pattern: ${match}`)
        }
      }
    }

    const potentialDebates = reasoning.match(/debates:\s*([^\s,\n]+)/gi)
    if (potentialDebates) {
      for (const match of potentialDebates) {
        const idMatch = match.match(/debates:\s*(decision_[\w]+)/i)
        if (!idMatch) {
          result.warnings.push(`Malformed debates pattern found: ${match}`)
          logger.warn(`Malformed debates pattern: ${match}`)
        }
      }
    }

    const potentialSynthesizes = reasoning.match(/synthesizes:\s*([^\n]+)/gi)
    if (potentialSynthesizes) {
      for (const match of potentialSynthesizes) {
        const arrayMatch = match.match(/synthesizes:\s*\[([\w,\s_]+)\]/i)
        if (!arrayMatch) {
          result.warnings.push(`Malformed synthesizes pattern found: ${match}`)
          logger.warn(`Malformed synthesizes pattern: ${match}`)
        }
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    result.warnings.push(`Failed to parse reasoning: ${errorMsg}`)
    logger.error(`Reasoning parse error: ${errorMsg}`)
  }

  return result
}

/**
 * Validate that a decision ID exists in the database
 *
 * @param db - Database instance
 * @param decisionId - Decision ID to validate
 * @returns true if exists
 */
export function validateDecisionId(
  db: { prepare: (sql: string) => { get: (id: string) => unknown } },
  decisionId: string
): boolean {
  try {
    const row = db.prepare('SELECT id FROM decisions WHERE id = ?').get(decisionId)
    return !!row
  } catch {
    return false
  }
}
