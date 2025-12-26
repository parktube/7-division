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
  export: ['export_json'],
  // transforms: Story 3.1~3.4 완료 후 추가 (translate, rotate, scale, delete)
  // export_svg: Story 3.6 완료 후 추가
} as const;

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
    description: '호를 그립니다. 문 열림 표시, 곡선 등에 사용',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름 (예: "door_swing")' },
        cx: { type: 'number', description: '중심 x 좌표' },
        cy: { type: 'number', description: '중심 y 좌표' },
        radius: { type: 'number', description: '반지름' },
        start_angle: { type: 'number', description: '시작 각도 (라디안, 0 = 3시 방향)' },
        end_angle: { type: 'number', description: '끝 각도 (라디안, 양수 = 반시계)' },
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
};
