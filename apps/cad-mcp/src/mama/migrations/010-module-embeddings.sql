-- Migration 010: Module Embeddings Cache
-- Add embedding storage for semantic search optimization

-- Create module embeddings table for caching
CREATE TABLE IF NOT EXISTS module_embeddings (
  module_name TEXT PRIMARY KEY,                    -- References modules(name)
  embedding TEXT NOT NULL,                         -- JSON array of floats [f32, f32, ...]
  embedding_dim INTEGER NOT NULL,                  -- Vector dimension (384)
  embedding_model TEXT NOT NULL,                   -- Model name for versioning

  -- Content-based invalidation
  metadata_hash TEXT NOT NULL,                     -- SHA256(description || tags || example)

  -- Lifecycle tracking
  created_at INTEGER NOT NULL,                     -- Unix timestamp (ms)
  updated_at INTEGER,                              -- Unix timestamp (ms)

  -- Foreign key constraint
  FOREIGN KEY (module_name) REFERENCES modules(name)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_module_embeddings_model
  ON module_embeddings(embedding_model);

CREATE INDEX IF NOT EXISTS idx_module_embeddings_updated
  ON module_embeddings(updated_at DESC);

-- Record migration version
INSERT OR IGNORE INTO schema_version (version, applied_at)
VALUES (10, strftime('%s', 'now') * 1000);