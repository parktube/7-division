-- ══════════════════════════════════════════════════════════════
-- CAD MAMA - Decision Edges (Reasoning Graph)
-- ══════════════════════════════════════════════════════════════
-- Version: 2.0
-- Date: 2026-01-21
-- Purpose: Add decision_edges table for Reasoning Graph
-- Story: 11.2 결정 저장 + Reasoning Graph
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- decision_edges: 결정 관계 (Reasoning Graph)
-- ══════════════════════════════════════════════════════════════

-- Decisions are immutable; edges must be cleaned separately if deletion is ever needed
CREATE TABLE IF NOT EXISTS decision_edges (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relationship TEXT NOT NULL,    -- 'supersedes', 'builds_on', 'debates', 'synthesizes'
  created_at INTEGER NOT NULL,
  PRIMARY KEY (from_id, to_id, relationship),
  FOREIGN KEY (from_id) REFERENCES decisions(id) ON DELETE RESTRICT,
  FOREIGN KEY (to_id) REFERENCES decisions(id) ON DELETE RESTRICT,
  CHECK (relationship IN ('supersedes', 'builds_on', 'debates', 'synthesizes'))
);

CREATE INDEX IF NOT EXISTS idx_edges_from ON decision_edges(from_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON decision_edges(to_id);
CREATE INDEX IF NOT EXISTS idx_edges_relationship ON decision_edges(relationship);

-- ══════════════════════════════════════════════════════════════
-- Update schema version
-- ══════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (2, 'Add decision_edges table for Reasoning Graph');
