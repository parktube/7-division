-- Story 11.13: Learning Progress Storage
-- FR81: Track user learning progress for concepts

-- Track schema version
INSERT OR IGNORE INTO schema_version (version) VALUES (5);

-- User learning progress table
CREATE TABLE IF NOT EXISTS learnings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,                    -- User identifier (for multi-user support)
  concept TEXT NOT NULL,                    -- e.g., '60-30-10 rule', 'Japandi', 'material contrast'
  domain TEXT,                              -- e.g., 'color_theory', 'spatial', 'style'
  understanding_level INTEGER DEFAULT 1 CHECK(understanding_level BETWEEN 1 AND 4),
  first_introduced INTEGER,                 -- Unix timestamp (ms)
  last_applied INTEGER,                     -- Unix timestamp (ms)
  applied_count INTEGER DEFAULT 0,
  user_explanation TEXT,                    -- User's own explanation of the concept
  created_at INTEGER                        -- Unix timestamp (ms)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_learnings_user ON learnings(user_id);
CREATE INDEX IF NOT EXISTS idx_learnings_concept ON learnings(concept);
CREATE INDEX IF NOT EXISTS idx_learnings_domain ON learnings(domain);
-- Unique constraint: one concept per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_learnings_user_concept ON learnings(user_id, concept);
