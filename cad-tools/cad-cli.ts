#!/usr/bin/env npx tsx
/**
 * CAD CLI - Claude Code가 직접 도구를 실행하는 CLI
 *
 * Claude Code가 tool_use 대신 Bash로 호출
 * LLM 없이 직접 CADExecutor 실행
 *
 * Usage:
 *   npx tsx cad-cli.ts draw_circle '{"name":"head","x":0,"y":0,"radius":50}'
 *   npx tsx cad-cli.ts export_json
 *   npx tsx cad-cli.ts list_entities
 */

import '../cad-engine/pkg/cad_engine.js';
import { CADExecutor } from './src/executor.js';
import { logger } from './src/logger.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENE_FILE = resolve(__dirname, '../viewer/scene.json');
const STATE_FILE = resolve(__dirname, '.cad-state.json');

interface SceneState {
  sceneName: string;
  entities: string[];
}

/** Entity from scene.json for replay */
interface SceneEntity {
  entity_type: 'Circle' | 'Rect' | 'Line' | 'Arc' | 'Group';
  geometry: {
    Circle?: { center: [number, number]; radius: number };
    Rect?: { origin: [number, number]; width: number; height: number };
    Line?: { points: [number, number][] };
    Arc?: { center: [number, number]; radius: number; start_angle: number; end_angle: number };
    Empty?: null;
  };
  style?: unknown;
  metadata?: { name?: string };
  children?: string[];
}

function loadState(): SceneState {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    } catch (err) {
      logger.error('Failed to load state file:', err instanceof Error ? err.message : String(err));
    }
  }
  return { sceneName: 'cad-scene', entities: [] };
}

