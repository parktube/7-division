-- ============================================================
-- Story 11.16: Terminology Evolution
-- FR84: 사용자 언어 변화 추적
-- ============================================================

-- Terminology Evolution table
-- Tracks how user language evolves from vague to specific terms
CREATE TABLE IF NOT EXISTS terminology_evolution (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,           -- User identifier
  before_term TEXT NOT NULL,       -- Vague term (e.g., '미니멀하게')
  after_term TEXT NOT NULL,        -- Specific term (e.g., 'Japandi 스타일로')
  domain TEXT,                     -- Domain (style, color, spatial, etc.)
  learning_id TEXT,                -- Related learning (if any)
  detected_at INTEGER NOT NULL,    -- Unix timestamp (seconds)
  FOREIGN KEY (learning_id) REFERENCES learnings(id)
);

-- Index for user-based queries
CREATE INDEX IF NOT EXISTS idx_terminology_user ON terminology_evolution(user_id);

-- Index for domain-based queries
CREATE INDEX IF NOT EXISTS idx_terminology_domain ON terminology_evolution(domain);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_terminology_time ON terminology_evolution(detected_at);
