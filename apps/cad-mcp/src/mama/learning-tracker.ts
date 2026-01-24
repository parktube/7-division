/**
 * Learning Tracker Module
 *
 * Story 11.13: Learning Progress Storage (FR81)
 *
 * Tracks user learning progress for concepts:
 * - Understanding levels (1=introduced, 2=understood, 3=applied, 4=mastered)
 * - Applied count tracking
 * - Auto-upgrade to mastery (3+ applications)
 */

import { nanoid } from 'nanoid'
import {
  upsertLearning,
  getLearning,
  updateUnderstandingLevel,
  incrementAppliedCount,
  getUserLearnings,
  getLearningsSummary,
  type LearningRow,
  type UnderstandingLevel,
} from './db.js'
import { logger } from '../logger.js'
import { DEFAULT_USER_ID } from './config.js'

// ============================================================
// Types
// ============================================================

export interface SaveLearningArgs {
  concept: string
  domain?: string
  user_explanation?: string
}

export interface SaveLearningResult {
  id: string
  concept: string
  domain: string | null
  understanding_level: UnderstandingLevel
  applied_count: number
  is_new: boolean
}

export interface LearningHint {
  concept: string
  level: UnderstandingLevel
  applied_count: number
  levelName: string
}

// ============================================================
// Constants
// ============================================================

const LEVEL_NAMES: Record<UnderstandingLevel, string> = {
  1: '소개됨',
  2: '이해함',
  3: '적용함',
  4: '숙달',
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Save a new learning (concept introduction)
 *
 * AC1: When AI introduces a new concept, save with level=1
 *
 * @param args - Learning data
 * @returns Result with learning details
 */
export function saveLearning(args: SaveLearningArgs): SaveLearningResult {
  // Check if already exists
  const existing = getLearning(DEFAULT_USER_ID, args.concept)

  if (existing) {
    logger.info(`Learning already exists: ${args.concept} (level ${existing.understanding_level})`)
    return {
      id: existing.id,
      concept: existing.concept,
      domain: existing.domain,
      understanding_level: existing.understanding_level,
      applied_count: existing.applied_count,
      is_new: false,
    }
  }

  // Create new learning
  const id = `learning_${nanoid()}`
  const learning = upsertLearning({
    id,
    user_id: DEFAULT_USER_ID,
    concept: args.concept,
    domain: args.domain,
    understanding_level: 1,
    user_explanation: args.user_explanation,
  })

  logger.info(`New learning saved: ${args.concept}`)

  return {
    id: learning.id,
    concept: learning.concept,
    domain: learning.domain,
    understanding_level: learning.understanding_level,
    applied_count: learning.applied_count,
    is_new: true,
  }
}

/**
 * Mark concept as understood
 *
 * AC2: When user expresses understanding, upgrade to level 2
 *
 * @param concept - Concept name
 * @param userExplanation - Optional user's own explanation
 */
export function markUnderstood(concept: string, userExplanation?: string): void {
  const learning = getLearning(DEFAULT_USER_ID, concept)

  if (!learning) {
    logger.warn(`Cannot mark understood: concept "${concept}" not found`)
    return
  }

  if (learning.understanding_level < 2) {
    updateUnderstandingLevel(DEFAULT_USER_ID, concept, 2)
    logger.info(`Learning "${concept}" marked as understood`)
  }

  // Update user explanation if provided
  if (userExplanation) {
    upsertLearning({
      id: learning.id,
      user_id: DEFAULT_USER_ID,
      concept,
      user_explanation: userExplanation,
    })
  }
}

/**
 * Record concept application
 *
 * AC3: When user applies a concept, upgrade to level 3 and increment count
 * AC4: After 3+ applications, auto-upgrade to level 4 (mastery)
 *
 * @param concept - Concept name
 * @returns New applied count
 */
export function recordApplication(concept: string): number {
  const learning = getLearning(DEFAULT_USER_ID, concept)

  if (!learning) {
    logger.warn(`Cannot record application: concept "${concept}" not found`)
    return 0
  }

  // AC3/AC4: Level upgrades are handled by incrementAppliedCount in db.ts
  // - Level 3 (applied): First application
  // - Level 4 (mastery): After 3+ applications
  const newCount = incrementAppliedCount(DEFAULT_USER_ID, concept)

  logger.info(`Concept "${concept}" applied (count: ${newCount})`)

  return newCount
}

/**
 * Get learnings for session hint
 *
 * AC5: Inject learning hints on session start
 *
 * @returns Array of learning hints for session injection
 */
export function getSessionLearningHints(): LearningHint[] {
  const summary = getLearningsSummary(DEFAULT_USER_ID)

  const hints: LearningHint[] = []

  // Include recently applied learnings
  for (const learning of summary.recentlyApplied) {
    hints.push({
      concept: learning.concept,
      level: learning.understanding_level,
      applied_count: learning.applied_count,
      levelName: LEVEL_NAMES[learning.understanding_level],
    })
  }

  // Include mastered concepts (level 4)
  const mastered = getUserLearnings(DEFAULT_USER_ID)
    .filter((l) => l.understanding_level === 4)
    .filter((l) => !hints.some((h) => h.concept === l.concept))
    .slice(0, 3)

  for (const learning of mastered) {
    hints.push({
      concept: learning.concept,
      level: learning.understanding_level,
      applied_count: learning.applied_count,
      levelName: LEVEL_NAMES[learning.understanding_level],
    })
  }

  return hints.slice(0, 5) // Max 5 hints
}

/**
 * Format learning hints for session context
 *
 * @param hints - Learning hints
 * @returns Formatted hint string
 */
export function formatLearningHints(hints: LearningHint[]): string | null {
  if (hints.length === 0) {
    return null
  }

  const lines = hints.map((h) => {
    const countInfo = h.applied_count > 0 ? ` (${h.applied_count}번 적용)` : ''
    return `   • ${h.concept}: ${h.levelName}${countInfo}`
  })

  return `📚 **학습 현황** (${hints.length}개 개념):\n${lines.join('\n')}`
}

/**
 * Get all learnings for a user
 */
export function getAllLearnings(): LearningRow[] {
  return getUserLearnings(DEFAULT_USER_ID)
}

/**
 * Get learning by concept name
 */
export function getLearningByConcept(concept: string): LearningRow | null {
  return getLearning(DEFAULT_USER_ID, concept)
}

// ============================================================
// Exports
// ============================================================

export { LEVEL_NAMES, DEFAULT_USER_ID }
