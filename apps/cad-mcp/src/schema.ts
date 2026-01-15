/**
 * Canonical Tool Schema - LLM-agnostic
 * 특정 LLM 벤더에 종속되지 않는 내부 표준 스키마
 *
 * Story 9.4: run_cad_code가 단일 MCP 진입점
 * 다른 함수들(drawCircle, drawRect 등)은 JavaScript 코드 내에서 호출됨
 */

export interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  items?: ParameterSchema; // array인 경우
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterSchema>;
    required: string[];
  };
}

/**
 * 도메인 정의 (sandbox에서 사용 가능한 JavaScript 함수들)
 * 이 함수들은 run_cad_code로 전달되는 JavaScript 코드 내에서 호출됨
 */
export const DOMAINS = {
  primitives: ['drawCircle', 'drawRect', 'drawLine', 'drawArc', 'drawPolygon', 'drawBezier', 'drawText'],
  style: ['setFill', 'setStroke', 'drawOrder'],
  transforms: ['translate', 'rotate', 'scale', 'setPivot', 'deleteEntity'],
  groups: ['createGroup', 'addToGroup'],
  query: ['getEntity', 'exists', 'getWorldBounds', 'getDrawOrder', 'getTextMetrics', 'fitToViewport'],
  boolean: ['booleanUnion', 'booleanDifference', 'booleanIntersect'],
  geometry: ['offsetPolygon', 'getArea', 'convexHull', 'decompose'],
  utility: ['duplicate', 'mirror'],
} as const;

// Type declarations before usage for better readability
export type DomainName = keyof typeof DOMAINS;
export type ToolName = (typeof DOMAINS)[DomainName][number];

/**
 * 도메인 메타데이터 (LLM용 설명 포함)
 */
export const DOMAIN_METADATA: Record<DomainName, { description: string }> = {
  primitives: { description: '기본 도형 그리기 (원, 사각형, 선, 호, 폴리곤, 베지어, 텍스트)' },
  style: { description: '도형 스타일 설정 (fill, stroke, z-order)' },
  transforms: { description: '도형 변환 (이동, 회전, 크기, 피벗, 삭제)' },
  groups: { description: '그룹 관리 (생성, 추가)' },
  query: { description: '씬 상태 조회 (엔티티 정보, 좌표, 드로우 오더)' },
  boolean: { description: 'Boolean 연산 (합집합, 차집합, 교집합)' },
  geometry: { description: '기하 분석 (오프셋, 면적, 볼록껍질, 분해)' },
  utility: { description: '유틸리티 (복제, 미러)' },
};

/**
 * MCP 도구 스키마 정의
 *
 * Story 9.4: run_cad_code가 단일 진입점
 * - run_cad_code: JavaScript 코드 실행 (핵심 도구)
 * - describe: 도메인별 함수 설명 조회 (탐색용)
 * - list_domains/list_tools: 사용 가능한 함수 목록 (탐색용)
 * - export_json/export_svg: 씬 내보내기
 * - get_scene_info: 씬 상태 조회
 */
/**
 * 도메인 MCP 도구 스키마 (SpineLift 패턴)
 *
 * Story 9.x: 18개 flat 도구 → 5개 도메인 도구로 통합
 * 패턴: action 파라미터로 동작 선택 (MAMA save({ type: ... }) 스타일)
 *
 * 도메인:
 * - cad_code: JavaScript 코드 실행/편집 (핵심)
 * - discovery: 함수 탐색 (list_domains, describe, list_tools)
 * - scene: 씬 조회 (info, overview, groups, selection, reset)
 * - export: 내보내기 (json, svg, capture)
 * - module: 모듈 관리 (save, list, get, delete)
 */
