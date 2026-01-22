/**
 * Graph Health Metrics
 *
 * Story 11.11: Graph Health Metrics (FR77)
 *
 * Measures the health of the Reasoning Graph:
 * - Total decisions and edge type distribution
 * - Orphan decisions (no relationships)
 * - Stale decisions (90+ days old)
 * - Echo chamber warnings (debates < 10%)
 */

import { getDatabase } from './db.js'
import { logger } from '../logger.js'

// ============================================================
// Types
// ============================================================

export interface EdgeTypeCounts {
  supersedes: number
  builds_on: number
  debates: number
  synthesizes: number
}

export interface GraphHealth {
  totalDecisions: number
  totalEdges: number
  edgeTypeCounts: EdgeTypeCounts
  edgeTypeRatios: {
    supersedes: number
    builds_on: number
    debates: number
    synthesizes: number
  }
  orphanCount: number
  orphanRatio: number
  staleDecisions: Array<{
    id: string
    topic: string
    created_at: number
    age_days: number
  }>
  warnings: string[]
  healthScore: number  // 0-100
}

// ============================================================
// Constants
// ============================================================

const STALE_THRESHOLD_DAYS = 90
const DEBATES_WARNING_THRESHOLD = 0.10  // 10%
const ORPHAN_WARNING_THRESHOLD = 0.30   // 30%

// ============================================================
// Health Metrics Calculation
// ============================================================

/**
 * Calculate graph health metrics
 *
 * @returns GraphHealth object with all metrics and warnings
 */
