/**
 * CAD MAMA Module
 *
 * Story 11.1: MAMA Core 4 Tools MCP 통합
 * Main entry point for MAMA functionality
 *
 * Core 4 Tools:
 * - mama_save: Save decision or checkpoint
 * - mama_search: Semantic search for decisions
 * - mama_update: Update decision outcome
 * - mama_load_checkpoint: Resume from checkpoint
 *
 * Reference: ~/MAMA/packages/claude-code-plugin/src/core/mama-api.js
 */

import { logger } from '../logger.js'
import {
  getDatabase,
  initDatabase,
  closeDatabase,
  isVectorSearchEnabled,
  insertEmbedding,
  searchEmbeddings,
  getLastInsertRowid,
  insertEdge,
  getEdgeSummary,
  getDecisionIdByTopic,
  type DecisionRow,
  type CheckpointRow,
} from './db.js'
import { parseReasoning, validateDecisionId } from './reasoning-parser.js'
import {
  generateEmbedding,
  generateEnhancedEmbedding,
  preloadModel,
  isEmbeddingReady,
  clearEmbeddingCache,
} from './embeddings.js'
import { loadConfig, getContextInjection, type MAMAConfig } from './config.js'

// ============================================================
// Types
// ============================================================

export interface SaveDecisionParams {
  topic: string
  decision: string
  reasoning: string
  confidence?: number
}

export interface SaveCheckpointParams {
  summary: string
  open_files?: string[]
  next_steps?: string
}

export interface SearchParams {
  query?: string
  limit?: number
  type?: 'all' | 'decision' | 'checkpoint'
  domain?: string
  group_by_topic?: boolean
  outcome_filter?: 'success' | 'failed' | 'partial' | 'pending'
}

export interface UpdateParams {
  id: string
  outcome: 'SUCCESS' | 'FAILED' | 'PARTIAL'
  reason?: string
}

export interface EdgeInfo {
  supersedes_count: number
  superseded_by: string | null
  builds_on: string[]
  debates: string[]
  synthesizes: string[]
}

export interface DecisionResult {
  id: string
  topic: string
  decision: string
  reasoning: string | null
  outcome: string | null
  outcome_reason: string | null
  confidence: number
  created_at: number
  similarity?: number
  edges?: EdgeInfo
}

export interface CheckpointResult {
  id: number
  timestamp: number
  summary: string
  open_files: string[]
  next_steps: string | null
}

// ============================================================
// Module State
// ============================================================

let initialized = false
let initPromise: Promise<{
  dbReady: boolean
  embeddingReady: boolean
  vectorSearchEnabled: boolean
}> | null = null

// ============================================================
// Initialization
// ============================================================

/**
 * Initialize MAMA module
 *
 * - Opens database connection
 * - Runs migrations
 * - Preloads embedding model (async)
 *
 * Uses promise-based mutex to prevent race conditions on concurrent calls.
 *
 * @returns Initialization result
 */
export async function initMAMA(): Promise<{
  dbReady: boolean
  embeddingReady: boolean
  vectorSearchEnabled: boolean
}> {
  // Already initialized
  if (initialized) {
    return {
      dbReady: true,
      embeddingReady: isEmbeddingReady(),
      vectorSearchEnabled: isVectorSearchEnabled(),
    }
  }

  // Initialization in progress - wait for it
  if (initPromise) {
    return initPromise
  }

  // Start initialization
  initPromise = (async () => {
    const startTime = Date.now()

    try {
      // Initialize database
      initDatabase()
      logger.info('MAMA database initialized')

      // Preload embedding model (background)
      preloadModel()
        .then((ready) => {
          if (ready) {
            logger.info('MAMA embedding model preloaded')
          }
        })
        .catch((err) => {
          logger.warn(`MAMA embedding model preload failed: ${err}`)
        })

      initialized = true

      const initTime = Date.now() - startTime
      logger.info(`MAMA initialized in ${initTime}ms`)

      return {
        dbReady: true,
        embeddingReady: isEmbeddingReady(),
        vectorSearchEnabled: isVectorSearchEnabled(),
      }
    } catch (error) {
      // Reset promise so next call can retry
      initPromise = null
      logger.error(`MAMA initialization failed: ${error}`)
      throw error
    }
  })()

  return initPromise
}

/**
 * Shutdown MAMA module
 */
export function shutdownMAMA(): void {
  closeDatabase()
  clearEmbeddingCache()
  initialized = false
  // Reset initPromise so next initMAMA creates a fresh promise
  initPromise = null
  logger.info('MAMA shutdown complete')
}

// ============================================================
// Decision ID Generation
// ============================================================

