-- ══════════════════════════════════════════════════════════════
-- CAD MAMA - Initial Schema
-- ══════════════════════════════════════════════════════════════
-- Version: 1.0
-- Date: 2026-01-21
-- Purpose: Decision Graph schema for AI-Native CAD
-- Reference: ~/MAMA/packages/claude-code-plugin/src/db/migrations/001-initial-decision-graph.sql
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 1. Decisions (Core)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,              -- "decision_voxel_chicken_design_abc123"
  topic TEXT NOT NULL,              -- "voxel:chicken:color_palette"
  decision TEXT NOT NULL,           -- "Use warm orange tones for body"
  reasoning TEXT,                   -- "Matches Crossy Road aesthetic..."

  -- Outcome Tracking
  outcome TEXT,                     -- "SUCCESS", "FAILED", "PARTIAL", NULL
  outcome_reason TEXT,              -- "Works well with isometric view"

  -- User Involvement
  user_involvement TEXT,            -- "requested", "approved", "rejected"
  session_id TEXT,

  -- Relationships (Explicit)
  supersedes TEXT,                  -- Previous decision ID
  superseded_by TEXT,               -- Next decision ID (NULL if current)

  -- Confidence
  confidence REAL DEFAULT 0.5,      -- 0.0-1.0

  -- Timestamps (Unix milliseconds)
  created_at INTEGER NOT NULL,
  updated_at INTEGER,

  CHECK (confidence >= 0.0 AND confidence <= 1.0),
  CHECK (outcome IN ('SUCCESS', 'FAILED', 'PARTIAL') OR outcome IS NULL),
  CHECK (user_involvement IN ('requested', 'approved', 'rejected') OR user_involvement IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_decisions_topic ON decisions(topic);
CREATE INDEX IF NOT EXISTS idx_decisions_outcome ON decisions(outcome);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_supersedes ON decisions(supersedes);

-- ══════════════════════════════════════════════════════════════
-- 2. Checkpoints (Session State)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,       -- Unix milliseconds
  summary TEXT NOT NULL,            -- Session state summary
  open_files TEXT,                  -- JSON array of file paths
  next_steps TEXT,                  -- Next actions to take
  status TEXT DEFAULT 'active',     -- "active", "archived"

  CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_timestamp ON checkpoints(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_checkpoints_status ON checkpoints(status);

-- ══════════════════════════════════════════════════════════════
-- 3. Schema Version (Migration Tracking)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER DEFAULT (unixepoch() * 1000),
  description TEXT
);

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (1, 'Initial CAD MAMA schema');

-- ══════════════════════════════════════════════════════════════
-- Note: vss_memories virtual table is created programmatically
-- after sqlite-vec extension is loaded (see db.ts)
-- ══════════════════════════════════════════════════════════════