export function calculateGraphHealth(): GraphHealth {
  const db = getDatabase()
  const warnings: string[] = []

  // 1. Total decisions count
  const totalDecisionsResult = db.prepare(`
    SELECT COUNT(*) as count FROM decisions
  `).get() as { count: number }
  const totalDecisions = totalDecisionsResult.count

  // Empty graph case
  if (totalDecisions === 0) {
    return {
      totalDecisions: 0,
      totalEdges: 0,
      edgeTypeCounts: { supersedes: 0, builds_on: 0, debates: 0, synthesizes: 0 },
      edgeTypeRatios: { supersedes: 0, builds_on: 0, debates: 0, synthesizes: 0 },
      orphanCount: 0,
      orphanRatio: 0,
      staleDecisions: [],
      warnings: [],
      healthScore: 100,
    }
  }

  // 2. Edge type counts
  const edgeTypeCounts = db.prepare(`
    SELECT
      relationship,
      COUNT(*) as count
    FROM decision_edges
    GROUP BY relationship
  `).all() as Array<{ relationship: string; count: number }>

  const counts: EdgeTypeCounts = {
    supersedes: 0,
    builds_on: 0,
    debates: 0,
    synthesizes: 0,
  }

  let totalEdges = 0
  for (const row of edgeTypeCounts) {
    if (row.relationship in counts) {
      counts[row.relationship as keyof EdgeTypeCounts] = row.count
      totalEdges += row.count
    }
  }

  // 3. Calculate ratios
  const ratios = {
    supersedes: totalEdges > 0 ? counts.supersedes / totalEdges : 0,
    builds_on: totalEdges > 0 ? counts.builds_on / totalEdges : 0,
    debates: totalEdges > 0 ? counts.debates / totalEdges : 0,
    synthesizes: totalEdges > 0 ? counts.synthesizes / totalEdges : 0,
  }

  // 4. Orphan count (decisions with no edges)
  const orphanResult = db.prepare(`
    SELECT COUNT(*) as count
    FROM decisions d
    WHERE NOT EXISTS (
      SELECT 1 FROM decision_edges e
      WHERE e.from_id = d.id OR e.to_id = d.id
    )
  `).get() as { count: number }
  const orphanCount = orphanResult.count
  const orphanRatio = totalDecisions > 0 ? orphanCount / totalDecisions : 0

  // 5. Stale decisions (90+ days old)
  const now = Date.now()
  const staleThreshold = now - (STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

  // Get total count of stale decisions first
  const staleCountResult = db.prepare(`
    SELECT COUNT(*) as count
    FROM decisions
    WHERE created_at < ?
  `).get(staleThreshold) as { count: number }
  const totalStaleCount = staleCountResult.count

  // Get sample of stale decisions for display
  const staleDecisions = db.prepare(`
    SELECT id, topic, created_at
    FROM decisions
    WHERE created_at < ?
    ORDER BY created_at ASC
    LIMIT 10
  `).all(staleThreshold) as Array<{ id: string; topic: string; created_at: number }>

  const staleWithAge = staleDecisions.map(d => ({
    ...d,
    age_days: Math.floor((now - d.created_at) / (24 * 60 * 60 * 1000)),
  }))

  // 6. Generate warnings
  // Echo chamber warning
  if (totalEdges > 0 && ratios.debates < DEBATES_WARNING_THRESHOLD) {
    const debatesPercent = (ratios.debates * 100).toFixed(1)
    warnings.push(`⚠️ 에코챔버 위험: 반론(debates) 비율이 ${debatesPercent}%로 낮습니다. 다양한 관점을 고려해보세요.`)
  }

  // High orphan ratio warning
  if (orphanRatio > ORPHAN_WARNING_THRESHOLD) {
    const orphanPercent = (orphanRatio * 100).toFixed(1)
    warnings.push(`⚠️ 고아 결정 경고: ${orphanPercent}%의 결정이 연결되지 않았습니다. builds_on/debates 관계를 추가해보세요.`)
  }

  // Stale decisions warning
  if (totalStaleCount > 0) {
    warnings.push(`⚠️ ${totalStaleCount}개의 오래된 결정(90일+)이 있습니다. 여전히 유효한지 확인하세요.`)
  }

  // 7. Calculate health score (0-100)
  const healthScore = calculateHealthScore(totalDecisions, totalEdges, ratios, orphanRatio, totalStaleCount)

  logger.info(`Graph health calculated: ${totalDecisions} decisions, ${totalEdges} edges, score=${healthScore}`)

  return {
    totalDecisions,
    totalEdges,
    edgeTypeCounts: counts,
    edgeTypeRatios: ratios,
    orphanCount,
    orphanRatio,
    staleDecisions: staleWithAge,
    warnings,
    healthScore,
  }
}

/**
 * Calculate overall health score (0-100)
 */
function calculateHealthScore(
  totalDecisions: number,
  totalEdges: number,
  ratios: { debates: number },
  orphanRatio: number,
  staleCount: number
): number {
  if (totalDecisions === 0) return 100

  let score = 100

  // Deduct for low debates ratio (max -30)
  if (ratios.debates < DEBATES_WARNING_THRESHOLD) {
    const deduction = Math.min(30, (DEBATES_WARNING_THRESHOLD - ratios.debates) * 300)
    score -= deduction
  }

  // Deduct for high orphan ratio (max -25)
  if (orphanRatio > ORPHAN_WARNING_THRESHOLD) {
    const deduction = Math.min(25, (orphanRatio - ORPHAN_WARNING_THRESHOLD) * 50)
    score -= deduction
  }

  // Deduct for stale decisions (max -20)
  const staleDeduction = Math.min(20, staleCount * 4)
  score -= staleDeduction

  // Bonus for edge diversity (max +10)
  if (totalEdges >= totalDecisions * 0.5) {
    score = Math.min(100, score + 10)
  }

  return Math.max(0, Math.round(score))
}

// ============================================================
// Formatted Report
// ============================================================

/**
 * Generate formatted health report for display
 */
export function formatHealthReport(health: GraphHealth): string {
  const lines: string[] = []

  // Header with score
  const scoreEmoji = health.healthScore >= 80 ? '🟢' : health.healthScore >= 50 ? '🟡' : '🔴'
  lines.push(`📊 **Graph Health Report** ${scoreEmoji} Score: ${health.healthScore}/100`)
  lines.push('')

  // Basic stats
  lines.push('**📈 Statistics:**')
  lines.push(`├── Total Decisions: ${health.totalDecisions}`)
  lines.push(`├── Total Edges: ${health.totalEdges}`)
  lines.push(`└── Orphan Ratio: ${(health.orphanRatio * 100).toFixed(1)}%`)
  lines.push('')

  // Edge distribution
  if (health.totalEdges > 0) {
    lines.push('**🔗 Edge Distribution:**')
    const { edgeTypeCounts: c, edgeTypeRatios: r } = health
    lines.push(`├── supersedes: ${c.supersedes} (${(r.supersedes * 100).toFixed(1)}%)`)
    lines.push(`├── builds_on: ${c.builds_on} (${(r.builds_on * 100).toFixed(1)}%)`)
    lines.push(`├── debates: ${c.debates} (${(r.debates * 100).toFixed(1)}%)`)
    lines.push(`└── synthesizes: ${c.synthesizes} (${(r.synthesizes * 100).toFixed(1)}%)`)
    lines.push('')
  }

  // Stale decisions
  if (health.staleDecisions.length > 0) {
    lines.push('**⏰ Stale Decisions (90+ days):**')
    for (const d of health.staleDecisions.slice(0, 5)) {
      lines.push(`├── ${d.topic} (${d.age_days}d old)`)
    }
    if (health.staleDecisions.length > 5) {
      lines.push(`└── ... and ${health.staleDecisions.length - 5} more`)
    }
    lines.push('')
  }

  // Warnings
  if (health.warnings.length > 0) {
    lines.push('**⚠️ Warnings:**')
    for (const w of health.warnings) {
      lines.push(`• ${w}`)
    }
  } else {
    lines.push('✅ No warnings - graph is healthy!')
  }

  return lines.join('\n')
}

/**
 * Get compact health summary for session init
 */
export function getHealthSummary(health: GraphHealth): string | null {
  if (health.warnings.length === 0) {
    return null
  }

  // Return first warning only for compact summary
  return health.warnings[0]
}