/**
 * Generate unique decision ID
 *
 * Format: decision_{topic}_{timestamp}_{random}
 */
function generateDecisionId(topic: string): string {
  const sanitized = topic
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 50)

  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 6)

  return `decision_${sanitized}_${timestamp}_${random}`
}

// ============================================================
// Save Operations
// ============================================================

/**
 * Save a decision to MAMA
 *
 * @param params - Decision parameters
 * @returns Decision ID
 */
export async function saveDecision(params: SaveDecisionParams): Promise<string> {
  if (!initialized) {
    await initMAMA()
  }

  const { topic, decision, reasoning, confidence = 0.5 } = params

  // Validate
  if (!topic || typeof topic !== 'string') {
    throw new Error('topic is required (string)')
  }
  if (!decision || typeof decision !== 'string') {
    throw new Error('decision is required (string)')
  }
  if (!reasoning || typeof reasoning !== 'string') {
    throw new Error('reasoning is required (string)')
  }
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error('confidence must be between 0.0 and 1.0')
  }

  const db = getDatabase()
  const decisionId = generateDecisionId(topic)
  const now = Date.now()

  // Check for previous decision on same topic
  const previous = db
    .prepare(
      `
      SELECT id FROM decisions
      WHERE topic = ? AND superseded_by IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `
    )
    .get(topic) as { id: string } | undefined

  // Insert new decision
  db.prepare(
    `
    INSERT INTO decisions (id, topic, decision, reasoning, confidence, supersedes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(decisionId, topic, decision, reasoning, confidence, previous?.id || null, now)

  // Get rowid for embedding
  const rowid = getLastInsertRowid()

  // Update previous decision's superseded_by and create supersedes edge
  if (previous) {
    db.prepare(
      `
      UPDATE decisions
      SET superseded_by = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(decisionId, now, previous.id)

    // Create supersedes edge in decision_edges table
    try {
      insertEdge(decisionId, previous.id, 'supersedes')
    } catch (err) {
      logger.warn(`Failed to create supersedes edge: ${err}`)
    }

    logger.info(`Decision ${previous.id} superseded by ${decisionId}`)
  }

  // Parse reasoning for relationship patterns (builds_on, debates, synthesizes)
  const parseResult = parseReasoning(reasoning)

  for (const edge of parseResult.edges) {
    let targetId: string | null = null

    // Resolve target: either direct ID or topic-based lookup
    if (edge.targetId) {
      // Direct decision ID reference
      if (validateDecisionId(db, edge.targetId)) {
        targetId = edge.targetId
      } else {
        logger.warn(`Target decision not found for ${edge.type}: ${edge.targetId}`)
      }
    } else if (edge.targetTopic) {
      // Topic-based reference - resolve to latest decision ID
      targetId = getDecisionIdByTopic(edge.targetTopic)
      if (!targetId) {
        logger.warn(`No decision found for topic ${edge.type}: ${edge.targetTopic}`)
      } else {
        logger.info(`Resolved topic '${edge.targetTopic}' to decision '${targetId}'`)
      }
    }

    // Create edge if target was resolved
    if (targetId) {
      try {
        insertEdge(decisionId, targetId, edge.type)
      } catch (err) {
        logger.warn(`Failed to create ${edge.type} edge to ${targetId}: ${err}`)
      }
    }
  }

  // Log any parsing warnings
  for (const warning of parseResult.warnings) {
    logger.warn(`Reasoning parse warning: ${warning}`)
  }

  // Generate and store embedding
  if (isVectorSearchEnabled()) {
    try {
      const embedding = await generateEnhancedEmbedding({
        topic,
        decision,
        reasoning,
        confidence,
      })

      if (embedding) {
        insertEmbedding(rowid, embedding)
        logger.info(`Embedding stored for ${decisionId}`)
      }
    } catch (err) {
      logger.warn(`Failed to generate embedding for ${decisionId}: ${err}`)
    }
  }

  logger.info(`Decision saved: ${decisionId}`)
  return decisionId
}

/**
 * Save a checkpoint to MAMA
 *
 * @param params - Checkpoint parameters
 * @returns Checkpoint ID
 */
