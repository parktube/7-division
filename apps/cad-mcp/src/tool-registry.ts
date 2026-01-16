/**
 * Tool Registry - 도구 메타데이터 관리 및 요청 큐
 * LLM이 도구를 탐색하고 새 도구를 요청할 수 있게 함
 *
 * Note: EXECUTOR_TOOLS는 runtime.ts의 직접 LLM 호출용 (MCP 비사용)
 */

import { DOMAINS, DOMAIN_METADATA, CAD_TOOLS, type DomainName, type ToolSchema } from './schema.js';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger.js';

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
    description: '채움 색상 설정 (RGBA 각 요소 0~1 범위)',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        fill: { type: 'object', description: '채움 스타일 { color: [r,g,b,a] } - 각 요소 0~1 범위 (예: [1,0,0,1] = 빨강)' },
      },
      required: ['name', 'fill'],
    },
  },
  set_stroke: {
    name: 'set_stroke',
    description: '선 스타일 설정 (RGBA 각 요소 0~1 범위)',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        stroke: { type: 'object', description: '선 스타일 { color: [r,g,b,a], width } - color 각 요소 0~1 범위 (예: [0,0,1,1] = 파랑)' },
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
        group_name: { type: 'string', description: '그룹 이름' },
        entity_name: { type: 'string', description: '추가할 엔티티' },
      },
      required: ['group_name', 'entity_name'],
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
 * 모든 executor 도구 스키마 반환
 */
export function getAllExecutorTools(): ToolSchema[] {
  return Object.values(EXECUTOR_TOOLS);
}

// Executor tools 캐싱 (snake_case 도구들)
let executorToolsMap: Map<string, ToolSchema> | null = null;
function getExecutorToolsMap(): Map<string, ToolSchema> {
  if (!executorToolsMap) {
    executorToolsMap = new Map();
    for (const tool of getAllExecutorTools()) {
      executorToolsMap.set(tool.name, tool);
    }
  }
  return executorToolsMap;
}

/**
 * 도메인 정보 (LLM 응답용)
 */
export interface DomainInfo {
  domain: string;
  description: string;
  count: number;
}

/**
 * 도구 요약 정보 (list_tools 응답용)
 */
export interface ToolSummary {
  name: string;
  description: string;
}

/**
 * 도구 요청 (request_tool 입력)
 */
export interface ToolRequest {
  id: string;
  name: string;
  description: string;
  rationale: string;
  suggested_params?: string[];
  status: 'queued' | 'approved' | 'rejected';
  created_at: string;
}

/**
 * ToolRegistry - 도구 메타데이터 싱글톤
 */
export class ToolRegistry {
  private static instance: ToolRegistry | null = null;
  private requests: ToolRequest[] = [];
  private requestsFilePath: string;

  private constructor(requestsFilePath?: string) {
    this.requestsFilePath = requestsFilePath || path.join(process.cwd(), 'tool-requests.json');
    this.loadRequests();
  }

