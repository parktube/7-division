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
// captureViewport is dynamically imported only when needed (puppeteer not bundled in packaged app)
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
  entity_type: 'Circle' | 'Rect' | 'Line' | 'Arc' | 'Group';
  geometry: {
    Circle?: { center: [number, number]; radius: number };
    Rect?: { origin: [number, number]; width: number; height: number };
    Line?: { points: [number, number][] };
    Arc?: { center: [number, number]; radius: number; start_angle: number; end_angle: number };
    Empty?: null;
  };
  transform?: {
    translate?: [number, number];
    rotate?: number;
    scale?: [number, number];
    pivot?: [number, number];
  };
  style?: unknown;
  metadata?: { name?: string };
  children?: string[];
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
- set_pivot [name, px, py]: 회전/스케일 중심점 설정
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
- get_selection: 뷰어에서 선택된 도형 조회

🎯 WORKFLOW
1. 작업 시작 전: list_entities로 현재 상태 파악
2. 사용자가 "이거"라고 말하면: get_selection으로 선택된 도형 확인
3. 디버깅: get_entity로 특정 엔티티 검증

💡 TIPS
- 작업 전후로 list_entities 호출 권장
- get_selection으로 사용자가 클릭한 도형 확인 가능
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
- add_to_group: 기존 그룹에 엔티티 추가 (다른 그룹에서 자동 이동)
- remove_from_group: 그룹에서 엔티티 제거 (독립 엔티티로)