export async function saveCheckpoint(params: SaveCheckpointParams): Promise<number> {
  if (!initialized) {
    await initMAMA()
  }

  const { summary, open_files = [], next_steps = '' } = params

  if (!summary || typeof summary !== 'string') {
    throw new Error('summary is required (string)')
  }

  const db = getDatabase()
  const now = Date.now()

  // Archive previous active checkpoints
  db.prepare(
    `
    UPDATE checkpoints
    SET status = 'archived'
    WHERE status = 'active'
  `
  ).run()

  // Insert new checkpoint
  db.prepare(
    `
    INSERT INTO checkpoints (timestamp, summary, open_files, next_steps, status)
    VALUES (?, ?, ?, ?, 'active')
  `
  ).run(now, summary, JSON.stringify(open_files), next_steps)

  const checkpointId = getLastInsertRowid()

  logger.info(`Checkpoint saved: ${checkpointId}`)
  return checkpointId
}

// ============================================================
// Search Operations
// ============================================================

/**
 * Search decisions using semantic similarity
 *
 * @param params - Search parameters
 * @returns Search results
 */
export async function searchDecisions(params: SearchParams): Promise<DecisionResult[]> {
  if (!initialized) {
    await initMAMA()
  }

  const { query, limit = 10, domain, group_by_topic, outcome_filter } = params
  const db = getDatabase()

  // Helper function to add edges to result
  const addEdgesToResult = (row: DecisionRow, similarity?: number): DecisionResult => ({
    id: row.id,
    topic: row.topic,
    decision: row.decision,
    reasoning: row.reasoning,
    outcome: row.outcome,
    outcome_reason: row.outcome_reason,
    confidence: row.confidence,
    created_at: row.created_at,
    similarity,
    edges: getEdgeSummary(row.id),
  })

  // Build parameterized filter conditions (SQL injection prevention)
  const filterConditions: string[] = []
  const filterParams: unknown[] = []

  if (domain) {
    filterConditions.push('topic LIKE ?')
    filterParams.push(`${domain.toLowerCase()}:%`)
  }

  if (outcome_filter) {
    // Validate outcome_filter against allowed values
    const validOutcomes = ['success', 'failed', 'partial', 'pending']
    if (!validOutcomes.includes(outcome_filter)) {
      throw new Error(`Invalid outcome_filter: ${outcome_filter}`)
    }
    if (outcome_filter === 'pending') {
      filterConditions.push('outcome IS NULL')
    } else {
      filterConditions.push('outcome = ?')
      filterParams.push(outcome_filter.toUpperCase())
    }
  }

  const filterClause = filterConditions.length > 0
    ? 'AND ' + filterConditions.join(' AND ')
    : ''

  // If no query, return recent items
  if (!query || query.trim().length === 0) {
    let rows: DecisionRow[]

    if (group_by_topic) {
      // Group by topic: get latest decision per topic
      rows = db
        .prepare(
          `
          SELECT d.* FROM decisions d
          INNER JOIN (
            SELECT topic, MAX(created_at) as max_created
            FROM decisions
            WHERE superseded_by IS NULL ${filterClause}
            GROUP BY topic
          ) latest ON d.topic = latest.topic AND d.created_at = latest.max_created
          WHERE d.superseded_by IS NULL ${filterClause}
          ORDER BY d.created_at DESC
          LIMIT ?
        `
        )
        .all(...filterParams, ...filterParams, limit) as DecisionRow[]
    } else {
      rows = db
        .prepare(
          `
          SELECT * FROM decisions
          WHERE superseded_by IS NULL ${filterClause}
          ORDER BY created_at DESC
          LIMIT ?
        `
        )
        .all(...filterParams, limit) as DecisionRow[]
    }

    return rows.map((row) => addEdgesToResult(row))
  }

  // Try vector search first
  if (isVectorSearchEnabled() && isEmbeddingReady()) {
    try {
      const queryEmbedding = await generateEmbedding(query)

      if (queryEmbedding) {
        const vectorResults = searchEmbeddings(queryEmbedding, limit * 2)

        if (vectorResults.length > 0) {
          // Get decision details
          const rowids = vectorResults.map((r) => r.rowid)
          const placeholders = rowids.map(() => '?').join(',')

          const rows = db
            .prepare(
              `
              SELECT *, rowid FROM decisions
              WHERE rowid IN (${placeholders})
              AND superseded_by IS NULL ${filterClause}
            `
            )
            .all(...rowids, ...filterParams) as (DecisionRow & { rowid: number })[]

          // Create rowid to distance map
          const distanceMap = new Map(vectorResults.map((r) => [r.rowid, r.distance]))

          // Convert distance to similarity (cosine distance: 0 = identical)
          let results = rows
            .map((row) => {
              const distance = distanceMap.get(row.rowid) || 1
              const similarity = 1 - distance // Convert distance to similarity
              return addEdgesToResult(row, similarity)
            })
            .filter((r) => (r.similarity || 0) >= 0.3) // Threshold (lowered for multilingual model)
            .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))

          // Apply group_by_topic filter
          if (group_by_topic) {
            const seen = new Set<string>()
            results = results.filter((r) => {
              if (seen.has(r.topic)) return false
              seen.add(r.topic)
              return true
            })
          }

          results = results.slice(0, limit)

          if (results.length > 0) {
            logger.info(`Vector search: ${results.length} results for "${query}"${domain ? ` in domain "${domain}"` : ''}`)
            return results
          }
        }
      }
    } catch (err) {
      logger.warn(`Vector search failed, falling back to keyword: ${err}`)
    }
  }

  // Fallback: keyword search
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)

  if (keywords.length === 0) {
    return []
  }

  const likeConditions = keywords.map(() => '(topic LIKE ? ESCAPE \'\\\' OR decision LIKE ? ESCAPE \'\\\' OR reasoning LIKE ? ESCAPE \'\\\')').join(' OR ')
  // Escape SQL wildcards in keywords
  const escapeWildcards = (s: string) => s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  const likeParams = keywords.flatMap((k) => {
    const escaped = escapeWildcards(k)
    return [`%${escaped}%`, `%${escaped}%`, `%${escaped}%`]
  })

  let rows: DecisionRow[]

  if (group_by_topic) {
    // For group_by_topic with keyword search, we need to filter after
    rows = db
      .prepare(
        `
        SELECT * FROM decisions
        WHERE (${likeConditions})
        AND superseded_by IS NULL ${filterClause}
        ORDER BY created_at DESC
      `
      )
      .all(...likeParams, ...filterParams) as DecisionRow[]

    // Apply group_by_topic filter
    const seen = new Set<string>()
    rows = rows.filter((r) => {
      if (seen.has(r.topic)) return false
      seen.add(r.topic)
      return true
    })
    rows = rows.slice(0, limit)
  } else {
    rows = db
      .prepare(
        `
        SELECT * FROM decisions
        WHERE (${likeConditions})
        AND superseded_by IS NULL ${filterClause}
        ORDER BY created_at DESC
        LIMIT ?
      `
      )
      .all(...likeParams, ...filterParams, limit) as DecisionRow[]
  }

  logger.info(`Keyword search: ${rows.length} results for "${query}"${domain ? ` in domain "${domain}"` : ''}`)

  return rows.map((row) => addEdgesToResult(row, 0.75)) // Default similarity for keyword matches
}

