/**
 * CAD MAMA Database Layer
 *
 * Story 11.1: MAMA Core 4 Tools MCP 통합
 * SQLite + sqlite-vec for semantic search
 *
 * Reference: ~/MAMA/packages/claude-code-plugin/src/core/db-adapter/sqlite-adapter.js
 */

import Database from 'better-sqlite3'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { DB_PATH, ensureDataDirs, getEmbeddingDim } from './config.js'
import { logger } from '../logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ============================================================
// Types
// ============================================================

export interface DecisionRow {
  id: string
  topic: string
  decision: string
  reasoning: string | null
  outcome: string | null
  outcome_reason: string | null
  user_involvement: string | null
  session_id: string | null
  supersedes: string | null
  superseded_by: string | null
  confidence: number
  created_at: number
  updated_at: number | null
}

export interface CheckpointRow {
  id: number
  timestamp: number
  summary: string
  open_files: string | null
  next_steps: string | null
  status: string
}

export type SkillLevel = 'beginner' | 'intermediate' | 'expert'

// Understanding levels: 1=introduced, 2=understood, 3=applied, 4=mastered
export type UnderstandingLevel = 1 | 2 | 3 | 4

export interface LearningRow {
  id: string
  user_id: string
  concept: string
  domain: string | null
  understanding_level: UnderstandingLevel
  first_introduced: number
  last_applied: number | null
  applied_count: number
  user_explanation: string | null
  created_at: number
}

// Growth metric types
export type GrowthMetricType =
  | 'independent_decision'
  | 'concept_applied'
  | 'tradeoff_predicted'
  | 'terminology_used'

export interface GrowthMetricRow {
  id: number
  user_id: string
  metric_type: GrowthMetricType
  related_learning_id: string | null
  related_decision_id: string | null
  context: string | null
  created_at: number
}

export interface UserProfileRow {
  id: number
  global_skill_level: SkillLevel
  domain_skill_levels: string  // JSON
  action_counts: string  // JSON
  created_at: number
  updated_at: number
}

// ============================================================
// Database Singleton
// ============================================================

let db: Database.Database | null = null
let vectorSearchEnabled = false

/**
 * Initialize database connection
 *
 * @returns Database instance
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  // Ensure directories exist
  ensureDataDirs()

  // Open database
  db = new Database(DB_PATH, { verbose: undefined })
  logger.info(`MAMA DB opened: ${DB_PATH}`)

  // Configure for production
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -64000') // 64MB cache
  db.pragma('temp_store = MEMORY')
  db.pragma('foreign_keys = ON')

  // Load sqlite-vec extension (graceful degradation)
  try {
    // Dynamic import for sqlite-vec
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqliteVec = require('sqlite-vec')
    sqliteVec.load(db)
    vectorSearchEnabled = true
    logger.info('sqlite-vec extension loaded')
  } catch (err) {
    vectorSearchEnabled = false
    logger.warn(`sqlite-vec unavailable (Tier 2 fallback): ${err}`)
  }

  // Run migrations
  runMigrations(db)

  // Create vector table if enabled
  if (vectorSearchEnabled) {
    createVectorTable(db)
  }

  return db
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase()
  }
  return db
}

/**
 * Check if vector search is available
 */
export function isVectorSearchEnabled(): boolean {
  return vectorSearchEnabled
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    logger.info('MAMA DB closed')
  }
}

// ============================================================
// Migration System
// ============================================================

/**
 * Run database migrations
 */
