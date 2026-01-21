-- Story 11.14: User Growth Metrics
-- FR82: Track user growth metrics for adaptive mentoring

-- Track schema version
INSERT OR IGNORE INTO schema_version (version) VALUES (6);

-- User growth metrics table
CREATE TABLE IF NOT EXISTS growth_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                    -- User identifier (for multi-user support)
  metric_type TEXT NOT NULL,                -- 'independent_decision', 'concept_applied',
                                            -- 'tradeoff_predicted', 'terminology_used'
  related_learning_id TEXT,                 -- FK to learnings table
  related_decision_id TEXT,                 -- FK to decisions table
  context TEXT,                             -- Situation context
  created_at INTEGER                        -- Unix timestamp (ms)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_growth_metrics_user ON growth_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_growth_metrics_type ON growth_metrics(metric_type);
-- Composite index for user + type queries
CREATE INDEX IF NOT EXISTS idx_growth_metrics_user_type ON growth_metrics(user_id, metric_type);