/**
 * List all unique domains from decisions
 *
 * @returns Array of unique domain names
 */
export async function listDomains(): Promise<string[]> {
  if (!initialized) {
    await initMAMA()
  }

  const db = getDatabase()

  // Extract domain (first part before colon) from topics
  const rows = db
    .prepare(
      `
      SELECT DISTINCT
        CASE
          WHEN topic LIKE '%:%' THEN SUBSTR(topic, 1, INSTR(topic, ':') - 1)
          ELSE topic
        END as domain
      FROM decisions
      WHERE superseded_by IS NULL
      ORDER BY domain
    `
    )
    .all() as Array<{ domain: string }>

  return rows.map((r) => r.domain).filter((d) => d && d.length > 0)
}

// ============================================================
// Update Operations
// ============================================================

/**
 * Update decision outcome
 *
 * @param params - Update parameters
 */
export async function updateOutcome(params: UpdateParams): Promise<void> {
  if (!initialized) {
    await initMAMA()
  }

  const { id, outcome, reason } = params

  if (!id || typeof id !== 'string') {
    throw new Error('id is required (string)')
  }

  const validOutcomes = ['SUCCESS', 'FAILED', 'PARTIAL']
  if (!outcome || !validOutcomes.includes(outcome)) {
    throw new Error(`outcome must be one of: ${validOutcomes.join(', ')}`)
  }

  const db = getDatabase()
  const now = Date.now()

  const result = db
    .prepare(
      `
      UPDATE decisions
      SET outcome = ?, outcome_reason = ?, updated_at = ?
      WHERE id = ?
    `
    )
    .run(outcome, reason || null, now, id)

  if (result.changes === 0) {
    throw new Error(`Decision not found: ${id}`)
  }

  logger.info(`Decision ${id} outcome updated: ${outcome}`)
}

// ============================================================
// Checkpoint Operations
// ============================================================

/**
 * Load latest active checkpoint
 *
 * @returns Checkpoint or null
 */
