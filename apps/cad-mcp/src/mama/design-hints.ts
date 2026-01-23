/**
 * DesignHints System
 *
 * Story 11.15: DesignHints System (FR83)
 *
 * Guides Human Chain of Thought (CoT) to help users learn through thinking:
 * - next_concepts: Concepts to learn next
 * - questions: Questions to stimulate thinking
 * - options: Choices with tradeoffs
 *
 * This is the UX counterpart to ActionHints (AX):
 * - ActionHints (AX): Guides AI's next actions
 * - DesignHints (UX): Guides human's next thoughts
 */

import { recordApplication, getLearningByConcept, saveLearning } from './learning-tracker.js'
import { recordIndependentDecision } from './growth-tracker.js'
import { logger } from '../logger.js'

// ============================================================
// Types
// ============================================================

export interface NextConcept {
  concept: string
  relevance: string  // Why learn this now
}

export interface ThinkingQuestion {
  question: string
  purpose: string    // Human CoT purpose
}

export interface DesignOption {
  label: string
  pros: string[]
  cons: string[]
}

export interface DesignHints {
  next_concepts: NextConcept[]
  questions: ThinkingQuestion[]
  options: DesignOption[]
  principle?: string  // Relevant design principle (e.g., "60-30-10 rule")
}

export interface DesignContext {
  domain?: string         // e.g., 'color', 'style', 'layout', 'material'
  userIntent?: string     // What user is trying to do
  currentChoice?: string  // What user chose
}

// ============================================================
// Constants
// ============================================================

// Design domain keywords for detection
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  color: ['color', 'colour', '색', '색상', '컬러', 'palette', 'tone', '톤'],
  style: ['style', '스타일', 'minimal', '미니멀', 'modern', '모던', 'traditional', '전통', 'japandi', 'scandinavian'],
  layout: ['layout', '레이아웃', 'arrangement', '배치', 'position', '위치', 'space', '공간'],
  material: ['material', '재료', '소재', 'wood', '나무', 'metal', '금속', 'fabric', '패브릭'],
}

// Design principles by domain
const PRINCIPLES: Record<string, string[]> = {
  color: [
    '60-30-10 법칙: 주색 60%, 보조색 30%, 강조색 10%',
    '대비와 조화: 보색 대비 vs 유사색 조화',
    '색온도: 따뜻한 색(노랑, 주황) vs 차가운 색(파랑, 초록)',
  ],
  style: [
    'Japandi: 일본 미니멀 + 북유럽 따뜻함',
    'Bauhaus: 형태는 기능을 따른다',
    'Wabi-sabi: 불완전함의 아름다움',
  ],
  layout: [
    '동선: 자주 이동하는 경로의 효율성',
    '시선: 첫 인상을 결정하는 포인트',
    '여백: 공간의 숨결을 위한 비움',
  ],
  material: [
    '질감 대비: 거친 표면 vs 매끄러운 표면',
    '자연 소재 vs 인공 소재의 균형',
    '내구성과 관리의 트레이드오프',
  ],
}

// Style options templates
const STYLE_OPTIONS: Record<string, DesignOption[]> = {
  minimal: [
    {
      label: 'Japandi',
      pros: ['따뜻한 나무톤', '자연 소재 질감', '편안한 분위기'],
      cons: ['완벽한 정돈 필요', '특정 가구 스타일 제한'],
    },
    {
      label: 'Bauhaus',
      pros: ['기하학적 명확함', '기능 중심 디자인', '시대를 초월한 모던함'],
      cons: ['차가운 느낌 가능', '곡선미 부족'],
    },
    {
      label: 'Muji',
      pros: ['극도로 절제된 미학', '무채색의 평화로움', '정리의 용이성'],
      cons: ['개성 표현 제한', '단조로울 수 있음'],
    },
  ],
  modern: [
    {
      label: 'Contemporary',
      pros: ['최신 트렌드 반영', '유연한 스타일 조합'],
      cons: ['트렌드에 민감', '정체성 모호 가능'],
    },
    {
      label: 'Mid-Century Modern',
      pros: ['클래식한 우아함', '검증된 디자인'],
      cons: ['특정 가구 필요', '레트로 느낌'],
    },
  ],
}