function runMigrations(database: Database.Database): void {
  const migrationsDir = join(__dirname, 'migrations')

  // Check current version
  let currentVersion = 0
  try {
    const tables = database
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'`)
      .all()

    if (tables.length > 0) {
      const result = database
        .prepare('SELECT MAX(version) as version FROM schema_version')
        .get() as { version: number | null }
      currentVersion = result?.version || 0
    }
  } catch {
    currentVersion = 0
  }

  logger.info(`MAMA DB current schema version: ${currentVersion}`)

  // Get migration files
  if (!existsSync(migrationsDir)) {
    logger.warn(`Migrations directory not found: ${migrationsDir}`)
    return
  }

  const migrationFiles = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()

  // Apply migrations
  for (const file of migrationFiles) {
    const versionMatch = file.match(/^(\d+)-/)
    if (!versionMatch) continue

    const version = parseInt(versionMatch[1], 10)
    if (version <= currentVersion) continue

    const migrationPath = join(migrationsDir, file)
    const migrationSQL = readFileSync(migrationPath, 'utf8')

    logger.info(`Applying migration: ${file}`)

    try {
      database.exec('BEGIN TRANSACTION')
      database.exec(migrationSQL)
      database.exec('COMMIT')

      logger.info(`Migration ${file} applied successfully`)
    } catch (err) {
      database.exec('ROLLBACK')

      // Handle duplicate column errors (idempotent)
      if (err instanceof Error && err.message.includes('duplicate column')) {
        logger.warn(`Migration ${file} skipped (duplicate column - already applied)`)
        database
          .prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)')
          .run(version)
        continue
      }

      logger.error(`Migration ${file} failed: ${err}`)
      throw new Error(`Migration ${file} failed: ${err}`)
    }
  }
}

/**
 * Create vector search virtual table
 */
