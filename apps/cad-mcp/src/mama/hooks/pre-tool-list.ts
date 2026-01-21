/**
 * PreToolList Hook Implementation
 *
 * Story 11.6: Dynamic Hint Injection (preToolList)
 *
 * Injects DB hints into tool descriptions when tools/list is requested.
 */

import { logger } from '../../logger.js'
import { getDatabase } from '../db.js'

// ============================================================
// Types
// ============================================================

export interface ToolDefinition {
  name: string
  description: string
  parameters: unknown
}

export interface HintRow {
  id: number
  tool_name: string
  hint_text: string
  priority: number
  tags: string | null
  source: string
  created_at: number
}

// ============================================================
// Cache
// ============================================================

let hintCache: Map<string, string[]> | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60000 // 1 minute

/**
 * Invalidate the hint cache
 * Called when hints are added/updated/deleted
 */
export function invalidateHintCache(): void {
  hintCache = null
  cacheTimestamp = 0
  logger.info('Hint cache invalidated')
}

// ============================================================
// Implementation
// ============================================================

/**
 * Get hints for a tool from cache or DB
 *
 * @param toolName - Tool name
 * @returns Array of hint texts (max 3, ordered by priority)
 */
function getHintsForTool(toolName: string): string[] {
  // Check cache
  const now = Date.now()
  if (hintCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return hintCache.get(toolName) || []
  }

  // Rebuild cache from DB
  try {
    const db = getDatabase()

    // Load all hints at once
    const allHints = db
      .prepare(
        `
        SELECT tool_name, hint_text
        FROM hints
        ORDER BY tool_name, priority DESC
      `
      )
      .all() as Array<{ tool_name: string; hint_text: string }>

    // Group by tool and limit to 3 per tool
    const newCache = new Map<string, string[]>()
    for (const hint of allHints) {
      const existing = newCache.get(hint.tool_name) || []
      if (existing.length < 3) {
        existing.push(hint.hint_text)
        newCache.set(hint.tool_name, existing)
      }
    }

    hintCache = newCache
    cacheTimestamp = now

    return newCache.get(toolName) || []
  } catch (error) {
    logger.warn(`Failed to load hints: ${error}`)
    return []
  }
}

/**
 * Execute preToolList hook
 *
 * Injects hints from DB into tool descriptions.
 * Max 3 hints per tool, ordered by priority (highest first).
 *
 * @param tools - Original tool definitions
 * @returns Tools with hints injected into descriptions
 */
export function executePreToolList(tools: ToolDefinition[]): ToolDefinition[] {
  const enhancedTools: ToolDefinition[] = []

  for (const tool of tools) {
    const hints = getHintsForTool(tool.name)

    if (hints.length === 0) {
      // No hints for this tool
      enhancedTools.push(tool)
      continue
    }

    // Build hint section
    const hintSection = hints.map((h) => `💡 ${h}`).join('\n')

    // Combine description with hints
    enhancedTools.push({
      ...tool,
      description: `${tool.description}\n\n${hintSection}`,
    })
  }

  const hintsInjected = enhancedTools.filter(
    (t, i) => t.description !== tools[i]?.description
  ).length

  if (hintsInjected > 0) {
    logger.info(`preToolList: Injected hints into ${hintsInjected} tools`)
  }

  return enhancedTools
}

// ============================================================
// Hint CRUD Operations
// ============================================================

export interface AddHintParams {
  tool_name: string
  hint_text: string
  priority?: number
  tags?: string[]
}

export interface UpdateHintParams {
  hint_id: number
  hint_text?: string
  priority?: number
  tags?: string[]
}

/**
 * Add a new hint
 */
export function addHint(params: AddHintParams): number {
  const db = getDatabase()
  const now = Date.now()

  const result = db
    .prepare(
      `
      INSERT INTO hints (tool_name, hint_text, priority, tags, source, created_at)
      VALUES (?, ?, ?, ?, 'user', ?)
    `
    )
    .run(
      params.tool_name,
      params.hint_text,
      params.priority || 5,
      params.tags ? JSON.stringify(params.tags) : null,
      now
    )

  invalidateHintCache()

  return result.lastInsertRowid as number
}

/**
 * Update an existing hint
 */
export function updateHint(params: UpdateHintParams): boolean {
  const db = getDatabase()

  const updates: string[] = []
  const values: unknown[] = []

  if (params.hint_text !== undefined) {
    updates.push('hint_text = ?')
    values.push(params.hint_text)
  }
  if (params.priority !== undefined) {
    updates.push('priority = ?')
    values.push(params.priority)
  }
  if (params.tags !== undefined) {
    updates.push('tags = ?')
    values.push(JSON.stringify(params.tags))
  }

  if (updates.length === 0) {
    return false
  }

  values.push(params.hint_id)

  const result = db
    .prepare(`UPDATE hints SET ${updates.join(', ')} WHERE id = ?`)
    .run(...values)

  if (result.changes > 0) {
    invalidateHintCache()
    return true
  }

  return false
}

/**
 * Delete a hint
 */
export function deleteHint(hintId: number): boolean {
  const db = getDatabase()

  const result = db.prepare('DELETE FROM hints WHERE id = ?').run(hintId)

  if (result.changes > 0) {
    invalidateHintCache()
    return true
  }

  return false
}

/**
 * List hints for a tool (or all hints if no tool specified)
 */
export function listHints(toolName?: string): HintRow[] {
  const db = getDatabase()

  if (toolName) {
    return db
      .prepare('SELECT * FROM hints WHERE tool_name = ? ORDER BY priority DESC')
      .all(toolName) as HintRow[]
  }

  return db
    .prepare('SELECT * FROM hints ORDER BY tool_name, priority DESC')
    .all() as HintRow[]
}
