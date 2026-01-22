/**
 * Anti-Echo Chamber Module
 *
 * Story 11.12: Anti-Echo Chamber (FR78)
 *
 * Provides warnings to prevent echo chamber effects:
 * - Similar decisions warning
 * - Stale decision warning (90+ days)
 * - Evidence suggestion
 * - Debates encouragement
 */

import { getDatabase } from './db.js'
import { calculateGraphHealth } from './health.js'
import { logger } from '../logger.js'

// ============================================================
// Types
// ============================================================

export interface AntiEchoWarning {
  type: 'similar_decisions' | 'stale_decision' | 'no_evidence' | 'low_debates'
  level: 'suggestion' | 'warning'  // Level 1 (persuasion) vs Level 2 (warning)
  message: string
}

export interface SaveWarnings {
  warnings: AntiEchoWarning[]
  canProceed: boolean  // Always true - warnings are advisory only
}

export interface SearchWarning {
  decisionId: string
  warning: AntiEchoWarning
}

// ============================================================
// Constants
// ============================================================

const STALE_THRESHOLD_DAYS = 90
const SIMILARITY_THRESHOLD = 0.85
const DEBATES_WARNING_THRESHOLD = 0.10

/**
 * Evidence keywords to look for in reasoning
 * Korean and English keywords
 */
const EVIDENCE_KEYWORDS = [
  // English
  'test', 'tested', 'testing',
  'benchmark', 'benchmarked',
  'verified', 'verify', 'verification',
  'measured', 'measure', 'measurement',
  'proven', 'prove', 'proof',
  'experiment', 'experimental',
  'data', 'evidence',
  'confirmed', 'confirm',
  'validated', 'validate',
  // Korean
  '테스트', '검증', '측정', '실험', '데이터', '증거',
  '확인', '검사', '벤치마크',
]

// ============================================================
// Save-time Analysis
// ============================================================

/**
 * Analyze a decision before saving and generate warnings
 *
 * @param topic - Decision topic
 * @param decision - Decision text
 * @param reasoning - Reasoning text
 * @returns Warnings and whether to proceed
 */
export function analyzeDecisionBeforeSave(
  topic: string,
  decision: string,
  reasoning: string
): SaveWarnings {
  const warnings: AntiEchoWarning[] = []

  // 1. Check for evidence in reasoning (AC3)
  if (!hasEvidence(reasoning)) {
    warnings.push({
      type: 'no_evidence',
      level: 'suggestion',
      message: '💡 증거를 추가하면 결정이 더 강해집니다. (test, benchmark, verified 등)',
    })
  }

  // 2. Check debates ratio (AC4)
  try {
    const health = calculateGraphHealth()
    if (health.totalEdges > 0 && health.edgeTypeRatios.debates < DEBATES_WARNING_THRESHOLD) {
      warnings.push({
        type: 'low_debates',
        level: 'suggestion',
        message: '💡 다른 관점에서 이 결정에 반론해보세요. (debates 비율이 낮습니다)',
      })
    }
  } catch {
    // Ignore health check errors
  }

  // 3. Check for similar recent decisions (AC1)
  try {
    const similarWarning = checkSimilarDecisions(topic)
    if (similarWarning) {
      warnings.push(similarWarning)
    }
  } catch (error) {
    // DB error should not block save flow - warnings are advisory only
    logger.warn(`Anti-echo similar check failed: ${error}`)
  }

  logger.info(`Anti-echo analysis: ${warnings.length} warnings for topic "${topic}"`)

  return {
    warnings,
    canProceed: true,  // Warnings are advisory only (AC5)
  }
}

/**
 * Check if reasoning contains evidence keywords
 */
function hasEvidence(reasoning: string): boolean {
  const lowerReasoning = reasoning.toLowerCase()

  for (const keyword of EVIDENCE_KEYWORDS) {
    if (lowerReasoning.includes(keyword.toLowerCase())) {
      return true
    }
  }

  return false
}

/**
 * Check for similar recent decisions on the same topic
 */
function checkSimilarDecisions(topic: string): AntiEchoWarning | null {
  const db = getDatabase()

  // Get recent decisions on the same topic
  const recentDecisions = db.prepare(`
    SELECT COUNT(*) as count
    FROM decisions
    WHERE topic = ? AND superseded_by IS NULL
    AND created_at > ?
  `).get(topic, Date.now() - (7 * 24 * 60 * 60 * 1000)) as { count: number }

  // If there are multiple decisions on the same topic in the last 7 days
  if (recentDecisions.count >= 2) {
    return {
      type: 'similar_decisions',
      level: 'warning',
      message: '⚠️ 최근 결정들이 비슷합니다. 대안을 고려해보세요.',
    }
  }

  return null
}

// ============================================================
// Search-time Analysis
// ============================================================

/**
 * Analyze search results and add stale warnings
 *
 * @param results - Search results with created_at timestamp
 * @returns Array of warnings for each stale result
 */
export function analyzeSearchResults(
  results: Array<{ id: string; created_at: number }>
): SearchWarning[] {
  const warnings: SearchWarning[] = []
  const now = Date.now()
  const staleThreshold = now - (STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

  for (const result of results) {
    if (result.created_at < staleThreshold) {
      const ageInDays = Math.floor((now - result.created_at) / (24 * 60 * 60 * 1000))
      warnings.push({
        decisionId: result.id,
        warning: {
          type: 'stale_decision',
          level: 'warning',
          message: `⚠️ 오래된 결정입니다 (${ageInDays}일). 여전히 유효한지 확인하세요.`,
        },
      })
    }
  }

  return warnings
}

/**
 * Get a single stale warning message for a decision
 */
export function getStaleWarning(createdAt: number): string | null {
  const now = Date.now()
  const ageInDays = Math.floor((now - createdAt) / (24 * 60 * 60 * 1000))

  if (ageInDays >= STALE_THRESHOLD_DAYS) {
    return `⚠️ 오래된 결정입니다 (${ageInDays}일). 여전히 유효한지 확인하세요.`
  }

  return null
}

// ============================================================
// Exports
// ============================================================

export {
  STALE_THRESHOLD_DAYS,
  SIMILARITY_THRESHOLD,
  DEBATES_WARNING_THRESHOLD,
  EVIDENCE_KEYWORDS,
}
