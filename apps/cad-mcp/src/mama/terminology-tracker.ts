/**
 * Terminology Evolution Tracker
 *
 * Story 11.16: Terminology Evolution (FR84)
 *
 * Tracks how user language evolves from vague to specific terms:
 * - Domain-based term mapping (vague → specific)
 * - Learning connection (term evolution linked to learnings)
 * - Question quality scoring
 */

import {
  recordTerminologyEvolution,
  getTerminologyEvolutions,
  getUserLastTerms,
  countTerminologyByDomain,
  getLearning,
  recordGrowthMetric,
} from './db.js'
import { logger } from '../logger.js'
import { DEFAULT_USER_ID } from './config.js'

// ============================================================
// Constants
// ============================================================

// Term mapping: vague terms → specific terms by domain
// AC5: 자동 감지 로직 - 1차: 매핑 사전 매치
export const TERM_MAPPING: Record<string, { vague: string[]; specific: string[] }> = {
  style: {
    vague: ['미니멀하게', '깔끔하게', '심플하게', '모던하게', '간단하게'],
    specific: ['Japandi', 'Bauhaus', 'Muji', 'Scandinavian', 'Mid-Century Modern'],
  },
  color: {
    vague: ['따뜻하게', '차갑게', '색감 어떻게', '밝게', '어둡게'],
    specific: ['60-30-10 비율', '웜톤 팔레트', '보색 대비', '유사색 조화', '색온도'],
  },
  spatial: {
    vague: ['여기', '저기', '어디에', '어디가 좋아', '이쪽'],
    specific: ['동선', '시선 흐름', '개방감', 'focal point', '여백'],
  },
  quality: {
    vague: ['이거 괜찮아요?', '좋아요?', '어때요?'],
    specific: ['트레이드오프', '장단점', '비용 대비', '유지보수 고려'],
  },
}

// Domain keywords for detection
export const DOMAIN_KEYWORDS: Record<string, string[]> = {
  style: ['스타일', 'style', '인테리어', 'interior', '디자인', 'design'],
  color: ['색', 'color', '컬러', '팔레트', 'palette', '톤', 'tone'],
  spatial: ['공간', 'space', '위치', 'position', '배치', 'layout', '동선'],
  quality: ['평가', 'review', '판단', 'judge', '괜찮', 'okay'],
}

// ============================================================
// Types
// ============================================================

export interface TerminologyEvolution {
  id: number
  beforeTerm: string
  afterTerm: string
  domain: string | null
  learningId: string | null
  detectedAt: number
}

export interface QuestionQualityScore {
  specificity: number       // Keyword count score (0-50)
  professionalism: number   // Term mapping match score (0-50)
  total: number             // Combined score (0-100)
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Detect domain from user message
 *
 * Checks both domain keywords and term mappings (vague/specific terms)
 *
 * @param text - User message
 * @returns Detected domain or null
 */
export function detectTermDomain(text: string): string | null {
  const lowerText = text.toLowerCase()

  // First check domain keywords
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return domain
      }
    }
  }

  // Also check term mappings (vague and specific terms)
  for (const [domain, mapping] of Object.entries(TERM_MAPPING)) {
    // Check vague terms
    for (const vague of mapping.vague) {
      if (lowerText.includes(vague.toLowerCase())) {
        return domain
      }
    }
    // Check specific terms
    for (const specific of mapping.specific) {
      if (lowerText.includes(specific.toLowerCase())) {
        return domain
      }
    }
  }

  return null
}

/**
 * Check if a term is vague
 *
 * @param term - Term to check
 * @param domain - Optional domain to narrow search
 * @returns true if term is vague
 */
export function isVagueTerm(term: string, domain?: string): boolean {
  const lowerTerm = term.toLowerCase()

  if (domain && TERM_MAPPING[domain]) {
    return TERM_MAPPING[domain].vague.some((v) => lowerTerm.includes(v.toLowerCase()))
  }

  for (const mapping of Object.values(TERM_MAPPING)) {
    if (mapping.vague.some((v) => lowerTerm.includes(v.toLowerCase()))) {
      return true
    }
  }

  return false
}

/**
 * Check if a term is specific
 *
 * @param term - Term to check
 * @param domain - Optional domain to narrow search
 * @returns true if term is specific
 */
