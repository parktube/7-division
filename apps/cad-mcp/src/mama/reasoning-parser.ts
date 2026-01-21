/**
 * Reasoning Parser Module
 *
 * Story 11.2: 결정 저장 + Reasoning Graph
 * Parses reasoning field for relationship patterns:
 * - builds_on: decision_xxx (ID) 또는 builds_on: topic_name (토픽)
 * - debates: decision_xxx 또는 debates: topic_name
 * - synthesizes: [id1, id2] 또는 [topic1, topic2]
 */

import { logger } from '../logger.js'

// ============================================================
// Types
// ============================================================

export type EdgeType = 'supersedes' | 'builds_on' | 'debates' | 'synthesizes'

export interface ParsedEdge {
  type: EdgeType
  targetId?: string      // decision_xxx 형식
  targetTopic?: string   // topic:name 형식 (새로 추가)
}

export interface ParseResult {
  edges: ParsedEdge[]
  warnings: string[]
}

// ============================================================
// Patterns
// ============================================================

// Decision ID pattern: decision_xxx
const DECISION_ID_PATTERN = /^decision_[\w]+$/

// Topic pattern: domain:name (예: cad:mama_comparison_test)
const TOPIC_PATTERN = /^[\w]+:[\w:_-]+$/

// builds_on: decision_xxx 또는 builds_on: topic:name
const BUILDS_ON_ID_PATTERN = /builds_on:\s*(decision_[\w]+)/gi
const BUILDS_ON_TOPIC_PATTERN = /builds_on:\s*([\w]+:[\w:_-]+)/gi

// debates: decision_xxx 또는 debates: topic:name
const DEBATES_ID_PATTERN = /debates:\s*(decision_[\w]+)/gi
const DEBATES_TOPIC_PATTERN = /debates:\s*([\w]+:[\w:_-]+)/gi

// synthesizes: [id1, id2] 또는 synthesizes: [topic1, topic2]
const SYNTHESIZES_PATTERN = /synthesizes:\s*\[([^\]]+)\]/gi

// ============================================================
// Parser Functions
// ============================================================

interface ParsedRef {
  ids: string[]      // decision_xxx 형식
  topics: string[]   // topic:name 형식
}

/**
 * Parse builds_on patterns from reasoning text
 *
 * @param reasoning - Reasoning text to parse
 * @returns Object with decision IDs and topics
 */
function parseBuildsOn(reasoning: string): ParsedRef {
  const result: ParsedRef = { ids: [], topics: [] }
  let match

  // Parse decision IDs
  BUILDS_ON_ID_PATTERN.lastIndex = 0
  while ((match = BUILDS_ON_ID_PATTERN.exec(reasoning)) !== null) {
    const id = match[1].trim()
    if (id && DECISION_ID_PATTERN.test(id)) {
      result.ids.push(id)
    }
  }

  // Parse topics
  BUILDS_ON_TOPIC_PATTERN.lastIndex = 0
  while ((match = BUILDS_ON_TOPIC_PATTERN.exec(reasoning)) !== null) {
    const topic = match[1].trim()
    // Skip if it's actually a decision ID (starts with decision_)
    if (topic && TOPIC_PATTERN.test(topic) && !topic.startsWith('decision_')) {
      result.topics.push(topic)
    }
  }

  return { ids: [...new Set(result.ids)], topics: [...new Set(result.topics)] }
}

/**
 * Parse debates patterns from reasoning text
 *
 * @param reasoning - Reasoning text to parse
 * @returns Object with decision IDs and topics
 */
function parseDebates(reasoning: string): ParsedRef {
  const result: ParsedRef = { ids: [], topics: [] }
  let match

  // Parse decision IDs
  DEBATES_ID_PATTERN.lastIndex = 0
  while ((match = DEBATES_ID_PATTERN.exec(reasoning)) !== null) {
    const id = match[1].trim()
    if (id && DECISION_ID_PATTERN.test(id)) {
      result.ids.push(id)
    }
  }

  // Parse topics
  DEBATES_TOPIC_PATTERN.lastIndex = 0
  while ((match = DEBATES_TOPIC_PATTERN.exec(reasoning)) !== null) {
    const topic = match[1].trim()
    if (topic && TOPIC_PATTERN.test(topic) && !topic.startsWith('decision_')) {
      result.topics.push(topic)
    }
  }

  return { ids: [...new Set(result.ids)], topics: [...new Set(result.topics)] }
}

/**
 * Parse synthesizes patterns from reasoning text
 *
 * @param reasoning - Reasoning text to parse
 * @returns Object with decision IDs and topics
 */
function parseSynthesizes(reasoning: string): ParsedRef {
  const result: ParsedRef = { ids: [], topics: [] }
  let match

  SYNTHESIZES_PATTERN.lastIndex = 0
  while ((match = SYNTHESIZES_PATTERN.exec(reasoning)) !== null) {
    const itemList = match[1].trim()
    // Split by comma and clean up
    const items = itemList.split(',').map((item) => item.trim())

    for (const item of items) {
      if (DECISION_ID_PATTERN.test(item)) {
        result.ids.push(item)
      } else if (TOPIC_PATTERN.test(item)) {
        result.topics.push(item)
      }
    }
  }

  return { ids: [...new Set(result.ids)], topics: [...new Set(result.topics)] }
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
    // Parse builds_on (IDs and topics)
    const buildsOnRefs = parseBuildsOn(reasoning)
    for (const targetId of buildsOnRefs.ids) {
      result.edges.push({ type: 'builds_on', targetId })
    }
    for (const targetTopic of buildsOnRefs.topics) {
      result.edges.push({ type: 'builds_on', targetTopic })
    }

    // Parse debates (IDs and topics)
    const debatesRefs = parseDebates(reasoning)
    for (const targetId of debatesRefs.ids) {
      result.edges.push({ type: 'debates', targetId })
    }
    for (const targetTopic of debatesRefs.topics) {
      result.edges.push({ type: 'debates', targetTopic })
    }

    // Parse synthesizes (IDs and topics)
    const synthesizesRefs = parseSynthesizes(reasoning)
    for (const targetId of synthesizesRefs.ids) {
      result.edges.push({ type: 'synthesizes', targetId })
    }
    for (const targetTopic of synthesizesRefs.topics) {
      result.edges.push({ type: 'synthesizes', targetTopic })
    }

    // Log parsed edges
    if (result.edges.length > 0) {
      logger.info(`Parsed ${result.edges.length} edge(s) from reasoning`)
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

