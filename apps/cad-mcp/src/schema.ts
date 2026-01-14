/**
 * Canonical Tool Schema - LLM-agnostic
 * 특정 LLM 벤더에 종속되지 않는 내부 표준 스키마
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
 * 도메인 정의 (현재 WASM에 구현된 도구만)
 */
export const DOMAINS = {
  primitives: ['draw_line', 'draw_circle', 'draw_rect', 'draw_arc'],
  style: ['set_stroke', 'set_fill', 'remove_stroke', 'remove_fill'],
  transforms: ['translate', 'rotate', 'scale', 'delete'],
  query: ['list_entities', 'get_entity', 'get_scene_info'],
  registry: ['list_domains', 'list_tools', 'get_tool_schema', 'request_tool'],
  export: ['export_json', 'export_svg'],
} as const;

/**
 * 도메인 메타데이터 (LLM용 설명 포함)
 */
export const DOMAIN_METADATA: Record<DomainName, { description: string }> = {
  primitives: { description: '기본 도형 그리기 (선, 원, 사각형, 호)' },
  style: { description: '도형 스타일 설정 (stroke, fill)' },
  transforms: { description: '도형 변환 (이동, 회전, 크기)' },
  query: { description: '씬 상태 조회 (엔티티 목록, 상세 정보)' },
  registry: { description: '도구 탐색 및 요청' },
  export: { description: '씬 내보내기 (JSON, SVG)' },
};

export type DomainName = keyof typeof DOMAINS;
export type ToolName = (typeof DOMAINS)[DomainName][number];

/**
 * Canonical 도구 스키마 정의
 */
