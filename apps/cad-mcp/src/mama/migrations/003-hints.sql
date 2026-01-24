-- ══════════════════════════════════════════════════════════════
-- CAD MAMA - Dynamic Hints
-- ══════════════════════════════════════════════════════════════
-- Version: 3.0
-- Date: 2026-01-21
-- Purpose: Add hints table for Dynamic Hint Injection
-- Story: 11.6 Dynamic Hint Injection (preToolList)
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- hints: 도구별 동적 힌트
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS hints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,           -- 'edit', 'write', 'lsp', etc.
  hint_text TEXT NOT NULL,           -- "rect의 x,y는 CENTER 좌표입니다"
  priority INTEGER DEFAULT 5,        -- 1(낮음) ~ 10(높음)
  tags TEXT,                         -- JSON array: ["rect", "coordinate"]
  source TEXT DEFAULT 'system',      -- 'user', 'system', 'learned'
  created_at INTEGER NOT NULL,
  CHECK (priority >= 1 AND priority <= 10),
  CHECK (source IN ('user', 'system', 'learned'))
);

CREATE INDEX IF NOT EXISTS idx_hints_tool ON hints(tool_name);
CREATE INDEX IF NOT EXISTS idx_hints_priority ON hints(priority DESC);
-- Unique constraint for INSERT OR IGNORE to work correctly
CREATE UNIQUE INDEX IF NOT EXISTS idx_hints_tool_text ON hints(tool_name, hint_text);

-- ══════════════════════════════════════════════════════════════
-- Default CAD hints (시드 데이터)
-- Note: One-time seed with SQLite timestamp for initial DB setup.
-- App-layer hint additions use Date.now() via addHint() in db.ts.
-- ══════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO hints (tool_name, hint_text, priority, tags, source, created_at)
VALUES
  ('edit', 'rect의 x,y는 CENTER 좌표입니다', 8, '["rect", "coordinate", "center"]', 'system', unixepoch() * 1000),
  ('edit', '회전 각도는 라디안 단위입니다', 7, '["rotation", "angle", "radian"]', 'system', unixepoch() * 1000),
  ('write', '새 파일 작성 전 glob으로 기존 파일 확인', 6, '["file", "glob", "check"]', 'system', unixepoch() * 1000),
  ('lsp', 'domains → describe → schema 순서로 탐색', 8, '["discovery", "order"]', 'system', unixepoch() * 1000);

-- ══════════════════════════════════════════════════════════════
-- Update schema version
-- ══════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (3, 'Add hints table for Dynamic Hint Injection');
