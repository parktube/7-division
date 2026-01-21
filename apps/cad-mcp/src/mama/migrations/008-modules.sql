-- Migration 008: Module Library (Story 11.19)
-- Module metadata and recommendation system

-- Modules table for semantic recommendation
CREATE TABLE IF NOT EXISTS modules (
  name TEXT PRIMARY KEY,              -- Module name (e.g., 'house_lib')
  description TEXT NOT NULL,          -- Module description (from JSDoc)
  tags TEXT,                          -- JSON array of tags
  example TEXT,                       -- Example usage code
  usage_count INTEGER DEFAULT 0,      -- Number of times used
  last_used_at INTEGER,               -- Unix timestamp of last use
  created_at INTEGER NOT NULL,        -- Unix timestamp of creation
  updated_at INTEGER                  -- Unix timestamp of last update
);

-- Record version
INSERT OR IGNORE INTO schema_version (version) VALUES (8);