export const CAD_TOOLS: Record<string, ToolSchema> = {
  // === primitives ===
  draw_line: {
    name: 'draw_line',
    description: '선분을 그립니다. 벽, 경계선, 뼈대 등에 사용',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름 (예: "wall", "spine")' },
        points: {
          type: 'array',
          description: '[x1, y1, x2, y2, ...] 형태의 좌표 배열',
          items: { type: 'number', description: '좌표값' },
        },
        style: {
          type: 'object',
          description: '스타일 객체 (선택). 예: { stroke: { color: [r,g,b,a], width: 2 } }',
        },
      },
      required: ['name', 'points'],
    },
  },

  draw_circle: {
    name: 'draw_circle',
    description: '원을 그립니다. 머리, 관절, 버튼 등에 사용',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름 (예: "head", "joint")' },
        x: { type: 'number', description: '중심 x 좌표' },
        y: { type: 'number', description: '중심 y 좌표' },
        radius: { type: 'number', description: '반지름 (양수)' },
        style: {
          type: 'object',
          description: '스타일 객체 (선택). 예: { stroke: { color: [r,g,b,a], width: 2 }, fill: { color: [r,g,b,a] } }',
        },
      },
      required: ['name', 'x', 'y', 'radius'],
    },
  },

  draw_rect: {
    name: 'draw_rect',
    description: '사각형을 그립니다. 벽, 바닥, 가구 등에 사용',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름 (예: "wall", "table")' },
        x: { type: 'number', description: '원점 x 좌표' },
        y: { type: 'number', description: '원점 y 좌표' },
        width: { type: 'number', description: '너비' },
        height: { type: 'number', description: '높이' },
        style: {
          type: 'object',
          description: '스타일 객체 (선택). 예: { stroke: { color: [r,g,b,a], width: 2 }, fill: { color: [r,g,b,a] } }',
        },
      },
      required: ['name', 'x', 'y', 'width', 'height'],
    },
  },

  draw_arc: {
    name: 'draw_arc',
    description: '호를 그립니다. 문 열림 표시, 곡선 등에 사용. angle_unit으로 degree/radian 지정 가능',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름 (예: "door_swing")' },
        cx: { type: 'number', description: '중심 x 좌표' },
        cy: { type: 'number', description: '중심 y 좌표' },
        radius: { type: 'number', description: '반지름' },
        start_angle: { type: 'number', description: '시작 각도 (기본: 라디안, 0 = 3시 방향)' },
        end_angle: { type: 'number', description: '끝 각도 (기본: 라디안, 양수 = 반시계)' },
        angle_unit: { type: 'string', description: '각도 단위. "degree" 또는 "radian"(기본값)' },
        style: {
          type: 'object',
          description: '스타일 객체 (선택). 예: { stroke: { color: [r,g,b,a], width: 1 } }',
        },
      },
      required: ['name', 'cx', 'cy', 'radius', 'start_angle', 'end_angle'],
    },
  },

  // === style ===
  set_stroke: {
    name: 'set_stroke',
    description: '기존 도형의 선(stroke) 스타일을 변경합니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '대상 엔티티 이름' },
        stroke: {
          type: 'object',
          description: 'StrokeStyle 객체. 예: { color: [1,0,0,1], width: 2 }',
        },
      },
      required: ['name', 'stroke'],
    },
  },

  set_fill: {
    name: 'set_fill',
    description: '기존 도형의 채움(fill) 스타일을 변경합니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '대상 엔티티 이름' },
        fill: {
          type: 'object',
          description: 'FillStyle 객체. 예: { color: [0.5,0.5,0.5,0.5] }',
        },
      },
      required: ['name', 'fill'],
    },
  },

  remove_stroke: {
    name: 'remove_stroke',
    description: '도형의 선(stroke)을 제거합니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '대상 엔티티 이름' },
      },
      required: ['name'],
    },
  },

  remove_fill: {
    name: 'remove_fill',
    description: '도형의 채움(fill)을 제거합니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '대상 엔티티 이름' },
      },
      required: ['name'],
    },
  },

  // === query ===
  list_entities: {
    name: 'list_entities',
    description: 'Scene 내 모든 Entity의 이름과 타입 목록을 반환합니다. 현재 어떤 도형이 있는지 확인할 때 사용',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  get_entity: {
    name: 'get_entity',
    description: '이름으로 Entity를 조회하여 상세 정보를 반환합니다. 특정 도형의 geometry, style, transform 등을 확인할 때 사용',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '조회할 엔티티 이름' },
      },
      required: ['name'],
    },
  },

  get_scene_info: {
    name: 'get_scene_info',
    description: 'Scene의 전체 정보를 반환합니다. 이름, 엔티티 개수, 전체 bounds 등을 확인할 때 사용',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // === transforms ===
  translate: {
    name: 'translate',
    description: '도형을 지정된 거리만큼 이동합니다. 값이 누적됩니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '대상 엔티티 이름' },
        dx: { type: 'number', description: 'x축 이동 거리' },
        dy: { type: 'number', description: 'y축 이동 거리' },
      },
      required: ['name', 'dx', 'dy'],
    },
  },

  rotate: {
    name: 'rotate',
    description: '도형을 지정된 각도만큼 회전합니다. 값이 누적됩니다. angle_unit으로 degree/radian 지정 가능',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '대상 엔티티 이름' },
        angle: { type: 'number', description: '회전 각도 (기본: 라디안, 양수 = 반시계방향)' },
        angle_unit: { type: 'string', description: '각도 단위. "degree" 또는 "radian"(기본값)' },
      },
      required: ['name', 'angle'],
    },
  },

  scale: {
    name: 'scale',
    description: '도형의 크기를 배율로 변경합니다. 값이 곱셈 누적됩니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '대상 엔티티 이름' },
        sx: { type: 'number', description: 'x축 스케일 배율 (1.0 = 원래 크기)' },
        sy: { type: 'number', description: 'y축 스케일 배율 (1.0 = 원래 크기)' },
      },
      required: ['name', 'sx', 'sy'],
    },
  },

  delete: {
    name: 'delete',
    description: '도형을 Scene에서 삭제합니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '삭제할 엔티티 이름' },
      },
      required: ['name'],
    },
  },

  // === registry ===
  list_domains: {
    name: 'list_domains',
    description: '사용 가능한 도메인 목록을 반환합니다. 도구를 탐색할 때 먼저 호출',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  list_tools: {
    name: 'list_tools',
    description: '도메인별 도구 목록을 반환합니다. 도메인 생략 시 전체 도구 반환',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: '도메인 이름 (선택). 예: primitives, style, query' },
      },
      required: [],
    },
  },

  get_tool_schema: {
    name: 'get_tool_schema',
    description: '특정 도구의 전체 스키마를 반환합니다. 파라미터 상세 확인 시 사용',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '도구 이름' },
      },
      required: ['name'],
    },
  },

  request_tool: {
    name: 'request_tool',
    description: '필요한 도구가 없을 때 개발자에게 요청합니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '요청할 도구 이름' },
        description: { type: 'string', description: '도구 설명' },
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

  // === export ===
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
};