function createVectorTable(database: Database.Database): void {
  const embeddingDim = getEmbeddingDim()

  // Check if table exists
  const tables = database
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='vss_memories'`)
    .all()

  if (tables.length === 0) {
    logger.info(`Creating vss_memories virtual table (${embeddingDim}-dim)`)
    database.exec(`
      CREATE VIRTUAL TABLE vss_memories USING vec0(
        embedding float[${embeddingDim}]
      )
    `)
  }
}

// ============================================================
// Vector Operations
// ============================================================

/**
 * Insert embedding into vector table
 *
 * @param rowid - Row ID from decisions table
 * @param embedding - Embedding vector
 */
export function insertEmbedding(rowid: number, embedding: Float32Array): void {
  if (!vectorSearchEnabled || !db) {
    return
  }

  const embeddingJson = JSON.stringify(Array.from(embedding))

  // sqlite-vec requires rowid as literal (not placeholder)
  const safeRowid = Number(rowid)
  if (!Number.isInteger(safeRowid) || safeRowid < 1) {
    throw new Error(`Invalid rowid: ${rowid}`)
  }

  db.prepare(`INSERT INTO vss_memories(rowid, embedding) VALUES (${safeRowid}, ?)`).run(
    embeddingJson
  )
}

/**
 * Search similar embeddings
 *
 * @param embedding - Query embedding
 * @param limit - Maximum results
 * @returns Array of { rowid, distance }
 */
export function searchEmbeddings(
  embedding: Float32Array,
  limit = 10
): Array<{ rowid: number; distance: number }> {
  if (!vectorSearchEnabled || !db) {
    return []
  }

  const embeddingJson = JSON.stringify(Array.from(embedding))

  const results = db
    .prepare(
      `
      SELECT
        rowid,
        distance
      FROM vss_memories
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    `
    )
    .all(embeddingJson, limit) as Array<{ rowid: number; distance: number }>

  return results
}

/**
 * Get last inserted rowid
 */
export function getLastInsertRowid(): number {
  if (!db) {
    throw new Error('Database not initialized')
  }

  const result = db.prepare('SELECT last_insert_rowid() as rowid').get() as { rowid: number }
  return result.rowid
}

// ============================================================
// Edge Operations (Reasoning Graph)
// ============================================================

export interface EdgeRow {
  from_id: string
  to_id: string
  relationship: string
  created_at: number
}

/**
 * Insert an edge into decision_edges table
 *
 * @param fromId - Source decision ID
 * @param toId - Target decision ID
 * @param relationship - Edge type: 'supersedes', 'builds_on', 'debates', 'synthesizes'
 */
export function insertEdge(
  fromId: string,
  toId: string,
  relationship: 'supersedes' | 'builds_on' | 'debates' | 'synthesizes'
): void {
  if (!db) {
    throw new Error('Database not initialized')
  }

  const now = Date.now()

  try {
    db.prepare(`
      INSERT OR IGNORE INTO decision_edges (from_id, to_id, relationship, created_at)
      VALUES (?, ?, ?, ?)
    `).run(fromId, toId, relationship, now)

    logger.info(`Edge created: ${fromId} -[${relationship}]-> ${toId}`)
  } catch (error) {
    logger.error(`Failed to insert edge: ${error}`)
    throw error
  }
}

/**
 * Get edges for a decision
 *
 * @param decisionId - Decision ID
 * @returns Edges where this decision is the source
 */
export function getEdgesFrom(decisionId: string): EdgeRow[] {
  if (!db) {
    return []
  }

  return db.prepare(`
    SELECT * FROM decision_edges WHERE from_id = ?
  `).all(decisionId) as EdgeRow[]
}

/**
 * Get edges pointing to a decision
 *
 * @param decisionId - Decision ID
 * @returns Edges where this decision is the target
 */
export function getEdgesTo(decisionId: string): EdgeRow[] {
  if (!db) {
    return []
  }

  return db.prepare(`
    SELECT * FROM decision_edges WHERE to_id = ?
  `).all(decisionId) as EdgeRow[]
}

/**
 * Get edge summary for a decision
 *
 * @param decisionId - Decision ID
 * @returns Edge counts and lists
 */
export function getEdgeSummary(decisionId: string): {
  supersedes_count: number
  superseded_by: string | null
  builds_on: string[]
  debates: string[]
  synthesizes: string[]
} {
  if (!db) {
    return {
      supersedes_count: 0,
      superseded_by: null,
      builds_on: [],
      debates: [],
      synthesizes: [],
    }
  }

  const outgoing = getEdgesFrom(decisionId)
  const incoming = getEdgesTo(decisionId)

  // Find superseded_by (incoming supersedes edge)
  const supersededByEdge = incoming.find((e) => e.relationship === 'supersedes')

  return {
    supersedes_count: outgoing.filter((e) => e.relationship === 'supersedes').length,
    superseded_by: supersededByEdge?.from_id || null,
    builds_on: outgoing.filter((e) => e.relationship === 'builds_on').map((e) => e.to_id),
    debates: outgoing.filter((e) => e.relationship === 'debates').map((e) => e.to_id),
    synthesizes: outgoing.filter((e) => e.relationship === 'synthesizes').map((e) => e.to_id),
  }
}

// ============================================================
// User Profile Operations (Adaptive Mentoring)
// ============================================================

/**
 * Get user profile
 */
export function getUserProfile(): UserProfileRow {
  if (!db) {
    initDatabase()
  }

  const row = db!.prepare('SELECT * FROM user_profile WHERE id = 1').get() as UserProfileRow | undefined

  if (!row) {
    // Create default profile
    const now = Date.now()
    db!.prepare(`
      INSERT OR IGNORE INTO user_profile (id, global_skill_level, domain_skill_levels, action_counts, created_at, updated_at)
      VALUES (1, 'intermediate', '{}', '{}', ?, ?)
    `).run(now, now)

    return {
      id: 1,
      global_skill_level: 'intermediate',
      domain_skill_levels: '{}',
      action_counts: '{}',
      created_at: now,
      updated_at: now,
    }
  }

  return row
}

/**
 * Update global skill level
 */
export function setGlobalSkillLevel(level: SkillLevel): void {
  if (!db) {
    initDatabase()
  }

  const now = Date.now()
  db!.prepare(`
    UPDATE user_profile SET global_skill_level = ?, updated_at = ? WHERE id = 1
  `).run(level, now)

  logger.info(`Global skill level set to: ${level}`)
}

/**
 * Get domain skill level
 */
export function getDomainSkillLevel(domain: string): SkillLevel {
  const profile = getUserProfile()
  try {
    const levels = JSON.parse(profile.domain_skill_levels) as Record<string, SkillLevel>
    return levels[domain] || profile.global_skill_level
  } catch {
    return profile.global_skill_level
  }
}

/**
 * Update domain skill level
 */
export function setDomainSkillLevel(domain: string, level: SkillLevel): void {
  if (!db) {
    initDatabase()
  }

  const profile = getUserProfile()
  let levels: Record<string, SkillLevel>
  try {
    levels = JSON.parse(profile.domain_skill_levels)
  } catch {
    levels = {}
  }

  levels[domain] = level

  const now = Date.now()
  db!.prepare(`
    UPDATE user_profile SET domain_skill_levels = ?, updated_at = ? WHERE id = 1
  `).run(JSON.stringify(levels), now)

  logger.info(`Domain ${domain} skill level set to: ${level}`)
}

/**
 * Increment action count for adaptive mentoring
 */
export function incrementActionCount(action: string): number {
  if (!db) {
    initDatabase()
  }

  const profile = getUserProfile()
  let counts: Record<string, number>
  try {
    counts = JSON.parse(profile.action_counts)
  } catch {
    counts = {}
  }

  counts[action] = (counts[action] || 0) + 1

  const now = Date.now()
  db!.prepare(`
    UPDATE user_profile SET action_counts = ?, updated_at = ? WHERE id = 1
  `).run(JSON.stringify(counts), now)

  return counts[action]
}

/**
 * Get action count
 */
export function getActionCount(action: string): number {
  const profile = getUserProfile()
  try {
    const counts = JSON.parse(profile.action_counts) as Record<string, number>
    return counts[action] || 0
  } catch {
    return 0
  }
}

/**
 * Get all action counts
 */
export function getAllActionCounts(): Record<string, number> {
  const profile = getUserProfile()
  try {
    return JSON.parse(profile.action_counts) as Record<string, number>
  } catch {
    return {}
  }
}

// ============================================================
// Learning Operations (Learning Track)
// ============================================================

/**
 * Create or update a learning record
 *
 * @param learning - Learning data
 * @returns Created or updated learning
 */
export function upsertLearning(learning: {
  id: string
  user_id: string
  concept: string
  domain?: string
  understanding_level?: UnderstandingLevel
  user_explanation?: string
}): LearningRow {
  if (!db) {
    initDatabase()
  }

  const now = Date.now()

  // Check if learning already exists for this user/concept
  const existing = db!.prepare(`
    SELECT * FROM learnings WHERE user_id = ? AND concept = ?
  `).get(learning.user_id, learning.concept) as LearningRow | undefined

  if (existing) {
    // Update existing
    db!.prepare(`
      UPDATE learnings
      SET understanding_level = COALESCE(?, understanding_level),
          user_explanation = COALESCE(?, user_explanation),
          domain = COALESCE(?, domain)
      WHERE user_id = ? AND concept = ?
    `).run(
      learning.understanding_level,
      learning.user_explanation,
      learning.domain,
      learning.user_id,
      learning.concept
    )

    return getLearning(learning.user_id, learning.concept)!
  }

  // Insert new
  db!.prepare(`
    INSERT INTO learnings (id, user_id, concept, domain, understanding_level, first_introduced, applied_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    learning.id,
    learning.user_id,
    learning.concept,
    learning.domain || null,
    learning.understanding_level || 1,
    now,
    now
  )

  logger.info(`Learning created: ${learning.concept} for user ${learning.user_id}`)

  return getLearning(learning.user_id, learning.concept)!
}

