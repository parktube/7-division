-- Migration 009: Design Workflow System (Story 11.21)
-- Project tracking for design workflow phases
-- Phases: discovery → planning → architecture → creation

-- ══════════════════════════════════════════════════════════════
-- 1. Projects (Core)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,                  -- "project_chicken_model_abc123"
  name TEXT NOT NULL,                   -- "Chicken Character"
  description TEXT,                     -- "Crossy Road style chicken voxel model"
  current_phase TEXT DEFAULT 'discovery', -- Current workflow phase
  created_at INTEGER NOT NULL,          -- Unix timestamp
  updated_at INTEGER,                   -- Unix timestamp

  CHECK (current_phase IN ('discovery', 'planning', 'architecture', 'creation', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_projects_current_phase ON projects(current_phase);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 2. Project Artifacts (Phase deliverables)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS project_artifacts (
  id TEXT PRIMARY KEY,                  -- "artifact_chicken_discovery_ref_abc123"
  project_id TEXT NOT NULL,             -- FK to projects
  phase TEXT NOT NULL,                  -- "discovery", "planning", etc.
  artifact_type TEXT NOT NULL,          -- "reference_image", "style_guide", "module_spec", etc.
  content TEXT,                         -- JSON or text content
  created_at INTEGER NOT NULL,          -- Unix timestamp

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CHECK (phase IN ('discovery', 'planning', 'architecture', 'creation'))
);

CREATE INDEX IF NOT EXISTS idx_project_artifacts_project_id ON project_artifacts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_artifacts_phase ON project_artifacts(phase);
CREATE INDEX IF NOT EXISTS idx_project_artifacts_type ON project_artifacts(artifact_type);

-- ══════════════════════════════════════════════════════════════
-- 3. Project Phases (Phase completion tracking)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS project_phases (
  project_id TEXT NOT NULL,             -- FK to projects
  phase TEXT NOT NULL,                  -- "discovery", "planning", etc.
  completed_at INTEGER,                 -- Unix timestamp when phase completed
  learnings_count INTEGER DEFAULT 0,    -- Number of learnings in this phase
  decisions_count INTEGER DEFAULT 0,    -- Number of decisions in this phase

  PRIMARY KEY (project_id, phase),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CHECK (phase IN ('discovery', 'planning', 'architecture', 'creation'))
);

-- Record version
INSERT OR IGNORE INTO schema_version (version, description)
VALUES (9, 'Design Workflow System - projects, artifacts, phases');
