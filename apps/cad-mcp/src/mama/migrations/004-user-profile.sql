-- Migration 004: User Profile for Adaptive Mentoring
-- Story 11.10: Adaptive Mentoring

-- User profile table for skill tracking
CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton (single user per session)
  global_skill_level TEXT DEFAULT 'intermediate',  -- beginner, intermediate, expert
  domain_skill_levels TEXT DEFAULT '{}',  -- JSON: {"primitives": "expert", "groups": "beginner"}
  action_counts TEXT DEFAULT '{}',  -- JSON: {"drawBox": 45, "group": 12}
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (global_skill_level IN ('beginner', 'intermediate', 'expert'))
);

-- Initialize with default user profile
-- Note: Timestamps set to 0 as placeholder. App-layer updates use Date.now() via db.ts.
-- This maintains consistency with project convention (app-layer timestamp management).
INSERT OR IGNORE INTO user_profile (id, global_skill_level, domain_skill_levels, action_counts, created_at, updated_at)
VALUES (1, 'intermediate', '{}', '{}', 0, 0);