/**
 * Get a specific learning by user and concept
 */
export function getLearning(userId: string, concept: string): LearningRow | null {
  if (!db) {
    initDatabase()
  }

  const row = db!.prepare(`
    SELECT * FROM learnings WHERE user_id = ? AND concept = ?
  `).get(userId, concept) as LearningRow | undefined

  return row || null
}

/**
 * Get learning by ID
 */
export function getLearningById(id: string): LearningRow | null {
  if (!db) {
    initDatabase()
  }

  const row = db!.prepare(`
    SELECT * FROM learnings WHERE id = ?
  `).get(id) as LearningRow | undefined

  return row || null
}

/**
 * Update understanding level
 *
 * @param userId - User ID
 * @param concept - Concept name
 * @param level - New understanding level
 */
export function updateUnderstandingLevel(
  userId: string,
  concept: string,
  level: UnderstandingLevel
): void {
  if (!db) {
    initDatabase()
  }

  db!.prepare(`
    UPDATE learnings
    SET understanding_level = ?
    WHERE user_id = ? AND concept = ?
  `).run(level, userId, concept)

  logger.info(`Learning level updated: ${concept} -> level ${level}`)
}

/**
 * Increment applied count and auto-upgrade to mastery if needed
 *
 * @param userId - User ID
 * @param concept - Concept name
 * @returns New applied count
 */