export async function loadCheckpoint(): Promise<CheckpointResult | null> {
  if (!initialized) {
    await initMAMA()
  }

  const db = getDatabase()

  const row = db
    .prepare(
      `
      SELECT * FROM checkpoints
      WHERE status = 'active'
      ORDER BY timestamp DESC
      LIMIT 1
    `
    )
    .get() as CheckpointRow | undefined

  if (!row) {
    return null
  }

  let openFiles: string[] = []
  try {
    openFiles = JSON.parse(row.open_files || '[]')
  } catch {
    openFiles = []
  }

  return {
    id: row.id,
    timestamp: row.timestamp,
    summary: row.summary,
    open_files: openFiles,
    next_steps: row.next_steps,
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get recent decisions for a topic
 */
export async function getDecisionsByTopic(
  topic: string,
  limit = 10
): Promise<DecisionResult[]> {
  if (!initialized) {
    await initMAMA()
  }

  const db = getDatabase()

  const rows = db
    .prepare(
      `
      SELECT * FROM decisions
      WHERE topic = ?
      ORDER BY created_at DESC
      LIMIT ?
    `
    )
    .all(topic, limit) as DecisionRow[]

  return rows.map((row) => ({
    id: row.id,
    topic: row.topic,
    decision: row.decision,
    reasoning: row.reasoning,
    outcome: row.outcome,
    outcome_reason: row.outcome_reason,
    confidence: row.confidence,
    created_at: row.created_at,
  }))
}

/**
 * Get MAMA status
 */
export function getStatus(): {
  initialized: boolean
  dbReady: boolean
  embeddingReady: boolean
  vectorSearchEnabled: boolean
  config: MAMAConfig
} {
  return {
    initialized,
    dbReady: initialized,
    embeddingReady: isEmbeddingReady(),
    vectorSearchEnabled: isVectorSearchEnabled(),
    config: loadConfig(),
  }
}

// ============================================================
// Export
// ============================================================

export {
  // Re-export from submodules
  loadConfig,
  getContextInjection,
  isVectorSearchEnabled,
  isEmbeddingReady,
}

// Re-export hooks
export {
  hookRegistry,
  type SessionInitResult,
  type ToolDefinition,
  addHint,
  updateHint,
  deleteHint,
  listHints,
  invalidateHintCache,
  getHintsForTool,
  type AddHintParams,
  type UpdateHintParams,
  type HintRow,
  // Post-execute (Story 11.7)
  formatActionHints,
  type ExecutionContext,
  type CADToolResult,
  type ActionHints,
} from './hooks/registry.js'

// Re-export action hints types
export type {
  NextStep,
  SaveSuggestion,
} from './types/action-hints.js'

// Re-export health metrics (Story 11.11)
export {
  calculateGraphHealth,
  formatHealthReport,
  getHealthSummary,
  type GraphHealth,
  type EdgeTypeCounts,
} from './health.js'

// Re-export anti-echo chamber (Story 11.12)
export {
  analyzeDecisionBeforeSave,
  analyzeSearchResults,
  getStaleWarning,
  type AntiEchoWarning,
  type SaveWarnings,
  type SearchWarning,
} from './anti-echo.js'

// Re-export learning tracker (Story 11.13)
export {
  saveLearning,
  markUnderstood,
  recordApplication,
  getSessionLearningHints,
  formatLearningHints,
  getAllLearnings,
  getLearningByConcept,
  type SaveLearningResult,
  type LearningHint,
} from './learning-tracker.js'

// Re-export growth tracker (Story 11.14)
export {
  recordGrowth,
  recordIndependentDecision,
  recordConceptApplied,
  recordTradeoffPredicted,
  recordTerminologyUsed,
  getGrowthSummary,
  formatGrowthReport,
  checkSkillLevelUpgrade,
  shouldTrigger30DayReport,
  findRelatedLearning,
  type RecordGrowthParams,
  type GrowthSummary,
} from './growth-tracker.js'

// Re-export design hints (Story 11.15)
export {
  generateDesignHints,
  formatDesignHints,
  detectDomain,
  recordStyleChoice,
  shouldGenerateDesignHints,
  type DesignHints,
  type DesignContext,
  type NextConcept,
  type ThinkingQuestion,
  type DesignOption,
} from './design-hints.js'

// Re-export terminology tracker (Story 11.16)
export {
  detectTermDomain,
  isVagueTerm,
  isSpecificTerm,
  extractSpecificTerms,
  recordEvolution,
  detectEvolution,
  calculateQuestionQuality,
  hasQuestionQualityImproved,
  recordQuestionQualityImprovement,
  getEvolutionsForReport,
  formatTerminologySection,
  getTerminologyStats,
  TERM_MAPPING,
  DOMAIN_KEYWORDS,
  type TerminologyEvolution,
  type QuestionQualityScore,
} from './terminology-tracker.js'

// Re-export rules utilities
export { detectEntityTypes } from './rules/index.js'