export function isSpecificTerm(term: string, domain?: string): boolean {
  const lowerTerm = term.toLowerCase()

  if (domain && TERM_MAPPING[domain]) {
    return TERM_MAPPING[domain].specific.some((s) => lowerTerm.includes(s.toLowerCase()))
  }

  for (const mapping of Object.values(TERM_MAPPING)) {
    if (mapping.specific.some((s) => lowerTerm.includes(s.toLowerCase()))) {
      return true
    }
  }

  return false
}

/**
 * Find matching specific term for a vague term
 *
 * @param vagueText - Text containing vague term
 * @returns Domain and potential specific terms
 */
export function findTermDomain(text: string): { domain: string; vagueTerm: string } | null {
  const lowerText = text.toLowerCase()

  for (const [domain, mapping] of Object.entries(TERM_MAPPING)) {
    for (const vague of mapping.vague) {
      if (lowerText.includes(vague.toLowerCase())) {
        return { domain, vagueTerm: vague }
      }
    }
  }

  return null
}

/**
 * Extract specific terms from text
 *
 * @param text - User message
 * @returns Array of { domain, term }
 */
export function extractSpecificTerms(text: string): Array<{ domain: string; term: string }> {
  const results: Array<{ domain: string; term: string }> = []
  const lowerText = text.toLowerCase()

  for (const [domain, mapping] of Object.entries(TERM_MAPPING)) {
    for (const specific of mapping.specific) {
      if (lowerText.includes(specific.toLowerCase())) {
        results.push({ domain, term: specific })
      }
    }
  }

  return results
}

/**
 * Record terminology evolution
 *
 * AC1: 전문 용어 사용 감지
 * AC2: 학습과 연결
 *
 * @param args - Evolution data
 * @returns Evolution ID
 */
export function recordEvolution(args: {
  beforeTerm: string
  afterTerm: string
  domain?: string
  learningId?: string
  userId?: string
}): number {
  const userId = args.userId || DEFAULT_USER_ID

  // Try to find related learning
  let learningId = args.learningId
  if (!learningId && args.afterTerm) {
    // Check if there's a learning related to this term
    const learning = getLearning(userId, args.afterTerm)
    if (learning) {
      learningId = learning.id
    }
  }

  const id = recordTerminologyEvolution({
    user_id: userId,
    before_term: args.beforeTerm,
    after_term: args.afterTerm,
    domain: args.domain,
    learning_id: learningId,
  })

  logger.info(`Terminology evolution: ${args.beforeTerm} → ${args.afterTerm}`)

  return id
}

/**
 * Detect and record terminology evolution from user messages
 *
 * AC5: 자동 감지 로직
 *
 * @param previousMessage - Previous user message
 * @param currentMessage - Current user message
 * @param userId - User ID
 * @returns Evolution if detected, null otherwise
 */
export function detectEvolution(
  previousMessage: string,
  currentMessage: string,
  userId = DEFAULT_USER_ID
): TerminologyEvolution | null {
  // Find vague term in previous message
  const vagueInfo = findTermDomain(previousMessage)
  if (!vagueInfo) {
    return null
  }

  // Find specific term in current message
  const specificTerms = extractSpecificTerms(currentMessage)
  const matchingSpecific = specificTerms.find((s) => s.domain === vagueInfo.domain)

  if (!matchingSpecific) {
    return null
  }

  // Check for related learning (same as recordEvolution logic)
  const learning = getLearning(userId, matchingSpecific.term)
  const learningId = learning?.id ?? null

  // Record evolution
  const id = recordEvolution({
    beforeTerm: vagueInfo.vagueTerm,
    afterTerm: matchingSpecific.term,
    domain: vagueInfo.domain,
    learningId: learningId ?? undefined,
    userId,
  })

  return {
    id,
    beforeTerm: vagueInfo.vagueTerm,
    afterTerm: matchingSpecific.term,
    domain: vagueInfo.domain,
    learningId,
    detectedAt: Date.now(),
  }
}

// ============================================================
// Question Quality Functions (AC3)
// ============================================================

/**
 * Calculate question quality score
 *
 * AC3: 질문 품질 향상 감지
 * Score = specificity (keyword count) + professionalism (term mapping match)
 *
 * @param question - User's question
 * @returns Quality score
 */