export const DOMAIN_TOOLS: Record<string, ToolSchema> = {
  // === 핵심 도구: cad_code ===
  cad_code: {
    name: 'cad_code',
    description: `CAD JavaScript 실행 환경. 함수/클래스/재귀 모두 가능.

내장 함수: drawCircle, drawRect, drawLine, drawPolygon, drawArc, drawBezier, drawText, setFill, setStroke, translate, rotate, scale, createGroup, booleanUnion, booleanDifference, booleanIntersect, duplicate, mirror 등

좌표: Y+ 위, 원점 중심. 색상: RGBA 0~1. 각도: 라디안. 문자열: '작은따옴표'

discovery(action='describe', domain='primitives') → 시그니처 확인
scene(action='info') → 현재 씬 상태`,
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: "대상 파일: 'main' 또는 모듈명" },
        code: { type: 'string', description: "코드. '+' prefix면 추가 모드" },
        old_code: { type: 'string', description: '교체할 기존 코드 (부분 수정)' },
        new_code: { type: 'string', description: '새 코드 (부분 수정)' },
      },
      required: [],
    },
  },

  // === 탐색 도구: discovery ===
  discovery: {
    name: 'discovery',
    description: `CAD 함수 탐색 도구. cad_code 실행 전 확인.

ACTIONS
- list_domains: 도메인 목록 (primitives, style, transforms, ...)
- describe: 도메인별 함수 시그니처 (domain 필수)
- list_tools: 함수 목록 (domain 선택)
- get_schema: 단일 함수 상세 (name 필수)
- request: 새 함수 요청 (name, description, rationale 필수)

→ scene(action='info') 현재 씬
→ export(action='capture') 결과 확인
→ 재사용? module로 저장`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: "동작: 'list_domains' | 'describe' | 'list_tools' | 'get_schema' | 'request'",
        },
        domain: { type: 'string', description: 'describe/list_tools용 도메인명' },
        name: { type: 'string', description: 'get_schema/request용 함수명' },
        description: { type: 'string', description: 'request용 함수 설명' },
        rationale: { type: 'string', description: 'request용 필요 이유' },
      },
      required: ['action'],
    },
  },

  // === 씬 조회 도구: scene ===
  scene: {
    name: 'scene',
    description: `씬 상태 조회 및 관리.

ACTIONS
- info: 씬 요약 (entityCount, bounds)
- overview: 트리 구조 (groups, hierarchy)
- groups: 그룹 목록만
- selection: 현재 선택된 엔티티
- draw_order: 그리기 순서 조회 (group 파라미터로 그룹 내부 조회). 뒤→앞 순서
- reset: 씬 초기화 (되돌릴 수 없음)

💡 drawOrder() 전에 draw_order로 현재 상태 확인 권장
cad_code 후 결과 확인 → export 전 미리보기`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: "동작: 'info' | 'overview' | 'groups' | 'selection' | 'draw_order' | 'reset'",
        },
        group: {
          type: 'string',
          description: "draw_order용: 그룹명 (생략 시 root level)",
        },
      },
      required: ['action'],
    },
  },

  // === 내보내기 도구: export ===
  export: {
    name: 'export',
    description: `씬 내보내기.

ACTIONS
- json: 전체 씬 JSON
- svg: SVG 벡터 이미지
- capture: 뷰어 스크린샷 (PNG)
  - clearSketch: 캡처 후 스케치 클리어 (boolean)

scene으로 확인 후 최종 출력`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: "동작: 'json' | 'svg' | 'capture'",
        },
        clearSketch: { type: 'boolean', description: 'capture: 캡처 후 스케치 클리어' },
      },
      required: ['action'],
    },
  },

  // === 모듈 관리 도구: module ===
  module: {
    name: 'module',
    description: `재사용 가능한 코드 모듈 관리.

ACTIONS
- save: 모듈 저장 (name, code 필수)
- list: 저장된 모듈 목록
- get: 모듈 코드 조회 (name 필수)
- delete: 모듈 삭제 (name 필수)

사용: cad_code에서 import 'module_name'`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: "동작: 'save' | 'list' | 'get' | 'delete'",
        },
        name: { type: 'string', description: '모듈 이름' },
        code: { type: 'string', description: 'save: 저장할 코드' },
      },
      required: ['action'],
    },
  },
};

/**
 * Legacy MCP 도구 스키마 (하위 호환용)
 * 점진적으로 DOMAIN_TOOLS로 마이그레이션
 */
