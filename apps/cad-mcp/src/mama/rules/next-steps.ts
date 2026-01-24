/**
 * Next Steps Rules
 *
 * Story 11.7: ActionHints (postExecute)
 *
 * Domain-specific rules for suggesting next actions after CAD operations.
 * Uses entity detection to provide contextual workflow suggestions.
 */

import type { NextStep, SaveSuggestion } from '../types/action-hints.js'

// ============================================================
// Entity Type Detection
// ============================================================

/** Known entity type patterns */
const ENTITY_PATTERNS: Record<string, RegExp[]> = {
  room: [/room/i, /방/i, /floor/i, /space/i],
  wall: [/wall/i, /벽/i, /partition/i],
  door: [/door/i, /문/i, /entrance/i, /exit/i],
  window: [/window/i, /창/i, /창문/i],
  furniture: [/table/i, /chair/i, /desk/i, /bed/i, /sofa/i, /가구/i],
  character: [/chicken/i, /pig/i, /cow/i, /duck/i, /person/i, /캐릭터/i],
  vehicle: [/car/i, /truck/i, /bus/i, /차/i, /vehicle/i],
  tree: [/tree/i, /나무/i, /plant/i, /bush/i],
  building: [/building/i, /house/i, /건물/i, /집/i],
  road: [/road/i, /path/i, /길/i, /도로/i],
}

/**
 * Detect entity types from entity names
 */
export function detectEntityTypes(entities: string[]): string[] {
  const detected = new Set<string>()

  for (const entity of entities) {
    for (const [type, patterns] of Object.entries(ENTITY_PATTERNS)) {
      if (patterns.some((p) => p.test(entity))) {
        detected.add(type)
      }
    }
  }

  return Array.from(detected)
}

// ============================================================
// Next Step Rules by Entity Type
// ============================================================

interface NextStepRule {
  condition: (context: RuleContext) => boolean
  steps: NextStep[]
}

export interface RuleContext {
  entityTypes: string[]
  entitiesCreated: string[]
  toolName: string
  code?: string
}

