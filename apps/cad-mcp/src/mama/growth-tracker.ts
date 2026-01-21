/**
 * Growth Tracker Module
 *
 * Story 11.14: User Growth Metrics (FR82)
 *
 * Records and tracks user growth metrics:
 * - independent_decision: AI 제안 없이 결정
 * - concept_applied: 배운 개념 적용
 * - tradeoff_predicted: 트레이드오프 예측
 * - terminology_used: 전문 용어 사용
 */

import {
  recordGrowthMetric,
  countGrowthMetricsByType,
  calculateIndependentRatio,
  getFirstActivityTimestamp,
  type GrowthMetricType,
  type GrowthMetricRow,
  getUserLearnings,
  type LearningRow,
} from './db.js'
import { setGlobalSkillLevel } from './db.js'
import { logger } from '../logger.js'

// ============================================================
// Types
// ============================================================

export interface RecordGrowthParams {
  type: GrowthMetricType
  relatedLearningId?: string
  relatedDecisionId?: string
  context?: string
}

export interface GrowthSummary {
  period_days: number
  metrics: Record<GrowthMetricType, number>
  independentRatio: {
    firstHalf: number
    secondHalf: number
    trend: 'improving' | 'stable' | 'declining'
    hasEnoughData: boolean
  }
  newConceptsLearned: number
  shouldUpgradeSkillLevel: boolean
  daysActive: number | null
  reportTrigger: 'checkpoint' | '30_days' | 'manual' | null
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_USER_ID = 'default'
const EXPERT_THRESHOLD = 70 // 70% independent decision ratio for expert level
const REPORT_TRIGGER_DAYS = 30

// ============================================================
// Core Functions
// ============================================================

/**
 * Record a growth metric
 *
 * @param params - Metric parameters
 * @returns Created metric ID
 */
export function recordGrowth(params: RecordGrowthParams): number {
  const metricId = recordGrowthMetric({
    user_id: DEFAULT_USER_ID,
    metric_type: params.type,
    related_learning_id: params.relatedLearningId,
    related_decision_id: params.relatedDecisionId,
    context: params.context,
  })

  logger.info(`Growth recorded: ${params.type}`)

  // Check for automatic skill level upgrade after recording
  checkSkillLevelUpgrade()

  return metricId
}

/**
 * Record independent decision
 *
 * AC1: User made decision without AI suggestion, mentioning learned concept
 */
export function recordIndependentDecision(
  relatedLearningId?: string,
  context?: string
): number {
  return recordGrowth({
    type: 'independent_decision',
    relatedLearningId,
    context,
  })
}

/**
 * Record concept application
 *
 * AC2: User applied a learned concept
 */
export function recordConceptApplied(
  relatedLearningId: string,
  context?: string
): number {
  return recordGrowth({
    type: 'concept_applied',
    relatedLearningId,
    context,
  })
}

/**
 * Record tradeoff prediction
 *
 * AC3: User predicted tradeoffs before AI mentioned them
 */
export function recordTradeoffPredicted(
  relatedDecisionId?: string,
  context?: string
): number {
  return recordGrowth({
    type: 'tradeoff_predicted',
    relatedDecisionId,
    context,
  })
}

/**
 * Record terminology usage
 *
 * AC6: User used professional terminology
 */
export function recordTerminologyUsed(
  relatedLearningId?: string,
  context?: string
): number {
  return recordGrowth({
    type: 'terminology_used',
    relatedLearningId,
    context,
  })
}

/**
 * Get growth summary for a period
 *
 * AC4: Generate growth report
 *
 * @param periodDays - Period in days (default: 30)
 * @param trigger - What triggered this report
 */
export function getGrowthSummary(
  periodDays = 30,
  trigger: 'checkpoint' | '30_days' | 'manual' | null = null
): GrowthSummary {
  const metrics = countGrowthMetricsByType(DEFAULT_USER_ID, periodDays)
  const independentRatio = calculateIndependentRatio(DEFAULT_USER_ID, periodDays)

  // Calculate trend
  let trend: 'improving' | 'stable' | 'declining' = 'stable'
  if (independentRatio.hasEnoughData) {
    const diff = independentRatio.secondHalf - independentRatio.firstHalf
    if (diff >= 10) {
      trend = 'improving'
    } else if (diff <= -10) {
      trend = 'declining'
    }
  }

  // Count new concepts learned
  const learnings = getUserLearnings(DEFAULT_USER_ID)
  const periodStart = Date.now() - periodDays * 24 * 60 * 60 * 1000
  const newConceptsLearned = learnings.filter((l) => l.first_introduced > periodStart).length

  // Check if should upgrade skill level (AC5)
  const shouldUpgradeSkillLevel = independentRatio.secondHalf >= EXPERT_THRESHOLD

  // Calculate days active
  const firstActivity = getFirstActivityTimestamp(DEFAULT_USER_ID)
  const daysActive = firstActivity
    ? Math.floor((Date.now() - firstActivity) / (24 * 60 * 60 * 1000))
    : null

  return {
    period_days: periodDays,
    metrics,
    independentRatio: {
      ...independentRatio,
      trend,
    },
    newConceptsLearned,
    shouldUpgradeSkillLevel,
    daysActive,
    reportTrigger: trigger,
  }
}

/**
 * Format growth summary as string
 *
 * @param summary - Growth summary
 */
export function formatGrowthReport(summary: GrowthSummary): string {
  const lines: string[] = []

  lines.push(`📈 ${summary.period_days}일간의 성장:`)

  // Independent decision ratio with trend
  if (summary.independentRatio.hasEnoughData) {
    const trendIcon = summary.independentRatio.trend === 'improving'
      ? '📈'
      : summary.independentRatio.trend === 'declining'
        ? '📉'
        : '➡️'
    lines.push(`├── 독립 결정 비율: ${summary.independentRatio.firstHalf}% → ${summary.independentRatio.secondHalf}% ${trendIcon}`)
  } else {
    const currentRatio = summary.independentRatio.secondHalf || summary.independentRatio.firstHalf
    lines.push(`├── 독립 결정 비율: ${currentRatio}%`)
  }

  // Metrics counts
  lines.push(`├── 개념 적용 횟수: ${summary.metrics.concept_applied}회`)
  lines.push(`├── 트레이드오프 예측: ${summary.metrics.tradeoff_predicted}회`)
  lines.push(`├── 전문 용어 사용: ${summary.metrics.terminology_used}회`)
  lines.push(`└── 새로 배운 개념: ${summary.newConceptsLearned}개`)

  // Skill level upgrade notice
  if (summary.shouldUpgradeSkillLevel) {
    lines.push('')
    lines.push(`🎉 독립 결정 비율이 ${EXPERT_THRESHOLD}%를 넘었습니다! 숙련자 레벨로 전환할 수 있습니다.`)
  }

  return lines.join('\n')
}

/**
 * Check if skill level should be upgraded based on growth metrics
 *
 * AC5: Auto-upgrade to expert when independent_decision ratio >= 70%
 */
export function checkSkillLevelUpgrade(): boolean {
  const summary = getGrowthSummary(30)

  if (summary.shouldUpgradeSkillLevel) {
    setGlobalSkillLevel('expert')
    logger.info('Skill level auto-upgraded to expert based on growth metrics')
    return true
  }

  return false
}

/**
 * Check if 30-day report should be triggered
 *
 * AC4: Report trigger after 30 days from first activity
 */
export function shouldTrigger30DayReport(): boolean {
  const firstActivity = getFirstActivityTimestamp(DEFAULT_USER_ID)

  if (!firstActivity) {
    return false
  }

  const daysActive = Math.floor((Date.now() - firstActivity) / (24 * 60 * 60 * 1000))
  return daysActive >= REPORT_TRIGGER_DAYS
}

/**
 * Find related learning by matching concept in user message
 *
 * @param userMessage - User's message
 * @returns Related learning if found
 */
export function findRelatedLearning(userMessage: string): LearningRow | null {
  const learnings = getUserLearnings(DEFAULT_USER_ID)
  const lowerMessage = userMessage.toLowerCase()

  for (const learning of learnings) {
    if (lowerMessage.includes(learning.concept.toLowerCase())) {
      return learning
    }
  }

  return null
}

// ============================================================
// Exports
// ============================================================

export { DEFAULT_USER_ID, EXPERT_THRESHOLD, REPORT_TRIGGER_DAYS }
export type { GrowthMetricRow, GrowthMetricType }