export const CAD_TOOLS: Record<string, ToolSchema> = {
  // === 핵심 도구 ===
  run_cad_code: {
    name: 'run_cad_code',
    description: `CAD 코드 에디터 - JavaScript 코드 실행/읽기/수정 (핵심 도구).

📝 CODE EDITOR MODES
1. 구조 보기: file/code 없이 호출 → 프로젝트 파일 목록, main 코드, 엔티티
2. 파일 읽기: file='main' (또는 모듈명), code 없음 → 해당 파일 코드 반환
3. 코드 실행: code만 제공 → 즉시 실행 (main에 저장 안 됨)
4. 파일 쓰기: file + code → 해당 파일에 코드 저장 후 실행
5. 코드 추가: file + code('+' prefix) → 기존 코드에 추가
6. 부분 수정: file + old_code + new_code → old_code를 new_code로 교체

📋 FUNCTIONS BY DOMAIN
- primitives: drawCircle, drawRect, drawLine, drawArc, drawPolygon, drawBezier, drawText
- style: setFill(name, [r,g,b,a]), setStroke(name, color, width?), drawOrder(name, mode)
- transforms: translate, rotate, scale, setPivot, deleteEntity
- groups: createGroup(name, [children]), addToGroup
- query: getEntity, exists, getWorldBounds, getDrawOrder
- boolean: booleanUnion, booleanDifference, booleanIntersect
- geometry: offsetPolygon, getArea, convexHull, decompose
- utility: duplicate, mirror

🔧 BOOLEAN USE CASES
- 초승달/도넛/구멍: booleanDifference(base, cutter, result)
- 복잡한 도형 합치기: booleanUnion(a, b, result)
- 겹치는 영역만: booleanIntersect(a, b, result)

🎨 COORDINATE & STYLE
- Origin (0,0) at center, Y+ up
- Colors: RGBA [0-1, 0-1, 0-1, 0-1] (예: 빨강 [1,0,0,1])
- 외곽선 제거: setStroke(name, [0,0,0,0], 0)

⚠️ CRITICAL RULES
- 문자열은 작은따옴표(') 사용: drawCircle('name', 0, 0, 50)
- 수정 시 reset 금지! 기존 엔티티 직접 수정 (setFill, translate 등)
- 실행 실패 시 파일 변경 없음 (자동 롤백)

🏠 GROUP PATTERN
✅ drawRect('wall', 0, 0, w, h) → createGroup('house', ['wall']) → translate('house', 100, 50)

💡 TIP: describe(domain) 으로 함수 시그니처 확인`,
    parameters: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: `대상 파일명 (optional).
- 'main': 메인 코드 파일
- '<module_name>': 저장된 모듈
- 생략 시: code만 있으면 즉시 실행, 둘 다 없으면 프로젝트 구조 반환`,
        },
        code: {
          type: 'string',
          description: `실행할 JavaScript 코드 (optional).
- 일반 코드: 파일에 저장 (file 지정 시) 또는 즉시 실행
- '+' prefix: 기존 코드에 추가 (예: "+translate('c1', 10, 0)")
- 생략 시: file만 있으면 읽기, 둘 다 없으면 구조 보기`,
        },
        old_code: {
          type: 'string',
          description: `교체할 기존 코드 (부분 수정 모드). new_code와 함께 사용.
- file + old_code + new_code → old_code를 new_code로 교체
- old_code가 없으면 에러`,
        },
        new_code: {
          type: 'string',
          description: `새로운 코드 (부분 수정 모드). old_code와 함께 사용.
- 빈 문자열 가능 (해당 부분 삭제)`,
        },
      },
      required: [],
    },
  },

  // === 탐색용 도구 ===
  describe: {
    name: 'describe',
    description: `도메인별 함수 시그니처와 예제를 반환합니다.

📋 AVAILABLE DOMAINS
primitives, style, transforms, groups, query, boolean, geometry, utility

🎯 WHEN TO USE
- 함수 파라미터가 기억나지 않을 때
- 새로운 도메인 탐색 시
- 예제 코드가 필요할 때

💡 TIP: run_cad_code 실행 전 시그니처 확인 권장`,
    parameters: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: '도메인 이름. 예: primitives, style, transforms, groups, query, boolean, geometry, utility',
        },
      },
      required: ['domain'],
    },
  },

  list_domains: {
    name: 'list_domains',
    description: `사용 가능한 도메인 목록을 반환합니다.

🎯 WHEN TO USE
- 처음 시작할 때 전체 구조 파악
- 어떤 기능이 있는지 탐색

📋 DOMAINS
- primitives: 도형 생성 (circle, rect, line, arc, polygon, bezier, text)
- style: 스타일링 (fill, stroke, z-order)
- transforms: 변환 (translate, rotate, scale, pivot, delete)
- groups: 그룹화 (create, add)
- query: 조회 (getEntity, exists, bounds)
- boolean: 집합 연산 (union, difference, intersect)
- geometry: 기하 분석 (offset, area, hull, decompose)
- utility: 유틸 (duplicate, mirror)`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  list_tools: {
    name: 'list_tools',
    description: `도메인별 함수 목록을 반환합니다.

🎯 WHEN TO USE
- 특정 도메인의 함수 목록 확인
- 도메인 생략 시 전체 함수 반환

💡 TIP: 함수 시그니처가 필요하면 describe(domain) 사용`,
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: '도메인 이름 (선택). 예: primitives, style, transforms' },
      },
      required: [],
    },
  },

  get_tool_schema: {
    name: 'get_tool_schema',
    description: `특정 함수의 상세 시그니처를 반환합니다.

🎯 WHEN TO USE
- 단일 함수의 파라미터 상세 확인
- 옵션 파라미터 확인이 필요할 때

💡 TIP: 여러 함수가 필요하면 describe(domain) 사용`,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '함수 이름. 예: drawCircle, translate' },
      },
      required: ['name'],
    },
  },

  request_tool: {
    name: 'request_tool',
    description: `필요한 함수가 없을 때 개발자에게 요청합니다.

🎯 WHEN TO USE
- 기존 함수로 해결 불가능할 때
- 새로운 기능이 필요할 때

⚠️ NOTE: 요청은 즉시 반영되지 않음. 기존 함수로 대안 먼저 고려`,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '요청할 함수 이름' },
        description: { type: 'string', description: '함수 설명' },
        rationale: { type: 'string', description: '필요한 이유' },
        suggested_params: {
          type: 'array',
          description: '제안하는 파라미터 목록',
          items: { type: 'string', description: '파라미터 이름' },
        },
      },
      required: ['name', 'description', 'rationale'],
    },
  },

  // === 조회/내보내기 도구 ===
  get_scene_info: {
    name: 'get_scene_info',
    description: `Scene의 현재 상태를 반환합니다.

📋 RETURNS
- entityCount: 전체 엔티티 개수
- groupCount: 그룹 개수
- bounds: 전체 씬의 경계 박스 (min_x, min_y, max_x, max_y)

🎯 WHEN TO USE
- 작업 시작 전 씬 상태 확인
- 엔티티 수 파악

💡 TIP: 상세 구조는 overview 사용`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  export_json: {
    name: 'export_json',
    description: `Scene을 JSON으로 내보냅니다.

🎯 WHEN TO USE
- 씬 데이터 백업
- 다른 시스템과 데이터 교환
- 디버깅용 전체 씬 구조 확인

📋 RETURNS
전체 씬 데이터 (entities, groups, styles, transforms)`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  export_svg: {
    name: 'export_svg',
    description: `Scene을 SVG로 내보냅니다.

🎯 WHEN TO USE
- 벡터 그래픽으로 저장
- 웹/문서에 삽입용 이미지 생성
- 인쇄용 고해상도 출력

📋 RETURNS
SVG 문자열 (viewBox 자동 계산)`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // === 세션 관리 도구 ===
  reset: {
    name: 'reset',
    description: `Scene의 모든 엔티티를 삭제하고 초기화합니다.

⚠️ CRITICAL: 이 작업은 되돌릴 수 없습니다!

🎯 WHEN TO USE
- 완전히 새로운 작업 시작
- 테스트 후 정리

❌ AVOID: 일부 수정이 필요할 때 reset 대신 개별 수정 권장
- setFill, translate 등으로 기존 엔티티 직접 수정
- deleteEntity로 특정 엔티티만 삭제`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  capture: {
    name: 'capture',
    description: `뷰어의 현재 화면을 PNG 이미지로 캡처합니다.

🎯 WHEN TO USE
- 작업 결과 시각적 확인
- 진행 상황 스크린샷

📋 RETURNS
캡처된 이미지 파일 경로

⚠️ REQUIREMENTS
- 뷰어가 실행 중이어야 함 (localhost:5173 또는 GitHub Pages)
- 로컬 뷰어 사용 시: CAD_VIEWER_URL=http://localhost:5173`,
    parameters: {
      type: 'object',
      properties: {
        clearSketch: {
          type: 'boolean',
          description: '캡처 후 스케치 레이어를 클리어할지 여부 (기본값: false)',
        },
      },
      required: [],
    },
  },

  get_selection: {
    name: 'get_selection',
    description: `뷰어에서 현재 선택된 엔티티 목록을 반환합니다.

🎯 WHEN TO USE
- 사용자가 선택한 엔티티 확인
- 선택 기반 작업 수행

📋 RETURNS
선택된 엔티티 이름 배열: ['entity1', 'entity2', ...]`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // === 모듈 관리 도구 ===
  save_module: {
    name: 'save_module',
    description: `재사용 가능한 코드를 모듈로 저장합니다.

🎯 WHEN TO USE
- 반복 사용할 클래스/함수 정의
- 라이브러리 패턴 구현

📋 EXAMPLE
\`\`\`javascript
// house_lib 모듈
class House {
  constructor(name, x, y) { ... }
  build() {
    drawRect(this.name+'_wall', 0, 15, 40, 30);
    createGroup(this.name, [...]);
    translate(this.name, this.x, this.y);
  }
}
\`\`\`

💡 TIP: import 'module_name'으로 run_cad_code에서 사용`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '모듈 이름 (예: house_lib)',
        },
        code: {
          type: 'string',
          description: '저장할 JavaScript 코드',
        },
      },
      required: ['name', 'code'],
    },
  },

  list_modules: {
    name: 'list_modules',
    description: `저장된 모든 모듈 목록을 반환합니다.

🎯 WHEN TO USE
- 사용 가능한 모듈 확인
- 세션 시작 시 기존 모듈 파악

📋 RETURNS
모듈 이름 배열: ['house_lib', 'tree_lib', ...]`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  get_module: {
    name: 'get_module',
    description: `저장된 모듈의 코드를 반환합니다.

🎯 WHEN TO USE
- 모듈 내용 확인
- 모듈 수정 전 현재 코드 조회

📋 RETURNS
모듈의 JavaScript 코드 문자열`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '모듈 이름',
        },
      },
      required: ['name'],
    },
  },

  delete_module: {
    name: 'delete_module',
    description: `저장된 모듈을 삭제합니다.

⚠️ NOTE: 이 작업은 되돌릴 수 없습니다

🎯 WHEN TO USE
- 더 이상 필요 없는 모듈 정리
- 모듈 재작성 전 삭제`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '삭제할 모듈 이름',
        },
      },
      required: ['name'],
    },
  },

  // === 씬 조회 도구 ===
  list_groups: {
    name: 'list_groups',
    description: `Scene의 모든 그룹 목록을 반환합니다.

🎯 WHEN TO USE
- 그룹 구조 파악
- 특정 그룹 존재 확인

📋 RETURNS
그룹 이름 배열: ['robot', 'house1', ...]

💡 TIP: 전체 계층 구조는 overview 사용`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  overview: {
    name: 'overview',
    description: `Scene의 구조를 트리 형태로 반환합니다.

🎯 WHEN TO USE
- 씬의 전체 구조 파악
- 그룹-엔티티 계층 관계 확인
- 디버깅용 상태 확인

📋 RETURNS
트리 구조 텍스트:
\`\`\`
scene (5 entities)
├─ robot (group)
│  ├─ head
│  ├─ body
│  └─ arm_l
├─ house1 (group)
│  ├─ wall
│  └─ roof
\`\`\``,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

/**
 * sandbox 함수 시그니처 (describe 도구용)
 * run_cad_code에서 사용 가능한 JavaScript 함수들의 설명
 */
export const FUNCTION_SIGNATURES: Record<string, { signature: string; description: string; example?: string }> = {
  // primitives
  drawCircle: {
    signature: "drawCircle(name: string, x: number, y: number, radius: number): boolean",
    description: "원을 그립니다. 중심 좌표와 반지름 지정",
    example: "drawCircle('head', 0, 50, 30)",
  },
  drawRect: {
    signature: "drawRect(name: string, x: number, y: number, width: number, height: number): boolean",
    description: "사각형을 그립니다. 중심 좌표와 크기 지정",
    example: "drawRect('body', 0, 0, 40, 60)",
  },
  drawLine: {
    signature: "drawLine(name: string, points: number[]): boolean",
    description: "선분을 그립니다. [x1, y1, x2, y2, ...] 형태의 좌표 배열",
    example: "drawLine('wall', [0, 0, 100, 0, 100, 50])",
  },
  drawArc: {
    signature: "drawArc(name: string, cx: number, cy: number, radius: number, startAngle: number, endAngle: number): boolean",
    description: "호를 그립니다. 각도는 라디안 (0 = 3시 방향, 양수 = 반시계)",
    example: "drawArc('door_swing', 0, 0, 30, 0, Math.PI/2)",
  },
  drawPolygon: {
    signature: "drawPolygon(name: string, points: number[]): boolean",
    description: "폴리곤(다각형)을 그립니다. [x1, y1, x2, y2, ...] 형태의 좌표 배열",
    example: "drawPolygon('triangle', [0, 30, -25, -15, 25, -15])",
  },
  drawBezier: {
    signature: "drawBezier(name: string, path: string): boolean",
    description: "베지어 커브를 그립니다. SVG path 문법 (M, C, S, Z)",
    example: "drawBezier('curve', 'M 0,0 C 30,50 70,50 100,0 Z')",
  },
  drawText: {
    signature: "drawText(name: string, text: string, x: number, y: number, fontSize: number, options?: { fontPath?, align?, color? }): boolean",
    description: "텍스트를 베지어 경로로 그립니다. 한글 지원",
    example: "drawText('title', '안녕', 0, 0, 24, { color: [0,0,0,1] })",
  },
  // style
  setFill: {
    signature: "setFill(name: string, color: [r, g, b, a]): boolean",
    description: "도형의 채움 색상을 설정합니다. RGBA 0~1",
    example: "setFill('head', [1, 0.8, 0.6, 1])",
  },
  setStroke: {
    signature: "setStroke(name: string, color: [r, g, b, a], width?: number): boolean",
    description: "도형의 선 색상과 두께를 설정합니다",
    example: "setStroke('body', [0, 0, 0, 1], 2)",
  },
  drawOrder: {
    signature: "drawOrder(name: string, mode: 'front' | 'back' | number | 'above:target' | 'below:target'): boolean",
    description: "도형의 그리기 순서(z-order)를 변경. ⚠️ 'back'은 전체 씬의 맨 뒤로 이동(배경보다 뒤로 갈 수 있음!). 💡 레이어링 패턴: 배경을 먼저 생성 → 오브젝트 나중에 생성 = 자동으로 위에 배치. 'above:target'/'below:target'으로 특정 엔티티 기준 배치. 그룹 이동 시 자식도 함께 이동",
    example: "drawOrder('player', 'above:grass_0_0')  // grass_0_0 바로 위로",
  },
  // transforms
  translate: {
    signature: "translate(name: string, dx: number, dy: number, options?: { space?: 'world' | 'local' }): boolean",
    description: "도형을 이동합니다. 값이 누적됩니다",
    example: "translate('body', 10, 0)",
  },
  rotate: {
    signature: "rotate(name: string, angle: number, options?: { space?: 'world' | 'local' }): boolean",
    description: "도형을 회전합니다. 각도는 라디안",
    example: "rotate('arm', Math.PI/4)",
  },
  scale: {
    signature: "scale(name: string, sx: number, sy: number, options?: { space?: 'world' | 'local' }): boolean",
    description: "도형의 크기를 변경합니다. 1.0 = 원래 크기",
    example: "scale('head', 1.5, 1.5)",
  },
  setPivot: {
    signature: "setPivot(name: string, px: number, py: number): boolean",
    description: "도형의 회전/스케일 중심점을 설정합니다",
    example: "setPivot('arm', 0, 30)",
  },
  deleteEntity: {
    signature: "deleteEntity(name: string): boolean",
    description: "도형을 삭제합니다",
    example: "deleteEntity('temp')",
  },
  // groups
  createGroup: {
    signature: "createGroup(name: string, children: string[]): boolean",
    description: "여러 도형을 그룹으로 묶습니다",
    example: "createGroup('robot', ['head', 'body', 'arm_l', 'arm_r'])",
  },
  addToGroup: {
    signature: "addToGroup(groupName: string, entityName: string): boolean",
    description: "기존 그룹에 도형을 추가합니다",
    example: "addToGroup('robot', 'leg')",
  },
  // query
  getEntity: {
    signature: "getEntity(name: string): object | null",
    description: "도형의 상세 정보를 조회합니다 (geometry, transform, style, world bounds)",
    example: "const info = getEntity('head');",
  },
  exists: {
    signature: "exists(name: string): boolean",
    description: "도형이 존재하는지 확인합니다",
    example: "if (exists('head')) { ... }",
  },
  getWorldBounds: {
    signature: "getWorldBounds(name: string): { min_x, min_y, max_x, max_y } | null",
    description: "도형의 월드 좌표계 경계 박스를 조회합니다",
    example: "const bounds = getWorldBounds('robot');",
  },
  getDrawOrder: {
    signature: "getDrawOrder(groupName?: string): string[] | null",
    description: "그리기 순서 조회(뒤→앞, 배열 왼쪽이 뒤). 인자 없으면 root level, 그룹명 지정 시 해당 그룹의 자식 순서. 💡 drawOrder 전에 현재 상태 확인 권장. ⚠️ scene({action:'overview'})로도 구조 확인 가능",
    example: "getDrawOrder()  // root: ['bg', 'player', 'ui']\ngetDrawOrder('robot')  // 그룹 내: ['body', 'head', 'arm']",
  },
  getTextMetrics: {
    signature: "getTextMetrics(text: string, fontSize: number, fontPath?: string): { width, height } | null",
    description: "텍스트의 렌더링 크기를 미리 계산합니다",
    example: "const size = getTextMetrics('안녕', 24);",
  },
  fitToViewport: {
    signature: "fitToViewport(realWidth: number, realHeight: number, options?: { viewport?, margin? }): object | null",
    description: "실제 크기를 뷰포트에 맞는 스케일로 변환하는 코드 생성",
    example: "const fit = fitToViewport(1000, 800);",
  },
  // boolean
  booleanUnion: {
    signature: "booleanUnion(nameA: string, nameB: string, resultName: string): boolean",
    description: "두 도형의 합집합을 계산합니다 (A ∪ B)",
    example: "booleanUnion('circle1', 'circle2', 'merged')",
  },
  booleanDifference: {
    signature: "booleanDifference(nameA: string, nameB: string, resultName: string): boolean",
    description: "A에서 B를 뺀 차집합을 계산합니다 (A - B)",
    example: "booleanDifference('rect', 'hole', 'result')",
  },
  booleanIntersect: {
    signature: "booleanIntersect(nameA: string, nameB: string, resultName: string): boolean",
    description: "두 도형의 교집합을 계산합니다 (A ∩ B)",
    example: "booleanIntersect('a', 'b', 'overlap')",
  },
  // geometry
  offsetPolygon: {
    signature: "offsetPolygon(name: string, delta: number, resultName: string, options?: { joinType?, miterLimit?, circularSegments? }): boolean",
    description: "폴리곤을 확장(delta>0) 또는 축소(delta<0)합니다",
    example: "offsetPolygon('rect', 5, 'expanded', { joinType: 'round' })",
  },
  getArea: {
    signature: "getArea(name: string): number | null",
    description: "닫힌 도형의 면적을 계산합니다",
    example: "const area = getArea('floor');",
  },
  convexHull: {
    signature: "convexHull(name: string, resultName: string): boolean",
    description: "도형의 볼록 껍질을 계산합니다",
    example: "convexHull('complex', 'hull')",
  },
  decompose: {
    signature: "decompose(name: string, prefix: string): string[] | null",
    description: "분리된 컴포넌트들을 개별 폴리곤으로 추출합니다",
    example: "const parts = decompose('merged', 'part');",
  },
  // utility
  duplicate: {
    signature: "duplicate(sourceName: string, newName: string): boolean",
    description: "도형을 복제합니다 (그룹 포함 재귀적)",
    example: "duplicate('robot', 'robot2')",
  },
  mirror: {
    signature: "mirror(sourceName: string, newName: string, axis: 'x' | 'y'): boolean",
    description: "도형을 축 기준으로 미러 복제합니다",
    example: "mirror('arm_l', 'arm_r', 'x')",
  },
};