/** Domain-specific next step rules */
const NEXT_STEP_RULES: NextStepRule[] = [
  // Room created → suggest door/window
  {
    condition: (ctx) => ctx.entityTypes.includes('room'),
    steps: [
      {
        action: 'add_door',
        description: '문 배치하기',
        relevance: '방이 생성되었으니 출입구가 필요합니다',
        optional: false,
      },
      {
        action: 'add_window',
        description: '창문 배치하기',
        relevance: '채광과 환기를 위한 창문을 고려하세요',
        optional: true,
      },
      {
        action: 'add_furniture',
        description: '가구 배치하기',
        relevance: '방의 용도에 맞는 가구를 배치하세요',
        optional: true,
      },
    ],
  },

  // Wall created → suggest extend/connect
  {
    condition: (ctx) => ctx.entityTypes.includes('wall'),
    steps: [
      {
        action: 'extend_wall',
        description: '벽 연장하기',
        relevance: '벽을 연장하여 공간을 구획할 수 있습니다',
        optional: true,
      },
      {
        action: 'add_door',
        description: '문 추가하기',
        relevance: '벽에 출입구를 만들 수 있습니다',
        optional: true,
      },
    ],
  },

  // Character created → suggest animation/accessories
  {
    condition: (ctx) => ctx.entityTypes.includes('character'),
    steps: [
      {
        action: 'add_accessories',
        description: '액세서리 추가하기',
        relevance: '캐릭터에 모자, 안경 등을 추가할 수 있습니다',
        optional: true,
      },
      {
        action: 'create_variation',
        description: '변형 캐릭터 만들기',
        relevance: '색상이나 포즈가 다른 변형을 만들 수 있습니다',
        optional: true,
      },
    ],
  },

  // Vehicle created → suggest wheels/details
  {
    condition: (ctx) => ctx.entityTypes.includes('vehicle'),
    steps: [
      {
        action: 'add_wheels',
        description: '바퀴 추가하기',
        relevance: '차량에 바퀴를 추가하세요',
        optional: false,
      },
      {
        action: 'add_details',
        description: '세부 디테일 추가하기',
        relevance: '창문, 헤드라이트 등 디테일을 추가하세요',
        optional: true,
      },
    ],
  },

  // Building created → suggest roof/details
  {
    condition: (ctx) => ctx.entityTypes.includes('building'),
    steps: [
      {
        action: 'add_roof',
        description: '지붕 추가하기',
        relevance: '건물에 지붕을 추가하세요',
        optional: false,
      },
      {
        action: 'add_windows',
        description: '창문 배치하기',
        relevance: '건물 외관에 창문을 배치하세요',
        optional: true,
      },
      {
        action: 'add_door',
        description: '출입문 추가하기',
        relevance: '건물 입구에 문을 추가하세요',
        optional: false,
      },
    ],
  },

  // Tree/plant created → suggest more vegetation
  {
    condition: (ctx) => ctx.entityTypes.includes('tree'),
    steps: [
      {
        action: 'add_more_trees',
        description: '나무 더 추가하기',
        relevance: '숲이나 정원을 만들려면 더 많은 나무가 필요합니다',
        optional: true,
      },
      {
        action: 'add_ground_cover',
        description: '지면 장식 추가하기',
        relevance: '풀, 꽃 등으로 지면을 꾸밀 수 있습니다',
        optional: true,
      },
    ],
  },

  // Road created → suggest connections
  {
    condition: (ctx) => ctx.entityTypes.includes('road'),
    steps: [
      {
        action: 'extend_road',
        description: '도로 연장하기',
        relevance: '도로를 연장하여 네트워크를 만드세요',
        optional: true,
      },
      {
        action: 'add_crossing',
        description: '교차로 추가하기',
        relevance: '도로 교차점을 만들 수 있습니다',
        optional: true,
      },
    ],
  },

  // ============================================================
  // Advanced Feature Rules (Boolean, Geometry, Utility)
  // ============================================================

  // Multiple overlapping shapes → suggest boolean operations
  {
    condition: (ctx) => ctx.entitiesCreated.length >= 2,
    steps: [
      {
        action: 'boolean_union',
        description: 'booleanUnion으로 도형 합치기',
        relevance: '여러 도형을 하나로 합쳐 단일 객체로 관리',
        optional: true,
      },
      {
        action: 'boolean_difference',
        description: 'booleanDifference로 구멍 뚫기',
        relevance: '한 도형에서 다른 도형을 빼서 구멍이나 오목한 형태 생성',
        optional: true,
      },
    ],
  },

  // Room/Building with door/window → suggest boolean for cutouts
  {
    condition: (ctx) =>
      (ctx.entityTypes.includes('room') || ctx.entityTypes.includes('building')) &&
      (ctx.entityTypes.includes('door') || ctx.entityTypes.includes('window')),
    steps: [
      {
        action: 'cut_opening',
        description: 'booleanDifference로 벽에 개구부 만들기',
        relevance: '문/창문 위치에 실제 구멍을 뚫어 리얼리티 향상',
        optional: true,
      },
    ],
  },

  // Furniture/Character → suggest mirror for symmetry
  {
    condition: (ctx) =>
      ctx.entityTypes.includes('furniture') || ctx.entityTypes.includes('character'),
    steps: [
      {
        action: 'mirror_duplicate',
        description: 'mirror로 대칭 부품 생성',
        relevance: '팔/다리/손잡이 등 대칭 부품을 쉽게 생성',
        optional: true,
      },
      {
        action: 'duplicate_variation',
        description: 'duplicate로 변형 복제',
        relevance: '유사한 객체를 빠르게 복제 후 수정',
        optional: true,
      },
    ],
  },

  // Wall/Frame → suggest offsetPolygon for thickness
  {
    condition: (ctx) =>
      ctx.entityTypes.includes('wall') ||
      ctx.entitiesCreated.some((name) => /frame|border|outline/i.test(name)),
    steps: [
      {
        action: 'offset_outline',
        description: 'offsetPolygon으로 테두리 생성',
        relevance: '도형 외곽에 일정 두께의 테두리 추가',
        optional: true,
      },
    ],
  },

  // Floor/Room → suggest getArea for space analysis
  {
    condition: (ctx) =>
      ctx.entityTypes.includes('room') ||
      ctx.entitiesCreated.some((name) => /floor|space|area/i.test(name)),
    steps: [
      {
        action: 'calculate_area',
        description: 'getArea로 면적 계산',
        relevance: '공간의 면적을 계산하여 설계 검증',
        optional: true,
      },
    ],
  },

  // Complex shape → suggest convexHull
  {
    condition: (ctx) => ctx.entitiesCreated.length >= 5,
    steps: [
      {
        action: 'create_hull',
        description: 'convexHull로 외곽 윤곽 생성',
        relevance: '복잡한 형태의 외곽선을 단순화',
        optional: true,
      },
    ],
  },
]

// ============================================================
// Save Suggestion Rules
// ============================================================

interface SaveSuggestionRule {
  condition: (context: RuleContext) => boolean
  suggestion: SaveSuggestion
}