export function calculateQuestionQuality(question: string): QuestionQualityScore {
  // Specificity: count meaningful keywords (longer words = more specific)
  const words = question.split(/\s+/).filter((w) => w.length > 2)
  const specificWords = words.filter((w) => w.length > 4)
  const specificity = Math.min(50, (specificWords.length / Math.max(1, words.length)) * 100)

  // Professionalism: count specific terms from mapping
  const specificTerms = extractSpecificTerms(question)
  const professionalism = Math.min(50, specificTerms.length * 15)

  return {
    specificity: Math.round(specificity),
    professionalism: Math.round(professionalism),
    total: Math.round(specificity + professionalism),
  }
}

/**
 * Check if question quality improved
 *
 * AC3: 향상 판정 - 최근 3회 평균 대비 +10% 이상 또는 절대 점수 +5점 이상
 *
 * @param currentScore - Current question score
 * @param recentScores - Recent 3 question scores
 * @returns true if improved
 */
export function hasQuestionQualityImproved(
  currentScore: number,
  recentScores: number[]
): boolean {
  if (recentScores.length === 0) {
    return false
  }

  const average = recentScores.reduce((a, b) => a + b, 0) / recentScores.length

  // +10% improvement
  const percentImproved = currentScore >= average * 1.1

  // +5 points absolute improvement
  const absoluteImproved = currentScore >= average + 5

  return percentImproved || absoluteImproved
}

/**
 * Record question quality improvement
 *
 * @param userId - User ID
 * @param context - Context about the improvement
 */
export function recordQuestionQualityImprovement(
  userId = DEFAULT_USER_ID,
  context?: string
): number {
  return recordGrowthMetric({
    user_id: userId,
    metric_type: 'terminology_used',
    context: context || 'Question quality improved',
  })
}

// ============================================================
// Growth Report Integration Functions (AC4)
// ============================================================

/**
 * Get terminology evolutions for growth report
 *
 * AC4: 성장 리포트에 언어 변화 포함
 *
 * @param userId - User ID
 * @param periodDays - Period in days
 * @returns Array of evolutions
 */
export function getEvolutionsForReport(
  userId = DEFAULT_USER_ID,
  periodDays = 30
): TerminologyEvolution[] {
  const rows = getTerminologyEvolutions(userId, periodDays)

  return rows.map((row) => ({
    id: row.id,
    beforeTerm: row.before_term,
    afterTerm: row.after_term,
    domain: row.domain,
    learningId: row.learning_id,
    detectedAt: row.detected_at,
  }))
}

/**
 * Format terminology evolutions for growth report
 *
 * AC4: "💬 언어의 변화" 섹션 포맷
 *
 * @param evolutions - Array of evolutions
 * @returns Formatted string
 */
export function formatTerminologySection(evolutions: TerminologyEvolution[]): string | null {
  if (evolutions.length === 0) {
    return null
  }

  const lines: string[] = ['💬 언어의 변화:']

  for (let i = 0; i < evolutions.length; i++) {
    const e = evolutions[i]
    const prefix = i === evolutions.length - 1 ? '└──' : '├──'
    const suffix = e.learningId ? ' (관련 학습 후)' : ''
    lines.push(`${prefix} "${e.beforeTerm}" → "${e.afterTerm}"${suffix}`)
  }

  return lines.join('\n')
}

/**
 * Get terminology statistics for report
 *
 * @param userId - User ID
 * @param periodDays - Period in days
 */
export function getTerminologyStats(
  userId = DEFAULT_USER_ID,
  periodDays = 30
): {
  totalEvolutions: number
  byDomain: Record<string, number>
  lastUsedTerms: Record<string, string[]>
} {
  const byDomain = countTerminologyByDomain(userId, periodDays)
  const lastUsedTerms = getUserLastTerms(userId)
  const totalEvolutions = Object.values(byDomain).reduce((a, b) => a + b, 0)

  return {
    totalEvolutions,
    byDomain,
    lastUsedTerms,
  }
}

// ============================================================
// Note: TERM_MAPPING and DOMAIN_KEYWORDS are already exported via their const declarations
// ============================================================
