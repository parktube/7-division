/**
 * Progressive Exposure API - 런타임 내부 Pre-filter
 * LLM에 전달할 도구를 도메인별로 선택
 */

import { DOMAINS, CAD_TOOLS, type DomainName, type ToolSchema } from './schema.js';

/**
 * 사용 가능한 도메인 목록 반환
 */
export function listDomains(): DomainName[] {
  return Object.keys(DOMAINS) as DomainName[];
}

/**
 * 특정 도메인의 도구 이름 목록 반환
 */
export function listTools(domain: DomainName): string[] {
  return [...DOMAINS[domain]];
}

/**
 * 특정 도구의 canonical 스키마 반환
 */
export function getTool(name: string): ToolSchema | undefined {
  return CAD_TOOLS[name] || EXECUTOR_TOOLS[name];
}

/**
 * Executor용 도구 스키마 (snake_case - runtime.ts/cad-agent.ts용)
 * MCP의 run_cad_code와 별도로 개별 도구 호출을 지원
 */
const EXECUTOR_TOOLS: Record<string, ToolSchema> = {
  // primitives
  draw_circle: {
    name: 'draw_circle',
    description: '원을 그립니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        x: { type: 'number', description: '중심 X 좌표' },
        y: { type: 'number', description: '중심 Y 좌표' },
        radius: { type: 'number', description: '반지름' },
      },
      required: ['name', 'x', 'y', 'radius'],
    },
  },
  draw_rect: {
    name: 'draw_rect',
    description: '사각형을 그립니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        x: { type: 'number', description: '중심 X 좌표' },
        y: { type: 'number', description: '중심 Y 좌표' },
        width: { type: 'number', description: '너비' },
        height: { type: 'number', description: '높이' },
      },
      required: ['name', 'x', 'y', 'width', 'height'],
    },
  },
  draw_line: {
    name: 'draw_line',
    description: '선을 그립니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        points: { type: 'array', description: '좌표 배열 [x1, y1, x2, y2, ...]', items: { type: 'number', description: '좌표' } },
      },
      required: ['name', 'points'],
    },
  },
  draw_arc: {
    name: 'draw_arc',
    description: '호를 그립니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        cx: { type: 'number', description: '중심 X' },
        cy: { type: 'number', description: '중심 Y' },
        radius: { type: 'number', description: '반지름' },
        start_angle: { type: 'number', description: '시작 각도 (라디안)' },
        end_angle: { type: 'number', description: '종료 각도 (라디안)' },
      },
      required: ['name', 'cx', 'cy', 'radius', 'start_angle', 'end_angle'],
    },
  },
  draw_polygon: {
    name: 'draw_polygon',
    description: '다각형을 그립니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        points: { type: 'array', description: '좌표 배열', items: { type: 'number', description: '좌표' } },
      },
      required: ['name', 'points'],
    },
  },
  draw_bezier: {
    name: 'draw_bezier',
    description: '베지어 곡선을 그립니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        path: { type: 'string', description: 'SVG path 문자열' },
      },
      required: ['name', 'path'],
    },
  },
  draw_text: {
    name: 'draw_text',
    description: '텍스트를 그립니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        text: { type: 'string', description: '텍스트 내용' },
        x: { type: 'number', description: 'X 좌표' },
        y: { type: 'number', description: 'Y 좌표' },
        fontSize: { type: 'number', description: '폰트 크기' },
      },
      required: ['name', 'text', 'x', 'y', 'fontSize'],
    },
  },
  // style
  set_fill: {
    name: 'set_fill',
    description: '채움 색상 설정',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        fill: { type: 'object', description: '채움 스타일 { color: [r,g,b,a] }' },
      },
      required: ['name', 'fill'],
    },
  },
  set_stroke: {
    name: 'set_stroke',
    description: '선 스타일 설정',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        stroke: { type: 'object', description: '선 스타일 { color, width }' },
      },
      required: ['name', 'stroke'],
    },
  },
  set_draw_order: {
    name: 'set_draw_order',
    description: '그리기 순서 설정',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        order: { type: 'string', description: 'front, back, 또는 숫자' },
      },
      required: ['name', 'order'],
    },
  },
  remove_fill: {
    name: 'remove_fill',
    description: '채움 제거',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
      },
      required: ['name'],
    },
  },
  remove_stroke: {
    name: 'remove_stroke',
    description: '선 제거',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
      },
      required: ['name'],
    },
  },
  // transforms
  translate: {
    name: 'translate',
    description: '이동',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        dx: { type: 'number', description: 'X 이동량' },
        dy: { type: 'number', description: 'Y 이동량' },
      },
      required: ['name', 'dx', 'dy'],
    },
  },
  rotate: {
    name: 'rotate',
    description: '회전',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        angle: { type: 'number', description: '각도 (라디안)' },
      },
      required: ['name', 'angle'],
    },
  },
  scale: {
    name: 'scale',
    description: '크기 조절',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        sx: { type: 'number', description: 'X 스케일' },
        sy: { type: 'number', description: 'Y 스케일' },
      },
      required: ['name', 'sx', 'sy'],
    },
  },
  delete: {
    name: 'delete',
    description: '엔티티 삭제',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
      },
      required: ['name'],
    },
  },
  // query
  get_entity: {
    name: 'get_entity',
    description: '엔티티 정보 조회',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
      },
      required: ['name'],
    },
  },
  list_entities: {
    name: 'list_entities',
    description: '모든 엔티티 목록',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  get_scene_info: {
    name: 'get_scene_info',
    description: '씬 정보 조회',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  // export
  export_json: {
    name: 'export_json',
    description: 'JSON으로 내보내기',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  export_svg: {
    name: 'export_svg',
    description: 'SVG로 내보내기',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  // groups
  create_group: {
    name: 'create_group',
    description: '그룹 생성',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '그룹 이름' },
        children: { type: 'array', description: '자식 엔티티 이름들', items: { type: 'string', description: '엔티티 이름' } },
      },
      required: ['name', 'children'],
    },
  },
  add_to_group: {
    name: 'add_to_group',
    description: '그룹에 추가',
    parameters: {
      type: 'object',
      properties: {
        groupName: { type: 'string', description: '그룹 이름' },
        entityName: { type: 'string', description: '추가할 엔티티' },
      },
      required: ['groupName', 'entityName'],
    },
  },
  // utility
  duplicate: {
    name: 'duplicate',
    description: '엔티티 복제',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: '원본 이름' },
        newName: { type: 'string', description: '새 이름' },
      },
      required: ['source', 'newName'],
    },
  },
};

