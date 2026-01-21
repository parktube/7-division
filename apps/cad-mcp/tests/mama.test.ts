/**
 * MAMA Module Integration Tests
 *
 * Story 11.1: MAMA Core 4 Tools MCP 통합
 *
 * Note: These tests use real DB operations with temp directory.
 * Mocking is minimal to avoid hoisting issues.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir, homedir } from 'os'
import Database from 'better-sqlite3'

// Test paths - use actual MAMA paths but backup/restore
const CAD_DATA_DIR = join(homedir(), '.ai-native-cad')
const MAMA_DATA_DIR = join(CAD_DATA_DIR, 'data')
const DB_PATH = join(MAMA_DATA_DIR, 'mama.db')
const BACKUP_PATH = join(MAMA_DATA_DIR, 'mama.db.backup')

describe('MAMA Database Operations', () => {
  let db: Database.Database
  let testDbPath: string

  beforeAll(() => {
    // Create temp test DB
    const testDir = join(tmpdir(), 'mama-test-' + Date.now())
    mkdirSync(testDir, { recursive: true })
    testDbPath = join(testDir, 'test-mama.db')

    // Initialize test DB with schema
    db = new Database(testDbPath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        decision TEXT NOT NULL,
        reasoning TEXT,
        outcome TEXT,
        outcome_reason TEXT,
        user_involvement TEXT,
        session_id TEXT,
        supersedes TEXT,
        superseded_by TEXT,
        confidence REAL DEFAULT 0.5,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        CHECK (confidence >= 0.0 AND confidence <= 1.0),
        CHECK (outcome IN ('SUCCESS', 'FAILED', 'PARTIAL') OR outcome IS NULL)
      );

      CREATE TABLE IF NOT EXISTS checkpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        summary TEXT NOT NULL,
        open_files TEXT,
        next_steps TEXT,
        status TEXT DEFAULT 'active',
        CHECK (status IN ('active', 'archived'))
      );
    `)
  })

  afterAll(() => {
    if (db) {
      db.close()
    }
    // Cleanup test DB
    if (testDbPath && existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true })
    }
  })

  describe('Decision CRUD', () => {
    it('should insert a decision', () => {
      const id = `decision_test_${Date.now()}`
      const now = Date.now()

      db.prepare(`
        INSERT INTO decisions (id, topic, decision, reasoning, confidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, 'test_topic', 'Use TypeScript', 'Type safety', 0.9, now)

      const row = db.prepare('SELECT * FROM decisions WHERE id = ?').get(id) as Record<string, unknown>
      expect(row).toBeDefined()
      expect(row.topic).toBe('test_topic')
      expect(row.decision).toBe('Use TypeScript')
      expect(row.confidence).toBe(0.9)
    })

    it('should update decision outcome', () => {
      const id = `decision_outcome_${Date.now()}`
      const now = Date.now()

      db.prepare(`
        INSERT INTO decisions (id, topic, decision, reasoning, confidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, 'outcome_test', 'Test Decision', 'Test Reason', 0.5, now)

      db.prepare(`
        UPDATE decisions SET outcome = ?, outcome_reason = ?, updated_at = ?
        WHERE id = ?
      `).run('SUCCESS', 'It worked', now, id)

      const row = db.prepare('SELECT * FROM decisions WHERE id = ?').get(id) as Record<string, unknown>
      expect(row.outcome).toBe('SUCCESS')
      expect(row.outcome_reason).toBe('It worked')
    })

    it('should handle supersedes chain', () => {
      const now = Date.now()
      const id1 = `decision_chain_1_${now}`
      const id2 = `decision_chain_2_${now}`

      // First decision
      db.prepare(`
        INSERT INTO decisions (id, topic, decision, reasoning, confidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id1, 'chain_topic', 'First choice', 'Initial', 0.5, now)

      // Second decision supersedes first
      db.prepare(`
        INSERT INTO decisions (id, topic, decision, reasoning, confidence, supersedes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id2, 'chain_topic', 'Better choice', 'Improved', 0.8, id1, now + 1)

      // Update first decision's superseded_by
      db.prepare(`
        UPDATE decisions SET superseded_by = ? WHERE id = ?
      `).run(id2, id1)

      const first = db.prepare('SELECT * FROM decisions WHERE id = ?').get(id1) as Record<string, unknown>
      const second = db.prepare('SELECT * FROM decisions WHERE id = ?').get(id2) as Record<string, unknown>

      expect(first.superseded_by).toBe(id2)
      expect(second.supersedes).toBe(id1)
    })

    it('should search by keyword', () => {
      const now = Date.now()

      db.prepare(`
        INSERT INTO decisions (id, topic, decision, reasoning, confidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`decision_search_${now}`, 'auth_strategy', 'JWT tokens', 'Scalable auth', 0.9, now)

      const rows = db.prepare(`
        SELECT * FROM decisions
        WHERE topic LIKE ? OR decision LIKE ? OR reasoning LIKE ?
        ORDER BY created_at DESC
      `).all('%auth%', '%auth%', '%auth%') as Record<string, unknown>[]

      expect(rows.length).toBeGreaterThanOrEqual(1)
      expect(rows.some(r => r.topic === 'auth_strategy')).toBe(true)
    })
  })

  describe('Checkpoint CRUD', () => {
    it('should insert a checkpoint', () => {
      const now = Date.now()

      const result = db.prepare(`
        INSERT INTO checkpoints (timestamp, summary, open_files, next_steps, status)
        VALUES (?, ?, ?, ?, 'active')
      `).run(now, 'Test session', '["file1.ts"]', 'Continue testing')

      expect(result.lastInsertRowid).toBeGreaterThan(0)

      const row = db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>
      expect(row.summary).toBe('Test session')
    })

    it('should archive old checkpoints', () => {
      const now = Date.now()

      // Insert first checkpoint
      db.prepare(`
        INSERT INTO checkpoints (timestamp, summary, status)
        VALUES (?, ?, 'active')
      `).run(now, 'First checkpoint')

      // Archive all active
      db.prepare(`
        UPDATE checkpoints SET status = 'archived' WHERE status = 'active'
      `).run()

      // Insert new active
      const result = db.prepare(`
        INSERT INTO checkpoints (timestamp, summary, status)
        VALUES (?, ?, 'active')
      `).run(now + 1, 'Second checkpoint')

      // Should only get latest active
      const active = db.prepare(`
        SELECT * FROM checkpoints WHERE status = 'active' ORDER BY timestamp DESC LIMIT 1
      `).get() as Record<string, unknown>

      expect(active.summary).toBe('Second checkpoint')
    })

    it('should load latest checkpoint', () => {
      // Clear existing
      db.prepare('DELETE FROM checkpoints').run()

      const now = Date.now()
      db.prepare(`
        INSERT INTO checkpoints (timestamp, summary, open_files, next_steps, status)
        VALUES (?, ?, ?, ?, 'active')
      `).run(now, 'Latest work', '["src/mama/index.ts"]', 'Write more tests')

      const latest = db.prepare(`
        SELECT * FROM checkpoints WHERE status = 'active' ORDER BY timestamp DESC LIMIT 1
      `).get() as Record<string, unknown>

      expect(latest).toBeDefined()
      expect(latest.summary).toBe('Latest work')
      expect(JSON.parse(latest.open_files as string)).toEqual(['src/mama/index.ts'])
    })
  })
})

describe('MAMA Tool Schemas', () => {
  it('should export MAMA tools', async () => {
    const { MAMA_TOOLS } = await import('../src/mama/tools/schema.js')

    expect(MAMA_TOOLS).toBeDefined()
    expect(MAMA_TOOLS.mama_save).toBeDefined()
    expect(MAMA_TOOLS.mama_search).toBeDefined()
    expect(MAMA_TOOLS.mama_update).toBeDefined()
    expect(MAMA_TOOLS.mama_load_checkpoint).toBeDefined()
    expect(MAMA_TOOLS.mama_configure).toBeDefined()
  })

  it('should have correct tool structure', async () => {
    const { MAMA_TOOLS } = await import('../src/mama/tools/schema.js')

    const tool = MAMA_TOOLS.mama_save
    expect(tool.name).toBe('mama_save')
    expect(tool.description).toContain('decision')
    expect(tool.parameters.type).toBe('object')
    expect(tool.parameters.properties.type).toBeDefined()
  })
})
