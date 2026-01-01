/**
 * CAD CLI - Claude Code가 직접 도구를 실행하는 CLI
 *
 * Claude Code가 tool_use 대신 Bash로 호출
 * LLM 없이 직접 CADExecutor 실행
 *
 * Usage:
 *   node cli.js draw_circle '{"name":"head","x":0,"y":0,"radius":50}'
 *   node cli.js export_json
 *   node cli.js list_entities
 */

import '../../cad-engine/pkg/cad_engine.js';
import { CADExecutor, type ToolResult } from './executor.js';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_NAME = process.env.CAD_CLI_INVOKE || 'cad-cli';

function defaultUserDataDir(): string {
  const appName = process.env.CAD_APP_NAME || 'CADViewer';
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', appName);
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, appName);
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(xdgConfig, appName);
}

function resolveSceneFile(): string {
  if (process.env.CAD_SCENE_PATH) {
    return resolve(process.env.CAD_SCENE_PATH);
  }
  const repoScene = resolve(__dirname, '../../viewer/scene.json');
  if (existsSync(repoScene)) {
    return repoScene;
  }
  return resolve(defaultUserDataDir(), 'scene.json');
}

const SCENE_FILE = resolveSceneFile();
const STATE_DIR = process.env.CAD_STATE_DIR ? resolve(process.env.CAD_STATE_DIR) : dirname(SCENE_FILE);
const STATE_FILE = process.env.CAD_STATE_PATH
  ? resolve(process.env.CAD_STATE_PATH)
  : resolve(STATE_DIR, '.cad-state.json');

interface SceneState {
  sceneName: string;
  entities: string[];
}

/** Entity from scene.json for replay */
interface SceneEntity {
  entity_type: 'Circle' | 'Rect' | 'Line' | 'Arc';
  geometry: {
    Circle?: { center: [number, number]; radius: number };
    Rect?: { origin: [number, number]; width: number; height: number };
    Line?: { points: [number, number][] };
    Arc?: { center: [number, number]; radius: number; start_angle: number; end_angle: number };
  };
  style?: unknown;
  metadata?: { name?: string };
}

function ensureParentDir(targetPath: string): void {
  mkdirSync(dirname(targetPath), { recursive: true });
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : JSON.stringify(error);
}

function print(message: string): void {
  process.stdout.write(`${message}\n`);
}

function printError(message: string): void {
  process.stderr.write(`${message}\n`);
}

function loadState(): SceneState {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    } catch (err) {
      printError(`Failed to load state file: ${formatError(err)}`);
    }
  }
  return { sceneName: 'cad-scene', entities: [] };
}

function saveState(state: SceneState): void {
  ensureParentDir(STATE_FILE);
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
- export_json: JSON 형식 (scene.json에 자동 저장)
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
- status로 현재 엔티티 수 확인`
};

function showDomains(): void {
  print(`
📚 CAD CLI DOMAINS

Available domains:
  primitives  - 기본 도형 (circle, rect, line, arc)
  style       - 색상/스타일 (fill, stroke)
  transforms  - 변환 (translate, rotate, scale, delete)
  query       - 조회 (list_entities, get_entity, get_scene_info)
  export      - 내보내기 (json, svg)
  session     - 세션 관리 (reset, status)

Usage:
  ${CLI_NAME} describe <domain>

Example:
  ${CLI_NAME} describe primitives
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
};

function getActionHints(command: string): string[] {
  return ACTION_HINTS[command] || ['list_entities로 현재 상태 확인'];
}

function enrichResult(
  executor: CADExecutor,
  command: string,
  result: ToolResult
): Record<string, unknown> {
  // Get scene info for context
  const sceneInfoResult = executor.exec('get_scene_info', {});

  return {
    ...result,
    scene_info: sceneInfoResult,
    hints: getActionHints(command),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (
    args.length === 0 ||
    args[0] === 'help' ||
    args[0] === '--help' ||
    args[0] === '-h'
  ) {
    print(`
🎨 CAD CLI - Claude Code Friendly

Usage:
  ${CLI_NAME} <command> '<json_params>'

Examples:
  ${CLI_NAME} draw_circle '{"name":"head","x":0,"y":0,"radius":50}'
  ${CLI_NAME} draw_rect '{"name":"body","x":-25,"y":0,"width":50,"height":80}'
  ${CLI_NAME} list_entities
  ${CLI_NAME} export_json

Commands by domain:
  ${CLI_NAME} describe primitives
  ${CLI_NAME} describe style
  ${CLI_NAME} describe transforms
  ${CLI_NAME} describe query
  ${CLI_NAME} describe export
  ${CLI_NAME} describe session

Scene file:
  ${SCENE_FILE}
`);
    return;
  }

  const command = args[0];

  // Handle domain description
  if (command === 'describe') {
    const domain = args[1];
    if (!domain) {
      showDomains();
      return;
    }

    const description = DOMAIN_DESCRIPTIONS[domain];
    if (description) {
      print(description);
    } else {
      printError(`Unknown domain: ${domain}`);
      showDomains();
    }
    return;
  }

  // Parse JSON params
  let params: Record<string, unknown> = {};
  if (args[1]) {
    try {
      params = JSON.parse(args[1]);
    } catch (e) {
      printError(`❌ Invalid JSON: ${args[1]}`);
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
  print(JSON.stringify(enrichedResult, null, 2));

  // Save scene if successful
  if (result.success) {
    const jsonResult = executor.exec('export_json', {});
    if (jsonResult.success && jsonResult.data) {
      ensureParentDir(SCENE_FILE);
      writeFileSync(SCENE_FILE, jsonResult.data);
    }

    // Update state
    if (command === 'reset') {
      state.entities = [];
      saveState(state);
    } else if (result.entity && command.startsWith('draw_')) {
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
    }
  } catch (err) {
    // Log but continue - don't fail entire replay for one bad entity
    const errorMessage = formatError(err);
    printError(`Failed to replay entity: ${entity.metadata?.name ?? 'unknown'} (${errorMessage})`);
  }
}

main().catch((error) => {
  printError(`CLI error: ${formatError(error)}`);
  process.exit(1);
});