/** Rules for suggesting when to save decisions */
const SAVE_SUGGESTION_RULES: SaveSuggestionRule[] = [
  // Multiple entities of same type → pattern worth saving
  {
    condition: (ctx) => {
      const typeCount = ctx.entityTypes.length
      const entityCount = ctx.entitiesCreated.length
      return entityCount >= 3 && typeCount === 1
    },
    suggestion: {
      topic: 'voxel:pattern:layout',
      reason: '반복 패턴이 발견되었습니다. 나중에 재사용할 수 있도록 저장하세요.',
    },
  },

  // New character created
  {
    condition: (ctx) =>
      ctx.entityTypes.includes('character') && ctx.entitiesCreated.length === 1,
    suggestion: {
      topic: 'voxel:character:design',
      reason: '새 캐릭터 디자인을 저장하여 일관성을 유지하세요.',
    },
  },

  // Complex building structure
  {
    condition: (ctx) =>
      ctx.entityTypes.includes('building') && ctx.entitiesCreated.length >= 5,
    suggestion: {
      topic: 'voxel:building:structure',
      reason: '복잡한 건물 구조를 저장하여 나중에 참조하세요.',
    },
  },
]

// ============================================================
// Module Hint Rules
// ============================================================

interface ModuleHintRule {
  condition: (context: RuleContext) => boolean
  hints: string[]
}

/** Rules for suggesting related modules */
const MODULE_HINT_RULES: ModuleHintRule[] = [
  {
    condition: (ctx) => ctx.entityTypes.includes('character'),
    hints: [
      'primitives (drawBox, drawCylinder)',
      'materials (setColor)',
      'utility (mirror) - 대칭 부품 생성',
    ],
  },
  {
    condition: (ctx) => ctx.entityTypes.includes('building'),
    hints: [
      'primitives (drawBox)',
      'transforms (translate, rotate)',
      'groups (group)',
      'boolean (booleanDifference) - 창문/문 구멍 뚫기',
      'geometry (offsetPolygon) - 벽 두께 조절',
    ],
  },
  {
    condition: (ctx) =>
      ctx.entityTypes.includes('room') || ctx.entityTypes.includes('wall'),
    hints: [
      'primitives (drawBox)',
      'materials (setColor, setOpacity)',
      'boolean (booleanDifference) - 문/창문 구멍',
      'geometry (getArea) - 면적 계산',
    ],
  },
  // Advanced: Boolean operations for overlapping/combined shapes
  {
    condition: (ctx) => ctx.entitiesCreated.length >= 2,
    hints: [
      'boolean (booleanUnion) - 여러 도형 합치기',
      'boolean (booleanDifference) - 도형에서 구멍 뚫기',
      'boolean (booleanIntersect) - 겹치는 부분만 추출',
    ],
  },
  // Advanced: Geometry analysis for complex shapes
  {
    condition: (ctx) =>
      ctx.entityTypes.includes('furniture') || ctx.entityTypes.includes('vehicle'),
    hints: [
      'geometry (offsetPolygon) - 외곽선/테두리 생성',
      'geometry (convexHull) - 복잡한 형태 단순화',
      'utility (duplicate) - 복제',
      'utility (mirror) - 대칭 복제',
    ],
  },
  // Advanced: Mirror for symmetric objects
  {
    condition: (ctx) => {
      const hasSymmetricKeyword = ctx.entitiesCreated.some(
        (name) => /left|right|l_|r_|_l|_r|arm|leg|eye|ear|wing/i.test(name)
      )
      return hasSymmetricKeyword
    },
    hints: ['utility (mirror) - 반대편 대칭 복제 (x/y축 기준)'],
  },
]

// ============================================================
// Rule Evaluation
// ============================================================

/**
 * Evaluate next step rules and return matching steps
 */
export function evaluateNextSteps(context: RuleContext): NextStep[] {
  const steps: NextStep[] = []

  for (const rule of NEXT_STEP_RULES) {
    if (rule.condition(context)) {
      steps.push(...rule.steps)
    }
  }

  // Deduplicate by action
  const seen = new Set<string>()
  return steps.filter((step) => {
    if (seen.has(step.action)) return false
    seen.add(step.action)
    return true
  })
}

/**
 * Evaluate save suggestion rules
 */
export function evaluateSaveSuggestion(
  context: RuleContext
): SaveSuggestion | undefined {
  for (const rule of SAVE_SUGGESTION_RULES) {
    if (rule.condition(context)) {
      return rule.suggestion
    }
  }
  return undefined
}

/**
 * Evaluate module hint rules
 */
export function evaluateModuleHints(context: RuleContext): string[] {
  const hints: string[] = []

  for (const rule of MODULE_HINT_RULES) {
    if (rule.condition(context)) {
      hints.push(...rule.hints)
    }
  }

  // Deduplicate
  return [...new Set(hints)]
}

/**
 * Generate all action hints for a given context
 */
export function generateActionHints(context: RuleContext): {
  nextSteps: NextStep[]
  moduleHints: string[]
  saveSuggestion?: SaveSuggestion
} {
  return {
    nextSteps: evaluateNextSteps(context),
    moduleHints: evaluateModuleHints(context),
    saveSuggestion: evaluateSaveSuggestion(context),
  }
}
