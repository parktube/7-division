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

export type DomainName = keyof typeof DOMAINS;
export type ToolName = (typeof DOMAINS)[DomainName][number];

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
export const CAD_TOOLS: Record<string, ToolSchema> = {
  // === 핵심 도구 ===
  run_cad_code: {
    name: 'run_cad_code',
    description: `JavaScript 코드를 실행하여 CAD 도형을 생성/수정합니다.
사용 가능한 함수: drawCircle, drawRect, drawLine, drawArc, drawPolygon, drawBezier, drawText,
setFill, setStroke, drawOrder, translate, rotate, scale, setPivot, deleteEntity,
createGroup, addToGroup, getEntity, exists, getWorldBounds, getDrawOrder,
booleanUnion, booleanDifference, booleanIntersect, offsetPolygon, getArea, convexHull, decompose,
duplicate, mirror, getTextMetrics, fitToViewport.
함수 시그니처는 describe 도구로 확인하세요.`,
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: `실행할 JavaScript 코드.
예시:
- drawCircle('head', 0, 50, 30)
- drawRect('body', -20, -30, 40, 60)
- setFill('head', [1, 0.8, 0.6, 1])
- translate('body', 10, 0)`,
        },
      },
      required: ['code'],
    },
  },

  // === 탐색용 도구 ===
  describe: {
    name: 'describe',
    description: '도메인별 함수 목록과 시그니처를 반환합니다. 함수 사용법을 알고 싶을 때 사용',
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
    description: '사용 가능한 도메인 목록을 반환합니다. 어떤 기능이 있는지 탐색할 때 먼저 호출',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  list_tools: {
    name: 'list_tools',
    description: '도메인별 함수 목록을 반환합니다. 도메인 생략 시 전체 함수 반환',
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
    description: '특정 함수의 상세 시그니처를 반환합니다. 파라미터 확인 시 사용',
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
    description: '필요한 함수가 없을 때 개발자에게 요청합니다',
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
    description: 'Scene의 현재 상태를 반환합니다. 이름, 엔티티 개수, 전체 bounds 등',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  export_json: {
    name: 'export_json',
    description: 'Scene을 JSON으로 내보냅니다',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  export_svg: {
    name: 'export_svg',
    description: 'Scene을 SVG로 내보냅니다. 벡터 그래픽 파일로 저장하거나 웹에서 표시할 때 사용',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // === 세션 관리 도구 ===
  reset: {
    name: 'reset',
    description: 'Scene의 모든 엔티티를 삭제하고 초기화합니다',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  capture: {
    name: 'capture',
    description: '뷰어의 현재 화면을 PNG 이미지로 캡처합니다. 캡처된 이미지 경로를 반환합니다',
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
    description: '뷰어에서 현재 선택된 엔티티 목록을 반환합니다',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // === 모듈 관리 도구 ===
  save_module: {
    name: 'save_module',
    description: '재사용 가능한 코드를 모듈로 저장합니다',
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
    description: '저장된 모든 모듈 목록을 반환합니다',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  get_module: {
    name: 'get_module',
    description: '저장된 모듈의 코드를 반환합니다',
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
    description: '저장된 모듈을 삭제합니다',
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
    description: 'Scene의 모든 그룹 목록을 반환합니다',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  overview: {
    name: 'overview',
    description: 'Scene의 구조를 트리 형태로 반환합니다 (그룹, 엔티티 계층)',
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
    description: "도형의 그리기 순서를 변경합니다",
    example: "drawOrder('head', 'front')",
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
    description: "그리기 순서를 조회합니다. 그룹 지정 시 해당 그룹의 자식 순서",
    example: "const order = getDrawOrder();",
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
