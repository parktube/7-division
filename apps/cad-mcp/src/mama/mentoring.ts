/**
 * Adaptive Mentoring Module
 *
 * Story 11.10: Adaptive Mentoring
 *
 * Provides skill level tracking and adaptive hint generation
 * based on user experience and domain expertise.
 */

import { logger } from '../logger.js'
import {
  getUserProfile,
  setGlobalSkillLevel,
  getDomainSkillLevel,
  setDomainSkillLevel,
  incrementActionCount,
  getAllActionCounts,
  type SkillLevel,
} from './db.js'
import type { NextStep } from './types/action-hints.js'

// ============================================================
// Domain Classification
// ============================================================

/** Action to domain mapping */
const ACTION_DOMAINS: Record<string, string> = {
  // Primitives
  drawBox: 'primitives',
  drawCylinder: 'primitives',
  drawSphere: 'primitives',
  drawCircle: 'primitives',
  drawRect: 'primitives',
  drawPolygon: 'primitives',
  drawLine: 'primitives',
  drawPoint: 'primitives',

  // Transforms
  translate: 'transforms',
  rotate: 'transforms',
  scale: 'transforms',
  mirror: 'transforms',

  // Groups
  group: 'groups',
  ungroup: 'groups',
  clone: 'groups',

  // Boolean
  union: 'boolean',
  subtract: 'boolean',
  intersect: 'boolean',

  // Query
  select: 'query',
  find: 'query',
  getEntity: 'query',
}

/**
 * Get domain for an action
 */
export function getActionDomain(action: string): string {
  return ACTION_DOMAINS[action] || 'general'
}

// ============================================================
// Skill Level Calculation
// ============================================================

/** Thresholds for automatic skill upgrade */
const SKILL_THRESHOLDS = {
  intermediate: 20, // Actions to reach intermediate
  expert: 50, // Actions to reach expert
}

/**
 * Calculate domain skill level based on action counts
 */
export function calculateDomainSkillLevel(
  domainCounts: Record<string, number>
): SkillLevel {
  const totalActions = Object.values(domainCounts).reduce((a, b) => a + b, 0)

  if (totalActions >= SKILL_THRESHOLDS.expert) {
    return 'expert'
  } else if (totalActions >= SKILL_THRESHOLDS.intermediate) {
    return 'intermediate'
  }
  return 'beginner'
}

/**
 * Track action and update skill levels
 */
export function trackAction(action: string): {
  newCount: number
  domain: string
  levelChange: SkillLevel | null
} {
  const domain = getActionDomain(action)
  const newCount = incrementActionCount(action)

  // Get current domain level
  const currentLevel = getDomainSkillLevel(domain)

  // Calculate new level based on total domain actions
  const counts = getAllActionCounts()
  const domainCounts: Record<string, number> = {}

  for (const [act, count] of Object.entries(counts)) {
    const actDomain = getActionDomain(act)
    if (actDomain === domain) {
      domainCounts[act] = count
    }
  }

  const newLevel = calculateDomainSkillLevel(domainCounts)

  // Check for level change
  let levelChange: SkillLevel | null = null
  if (newLevel !== currentLevel) {
    setDomainSkillLevel(domain, newLevel)
    levelChange = newLevel
    logger.info(`Skill level upgraded: ${domain} → ${newLevel}`)
  }

  return { newCount, domain, levelChange }
}

// ============================================================
// Adaptive Hint Generation
// ============================================================

/**
 * Extract first sentence from text (handles edge cases)
 */
function getFirstSentence(text: string): string {
  if (!text || text.trim() === '') return text
  const firstSentence = text.split('.')[0]?.trim()
  // Return original if split results in empty (e.g., text starts with '.')
  return firstSentence || text
}

/**
 * Format next step based on skill level
 */
export function formatNextStep(step: NextStep, level: SkillLevel): NextStep {
  if (level === 'expert') {
    // Expert: minimal hint (action name + short relevance)
    return {
      ...step,
      description: step.action,
      relevance: getFirstSentence(step.relevance),
    }
  } else if (level === 'intermediate') {
    // Intermediate: brief description
    return {
      ...step,
      relevance: getFirstSentence(step.relevance),
    }
  }

  // Beginner: full detail with examples
  const tip = getBeginnerTip(step.action)
  const relevanceWithTip = step.relevance
    ? `${step.relevance} 💡 ${tip}`
    : `💡 ${tip}`

  return {
    ...step,
    description: `${step.description}`,
    relevance: relevanceWithTip,
  }
}

/**
 * Get beginner-friendly tip for an action
 */
function getBeginnerTip(action: string): string {
  const tips: Record<string, string> = {
    add_door: '문을 추가하려면 벽의 위치를 먼저 확인하세요.',
    add_window: '창문은 외벽에 배치하면 채광이 좋아집니다.',
    add_furniture: '가구는 방의 용도에 맞게 선택하세요.',
    add_accessories: '작은 디테일이 캐릭터에 생명을 불어넣습니다.',
    add_roof: '지붕 스타일은 건물의 분위기를 결정합니다.',
    extend_wall: '벽을 연장할 때 기존 구조와 연결되는지 확인하세요.',
    create_variation: '색상이나 크기를 조금씩 변경해보세요.',
  }

  return tips[action] || '천천히 시도해보세요!'
}

/**
 * Get skill-adapted hints for next steps
 */
export function getAdaptiveHints(
  steps: NextStep[],
  domain: string
): NextStep[] {
  const level = getDomainSkillLevel(domain)

  return steps.map((step) => formatNextStep(step, level))
}

// ============================================================
// Public API
// ============================================================

/**
 * Get current skill profile
 */
export function getSkillProfile(): {
  globalLevel: SkillLevel
  domainLevels: Record<string, SkillLevel>
  actionCounts: Record<string, number>
} {
  const profile = getUserProfile()

  let domainLevels: Record<string, SkillLevel>
  try {
    domainLevels = JSON.parse(profile.domain_skill_levels)
  } catch {
    domainLevels = {}
  }

  let actionCounts: Record<string, number>
  try {
    actionCounts = JSON.parse(profile.action_counts)
  } catch {
    actionCounts = {}
  }

  return {
    globalLevel: profile.global_skill_level,
    domainLevels,
    actionCounts,
  }
}

/**
 * Set skill level (manual override)
 */
export function setSkillLevel(
  level: SkillLevel,
  domain?: string
): { success: boolean; message: string } {
  try {
    if (domain) {
      setDomainSkillLevel(domain, level)
      return {
        success: true,
        message: `Domain '${domain}' skill level set to '${level}'`,
      }
    } else {
      setGlobalSkillLevel(level)
      return {
        success: true,
        message: `Global skill level set to '${level}'`,
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to set skill level: ${error}`,
    }
  }
}

// Re-export types
export type { SkillLevel }