export function incrementAppliedCount(userId: string, concept: string): number {
  if (!db) {
    initDatabase()
  }

  const now = Date.now()

  // Increment count and update last_applied
  db!.prepare(`
    UPDATE learnings
    SET applied_count = applied_count + 1,
        last_applied = ?,
        understanding_level = CASE
          WHEN understanding_level < 3 THEN 3
          WHEN applied_count + 1 >= 3 THEN 4
          ELSE understanding_level
        END
    WHERE user_id = ? AND concept = ?
  `).run(now, userId, concept)

  const learning = getLearning(userId, concept)
  logger.info(`Learning applied: ${concept} (count: ${learning?.applied_count})`)

  return learning?.applied_count || 0
}

/**
 * Get all learnings for a user
 *
 * @param userId - User ID
 * @param domain - Optional domain filter
 */
export function getUserLearnings(
  userId: string,
  domain?: string
): LearningRow[] {
  if (!db) {
    initDatabase()
  }

  if (domain) {
    return db!.prepare(`
      SELECT * FROM learnings
      WHERE user_id = ? AND domain = ?
      ORDER BY last_applied DESC NULLS LAST, first_introduced DESC
    `).all(userId, domain) as LearningRow[]
  }

  return db!.prepare(`
    SELECT * FROM learnings
    WHERE user_id = ?
    ORDER BY last_applied DESC NULLS LAST, first_introduced DESC
  `).all(userId) as LearningRow[]
}

/**
 * Get learnings by minimum understanding level
 */
export function getLearningsByLevel(
  userId: string,
  minLevel: UnderstandingLevel
): LearningRow[] {
  if (!db) {
    initDatabase()
  }

  return db!.prepare(`
    SELECT * FROM learnings
    WHERE user_id = ? AND understanding_level >= ?
    ORDER BY understanding_level DESC, applied_count DESC
  `).all(userId, minLevel) as LearningRow[]
}

/**
 * Get learnings summary for session hint
 */
export function getLearningsSummary(userId: string): {
  total: number
  byLevel: Record<UnderstandingLevel, number>
  recentlyApplied: LearningRow[]
} {
  if (!db) {
    initDatabase()
  }

  const learnings = getUserLearnings(userId)

  const byLevel: Record<UnderstandingLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const l of learnings) {
    byLevel[l.understanding_level]++
  }

  // Recently applied (last 7 days, max 5)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentlyApplied = learnings
    .filter((l) => l.last_applied && l.last_applied > sevenDaysAgo)
    .slice(0, 5)

  return {
    total: learnings.length,
    byLevel,
    recentlyApplied,
  }
}

// ============================================================
// Growth Metrics Operations (User Growth Metrics)
// ============================================================

/**
 * Record a growth metric
 *
 * @param metric - Metric data
 * @returns Created metric ID
 */
