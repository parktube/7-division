/**
 * Canonical Tool Schema - LLM-agnostic
 * 특정 LLM 벤더에 종속되지 않는 내부 표준 스키마
 *
 * Epic 10: Claude Code 패턴 일치 MCP 도구
 * 6개 도구: glob, read, edit, write, lsp, bash
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
 * 이 함수들은 write/edit로 전달되는 JavaScript 코드 내에서 호출됨
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
 * MCP 도구 스키마 (Epic 10: Claude Code 패턴 일치)
 *
 * 6개 도구: glob, read, edit, write, lsp, bash
 */
export const CAD_TOOLS: Record<string, ToolSchema> = {
  // === glob: 파일 목록 조회 ===
  glob: {
    name: 'glob',
    description: 'CAD 파일 목록 조회. main과 모듈 파일들.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: "glob 패턴 (예: '*_lib', 'house*'). 생략 시 전체 목록",
        },
      },
      required: [],
    },
  },

  // === read: 파일 읽기 ===
  read: {
    name: 'read',
    description: '파일 읽기. edit/write 전에 반드시 먼저 확인.',
    parameters: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: "파일명: 'main' 또는 모듈명",
        },
      },
      required: ['file'],
    },
  },

  // === edit: 파일 부분 수정 ===
  edit: {
    name: 'edit',
    description: '파일 부분 수정 → 자동 실행. ⚠️ read로 먼저 확인 필수.',
    parameters: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: "파일명: 'main' 또는 모듈명",
        },
        old_code: {
          type: 'string',
          description: '교체할 기존 코드',
        },
        new_code: {
          type: 'string',
          description: '새 코드 (빈 문자열 = 삭제)',
        },
      },
      required: ['file', 'old_code', 'new_code'],
    },
  },

  // === write: 파일 전체 작성 ===
  write: {
    name: 'write',
    description: '파일 전체 작성 → 자동 실행. ⚠️ 기존 파일은 read로 먼저 확인.',
    parameters: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: "파일명: 'main' 또는 모듈명",
        },
        code: {
          type: 'string',
          description: '전체 코드',
        },
      },
      required: ['file', 'code'],
    },
  },

  // === lsp: 코드 탐색 ===
  lsp: {
    name: 'lsp',
    description: '코드 탐색. built-in 함수(domains/describe/schema) + 모듈 심볼(symbols).',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: "동작: 'domains' | 'describe' | 'schema' | 'symbols'",
        },
        domain: {
          type: 'string',
          description: "describe용: 도메인명 (예: primitives, style)",
        },
        name: {
          type: 'string',
          description: "schema용: 함수명 (예: drawCircle)",
        },
        file: {
          type: 'string',
          description: "symbols용: 파일명 ('main' 또는 모듈명)",
        },
      },
      required: ['operation'],
    },
  },

  // === bash: 명령 실행 ===
  bash: {
    name: 'bash',
    description: '명령 실행. 씬 조회(info/tree/groups/draw_order/selection), 내보내기(capture/svg/json), 초기화(reset).',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: "명령: 'info' | 'tree' | 'groups' | 'draw_order' | 'selection' | 'capture' | 'svg' | 'json' | 'reset'",
        },
        group: {
          type: 'string',
          description: "draw_order용: 그룹명 (생략 시 root level)",
        },
        clearSketch: {
          type: 'boolean',
          description: 'capture용: 캡처 후 스케치 클리어',
        },
      },
      required: ['command'],
    },
  },
};

/**
 * sandbox 함수 시그니처 (lsp describe 도구용)
 * write/edit에서 사용 가능한 JavaScript 함수들의 설명
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
    description: "그리기 순서 조회(뒤→앞, 배열 왼쪽이 뒤). 인자 없으면 root level, 그룹명 지정 시 해당 그룹의 자식 순서. 💡 drawOrder 전에 현재 상태 확인 권장. ⚠️ bash({command:'tree'})로도 구조 확인 가능",
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