// Thinking questions templates by domain
const THINKING_QUESTIONS: Record<string, ThinkingQuestion[]> = {
  color: [
    { question: '이 공간에서 가장 먼저 눈길이 가는 곳은 어디인가요?', purpose: '시각적 초점 인식' },
    { question: '어떤 기분을 느끼고 싶으세요? (활기찬/차분한/따뜻한)', purpose: '감정적 목표 명확화' },
  ],
  style: [
    { question: '이 공간을 한 단어로 표현한다면?', purpose: '핵심 가치 발견' },
    { question: '어떤 공간에서 가장 편안함을 느끼셨나요?', purpose: '개인 취향 탐색' },
  ],
  layout: [
    { question: '이 공간에서 가장 많이 하는 활동은 무엇인가요?', purpose: '기능적 우선순위 파악' },
    { question: '혼자 있을 때와 손님이 있을 때, 어떻게 다르게 사용하세요?', purpose: '유연성 요구 파악' },
  ],
  material: [
    { question: '관리에 얼마나 시간을 쓸 의향이 있으세요?', purpose: '유지보수 우선순위 파악' },
    { question: '촉감이 중요한 공간인가요?', purpose: '감각적 요구 파악' },
  ],
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Detect domain from user message or context
 *
 * @param text - User message or context text
 * @returns Detected domain or null
 */
export function detectDomain(text: string): string | null {
  const lowerText = text.toLowerCase()

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return domain
      }
    }
  }

  return null
}

/**
 * Generate DesignHints based on context
 *
 * @param context - Design context
 * @returns DesignHints or null if not applicable
 */
export function generateDesignHints(context: DesignContext): DesignHints | null {
  const hints: DesignHints = {
    next_concepts: [],
    questions: [],
    options: [],
  }

  // Detect domain from intent if not provided
  const domain = context.domain || detectDomain(context.userIntent || '')

  if (!domain) {
    return null
  }

  // Add principle if available
  const principles = PRINCIPLES[domain]
  if (principles && principles.length > 0) {
    hints.principle = principles[0]  // Primary principle
  }

  // Add thinking questions
  const questions = THINKING_QUESTIONS[domain]
  if (questions) {
    hints.questions = questions.slice(0, 2)  // Max 2 questions
  }

  // Add style options if style domain and user mentioned minimal/modern
  if (domain === 'style' && context.userIntent) {
    const lowerIntent = context.userIntent.toLowerCase()

    if (lowerIntent.includes('미니멀') || lowerIntent.includes('minimal')) {
      hints.options = STYLE_OPTIONS.minimal
    } else if (lowerIntent.includes('모던') || lowerIntent.includes('modern')) {
      hints.options = STYLE_OPTIONS.modern
    }
  }

  // Add next concepts based on domain
  hints.next_concepts = getNextConcepts(domain)

  logger.info(`DesignHints generated for domain: ${domain}`)

  return hints
}

/**
 * Get next concepts to learn for a domain
 *
 * @param domain - Design domain
 * @returns Array of next concepts
 */
function getNextConcepts(domain: string): NextConcept[] {
  const conceptMap: Record<string, NextConcept[]> = {
    color: [
      { concept: '60-30-10 법칙', relevance: '색상 비율의 기본 원칙' },
      { concept: '색 온도와 분위기', relevance: '공간의 감정적 톤 결정' },
    ],
    style: [
      { concept: '스타일 믹스 앤 매치', relevance: '개인화된 공간 연출' },
      { concept: '시대별 스타일 특징', relevance: '디자인 역사 이해' },
    ],
    layout: [
      { concept: '동선 설계', relevance: '공간의 실용성 극대화' },
      { concept: '시선 유도', relevance: '공간의 인상 결정' },
    ],
    material: [
      { concept: '질감 대비', relevance: '시각적 깊이감 추가' },
      { concept: '자연 vs 인공 소재', relevance: '공간의 성격 결정' },
    ],
  }

  return conceptMap[domain] || []
}

/**
 * Record user's style choice and reason
 *
 * AC2: Record selection reason when user explains their choice
 *
 * @param choice - User's choice
 * @param reason - Reason for the choice
 */
export function recordStyleChoice(choice: string, reason?: string): void {
  // Check if this is a known concept
  const learning = getLearningByConcept(choice)

  if (learning) {
    // Record application
    recordApplication(choice)
    logger.info(`Style choice recorded: ${choice}`)
  } else {
    // Save as new learning with user's own naming
    saveLearning({
      concept: choice,
      domain: 'style',
      user_explanation: reason,
    })
    logger.info(`New style preference saved: ${choice}`)
  }

  // Record as independent decision if user expressed understanding
  // Use word boundary patterns to reduce false positives (e.g., "unlike" matching "like")
  if (reason) {
    const independencePatterns = [
      /취향/,           // Korean: preference/taste
      /내가\s/,         // Korean: "I" (followed by space to avoid partial matches)
      /좋아[해하]/,     // Korean: like/love (with verb endings)
      /\bprefer\b/i,    // English: prefer (word boundary)
      /\bI\s+like\b/i,  // English: "I like" (not "unlike")
      /\bmy\s+choice\b/i, // English: "my choice"
    ]
    const expressedIndependence = independencePatterns.some(p => p.test(reason))
    if (expressedIndependence) {
      recordIndependentDecision(learning?.id, `User named their preference: ${choice}`)
    }
  }
}