export function recordGrowthMetric(metric: {
  user_id: string
  metric_type: GrowthMetricType
  related_learning_id?: string
  related_decision_id?: string
  context?: string
}): number {
  if (!db) {
    initDatabase()
  }

  const now = Date.now()

  const result = db!.prepare(`
    INSERT INTO growth_metrics (user_id, metric_type, related_learning_id, related_decision_id, context, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    metric.user_id,
    metric.metric_type,
    metric.related_learning_id || null,
    metric.related_decision_id || null,
    metric.context || null,
    now
  )

  logger.info(`Growth metric recorded: ${metric.metric_type} for user ${metric.user_id}`)

  return result.lastInsertRowid as number
}

/**
 * Get growth metrics for a user
 *
 * @param userId - User ID
 * @param periodDays - Period in days (default: 30)
 * @param metricType - Optional metric type filter
 */
export function getGrowthMetrics(
  userId: string,
  periodDays = 30,
  metricType?: GrowthMetricType
): GrowthMetricRow[] {
  if (!db) {
    initDatabase()
  }

  const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000

  if (metricType) {
    return db!.prepare(`
      SELECT * FROM growth_metrics
      WHERE user_id = ? AND metric_type = ? AND created_at > ?
      ORDER BY created_at DESC
    `).all(userId, metricType, cutoff) as GrowthMetricRow[]
  }

  return db!.prepare(`
    SELECT * FROM growth_metrics
    WHERE user_id = ? AND created_at > ?
    ORDER BY created_at DESC
  `).all(userId, cutoff) as GrowthMetricRow[]
}

/**
 * Count growth metrics by type for a user
 *
 * @param userId - User ID
 * @param periodDays - Period in days (default: 30)
 */
export function countGrowthMetricsByType(
  userId: string,
  periodDays = 30
): Record<GrowthMetricType, number> {
  if (!db) {
    initDatabase()
  }

  const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000

  const rows = db!.prepare(`
    SELECT metric_type, COUNT(*) as count
    FROM growth_metrics
    WHERE user_id = ? AND created_at > ?
    GROUP BY metric_type
  `).all(userId, cutoff) as Array<{ metric_type: GrowthMetricType; count: number }>

  const counts: Record<GrowthMetricType, number> = {
    independent_decision: 0,
    concept_applied: 0,
    tradeoff_predicted: 0,
    terminology_used: 0,
  }

  for (const row of rows) {
    counts[row.metric_type] = row.count
  }

  return counts
}

/**
 * Get first activity timestamp for a user
 */
export function getFirstActivityTimestamp(userId: string): number | null {
  if (!db) {
    initDatabase()
  }

  const result = db!.prepare(`
    SELECT MIN(created_at) as first_activity
    FROM growth_metrics
    WHERE user_id = ?
  `).get(userId) as { first_activity: number | null } | undefined

  return result?.first_activity || null
}

/**
 * Calculate independent decision ratio
 * Compares first half vs second half of the period
 *
 * @param userId - User ID
 * @param periodDays - Period in days
 * @returns { firstHalf: number, secondHalf: number } percentages
 */
export function calculateIndependentRatio(
  userId: string,
  periodDays = 30
): { firstHalf: number; secondHalf: number; hasEnoughData: boolean } {
  if (!db) {
    initDatabase()
  }

  const now = Date.now()
  const midpoint = now - (periodDays / 2) * 24 * 60 * 60 * 1000
  const start = now - periodDays * 24 * 60 * 60 * 1000

  // Get totals and independent counts for each half
  const firstHalfTotal = db!.prepare(`
    SELECT COUNT(*) as count FROM growth_metrics
    WHERE user_id = ? AND created_at BETWEEN ? AND ?
  `).get(userId, start, midpoint) as { count: number }

  const firstHalfIndependent = db!.prepare(`
    SELECT COUNT(*) as count FROM growth_metrics
    WHERE user_id = ? AND metric_type = 'independent_decision' AND created_at BETWEEN ? AND ?
  `).get(userId, start, midpoint) as { count: number }

  const secondHalfTotal = db!.prepare(`
    SELECT COUNT(*) as count FROM growth_metrics
    WHERE user_id = ? AND created_at BETWEEN ? AND ?
  `).get(userId, midpoint, now) as { count: number }

  const secondHalfIndependent = db!.prepare(`
    SELECT COUNT(*) as count FROM growth_metrics
    WHERE user_id = ? AND metric_type = 'independent_decision' AND created_at BETWEEN ? AND ?
  `).get(userId, midpoint, now) as { count: number }

  const firstHalfRatio = firstHalfTotal.count > 0
    ? Math.round((firstHalfIndependent.count / firstHalfTotal.count) * 100)
    : 0

  const secondHalfRatio = secondHalfTotal.count > 0
    ? Math.round((secondHalfIndependent.count / secondHalfTotal.count) * 100)
    : 0

  // Need at least 5 metrics in each half for meaningful comparison
  const hasEnoughData = firstHalfTotal.count >= 5 && secondHalfTotal.count >= 5

  return {
    firstHalf: firstHalfRatio,
    secondHalf: secondHalfRatio,
    hasEnoughData,
  }
}