💡 EXAMPLES
- create_group '{"name":"left_arm","children":["upper_arm","lower_arm","hand"]}'
- create_group '{"name":"skeleton","children":["head","torso","left_arm","right_arm"]}'
- ungroup '{"name":"left_arm"}' → 그룹 해제, 자식들은 독립 엔티티로
- add_to_group '{"group_name":"left_arm","entity_name":"wrist"}' → 기존 그룹에 추가
- remove_from_group '{"group_name":"left_arm","entity_name":"hand"}' → 그룹에서 제거`
};

function showDomains(): void {
  print(`
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
  set_pivot: ['rotate로 pivot 기준 회전', 'get_entity로 결과 확인'],
  list_entities: ['get_entity로 상세 정보 확인', 'get_scene_info로 전체 현황'],
  get_entity: ['translate/rotate/scale로 변환', 'set_fill/set_stroke로 스타일링'],
  get_scene_info: ['export_svg로 내보내기', 'list_entities로 상세 목록'],
  get_selection: ['get_entity로 선택된 도형 상세 확인', 'translate/rotate/scale로 변환'],
  export_json: ['export_svg로 SVG도 내보내기'],
  export_svg: ['작업 완료!'],
  create_group: ['translate로 그룹 전체 이동', 'rotate로 그룹 전체 회전', 'list_entities로 확인'],
  ungroup: ['list_entities로 해제 결과 확인', 'create_group으로 다시 그룹화'],
  add_to_group: ['get_entity로 추가 결과 확인', 'remove_from_group으로 제거'],
  remove_from_group: ['list_entities로 결과 확인', 'add_to_group으로 다시 추가'],
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
      // ignore parsing errors
    }
  }

  return {
    ...result,
    scene_info: sceneInfoResult,
    hints: getActionHints(command),
    scene: sceneContext,
    actionHints: result.success ? getActionHints(command) : ['오류 확인 후 재시도'],
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
    const isWindows = process.platform === 'win32';
    const q = isWindows ? '"' : "'";
    const esc = isWindows ? '\\"' : '"';

    print(`
🎨 CAD CLI - Claude Code Friendly

Usage:
  ${CLI_NAME} <command> ${q}{${esc}param${esc}:${esc}value${esc}}${q}

Examples:
  ${CLI_NAME} draw_circle ${q}{${esc}name${esc}:${esc}head${esc},${esc}x${esc}:0,${esc}y${esc}:0,${esc}radius${esc}:50}${q}
  ${CLI_NAME} draw_rect ${q}{${esc}name${esc}:${esc}body${esc},${esc}x${esc}:-25,${esc}y${esc}:0,${esc}width${esc}:50,${esc}height${esc}:80}${q}
  ${CLI_NAME} list_entities
  ${CLI_NAME} export_json

Commands by domain:
  ${CLI_NAME} describe primitives
  ${CLI_NAME} describe style
  ${CLI_NAME} describe transforms
  ${CLI_NAME} describe group
  ${CLI_NAME} describe query
  ${CLI_NAME} describe export
  ${CLI_NAME} describe session

Discovery:
  ${CLI_NAME} domains

Extra commands:
  ${CLI_NAME} get_selection
  ${CLI_NAME} capture_viewport

Scene file:
  ${SCENE_FILE}
`);
    return;
  }

  const command = args[0];

  if (command === 'domains') {
    showDomains();
    return;
  }

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

  if (command === 'get_selection') {
    const selectionFile = resolve(__dirname, '../../viewer/selection.json');
    if (existsSync(selectionFile)) {
      try {
        const selection = JSON.parse(readFileSync(selectionFile, 'utf-8'));
        print(JSON.stringify({
          success: true,
          selection,
          hint: selection.last_selected
            ? `선택된 도형: "${selection.last_selected}". 이 도형을 수정하려면 translate/rotate/scale 사용.`
            : '선택된 도형 없음. 뷰어에서 도형을 클릭하세요.',
        }, null, 2));
      } catch {
        print(JSON.stringify({
          success: false,
          error: '선택 정보를 읽을 수 없습니다',
          hint: '뷰어에서 도형을 클릭하여 선택하세요',
        }, null, 2));
      }
    } else {
      print(JSON.stringify({
        success: true,
        selection: { selected_ids: [], last_selected: null, timestamp: null },
        hint: '아직 선택된 도형이 없습니다. 뷰어에서 도형을 클릭하세요.',
      }, null, 2));
    }
    return;
  }

  if (command === 'capture_viewport') {
    const outputPath = resolve(__dirname, '../../viewer/capture.png');
    // Dynamic import to avoid loading puppeteer at startup (not bundled in packaged app)
    const { captureViewport } = await import('./capture.js');
    const result = await captureViewport({
      outputPath,
      width: 800,
      height: 600,
      waitMs: 1000,
    });
    if (result.success) {
      print(JSON.stringify({
        success: true,
        path: result.path,
        message: 'Viewport captured. Use Read tool to view the image.',
        hint: `Read file: ${result.path}`,
      }, null, 2));
    } else {
      print(JSON.stringify({
        success: false,
        error: result.error,
        hint: '뷰어 서버가 실행 중인지 확인하세요 (node viewer/server.cjs)',
      }, null, 2));
    }
    return;
  }

  // Parse JSON params
  let params: Record<string, unknown> = {};
  if (args[1]) {
    try {
      params = JSON.parse(args[1]);
    } catch {
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
  if (command === 'status') {
    enrichedResult.state = {
      sceneName: state.sceneName,
      entityCount: state.entities.length,
      entities: state.entities,
      sceneFile: SCENE_FILE,
    };
  }

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
  const { entity_type, geometry, style, metadata, transform, children } = entity;
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
        executor.exec('create_group', {
          name,
          children: children ?? [],
        });
        break;
    }

    if (transform) {
      const pivot = transform.pivot;
      const scale = transform.scale ?? [1, 1];
      const rotate = transform.rotate ?? 0;
      const translate = transform.translate ?? [0, 0];

      if (pivot && (pivot[0] !== 0 || pivot[1] !== 0)) {
        executor.exec('set_pivot', {
          name,
          px: pivot[0],
          py: pivot[1],
        });
      }

      if (scale[0] !== 1 || scale[1] !== 1) {
        executor.exec('scale', {
          name,
          sx: scale[0],
          sy: scale[1],
        });
      }

      if (rotate !== 0) {
        executor.exec('rotate', {
          name,
          angle: rotate,
        });
      }

      if (translate[0] !== 0 || translate[1] !== 0) {
        executor.exec('translate', {
          name,
          dx: translate[0],
          dy: translate[1],
        });
      }
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