/**
 * Format DesignHints for display
 *
 * @param hints - DesignHints to format
 * @returns Formatted string
 */
export function formatDesignHints(hints: DesignHints): string {
  const lines: string[] = []

  // Add principle if present
  if (hints.principle) {
    lines.push(`💡 **원리**: ${hints.principle}`)
    lines.push('')
  }

  // Add questions
  if (hints.questions.length > 0) {
    lines.push('🤔 **생각해볼 질문**:')
    for (const q of hints.questions) {
      lines.push(`   • ${q.question}`)
    }
    lines.push('')
  }

  // Add options
  if (hints.options.length > 0) {
    lines.push('🎨 **선택지**:')
    for (const opt of hints.options) {
      lines.push(`   **${opt.label}**`)
      lines.push(`   장점: ${opt.pros.join(', ')}`)
      lines.push(`   단점: ${opt.cons.join(', ')}`)
    }
    lines.push('')
  }

  // Add next concepts
  if (hints.next_concepts.length > 0) {
    lines.push('📚 **다음에 배울 개념**:')
    for (const c of hints.next_concepts) {
      lines.push(`   • ${c.concept}: ${c.relevance}`)
    }
  }

  return lines.join('\n')
}

/**
 * Check if DesignHints should be generated for a context
 *
 * @param userMessage - User's message
 * @returns true if DesignHints are applicable
 */
export function shouldGenerateDesignHints(userMessage: string): boolean {
  const domain = detectDomain(userMessage)
  return domain !== null
}

// ============================================================
// Workflow Phase DesignHints (Story 11.21)
// ============================================================

/**
 * DesignHints by workflow phase
 */
const PHASE_DESIGN_HINTS: Record<string, DesignHints> = {
  discovery: {
    next_concepts: [
      { concept: '스타일 카테고리', relevance: '선호 스타일 파악의 기초' },
      { concept: '레퍼런스 수집', relevance: '비전 구체화' },
    ],
    questions: [
      { question: '이 공간에서 어떤 기분을 느끼고 싶으세요?', purpose: '감정적 목표 명확화' },
      { question: '가장 좋아하는 공간의 특징을 설명해주세요', purpose: '선호 패턴 발견' },
    ],
    options: STYLE_OPTIONS.minimal,
    principle: '비전을 명확히 하면 결정이 쉬워집니다',
  },
  planning: {
    next_concepts: [
      { concept: '60-30-10 법칙', relevance: '색상 비율의 기본' },
      { concept: '재료 선택', relevance: '질감과 분위기 결정' },
    ],
    questions: [
      { question: '따뜻한 분위기 vs 차가운 분위기 중 어떤 것을 선호하세요?', purpose: '색온도 결정' },
      { question: '관리 편의성과 고급스러움 중 우선순위는?', purpose: '재료 트레이드오프' },
    ],
    options: [],
    principle: '60-30-10 법칙: 주색 60%, 보조색 30%, 강조색 10%',
  },
  architecture: {
    next_concepts: [
      { concept: '동선', relevance: '공간의 실용성' },
      { concept: 'z-order', relevance: '시각적 깊이감' },
    ],
    questions: [
      { question: '이 공간에서 가장 많이 이동하는 경로는?', purpose: '동선 파악' },
      { question: '어떤 요소가 먼저 눈에 들어오면 좋겠어요?', purpose: '시선 유도 계획' },
    ],
    options: [],
    principle: '동선은 공간의 스토리를 만듭니다',
  },
  creation: {
    next_concepts: [
      { concept: '점진적 디테일링', relevance: '단계별 완성' },
      { concept: '비율 검증', relevance: '시각적 균형' },
    ],
    questions: [
      { question: '가장 중요한 요소부터 시작할까요?', purpose: '우선순위 결정' },
      { question: '어디서 멈춰야 할지 기준이 있으세요?', purpose: '완성도 기준' },
    ],
    options: [],
    principle: '만들면서 배우고, 배우면서 만듭니다',
  },
  completed: {
    next_concepts: [],
    questions: [],
    options: [],
  },
}

/**
 * Get DesignHints for a workflow phase
 *
 * @param phase - Workflow phase
 * @returns DesignHints for the phase or null
 */
export function getPhaseDesignHints(phase: string): DesignHints | null {
  return PHASE_DESIGN_HINTS[phase] || null
}

// ============================================================
// Exports
// ============================================================

export {
  DOMAIN_KEYWORDS,
  PRINCIPLES,
  STYLE_OPTIONS,
  THINKING_QUESTIONS,
  PHASE_DESIGN_HINTS,
}
