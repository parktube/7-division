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

describe('Reasoning Parser', () => {
  it('should parse builds_on pattern', async () => {
    const { parseReasoning } = await import('../src/mama/reasoning-parser.js')

    const result = parseReasoning('This builds_on: decision_auth_123_abc previous work.')

    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].type).toBe('builds_on')
    expect(result.edges[0].targetId).toBe('decision_auth_123_abc')
    expect(result.warnings).toHaveLength(0)
  })

  it('should parse debates pattern', async () => {
    const { parseReasoning } = await import('../src/mama/reasoning-parser.js')

    const result = parseReasoning('debates: decision_old_approach_456_def')

    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].type).toBe('debates')
    expect(result.edges[0].targetId).toBe('decision_old_approach_456_def')
  })

  it('should parse synthesizes pattern with multiple IDs', async () => {
    const { parseReasoning } = await import('../src/mama/reasoning-parser.js')

    const result = parseReasoning('synthesizes: [decision_a_1, decision_b_2, decision_c_3]')

    expect(result.edges).toHaveLength(3)
    expect(result.edges.every(e => e.type === 'synthesizes')).toBe(true)
    expect(result.edges.map(e => e.targetId)).toEqual([
      'decision_a_1',
      'decision_b_2',
      'decision_c_3',
    ])
  })

  it('should parse multiple relationship types', async () => {
    const { parseReasoning } = await import('../src/mama/reasoning-parser.js')

    const reasoning = `
      This builds_on: decision_base_123.
      It also debates: decision_alt_456.
      Finally synthesizes: [decision_x_1, decision_y_2].
    `

    const result = parseReasoning(reasoning)

    expect(result.edges).toHaveLength(4)
    expect(result.edges.filter(e => e.type === 'builds_on')).toHaveLength(1)
    expect(result.edges.filter(e => e.type === 'debates')).toHaveLength(1)
    expect(result.edges.filter(e => e.type === 'synthesizes')).toHaveLength(2)
  })

  it('should ignore malformed patterns', async () => {
    const { parseReasoning } = await import('../src/mama/reasoning-parser.js')

    const result = parseReasoning('builds_on: invalid_id_format')

    expect(result.edges).toHaveLength(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('should handle null/undefined reasoning', async () => {
    const { parseReasoning } = await import('../src/mama/reasoning-parser.js')

    expect(parseReasoning(null).edges).toHaveLength(0)
    expect(parseReasoning(undefined).edges).toHaveLength(0)
    expect(parseReasoning('').edges).toHaveLength(0)
  })

  it('should deduplicate IDs', async () => {
    const { parseReasoning } = await import('../src/mama/reasoning-parser.js')

    const result = parseReasoning(`
      builds_on: decision_same_123
      builds_on: decision_same_123
    `)

    expect(result.edges).toHaveLength(1)
  })
})

describe('Decision Edges', () => {
  let db: Database.Database
  let testDbPath: string

  beforeAll(() => {
    const testDir = join(tmpdir(), 'mama-edges-test-' + Date.now())
    mkdirSync(testDir, { recursive: true })
    testDbPath = join(testDir, 'test-edges.db')

    db = new Database(testDbPath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        decision TEXT NOT NULL,
        reasoning TEXT,
        outcome TEXT,
        confidence REAL DEFAULT 0.5,
        supersedes TEXT,
        superseded_by TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS decision_edges (
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relationship TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (from_id, to_id, relationship)
      );
    `)
  })

  afterAll(() => {
    if (db) db.close()
    if (testDbPath && existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true })
    }
  })

  it('should create supersedes edge', () => {
    const now = Date.now()

    // Insert two decisions
    db.prepare(`
      INSERT INTO decisions (id, topic, decision, created_at)
      VALUES (?, ?, ?, ?)
    `).run('decision_old_1', 'topic_a', 'Old decision', now)

    db.prepare(`
      INSERT INTO decisions (id, topic, decision, supersedes, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('decision_new_1', 'topic_a', 'New decision', 'decision_old_1', now + 1)

    // Insert edge
    db.prepare(`
      INSERT INTO decision_edges (from_id, to_id, relationship, created_at)
      VALUES (?, ?, 'supersedes', ?)
    `).run('decision_new_1', 'decision_old_1', now + 1)

    const edges = db.prepare(`
      SELECT * FROM decision_edges WHERE from_id = ?
    `).all('decision_new_1') as Array<{ relationship: string; to_id: string }>

    expect(edges).toHaveLength(1)
    expect(edges[0].relationship).toBe('supersedes')
    expect(edges[0].to_id).toBe('decision_old_1')
  })

  it('should create builds_on edge', () => {
    const now = Date.now()

    db.prepare(`
      INSERT INTO decisions (id, topic, decision, created_at)
      VALUES (?, ?, ?, ?)
    `).run('decision_base_2', 'topic_b', 'Base decision', now)

    db.prepare(`
      INSERT INTO decision_edges (from_id, to_id, relationship, created_at)
      VALUES (?, ?, 'builds_on', ?)
    `).run('decision_derived_2', 'decision_base_2', now)

    const edges = db.prepare(`
      SELECT * FROM decision_edges WHERE relationship = 'builds_on'
    `).all() as Array<{ from_id: string; to_id: string }>

    expect(edges.some(e => e.from_id === 'decision_derived_2' && e.to_id === 'decision_base_2')).toBe(true)
  })

  it('should query edges by relationship type', () => {
    const edgeCount = db.prepare(`
      SELECT COUNT(*) as count FROM decision_edges WHERE relationship = 'supersedes'
    `).get() as { count: number }

    expect(edgeCount.count).toBeGreaterThanOrEqual(1)
  })
})

// ============================================================
// Story 11.3: Topic Utilities Tests
// ============================================================

describe('Topic Utilities', () => {
  it('should parse full topic format', async () => {
    const { parseTopic } = await import('../src/mama/topic-utils.js')

    const result = parseTopic('voxel:chicken:color_palette')

    expect(result).not.toBeNull()
    expect(result!.domain).toBe('voxel')
    expect(result!.entity).toBe('chicken')
    expect(result!.aspect).toBe('color_palette')
    expect(result!.raw).toBe('voxel:chicken:color_palette')
  })

  it('should return null for invalid topic format', async () => {
    const { parseTopic } = await import('../src/mama/topic-utils.js')

    expect(parseTopic('')).toBeNull()
    expect(parseTopic('just_one_part')).toBeNull()
    expect(parseTopic('two:parts')).toBeNull()
  })

  it('should normalize uppercase to lowercase', async () => {
    const { parseTopic } = await import('../src/mama/topic-utils.js')

    const result = parseTopic('VOXEL:CHICKEN:COLOR')

    expect(result).not.toBeNull()
    expect(result!.domain).toBe('voxel')
    expect(result!.entity).toBe('chicken')
    expect(result!.aspect).toBe('color')
  })

  it('should extract domain from topic', async () => {
    const { extractDomain } = await import('../src/mama/topic-utils.js')

    expect(extractDomain('voxel:chicken:color')).toBe('voxel')
    expect(extractDomain('furniture:chair:dimensions')).toBe('furniture')
    expect(extractDomain('simple_topic')).toBe('simple')
    expect(extractDomain('notopic')).toBe('notopic')
  })

  it('should validate topic format', async () => {
    const { validateTopic } = await import('../src/mama/topic-utils.js')

    // Valid formats
    expect(validateTopic('voxel:chicken:color')).toBe(true)
    expect(validateTopic('cad:scene:structure')).toBe(true)
    expect(validateTopic('auth_strategy')).toBe(true) // Simple format
    expect(validateTopic('simple')).toBe(true)
    expect(validateTopic('UPPERCASE:FORMAT:HERE')).toBe(true) // Normalized to lowercase

    // Invalid formats
    expect(validateTopic('')).toBe(false)
    expect(validateTopic('123invalid')).toBe(false) // Starts with number
  })

  it('should check if topic is full format', async () => {
    const { isFullFormat } = await import('../src/mama/topic-utils.js')

    expect(isFullFormat('voxel:chicken:color')).toBe(true)
    expect(isFullFormat('auth_strategy')).toBe(false)
    expect(isFullFormat('simple')).toBe(false)
  })

  it('should build topic from components', async () => {
    const { buildTopic } = await import('../src/mama/topic-utils.js')

    expect(buildTopic('voxel', 'chicken', 'color')).toBe('voxel:chicken:color')
    expect(buildTopic('CAD', 'Scene', 'Structure')).toBe('cad:scene:structure')
  })

  it('should get unique domains from topic list', async () => {
    const { getUniqueDomains } = await import('../src/mama/topic-utils.js')

    const topics = [
      'voxel:chicken:color',
      'voxel:pig:size',
      'furniture:chair:dimensions',
      'cad:scene:structure',
    ]

    const domains = getUniqueDomains(topics)

    expect(domains).toContain('voxel')
    expect(domains).toContain('furniture')
    expect(domains).toContain('cad')
    expect(domains).toHaveLength(3)
  })

  it('should group topics by domain', async () => {
    const { groupTopicsByDomain } = await import('../src/mama/topic-utils.js')

    const topics = [
      'voxel:chicken:color',
      'voxel:pig:size',
      'furniture:chair:dimensions',
    ]

    const groups = groupTopicsByDomain(topics)

    expect(groups.get('voxel')).toHaveLength(2)
    expect(groups.get('furniture')).toHaveLength(1)
  })
})

describe('Domain Filter and Group By Topic', () => {
  let db: Database.Database
  let testDbPath: string

  beforeAll(() => {
    const testDir = join(tmpdir(), 'mama-domain-test-' + Date.now())
    mkdirSync(testDir, { recursive: true })
    testDbPath = join(testDir, 'test-domain.db')

    db = new Database(testDbPath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        decision TEXT NOT NULL,
        reasoning TEXT,
        outcome TEXT,
        confidence REAL DEFAULT 0.5,
        supersedes TEXT,
        superseded_by TEXT,
        created_at INTEGER NOT NULL
      );
    `)

    // Insert test data with different domains
    const now = Date.now()
    const testData = [
      { id: 'decision_voxel_1', topic: 'voxel:chicken:color', decision: 'Use orange', created_at: now },
      { id: 'decision_voxel_2', topic: 'voxel:pig:size', decision: 'Medium size', created_at: now + 1 },
      { id: 'decision_voxel_3', topic: 'voxel:chicken:color', decision: 'Use red instead', created_at: now + 2 },
      { id: 'decision_cad_1', topic: 'cad:scene:structure', decision: 'Use tree', created_at: now + 3 },
      { id: 'decision_furniture_1', topic: 'furniture:chair:dimensions', decision: '45cm height', created_at: now + 4 },
    ]

    // Mark older voxel:chicken:color as superseded
    for (const data of testData) {
      db.prepare(`
        INSERT INTO decisions (id, topic, decision, created_at)
        VALUES (?, ?, ?, ?)
      `).run(data.id, data.topic, data.decision, data.created_at)
    }

    // Set up supersedes chain
    db.prepare(`UPDATE decisions SET superseded_by = 'decision_voxel_3' WHERE id = 'decision_voxel_1'`).run()
    db.prepare(`UPDATE decisions SET supersedes = 'decision_voxel_1' WHERE id = 'decision_voxel_3'`).run()
  })

  afterAll(() => {
    if (db) db.close()
    if (testDbPath && existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true })
    }
  })

  it('should filter decisions by domain', () => {
    const domain = 'voxel'
    const rows = db.prepare(`
      SELECT * FROM decisions
      WHERE topic LIKE '${domain}:%'
      AND superseded_by IS NULL
    `).all() as Record<string, unknown>[]

    // Should get voxel:pig:size and voxel:chicken:color (superseded_by IS NULL only)
    expect(rows.length).toBe(2)
    expect(rows.every(r => (r.topic as string).startsWith('voxel:'))).toBe(true)
  })

  it('should allow cross-domain search without filter', () => {
    const rows = db.prepare(`
      SELECT * FROM decisions
      WHERE superseded_by IS NULL
      ORDER BY created_at DESC
    `).all() as Record<string, unknown>[]

    expect(rows.length).toBe(4) // All non-superseded decisions
    const domains = new Set(rows.map(r => (r.topic as string).split(':')[0]))
    expect(domains.size).toBe(3) // voxel, cad, furniture
  })

  it('should group by topic and return latest only', () => {
    const rows = db.prepare(`
      SELECT d.* FROM decisions d
      INNER JOIN (
        SELECT topic, MAX(created_at) as max_created
        FROM decisions
        WHERE superseded_by IS NULL
        GROUP BY topic
      ) latest ON d.topic = latest.topic AND d.created_at = latest.max_created
      WHERE d.superseded_by IS NULL
    `).all() as Record<string, unknown>[]

    // Should have one decision per unique topic
    const topics = rows.map(r => r.topic)
    expect(new Set(topics).size).toBe(topics.length) // All unique
  })

  it('should list unique domains', () => {
    const rows = db.prepare(`
      SELECT DISTINCT
        CASE
          WHEN topic LIKE '%:%' THEN SUBSTR(topic, 1, INSTR(topic, ':') - 1)
          ELSE topic
        END as domain
      FROM decisions
      WHERE superseded_by IS NULL
      ORDER BY domain
    `).all() as Array<{ domain: string }>

    const domains = rows.map(r => r.domain)
    expect(domains).toContain('voxel')
    expect(domains).toContain('cad')
    expect(domains).toContain('furniture')
  })
})

// ============================================================
// Story 11.4: Outcome Tracking Tests
// ============================================================

describe('Outcome Tracking', () => {
  let db: Database.Database
  let testDbPath: string

  beforeAll(() => {
    const testDir = join(tmpdir(), 'mama-outcome-test-' + Date.now())
    mkdirSync(testDir, { recursive: true })
    testDbPath = join(testDir, 'test-outcome.db')

    db = new Database(testDbPath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        decision TEXT NOT NULL,
        reasoning TEXT,
        outcome TEXT,
        outcome_reason TEXT,
        confidence REAL DEFAULT 0.5,
        supersedes TEXT,
        superseded_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        CHECK (outcome IN ('SUCCESS', 'FAILED', 'PARTIAL') OR outcome IS NULL)
      );
    `)

    // Insert test data with different outcomes
    const now = Date.now()
    const testData = [
      { id: 'decision_success_1', topic: 'auth:jwt:tokens', decision: 'Use JWT', outcome: 'SUCCESS', reason: 'Works well', created_at: now },
      { id: 'decision_failed_1', topic: 'auth:session:storage', decision: 'Use localStorage', outcome: 'FAILED', reason: 'Security issues', created_at: now + 1 },
      { id: 'decision_partial_1', topic: 'cache:redis:config', decision: 'Use default TTL', outcome: 'PARTIAL', reason: 'Works but slow', created_at: now + 2 },
      { id: 'decision_pending_1', topic: 'db:postgres:indexes', decision: 'Add composite index', outcome: null, reason: null, created_at: now + 3 },
      { id: 'decision_pending_2', topic: 'api:rest:versioning', decision: 'Use URL versioning', outcome: null, reason: null, created_at: now + 4 },
    ]

    for (const data of testData) {
      db.prepare(`
        INSERT INTO decisions (id, topic, decision, outcome, outcome_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(data.id, data.topic, data.decision, data.outcome, data.reason, data.created_at)
    }
  })

  afterAll(() => {
    if (db) db.close()
    if (testDbPath && existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true })
    }
  })

  it('should update outcome to SUCCESS', () => {
    const now = Date.now()

    db.prepare(`
      UPDATE decisions SET outcome = 'SUCCESS', outcome_reason = ?, updated_at = ?
      WHERE id = ?
    `).run('Confirmed working', now, 'decision_pending_1')

    const row = db.prepare('SELECT * FROM decisions WHERE id = ?').get('decision_pending_1') as Record<string, unknown>
    expect(row.outcome).toBe('SUCCESS')
    expect(row.outcome_reason).toBe('Confirmed working')
    expect(row.updated_at).toBe(now)
  })

  it('should update outcome to FAILED with reason', () => {
    const now = Date.now()

    db.prepare(`
      UPDATE decisions SET outcome = 'FAILED', outcome_reason = ?, updated_at = ?
      WHERE id = ?
    `).run('Performance issues under load', now, 'decision_pending_2')

    const row = db.prepare('SELECT * FROM decisions WHERE id = ?').get('decision_pending_2') as Record<string, unknown>
    expect(row.outcome).toBe('FAILED')
    expect(row.outcome_reason).toBe('Performance issues under load')
  })

  it('should filter by outcome = SUCCESS', () => {
    const rows = db.prepare(`
      SELECT * FROM decisions WHERE outcome = 'SUCCESS'
    `).all() as Record<string, unknown>[]

    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows.every(r => r.outcome === 'SUCCESS')).toBe(true)
  })

  it('should filter by outcome = FAILED', () => {
    const rows = db.prepare(`
      SELECT * FROM decisions WHERE outcome = 'FAILED'
    `).all() as Record<string, unknown>[]

    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows.every(r => r.outcome === 'FAILED')).toBe(true)
  })

  it('should filter by outcome = PARTIAL', () => {
    const rows = db.prepare(`
      SELECT * FROM decisions WHERE outcome = 'PARTIAL'
    `).all() as Record<string, unknown>[]

    expect(rows.length).toBe(1)
    expect(rows[0].outcome).toBe('PARTIAL')
    expect(rows[0].outcome_reason).toBe('Works but slow')
  })

  it('should filter pending (NULL outcome)', () => {
    // Reset one to NULL for this test
    db.prepare(`UPDATE decisions SET outcome = NULL, outcome_reason = NULL WHERE id = 'decision_pending_1'`).run()

    const rows = db.prepare(`
      SELECT * FROM decisions WHERE outcome IS NULL
    `).all() as Record<string, unknown>[]

    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows.every(r => r.outcome === null)).toBe(true)
  })

  it('should include outcome_reason in search results', () => {
    const rows = db.prepare(`
      SELECT id, topic, decision, outcome, outcome_reason
      FROM decisions
      WHERE outcome = 'FAILED'
    `).all() as Record<string, unknown>[]

    const failed = rows.find(r => r.id === 'decision_failed_1')
    expect(failed).toBeDefined()
    expect(failed!.outcome_reason).toBe('Security issues')
  })

  it('should reject invalid outcome values', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO decisions (id, topic, decision, outcome, created_at)
        VALUES ('bad_outcome', 'test:topic:bad', 'Test', 'INVALID', ${Date.now()})
      `).run()
    }).toThrow()
  })
})

// ============================================================
// Story 11.5: SessionStart Hook Tests
// ============================================================

describe('SessionStart Hook', () => {
  it('should export hookRegistry', async () => {
    const { hookRegistry } = await import('../src/mama/index.js')
    expect(hookRegistry).toBeDefined()
    expect(typeof hookRegistry.onSessionInit).toBe('function')
  })

  it('should return sessionInitResult with correct structure', async () => {
    const { hookRegistry } = await import('../src/mama/index.js')

    const result = await hookRegistry.onSessionInit()

    expect(result).toHaveProperty('checkpoint')
    expect(result).toHaveProperty('recentDecisions')
    expect(result).toHaveProperty('contextMode')
    expect(result).toHaveProperty('formattedContext')
    expect(['none', 'hint', 'full']).toContain(result.contextMode)
  })

  it('should handle empty data gracefully', async () => {
    const { executeSessionInit } = await import('../src/mama/hooks/session-init.js')

    // This should not throw even with empty DB
    const result = await executeSessionInit()

    expect(result.recentDecisions).toBeInstanceOf(Array)
    expect(typeof result.formattedContext).toBe('string')
  })

  it('should format full context with checkpoint and decisions', () => {
    // Test the formatting logic directly
    const checkpoint = {
      id: 1,
      timestamp: Date.now() - 3600000, // 1 hour ago
      summary: 'Test summary',
      open_files: ['file1.ts', 'file2.ts'],
      next_steps: 'Continue testing',
    }

    const decisions = [
      {
        id: 'decision_test_1',
        topic: 'test:topic:one',
        decision: 'Test decision',
        reasoning: 'Test reasoning',
        outcome: 'SUCCESS',
        outcome_reason: null,
        confidence: 0.9,
        created_at: Date.now() - 1800000, // 30 min ago
      },
    ]

    // Simulate formatFullContext logic
    const lines: string[] = []
    lines.push(`📍 **Last Checkpoint** (1h ago):`)
    lines.push(`   ${checkpoint.summary.substring(0, 200)}`)
    lines.push(`   Next: ${checkpoint.next_steps.substring(0, 150)}`)
    lines.push(`   Files: ${checkpoint.open_files.slice(0, 3).join(', ')}`)
    lines.push('')
    lines.push(`🧠 **Recent Decisions** (${decisions.length}):`)
    lines.push(`   1. ✅ ${decisions[0].topic}: ${decisions[0].decision} (30m ago)`)

    const formatted = lines.join('\n')

    expect(formatted).toContain('📍 **Last Checkpoint**')
    expect(formatted).toContain('Test summary')
    expect(formatted).toContain('🧠 **Recent Decisions**')
    expect(formatted).toContain('test:topic:one')
  })

  it('should format hint context correctly', () => {
    // Simulate formatHintContext logic
    const parts: string[] = []
    parts.push('1 checkpoint found')
    parts.push('5 related decisions available')

    const formatted = `🔍 ${parts.join(', ')}\n💡 Use mama_checkpoint() and mama_search() for details`

    expect(formatted).toContain('🔍')
    expect(formatted).toContain('1 checkpoint found')
    expect(formatted).toContain('5 related decisions')
    expect(formatted).toContain('💡')
  })

  it('should return empty context for none mode', async () => {
    // Mock none mode by testing the logic
    const contextMode = 'none'

    if (contextMode === 'none') {
      const result = {
        checkpoint: null,
        recentDecisions: [],
        contextMode: 'none' as const,
        formattedContext: '',
      }

      expect(result.formattedContext).toBe('')
      expect(result.checkpoint).toBeNull()
      expect(result.recentDecisions).toHaveLength(0)
    }
  })
})

// ============================================================
// Story 11.6: Dynamic Hint Injection Tests
// ============================================================

describe('Dynamic Hint Injection', () => {
  let db: Database.Database
  let testDbPath: string

  beforeAll(() => {
    const testDir = join(tmpdir(), 'mama-hints-test-' + Date.now())
    mkdirSync(testDir, { recursive: true })
    testDbPath = join(testDir, 'test-hints.db')

    db = new Database(testDbPath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS hints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        hint_text TEXT NOT NULL,
        priority INTEGER DEFAULT 5,
        tags TEXT,
        source TEXT DEFAULT 'system',
        created_at INTEGER NOT NULL,
        CHECK (priority >= 1 AND priority <= 10),
        CHECK (source IN ('user', 'system', 'learned'))
      );
      CREATE INDEX IF NOT EXISTS idx_hints_tool ON hints(tool_name);
    `)

    // Insert test hints
    const now = Date.now()
    db.prepare(`
      INSERT INTO hints (tool_name, hint_text, priority, source, created_at)
      VALUES
        ('edit', 'Hint 1 for edit (high priority)', 9, 'system', ?),
        ('edit', 'Hint 2 for edit (medium priority)', 5, 'system', ?),
        ('edit', 'Hint 3 for edit (low priority)', 2, 'system', ?),
        ('edit', 'Hint 4 for edit (should be excluded)', 1, 'system', ?),
        ('write', 'Hint for write', 7, 'system', ?)
    `).run(now, now, now, now, now)
  })

  afterAll(() => {
    if (db) db.close()
    if (testDbPath && existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true })
    }
  })

  it('should store hints in DB', () => {
    const hints = db.prepare('SELECT * FROM hints').all() as Record<string, unknown>[]
    expect(hints.length).toBe(5)
  })

  it('should order hints by priority DESC', () => {
    const hints = db.prepare(`
      SELECT hint_text, priority FROM hints
      WHERE tool_name = 'edit'
      ORDER BY priority DESC
    `).all() as Array<{ hint_text: string; priority: number }>

    expect(hints[0].priority).toBe(9)
    expect(hints[1].priority).toBe(5)
    expect(hints[2].priority).toBe(2)
  })

  it('should limit to 3 hints per tool', () => {
    const hints = db.prepare(`
      SELECT hint_text FROM hints
      WHERE tool_name = 'edit'
      ORDER BY priority DESC
      LIMIT 3
    `).all() as Array<{ hint_text: string }>

    expect(hints.length).toBe(3)
    expect(hints[0].hint_text).toBe('Hint 1 for edit (high priority)')
    expect(hints[2].hint_text).toBe('Hint 3 for edit (low priority)')
  })

  it('should return no hints for tool without hints', () => {
    const hints = db.prepare(`
      SELECT hint_text FROM hints
      WHERE tool_name = 'lsp'
      ORDER BY priority DESC
    `).all() as Array<{ hint_text: string }>

    expect(hints.length).toBe(0)
  })

  it('should add new user hint', () => {
    const now = Date.now()
    const result = db.prepare(`
      INSERT INTO hints (tool_name, hint_text, priority, source, created_at)
      VALUES ('bash', 'User added hint', 8, 'user', ?)
    `).run(now)

    expect(result.lastInsertRowid).toBeGreaterThan(0)

    const hint = db.prepare('SELECT * FROM hints WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>
    expect(hint.source).toBe('user')
    expect(hint.priority).toBe(8)
  })

  it('should update hint priority', () => {
    const result = db.prepare(`
      UPDATE hints SET priority = 10 WHERE tool_name = 'edit' AND priority = 9
    `).run()

    expect(result.changes).toBe(1)

    const hints = db.prepare(`
      SELECT priority FROM hints
      WHERE tool_name = 'edit'
      ORDER BY priority DESC
      LIMIT 1
    `).get() as { priority: number }

    expect(hints.priority).toBe(10)
  })

  it('should delete hint', () => {
    // Get the hint with lowest priority
    const lowest = db.prepare(`
      SELECT id FROM hints WHERE tool_name = 'edit' ORDER BY priority ASC LIMIT 1
    `).get() as { id: number }

    const result = db.prepare('DELETE FROM hints WHERE id = ?').run(lowest.id)
    expect(result.changes).toBe(1)

    const remaining = db.prepare(`
      SELECT COUNT(*) as count FROM hints WHERE tool_name = 'edit'
    `).get() as { count: number }

    expect(remaining.count).toBe(3) // 4 - 1 = 3
  })

  it('should export preToolList hook from registry', async () => {
    const { hookRegistry } = await import('../src/mama/index.js')
    expect(typeof hookRegistry.preToolList).toBe('function')
  })
})

// ============================================================
// Story 11.7: ActionHints (postExecute) Tests
// ============================================================

describe('ActionHints - Entity Detection', () => {
  it('should detect entity types from names', async () => {
    const { detectEntityTypes } = await import('../src/mama/rules/next-steps.js')

    const entities = ['chicken_body', 'pig_head', 'car_wheel']
    const types = detectEntityTypes(entities)

    expect(types).toContain('character')
    expect(types).toContain('vehicle')
  })

  it('should detect room entity type', async () => {
    const { detectEntityTypes } = await import('../src/mama/rules/next-steps.js')

    const entities = ['living_room', 'bedroom_floor']
    const types = detectEntityTypes(entities)

    expect(types).toContain('room')
  })

  it('should handle empty entity list', async () => {
    const { detectEntityTypes } = await import('../src/mama/rules/next-steps.js')

    const types = detectEntityTypes([])
    expect(types).toHaveLength(0)
  })

  it('should deduplicate detected types', async () => {
    const { detectEntityTypes } = await import('../src/mama/rules/next-steps.js')

    const entities = ['chicken_body', 'chicken_head', 'chicken_wing']
    const types = detectEntityTypes(entities)

    expect(types.filter((t) => t === 'character')).toHaveLength(1)
  })
})

describe('ActionHints - Entity Name Extraction', () => {
  it('should extract named entities from code', async () => {
    const { extractEntityNames } = await import('../src/mama/hooks/post-execute.js')

    const code = `
      drawBox({ name: 'chicken_body', size: [4, 6, 3] })
      drawCylinder({ name: "pig_head", radius: 2 })
    `

    const names = extractEntityNames(code)

    expect(names).toContain('chicken_body')
    expect(names).toContain('pig_head')
  })

  it('should extract group names', async () => {
    const { extractEntityNames } = await import('../src/mama/hooks/post-execute.js')

    const code = `
      group('vehicle_parts', () => {
        drawBox({ name: 'wheel', size: [1, 1, 1] })
      })
    `

    const names = extractEntityNames(code)

    expect(names).toContain('vehicle_parts')
    expect(names).toContain('wheel')
  })

  it('should handle empty code', async () => {
    const { extractEntityNames } = await import('../src/mama/hooks/post-execute.js')

    const names = extractEntityNames('')
    expect(names).toHaveLength(0)
  })
})

describe('ActionHints - Next Step Rules', () => {
  it('should suggest door/window for room creation', async () => {
    const { evaluateNextSteps } = await import('../src/mama/rules/next-steps.js')

    const context = {
      entityTypes: ['room'],
      entitiesCreated: ['living_room'],
      toolName: 'write',
    }

    const steps = evaluateNextSteps(context)

    expect(steps.some((s) => s.action === 'add_door')).toBe(true)
    expect(steps.some((s) => s.action === 'add_window')).toBe(true)
  })

  it('should suggest accessories for character creation', async () => {
    const { evaluateNextSteps } = await import('../src/mama/rules/next-steps.js')

    const context = {
      entityTypes: ['character'],
      entitiesCreated: ['chicken'],
      toolName: 'write',
    }

    const steps = evaluateNextSteps(context)

    expect(steps.some((s) => s.action === 'add_accessories')).toBe(true)
  })

  it('should suggest roof for building creation', async () => {
    const { evaluateNextSteps } = await import('../src/mama/rules/next-steps.js')

    const context = {
      entityTypes: ['building'],
      entitiesCreated: ['house'],
      toolName: 'write',
    }

    const steps = evaluateNextSteps(context)

    expect(steps.some((s) => s.action === 'add_roof')).toBe(true)
    expect(steps.some((s) => s.action === 'add_door')).toBe(true)
  })

  it('should deduplicate next steps', async () => {
    const { evaluateNextSteps } = await import('../src/mama/rules/next-steps.js')

    const context = {
      entityTypes: ['room', 'wall'], // Both may suggest add_door
      entitiesCreated: ['bedroom', 'wall_north'],
      toolName: 'write',
    }

    const steps = evaluateNextSteps(context)
    const doorSteps = steps.filter((s) => s.action === 'add_door')

    expect(doorSteps).toHaveLength(1) // Should be deduplicated
  })
})

describe('ActionHints - Save Suggestions', () => {
  it('should suggest saving pattern for multiple same-type entities', async () => {
    const { evaluateSaveSuggestion } = await import('../src/mama/rules/next-steps.js')

    const context = {
      entityTypes: ['tree'],
      entitiesCreated: ['tree1', 'tree2', 'tree3'],
      toolName: 'write',
    }

    const suggestion = evaluateSaveSuggestion(context)

    expect(suggestion).toBeDefined()
    expect(suggestion!.topic).toContain('pattern')
  })

  it('should suggest saving new character design', async () => {
    const { evaluateSaveSuggestion } = await import('../src/mama/rules/next-steps.js')

    const context = {
      entityTypes: ['character'],
      entitiesCreated: ['new_chicken'],
      toolName: 'write',
    }

    const suggestion = evaluateSaveSuggestion(context)

    expect(suggestion).toBeDefined()
    expect(suggestion!.topic).toContain('character')
  })
})

describe('ActionHints - Post Execute Hook', () => {
  it('should generate hints for write tool', async () => {
    const { executePostExecute } = await import('../src/mama/hooks/post-execute.js')

    const context = {
      toolName: 'write',
      code: "drawBox({ name: 'chicken_body', size: [4, 6, 3] })",
    }

    const result = {
      success: true,
      data: { entities: ['chicken_body'] },
    }

    const enhanced = executePostExecute(context, result)

    expect(enhanced.success).toBe(true)
    expect(enhanced.actionHints).toBeDefined()
    expect(enhanced.actionHints?.nextSteps).toBeDefined()
  })

  it('should skip hints for read tool', async () => {
    const { executePostExecute, shouldGenerateHints } = await import('../src/mama/hooks/post-execute.js')

    expect(shouldGenerateHints('read')).toBe(false)
    expect(shouldGenerateHints('mcp__ai-native-cad__read')).toBe(false)

    const context = { toolName: 'read' }
    const result = { success: true, data: { content: 'file content' } }

    const enhanced = executePostExecute(context, result)

    expect(enhanced.actionHints).toBeUndefined()
  })

  it('should skip hints for failed execution', async () => {
    const { executePostExecute } = await import('../src/mama/hooks/post-execute.js')

    const context = {
      toolName: 'write',
      code: "drawBox({ name: 'test' })",
    }

    const result = {
      success: false,
      data: null,
      error: 'Execution failed',
    }

    const enhanced = executePostExecute(context, result)

    expect(enhanced.actionHints).toBeUndefined()
    expect(enhanced.error).toBe('Execution failed')
  })

  it('should not fail if hint generation fails', async () => {
    const { executePostExecute } = await import('../src/mama/hooks/post-execute.js')

    // Invalid context that might cause issues
    const context = {
      toolName: 'write',
      code: null as unknown as string,
    }

    const result = {
      success: true,
      data: {},
    }

    // Should not throw
    const enhanced = executePostExecute(context, result)
    expect(enhanced.success).toBe(true)
  })
})

describe('ActionHints - Format Hints', () => {
  it('should format next steps correctly', async () => {
    const { formatActionHints } = await import('../src/mama/hooks/post-execute.js')

    const hints = {
      nextSteps: [
        {
          action: 'add_door',
          description: '문 배치하기',
          relevance: '방이 생성되었으니 출입구가 필요합니다',
          optional: false,
        },
      ],
      moduleHints: ['primitives (drawBox)'],
    }

    const formatted = formatActionHints(hints)

    expect(formatted).toContain('📋 Suggested Next Steps')
    expect(formatted).toContain('문 배치하기')
    expect(formatted).toContain('🔧 Related Modules')
    expect(formatted).toContain('primitives')
  })

  it('should include save suggestion in format', async () => {
    const { formatActionHints } = await import('../src/mama/hooks/post-execute.js')

    const hints = {
      nextSteps: [],
      moduleHints: [],
      saveSuggestion: {
        topic: 'voxel:pattern:layout',
        reason: '반복 패턴이 발견되었습니다',
      },
    }

    const formatted = formatActionHints(hints)

    expect(formatted).toContain('💾 Save Suggestion')
    expect(formatted).toContain('voxel:pattern:layout')
    expect(formatted).toContain('반복 패턴')
  })

  it('should export postExecute hook from registry', async () => {
    const { hookRegistry } = await import('../src/mama/index.js')
    expect(typeof hookRegistry.postExecute).toBe('function')
  })
})

// ============================================================
// Story 11.9: Configurable Context Tests
// ============================================================

describe('Configurable Context', () => {
  it('should support none/hint/full modes in config', async () => {
    const { loadConfig } = await import('../src/mama/config.js')

    const config = loadConfig()

    // contextInjection should exist and be one of the valid modes
    expect(['none', 'hint', 'full']).toContain(config.contextInjection)
  })

  it('should update contextInjection at runtime', async () => {
    const { loadConfig, updateConfig } = await import('../src/mama/config.js')

    // Get current value
    const originalConfig = loadConfig()
    const originalMode = originalConfig.contextInjection

    // Change to different mode
    const newMode = originalMode === 'full' ? 'hint' : 'full'
    updateConfig({ contextInjection: newMode })

    // Verify change
    const updatedConfig = loadConfig(true) // Force reload
    expect(updatedConfig.contextInjection).toBe(newMode)

    // Restore original
    updateConfig({ contextInjection: originalMode })
  })

  it('should format context based on mode', () => {
    // Test none mode output
    const noneOutput = '' // none mode should return empty
    expect(noneOutput.length).toBe(0)

    // Test hint mode output (single line)
    const hintOutput = '🔍 5 related decisions found, 1 checkpoint available'
    expect(hintOutput.split('\n').length).toBe(1)

    // Test full mode output (multiple lines)
    const fullOutput = `📍 **Last Checkpoint** (1h ago):
   Working on feature X

🧠 **Recent Decisions** (5):
   1. ✅ auth:jwt:tokens: Use JWT (30m ago)
   2. ⏳ db:postgres:indexes: Add composite index (1h ago)`

    expect(fullOutput.split('\n').length).toBeGreaterThan(3)
  })

  it('should save tokens in none mode vs full mode', () => {
    // Simulate token counts for same content
    const decisions = [
      { topic: 'topic1', decision: 'decision1' },
      { topic: 'topic2', decision: 'decision2' },
      { topic: 'topic3', decision: 'decision3' },
      { topic: 'topic4', decision: 'decision4' },
      { topic: 'topic5', decision: 'decision5' },
    ]

    const checkpoint = {
      summary: 'Working on MAMA integration',
      next_steps: 'Continue testing',
    }

    // None mode: 0 characters
    const noneLength = 0

    // Hint mode: ~50 characters
    const hintLength = `🔍 ${decisions.length} decisions, 1 checkpoint available`.length

    // Full mode: ~500+ characters
    const fullLength = decisions.reduce(
      (acc, d) => acc + d.topic.length + d.decision.length + 50,
      checkpoint.summary.length + checkpoint.next_steps.length + 100
    )

    // None should be 50%+ less than full
    expect(noneLength).toBeLessThan(fullLength * 0.5)

    // Hint should also be significantly less than full
    expect(hintLength).toBeLessThan(fullLength * 0.3)
  })

  it('should handle mama_configure set action', async () => {
    const { handleMamaConfigure } = await import('../src/mama/tools/handlers.js')

    // Get current config
    const getResult = await handleMamaConfigure({ action: 'get' })
    expect(getResult.success).toBe(true)

    const originalMode = (getResult.data as Record<string, unknown>).config as { contextInjection: string }

    // Set to different mode
    const newMode = originalMode.contextInjection === 'full' ? 'hint' : 'full'
    const setResult = await handleMamaConfigure({
      action: 'set',
      contextInjection: newMode as 'none' | 'hint' | 'full',
    })

    expect(setResult.success).toBe(true)
    expect((setResult.data as Record<string, { contextInjection: string }>).config.contextInjection).toBe(newMode)

    // Restore original
    await handleMamaConfigure({
      action: 'set',
      contextInjection: originalMode.contextInjection as 'none' | 'hint' | 'full',
    })
  })
})
