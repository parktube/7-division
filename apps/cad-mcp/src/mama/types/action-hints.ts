/**
 * ActionHints Types
 *
 * Story 11.7: ActionHints (postExecute)
 * Story 11.15: DesignHints System
 *
 * Types for post-execution action hints and workflow suggestions.
 * Includes DesignHints for guiding Human Chain of Thought (CoT).
 */

// Import and re-export DesignHints types from canonical source to avoid type drift
import type {
  DesignHints,
  NextConcept,
  ThinkingQuestion,
  DesignOption,
} from '../design-hints.js'

export type { DesignHints, NextConcept, ThinkingQuestion, DesignOption }

// ============================================================
// NextStep - Suggested next action
// ============================================================

export interface NextStep {
  /** Action identifier (e.g., 'add_door') */
  action: string
  /** Human-readable description (e.g., '문 배치하기') */
  description: string
  /** Why this action is relevant (e.g., '방이 생성되었으니 출입구 필요') */
  relevance: string
  /** Whether this step is optional */
  optional: boolean
}

// ============================================================
// SaveSuggestion - Suggestion to save a decision
// ============================================================

export interface SaveSuggestion {
  /** Topic for the decision (e.g., 'voxel:room:layout') */
  topic: string
  /** Reason for saving (e.g., '새로운 방 레이아웃 패턴 발견') */
  reason: string
}

// ============================================================
// ActionHints - All hints from postExecute
// ============================================================

export interface ActionHints {
  /** Suggested next steps (AX - AI guidance) */
  nextSteps?: NextStep[]
  /** Related module hints */
  moduleHints?: string[]
  /** Suggestion to save a decision */
  saveSuggestion?: SaveSuggestion
  /** Design hints for Human CoT (UX - Human guidance) */
  designHints?: DesignHints
}

// ============================================================
// ExecutionContext - Context for postExecute hook
// ============================================================

export interface ExecutionContext {
  /** The tool that was executed */
  toolName: string
  /** File that was modified (if applicable) */
  file?: string
  /** Entities created (if CAD operation) */
  entitiesCreated?: string[]
  /** Entity types detected */
  entityTypes?: string[]
  /** Code that was executed */
  code?: string
}

// ============================================================
// CADToolResult - Extended result with hints
// ============================================================

export interface CADToolResult {
  success: boolean
  data: unknown
  error?: string
  warnings?: string[]
  logs?: string[]
  /** Action hints for next steps */
  actionHints?: ActionHints
}