function saveState(state: SceneState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ============================================================================
// AX Domain Descriptions
// ============================================================================

const DOMAIN_DESCRIPTIONS: Record<string, string> = {
  primitives: `📦 PRIMITIVES - 기본 도형 그리기

📋 ACTIONS
- draw_circle [name, x, y, radius]: 원 (머리, 관절, 버튼 등)
- draw_rect [name, x, y, width, height]: 사각형 (몸통, 창문, 문 등)
- draw_line [name, points]: 선분/폴리라인 (팔, 다리, 지붕 등)
- draw_arc [name, cx, cy, radius, start_angle, end_angle]: 호 (미소, 문 표시 등)

🎯 WORKFLOW
1. list_entities → 현재 상태 확인
2. primitives → 도형 그리기
3. style → 색상/스타일 적용
4. transforms → 위치/크기 조정

💡 TIPS
- 이름은 의미있게: "head", "left_arm", "door" 등
- 좌표계: Y+ 위쪽, 중심 (0,0)
- style 파라미터로 그리기와 동시에 스타일 적용 가능`,

  style: `🎨 STYLE - 색상 및 스타일 적용

📋 ACTIONS
- set_fill [name, fill]: 채우기 색상 설정
- set_stroke [name, stroke]: 선 스타일 설정 (color, width)
- remove_fill [name]: 채우기 제거
- remove_stroke [name]: 선 제거

🎯 WORKFLOW
1. primitives로 도형 그리기 완료
2. set_fill로 채우기 색상 적용
3. set_stroke로 선 스타일 조정

💡 COLOR FORMAT
- RGBA 배열: [r, g, b, a] (각 0.0 ~ 1.0)
- 빨강: [1, 0, 0, 1]
- 반투명 파랑: [0, 0, 1, 0.5]

💡 STROKE OPTIONS
- width: 선 두께 (기본 1)
- color: RGBA 배열
- dash: [on, off] 점선 패턴`,

  transforms: `🔄 TRANSFORMS - 도형 변환

📋 ACTIONS
- translate [name, dx, dy]: 이동
- rotate [name, angle, cx?, cy?]: 회전 (도 단위, 반시계방향)
- scale [name, sx, sy, cx?, cy?]: 크기 조절
- delete [name]: 삭제

🎯 WORKFLOW
1. list_entities로 대상 확인
2. 필요한 변환 적용
3. get_entity로 결과 확인

💡 TIPS
- rotate/scale의 cx, cy: 변환 중심점 (생략시 도형 중심)
- 삭제 전 get_entity로 확인 권장`,

  query: `🔍 QUERY - 씬 조회

📋 ACTIONS
- list_entities: 모든 엔티티 목록
- get_entity [name]: 특정 엔티티 상세 정보
- get_scene_info: 씬 전체 정보 (bounds, count, last_operation)

🎯 WORKFLOW
1. 작업 시작 전: list_entities로 현재 상태 파악
2. 작업 중: get_scene_info로 진행 상황 확인
3. 디버깅: get_entity로 특정 엔티티 검증

💡 TIPS
- 작업 전후로 list_entities 호출 권장
- get_scene_info의 bounds로 뷰포트 계산 가능`,

  export: `💾 EXPORT - 내보내기

📋 ACTIONS
- export_json: JSON 형식 (viewer/scene.json에 자동 저장)
- export_svg: SVG 형식

🎯 WORKFLOW
1. 모든 도형 작업 완료
2. export_json으로 저장 (자동 저장됨)
3. 필요시 export_svg로 벡터 출력

💡 TIPS
- scene.json은 매 명령어 후 자동 저장
- SVG는 반환값의 data 필드에 포함`,

  session: `📁 SESSION - 세션 관리

📋 ACTIONS
- reset: 새 scene 시작 (모든 엔티티 삭제)
- status: 현재 세션 상태 확인

🎯 WORKFLOW
1. 새 작업 시작: reset
2. 상태 확인: status
3. 작업 진행...

💡 TIPS
- reset은 되돌릴 수 없음
- status로 현재 엔티티 수 확인`,

  group: `🗂️ GROUP - 그룹화

📋 ACTIONS
- create_group [name, children]: 여러 도형을 그룹으로 묶기

🎯 WORKFLOW
1. primitives로 개별 도형 그리기 (예: upper_arm, lower_arm, hand)
2. create_group으로 그룹 생성 (예: left_arm)
3. 그룹 단위로 변환 적용

💡 TIPS
- children: 그룹에 포함할 도형 이름 배열
- 존재하지 않는 도형은 무시됨
- 빈 children으로도 빈 그룹 생성 가능
- 그룹도 다른 그룹의 자식이 될 수 있음 (중첩 그룹)

💡 EXAMPLES
- create_group '{"name":"left_arm","children":["upper_arm","lower_arm","hand"]}'
- create_group '{"name":"skeleton","children":["head","torso","left_arm","right_arm"]}'`
};

function showDomains(): void {
  console.log(`
📚 CAD CLI DOMAINS

Available domains:
  primitives  - 기본 도형 (circle, rect, line, arc)
  style       - 색상/스타일 (fill, stroke)
  transforms  - 변환 (translate, rotate, scale, delete)
  group       - 그룹화 (create_group)
  query       - 조회 (list_entities, get_entity, get_scene_info)
  export      - 내보내기 (json, svg)
  session     - 세션 관리 (reset, status)

Usage:
  npx tsx cad-cli.ts describe <domain>

Example:
  npx tsx cad-cli.ts describe primitives
`);
}

// ============================================================================
// Action Hints - 다음 단계 제안
// ============================================================================

const ACTION_HINTS: Record<string, string[]> = {
  draw_circle: ['set_fill로 색상 추가', 'set_stroke로 선 스타일 변경', 'translate로 위치 이동'],
  draw_rect: ['set_fill로 색상 추가', 'set_stroke로 선 스타일 변경', 'scale로 크기 조정'],
  draw_line: ['set_stroke로 선 색상/두께 변경', 'translate로 위치 이동'],
  draw_arc: ['set_stroke로 선 스타일 변경', 'rotate로 회전'],
  set_fill: ['set_stroke로 선도 스타일링', 'list_entities로 확인'],
  set_stroke: ['set_fill로 채우기 추가', 'list_entities로 확인'],
  translate: ['get_entity로 결과 확인', 'rotate로 추가 변환'],
  rotate: ['get_entity로 결과 확인', 'scale로 추가 변환'],
  scale: ['get_entity로 결과 확인', 'translate로 추가 변환'],
  delete: ['list_entities로 남은 엔티티 확인'],
  list_entities: ['get_entity로 상세 정보 확인', 'get_scene_info로 전체 현황'],
  get_entity: ['translate/rotate/scale로 변환', 'set_fill/set_stroke로 스타일링'],
  get_scene_info: ['export_svg로 내보내기', 'list_entities로 상세 목록'],
  export_json: ['export_svg로 SVG도 내보내기'],
  export_svg: ['작업 완료!'],
  create_group: ['translate로 그룹 전체 이동', 'rotate로 그룹 전체 회전', 'list_entities로 확인'],
};

function getActionHints(command: string): string[] {
  return ACTION_HINTS[command] || ['list_entities로 현재 상태 확인'];
}

function enrichResult(
  executor: CADExecutor,
  command: string,
  result: Record<string, unknown>
): Record<string, unknown> {
  // Get scene info for context
  const sceneInfoResult = executor.exec('get_scene_info', {});
  let sceneContext: Record<string, unknown> = {};

  if (sceneInfoResult.success && sceneInfoResult.data) {
    try {
      const info = JSON.parse(sceneInfoResult.data as string);
      sceneContext = {
        entityCount: info.entity_count,
        lastOperation: info.last_operation,
        bounds: info.bounds,
      };
    } catch {
      // ignore
    }
  }

  return {
    ...result,
    scene: sceneContext,
    actionHints: result.success ? getActionHints(command) : ['오류 확인 후 재시도'],
  };
}

function showDomainDescription(domain: string): void {
  const desc = DOMAIN_DESCRIPTIONS[domain];
  if (desc) {
    console.log(desc);
  } else {
    console.error(`❌ Unknown domain: ${domain}`);
    console.log('Available: primitives, style, transforms, query, export, session');
  }
}

function showHelp(): void {
  console.log(`
CAD CLI - Claude Code용 직접 실행 CLI

Usage:
  npx tsx cad-cli.ts <command> [json_params]

Commands (primitives):
  draw_circle   {"name":"...", "x":0, "y":0, "radius":50}
  draw_rect     {"name":"...", "x":0, "y":0, "width":100, "height":50}
  draw_line     {"name":"...", "points":[x1,y1,x2,y2,...]}
  draw_arc      {"name":"...", "cx":0, "cy":0, "radius":50, "start_angle":0, "end_angle":90}

Commands (transforms):
  translate     {"name":"...", "dx":10, "dy":20}
  rotate        {"name":"...", "angle":45, "cx":0, "cy":0}
  scale         {"name":"...", "sx":2, "sy":2, "cx":0, "cy":0}
  delete        {"name":"..."}

Commands (group):
  create_group  {"name":"...", "children":["entity1","entity2",...]}

Commands (query):
  list_entities
  get_entity    {"name":"..."}
  get_scene_info

Commands (export):
  export_json
  export_svg

Commands (session):
  reset         새 scene 시작
  status        현재 상태 확인

Commands (discovery):
  domains       사용 가능한 도메인 목록
  describe <d>  도메인 상세 설명 (예: describe primitives)

Examples:
  npx tsx cad-cli.ts draw_circle '{"name":"head","x":0,"y":100,"radius":30}'
  npx tsx cad-cli.ts draw_rect '{"name":"body","x":-25,"y":0,"width":50,"height":80}'
  npx tsx cad-cli.ts list_entities
  npx tsx cad-cli.ts export_json
`);
}

async function main(): Promise<void> {
  const [command, paramsJson] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  // Discovery commands
  if (command === 'domains') {
    showDomains();
    return;
  }

  if (command === 'describe') {
    const domain = paramsJson || '';
    if (!domain) {
      showDomains();
    } else {
      showDomainDescription(domain);
    }
    return;
  }

  // Session commands
  if (command === 'reset') {
    if (existsSync(STATE_FILE)) {
      writeFileSync(STATE_FILE, JSON.stringify({ sceneName: 'cad-scene', entities: [] }));
    }
    if (existsSync(SCENE_FILE)) {
      writeFileSync(SCENE_FILE, JSON.stringify({ name: 'cad-scene', entities: [] }));
    }
    console.log('✅ Scene reset');
    return;
  }

  if (command === 'status') {
    const state = loadState();
    console.log(JSON.stringify({
      sceneName: state.sceneName,
      entityCount: state.entities.length,
      entities: state.entities,
      sceneFile: SCENE_FILE,
    }, null, 2));
    return;
  }

  // Parse params
  let params: Record<string, unknown> = {};
  if (paramsJson) {
    try {
      params = JSON.parse(paramsJson);
    } catch (e) {
      console.error('❌ Invalid JSON:', paramsJson);
      process.exit(1);
    }
  }

  // Create executor and load existing scene
  const executor = CADExecutor.create('cad-scene');
  const state = loadState();

  // Replay existing entities from scene.json if available
  if (existsSync(SCENE_FILE)) {
    try {
      const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
      if (sceneData.entities && Array.isArray(sceneData.entities)) {
        for (const entity of sceneData.entities) {
          replayEntity(executor, entity);
        }
      }
    } catch {
      // Start fresh
    }
  }

  // Execute command
  const result = executor.exec(command, params);

  // Enrich result with context
  const enrichedResult = enrichResult(executor, command, result);

  // Output result
  console.log(JSON.stringify(enrichedResult, null, 2));

  // Save scene if successful
  if (result.success) {
    const jsonResult = executor.exec('export_json', {});
    if (jsonResult.success && jsonResult.data) {
      writeFileSync(SCENE_FILE, jsonResult.data);
    }

    // Update state
    if (result.entity && command.startsWith('draw_')) {
      state.entities.push(result.entity);
      saveState(state);
    } else if (command === 'delete' && params.name) {
      state.entities = state.entities.filter(e => e !== params.name);
      saveState(state);
    }
  }

  executor.free();
}

/**
 * Replay entity from saved scene
 */
function replayEntity(executor: CADExecutor, entity: SceneEntity): void {
  const { entity_type, geometry, style, metadata } = entity;
  const name = metadata?.name;

  if (!name) return;

  try {
    switch (entity_type) {
      case 'Circle':
        if (geometry?.Circle) {
          const { center, radius } = geometry.Circle;
          executor.exec('draw_circle', {
            name,
            x: center[0],
            y: center[1],
            radius,
            style,
          });
        }
        break;

      case 'Rect':
        if (geometry?.Rect) {
          const { origin, width, height } = geometry.Rect;
          executor.exec('draw_rect', {
            name,
            x: origin[0],
            y: origin[1],
            width,
            height,
            style,
          });
        }
        break;

      case 'Line':
        if (geometry?.Line) {
          const points = geometry.Line.points.flat();
          executor.exec('draw_line', { name, points, style });
        }
        break;

      case 'Arc':
        if (geometry?.Arc) {
          const { center, radius, start_angle, end_angle } = geometry.Arc;
          executor.exec('draw_arc', {
            name,
            cx: center[0],
            cy: center[1],
            radius,
            start_angle,
            end_angle,
            style,
          });
        }
        break;

      case 'Group':
        // Group은 children을 통해 재생성 (빈 그룹도 포함)
        executor.exec('create_group', {
          name,
          children: entity.children ?? [],
        });
        break;
    }
  } catch (err) {
    // Log but continue - don't fail entire replay for one bad entity
    logger.error('Failed to replay entity:', entity.metadata?.name, err instanceof Error ? err.message : String(err));
  }
}

main().catch((err) => logger.error('Main error:', err instanceof Error ? err.message : String(err)));