/**
 * 도메인별 executor 도구 매핑 (runtime.ts용)
 */
const DOMAIN_TO_EXECUTOR_TOOLS: Record<string, string[]> = {
  primitives: ['draw_circle', 'draw_rect', 'draw_line', 'draw_arc', 'draw_polygon', 'draw_bezier', 'draw_text'],
  style: ['set_fill', 'set_stroke', 'set_draw_order', 'remove_fill', 'remove_stroke'],
  transforms: ['translate', 'rotate', 'scale', 'delete'],
  query: ['get_entity', 'list_entities', 'get_scene_info'],
  export: ['export_json', 'export_svg'],
  groups: ['create_group', 'add_to_group'],
  utility: ['duplicate'],
  // boolean, geometry는 executor에서 직접 지원하지 않음 - run_cad_code 사용 필요
};

/**
 * 여러 도메인의 도구 스키마 배열 반환 (런타임용)
 * executor.exec()와 호환되는 snake_case 도구 반환
 */
export function getToolsForDomains(domains: DomainName[]): ToolSchema[] {
  const tools: ToolSchema[] = [];
  const addedTools = new Set<string>();

  for (const domain of domains) {
    const executorToolNames = DOMAIN_TO_EXECUTOR_TOOLS[domain];
    if (executorToolNames) {
      for (const name of executorToolNames) {
        if (!addedTools.has(name) && EXECUTOR_TOOLS[name]) {
          tools.push(EXECUTOR_TOOLS[name]);
          addedTools.add(name);
        }
      }
    }
  }

  return tools;
}

/**
 * 모든 도구 스키마 반환 (MCP 도구)
 */
export function getAllTools(): ToolSchema[] {
  return Object.values(CAD_TOOLS);
}

/**
 * 모든 executor 도구 스키마 반환
 */
export function getAllExecutorTools(): ToolSchema[] {
  return Object.values(EXECUTOR_TOOLS);
}