  /**
   * 싱글톤 인스턴스 획득
   * Note: requestsFilePath is only used on first call; subsequent calls ignore it
   */
  static getInstance(requestsFilePath?: string): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry(requestsFilePath);
    } else if (requestsFilePath && requestsFilePath !== ToolRegistry.instance.requestsFilePath) {
      // Warn if different path is passed after instance creation
      logger.warn(
        `[ToolRegistry] getInstance called with different path. ` +
        `Using existing: ${ToolRegistry.instance.requestsFilePath}, ignoring: ${requestsFilePath}`
      );
    }
    return ToolRegistry.instance;
  }

  /**
   * 테스트용: 인스턴스 리셋
   * Also clears the cached executor tools map
   */
  static resetInstance(): void {
    ToolRegistry.instance = null;
    executorToolsMap = null;
  }

  /**
   * 모든 도메인 목록 반환
   */
  listDomains(): DomainInfo[] {
    return (Object.keys(DOMAINS) as DomainName[]).map((domain) => ({
      domain,
      description: DOMAIN_METADATA[domain]?.description || '',
      count: DOMAINS[domain].length,
    }));
  }

  /**
   * 도메인별 도구 목록 반환
   * 도메인 지정 시 executor 호환 도구 (snake_case) 반환
   * @param domain 도메인 이름 (생략 시 전체 MCP 도구)
   */
  listTools(domain?: string): { domain: string | null; tools: ToolSummary[] } {
    if (domain && domain in DOMAINS) {
      // 도메인 지정 시 executor 도구 반환 (snake_case, runtime.ts 호환)
      const executorTools = getToolsForDomains([domain as DomainName]);
      return {
        domain,
        tools: executorTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
      };
    }

    // 전체 도구 반환 (MCP 도구 + executor 도구, 중복 제거)
    const mcpTools = Object.values(CAD_TOOLS);
    const executorTools = getAllExecutorTools();

    // Map으로 중복 제거 (MCP 도구 우선)
    const toolMap = new Map<string, ToolSummary>();
    for (const tool of [...executorTools, ...mcpTools]) {
      toolMap.set(tool.name, { name: tool.name, description: tool.description });
    }

    return {
      domain: null,
      tools: Array.from(toolMap.values()),
    };
  }

  /**
   * 도구 스키마 조회
   * MCP 도구와 executor 도구 모두 검색
   * @returns 스키마 또는 null (존재하지 않는 경우)
   */
  getToolSchema(name: string): ToolSchema | null {
    // MCP 도구 먼저 검색
    if (CAD_TOOLS[name]) {
      return CAD_TOOLS[name];
    }
    // Executor 도구 검색 (snake_case)
    const executorTools = getExecutorToolsMap();
    return executorTools.get(name) || null;
  }

  /**
   * 유사 도구 이름 검색 (prefix/contains 매칭)
   * MCP 도구와 executor 도구 모두 검색
   * - prefix: 검색어 앞 4글자로 시작하는 도구
   * - contains: 검색어를 포함하는 도구
   * - reverse: 도구 이름이 검색어에 포함되는 경우
   */
  findSimilar(name: string): string[] {
    const mcpTools = Object.keys(CAD_TOOLS);
    const executorTools = Array.from(getExecutorToolsMap().keys());
    const allTools = [...new Set([...mcpTools, ...executorTools])];

    const prefix = name.slice(0, 4).toLowerCase();
    const searchTerm = name.toLowerCase();

    return allTools.filter((tool) => {
      const toolLower = tool.toLowerCase();
      return (
        toolLower.startsWith(prefix) ||
        toolLower.includes(searchTerm) ||
        searchTerm.includes(toolLower)
      );
    });
  }

  /**
   * 도구 요청 추가
   * - 동일한 이름의 queued 요청이 이미 있으면 기존 요청 반환
   */
  requestTool(request: {
    name: string;
    description: string;
    rationale: string;
    suggested_params?: string[];
  }): ToolRequest | { status: 'already_requested'; existing: ToolRequest } {
    // 입력 검증
    if (!request.name || !request.description || !request.rationale) {
      throw new Error('name, description, rationale are required');
    }

    // 중복 요청 확인 (동일 이름의 queued 상태 요청)
    const existingRequest = this.requests.find(
      (r) => r.name === request.name && r.status === 'queued'
    );
    if (existingRequest) {
      return { status: 'already_requested', existing: existingRequest };
    }

    const newRequest: ToolRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: request.name,
      description: request.description,
      rationale: request.rationale,
      suggested_params: request.suggested_params,
      status: 'queued',
      created_at: new Date().toISOString(),
    };

    this.requests.push(newRequest);
    this.saveRequests();

    return newRequest;
  }

  /**
   * 요청 목록 조회
   */
  listRequests(status?: 'queued' | 'approved' | 'rejected'): ToolRequest[] {
    if (status) {
      return this.requests.filter((r) => r.status === status);
    }
    return [...this.requests];
  }

  /**
   * 요청 파일 로드
   * Note: readFileSync is acceptable for CLI tools (non-server context)
   */
  private loadRequests(): void {
    try {
      if (fs.existsSync(this.requestsFilePath)) {
        const data = fs.readFileSync(this.requestsFilePath, 'utf-8');
        this.requests = JSON.parse(data);
      }
    } catch (error) {
      // 파일이 없거나 파싱 실패 시 빈 배열로 시작
      logger.warn(`[ToolRegistry] Failed to load requests: ${error}`);
      this.requests = [];
    }
  }

  /**
   * 요청 파일 저장
   */
  private saveRequests(): void {
    try {
      fs.writeFileSync(this.requestsFilePath, JSON.stringify(this.requests, null, 2) + '\n');
    } catch (error) {
      // 저장 실패 시 에러 로그
      logger.error(`[ToolRegistry] Failed to save requests: ${error}`);
    }
  }
}
