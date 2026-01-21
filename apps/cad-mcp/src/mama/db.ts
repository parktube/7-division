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
