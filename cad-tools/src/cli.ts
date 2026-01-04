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
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { runCadCode } from './sandbox/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read from stdin (for piped input)
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    // Check if stdin has data (is a pipe/file, not tty)
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });
    process.stdin.on('end', () => {
      resolve(data.trim());
    });
    // Timeout to avoid hanging if no input
    setTimeout(() => resolve(data.trim()), 100);
  });
}
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
const SCENE_CODE_FILE = resolve(STATE_DIR, 'scene.code.js');
const MODULES_DIR = resolve(STATE_DIR, '.cad-modules');

interface SceneState {
  sceneName: string;
  entities: string[];
}

/** Entity from scene.json for replay */
interface SceneEntity {
  entity_type: 'Circle' | 'Rect' | 'Line' | 'Arc' | 'Polygon' | 'Bezier' | 'Group';
  geometry: {
    Circle?: { center: [number, number]; radius: number };
    Rect?: { origin: [number, number]; width: number; height: number };
    Line?: { points: [number, number][] };
    Arc?: { center: [number, number]; radius: number; start_angle: number; end_angle: number };
    Polygon?: { points: [number, number][] };
    Bezier?: { start: [number, number]; segments: [[number, number], [number, number], [number, number]][]; closed: boolean };
    Empty?: null;
  };
  transform?: {
    translate?: [number, number];
    rotate?: number;
    scale?: [number, number];
    pivot?: [number, number];
  };
  style?: unknown;
  metadata?: { name?: string; z_index?: number };
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

/**
 * 코드 전처리: ES6 import 문을 모듈 코드로 치환
 * 순환 참조 방지를 위해 이미 포함된 모듈 추적
 *
 * 지원 패턴:
 * - import { func1, func2 } from 'module-name';
 * - import * from 'module-name';
 * - import 'module-name';
 */
interface PreprocessResult {
  code: string;
  importedModules: string[];
  errors: string[];
}

function preprocessCode(code: string, importedModules: Set<string> = new Set()): PreprocessResult {
  const errors: string[] = [];
  const newlyImported: string[] = [];

  // ES6 import 패턴들
  // import { ... } from 'module'
  // import * from 'module'
  // import 'module'
  const importPattern = /import\s+(?:\{[^}]*\}\s+from\s+|(?:\*\s+from\s+)?)?['"]([^'"]+)['"]\s*;?/g;

  const processedCode = code.replace(importPattern, (match, moduleName) => {
    // 이미 임포트된 모듈이면 스킵
    if (importedModules.has(moduleName)) {
      return `// [import] '${moduleName}' already loaded`;
    }

    const modulePath = resolve(MODULES_DIR, `${moduleName}.js`);

    if (!existsSync(modulePath)) {
      errors.push(`Module '${moduleName}' not found`);
      return `// [import] ERROR: '${moduleName}' not found`;
    }

    // 모듈 코드 읽기
    const moduleCode = readFileSync(modulePath, 'utf-8');
    importedModules.add(moduleName);
    newlyImported.push(moduleName);

    // 모듈 내부의 import도 재귀적으로 처리
    const nested = preprocessCode(moduleCode, importedModules);
    errors.push(...nested.errors);
    newlyImported.push(...nested.importedModules);

    return `// ===== [import] ${moduleName} =====\n${nested.code}\n// ===== [/import] ${moduleName} =====\n`;
  });

  return {
    code: processedCode,
    importedModules: newlyImported,
    errors,
  };
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
- draw_polygon [name, points]: 다각형 (삼각형 산, 별, 화살표 등) - 닫힌 도형, fill 지원

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
- remove_from_group '{"group_name":"left_arm","entity_name":"hand"}' → 그룹에서 제거`,

  sandbox: `🚀 SANDBOX - run_cad_code 샌드박스 함수

run_cad_code로 JavaScript 코드를 실행할 때 사용 가능한 함수들입니다.

📋 PRIMITIVES (6개)
- drawCircle(name, x, y, radius)
- drawRect(name, x, y, width, height)
- drawLine(name, points[])           // [x1,y1, x2,y2, ...]
- drawArc(name, cx, cy, radius, startAngle, endAngle)
- drawPolygon(name, points[])        // [x1,y1, x2,y2, ...] 닫힌 도형
- drawBezier(name, points[], closed) // ⭐ 베지어 커브

📋 TRANSFORMS (4개)
- translate(name, dx, dy)
- rotate(name, angle)                // 라디안 단위!
- scale(name, sx, sy)
- setPivot(name, px, py)

📋 STYLE (3개)
- setFill(name, [r,g,b,a])          // 0.0~1.0
- setStroke(name, [r,g,b,a], width?)
- setZOrder(name, zIndex)            // 높을수록 앞

📋 GROUPS (2개)
- createGroup(name, children[])
- addToGroup(groupName, entityName)

📋 UTILITY (2개)
- deleteEntity(name)
- exists(name)                       // boolean 반환

📋 QUERY (3개)
- getWorldTransform(name)
- getWorldPoint(name, x, y)
- getWorldBounds(name)

⭐ BEZIER 포맷 (중요!)
points = [startX, startY,           // 시작점 (2개)
          cp1X, cp1Y, cp2X, cp2Y, endX, endY,  // 세그먼트1 (6개)
          cp1X, cp1Y, cp2X, cp2Y, endX, endY,  // 세그먼트2 (6개)
          ...]

💡 EXAMPLE - 산 그리기
drawBezier("mountain", [
  -100, 0,                    // 시작점 (왼쪽 바닥)
  -80, 10, -60, 30, -40, 50,  // 왼쪽 사면
  -20, 70, 0, 80, 20, 70,     // 정상
  40, 50, 60, 30, 80, 10,     // 오른쪽 사면
  100, 0, -100, 0, -100, 0    // 바닥 닫기
], true);
setFill("mountain", [0.5, 0.6, 0.7, 1]);
setStroke("mountain", [0,0,0,0], 0);

💡 TIPS
- 좌표계: Y+ 위쪽, 중심 (0,0)
- 색상: RGBA [0.0~1.0, 0.0~1.0, 0.0~1.0, 0.0~1.0]
- closed=true: 시작점과 끝점 자동 연결
- for문, 함수 정의 등 JavaScript 문법 모두 사용 가능`
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
  sandbox     - ⭐ run_cad_code 샌드박스 함수 (drawBezier 등)

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
  // Primitives
  draw_circle: ['set_fill로 색상 추가', 'set_stroke로 선 스타일 변경', 'translate로 위치 이동'],
  draw_rect: ['set_fill로 색상 추가', 'set_stroke로 선 스타일 변경', 'scale로 크기 조정'],
  draw_line: ['set_stroke로 선 색상/두께 변경', 'translate로 위치 이동'],
  draw_arc: ['set_stroke로 선 스타일 변경', 'rotate로 회전'],
  draw_polygon: ['set_fill로 색상 추가', 'set_stroke로 테두리 설정'],
  draw_bezier: ['set_fill로 색상 추가 (closed=true일 때)', 'set_stroke로 커브 스타일'],

  // Style
  set_fill: ['set_stroke로 선도 스타일링', 'list_entities로 확인'],
  set_stroke: ['set_fill로 채우기 추가', 'list_entities로 확인'],

  // Transform
  translate: ['get_entity로 결과 확인', 'rotate로 추가 변환'],
  rotate: ['get_entity로 결과 확인', 'scale로 추가 변환'],
  scale: ['get_entity로 결과 확인', 'translate로 추가 변환'],
  delete: ['list_entities로 남은 엔티티 확인'],
  set_pivot: ['rotate로 pivot 기준 회전', 'get_entity로 결과 확인'],

  // Z-Order
  set_z_order: ['capture_viewport로 결과 확인', 'bring_to_front/send_to_back으로 조정'],
  bring_to_front: ['capture_viewport로 결과 확인'],
  send_to_back: ['capture_viewport로 결과 확인'],

  // Query
  list_entities: ['get_entity로 상세 정보 확인', 'get_scene_info로 전체 현황'],
  get_entity: ['translate/rotate/scale로 변환', 'set_fill/set_stroke로 스타일링'],
  get_scene_info: ['export_svg로 내보내기', 'list_entities로 상세 목록'],
  get_selection: ['get_entity로 선택된 도형 상세 확인', 'translate/rotate/scale로 변환'],

  // Export
  export_json: ['export_svg로 SVG도 내보내기'],
  export_svg: ['작업 완료!'],
  capture_viewport: ['결과 이미지 확인', 'Read tool로 PNG 이미지 열기'],

  // Groups (객체지향 씬 설계)
  create_group: ['setZOrder로 그룹 z-order 설정 (필수!)', 'translate로 그룹 전체 이동'],
  ungroup: ['list_entities로 해제 결과 확인', 'create_group으로 다시 그룹화'],
  add_to_group: ['get_entity로 추가 결과 확인', 'remove_from_group으로 제거'],
  remove_from_group: ['list_entities로 결과 확인', 'add_to_group으로 다시 추가'],

  // Code Execution
  run_cad_code: ['save_module로 재사용 가능한 모듈로 저장', 'capture_viewport로 결과 확인'],
  save_module: ['run_module로 모듈 실행', 'list_modules로 저장된 모듈 확인'],
  run_module: ['capture_viewport로 결과 확인', 'create_group으로 그룹화'],
  list_modules: ['run_module로 모듈 실행'],
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

Code execution:
  ${CLI_NAME} run_cad_code '<javascript code>'
  ${CLI_NAME} get_scene_code

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

  // run_cad_code: Code editor for sandbox
  // - run_cad_code                    → 프로젝트 구조 (files, main, entities)
  // - run_cad_code <name>             → 파일 읽기
  // - run_cad_code <name> "code"      → 파일 쓰기 (덮어쓰기)
  // - run_cad_code <name> +"code"     → 파일에 코드 추가
  // - run_cad_code <name> -           → stdin에서 코드 읽기 (멀티라인)
  // - run_cad_code --delete <name>    → 파일 삭제
  // - run_cad_code --deps             → 의존성 그래프
  if (command === 'run_cad_code') {
    let target = args[1];  // main, module name, --delete, --deps, or undefined
    let newCode = args[2]; // code to write, '-' for stdin, or undefined

    // Check for special flags
    const isDeleteMode = target === '--delete';
    const isDepsMode = target === '--deps';

    if (isDeleteMode) {
      target = args[2]; // module name to delete
    }

    // Read from stdin if '-' is specified
    if (newCode === '-') {
      newCode = await readStdin();
      if (!newCode) {
        print(JSON.stringify({
          success: false,
          error: 'stdin에서 코드를 읽지 못했습니다.',
          hint: 'echo "code" | run_cad_code main -',
        }, null, 2));
        return;
      }
    }

    // Helper: get list of modules
    const getModuleList = (): string[] => {
      if (!existsSync(MODULES_DIR)) return [];
      return readdirSync(MODULES_DIR)
        .filter(f => f.endsWith('.js'))
        .map(f => f.replace('.js', ''));
    };

    // Helper: get current entities
    const getEntities = (): string[] => {
      if (!existsSync(SCENE_FILE)) return [];
      try {
        const scene = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
        return (scene.entities || []).map((e: SceneEntity) => e.metadata?.name).filter(Boolean);
      } catch {
        return [];
      }
    };

    // Helper: execute main code and update scene
    const executeMain = async (): Promise<{ success: boolean; error?: string; entities: string[] }> => {
      const mainCode = existsSync(SCENE_CODE_FILE) ? readFileSync(SCENE_CODE_FILE, 'utf-8') : '';
      if (!mainCode.trim()) {
        return { success: true, entities: [] };
      }

      const preprocessed = preprocessCode(mainCode);
      if (preprocessed.errors.length > 0) {
        return { success: false, error: `Import errors: ${preprocessed.errors.join(', ')}`, entities: [] };
      }

      const executor = CADExecutor.create('cad-scene');
      const result = await runCadCode(executor, preprocessed.code);

      if (result.success) {
        const jsonResult = executor.exec('export_json', {});
        if (jsonResult.success && jsonResult.data) {
          ensureParentDir(SCENE_FILE);
          writeFileSync(SCENE_FILE, jsonResult.data);
        }
      }

      executor.free();
      return {
        success: result.success,
        error: result.error,
        entities: result.entitiesCreated || [],
      };
    };

    // Helper: get imports from code (same pattern as preprocessCode)
    const getImports = (code: string): string[] => {
      const imports: string[] = [];
      // Match all import patterns:
      // import { ... } from 'module'
      // import * from 'module'
      // import 'module'
      const importRegex = /import\s+(?:\{[^}]*\}\s+from\s+|(?:\*\s+from\s+)?)?['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(code)) !== null) {
        imports.push(match[1]);
      }
      return imports;
    };

    // Mode: --deps - 의존성 그래프
    if (isDepsMode) {
      const modules = getModuleList();
      const deps: Record<string, string[]> = {};

      // main dependencies
      const mainCode = existsSync(SCENE_CODE_FILE) ? readFileSync(SCENE_CODE_FILE, 'utf-8') : '';
      deps['main'] = getImports(mainCode);

      // module dependencies
      for (const mod of modules) {
        const modPath = resolve(MODULES_DIR, `${mod}.js`);
        const modCode = readFileSync(modPath, 'utf-8');
        deps[mod] = getImports(modCode);
      }

      print(JSON.stringify({
        success: true,
        dependencies: deps,
        hint: '각 파일이 import하는 모듈 목록',
      }, null, 2));
      return;
    }

    // Mode: --delete - 모듈 삭제
    if (isDeleteMode) {
      if (!target) {
        print(JSON.stringify({
          success: false,
          error: '삭제할 파일명을 지정하세요.',
          hint: 'run_cad_code --delete <name>',
        }, null, 2));
        return;
      }

      if (target === 'main') {
        // Clear main instead of deleting
        writeFileSync(SCENE_CODE_FILE, '');
        const result = await executeMain();
        print(JSON.stringify({
          success: true,
          file: 'main',
          message: 'main 초기화 완료',
          entities: result.entities,
        }, null, 2));
        return;
      }

      const modulePath = resolve(MODULES_DIR, `${target}.js`);
      if (!existsSync(modulePath)) {
        print(JSON.stringify({
          success: false,
          error: `'${target}' 모듈을 찾을 수 없습니다.`,
        }, null, 2));
        return;
      }

      unlinkSync(modulePath);
      print(JSON.stringify({
        success: true,
        file: target,
        message: `'${target}' 모듈 삭제 완료`,
        files: ['main', ...getModuleList()],
      }, null, 2));
      return;
    }

    // Mode 1: 프로젝트 구조 반환 (인자 없음)
    if (!target) {
      const modules = getModuleList();
      const mainCode = existsSync(SCENE_CODE_FILE) ? readFileSync(SCENE_CODE_FILE, 'utf-8') : '';
      const entities = getEntities();

      print(JSON.stringify({
        success: true,
        files: ['main', ...modules],
        main: mainCode || '// 빈 프로젝트입니다. main에 코드를 작성하세요.',
        entities,
        hint: '읽기: run_cad_code <name>, 쓰기: run_cad_code <name> "code", 추가: run_cad_code <name> +"code"',
      }, null, 2));
      return;
    }

    // Mode 2: 파일 읽기 (코드 인자 없음)
    if (!newCode) {
      if (target === 'main') {
        const mainCode = existsSync(SCENE_CODE_FILE) ? readFileSync(SCENE_CODE_FILE, 'utf-8') : '';
        print(JSON.stringify({
          success: true,
          file: 'main',
          code: mainCode || '// 빈 main 파일입니다.',
        }, null, 2));
        return;
      }

      // Read module
      const modulePath = resolve(MODULES_DIR, `${target}.js`);
      if (!existsSync(modulePath)) {
        print(JSON.stringify({
          success: false,
          error: `'${target}' 파일을 찾을 수 없습니다.`,
          hint: `사용 가능: main, ${getModuleList().join(', ') || '(모듈 없음)'}`,
        }, null, 2));
        return;
      }

      const moduleCode = readFileSync(modulePath, 'utf-8');
      print(JSON.stringify({
        success: true,
        file: target,
        code: moduleCode,
      }, null, 2));
      return;
    }

    // Mode 3: 파일 쓰기 + 실행
    // Check for append mode (code starts with +)
    const isAppendMode = newCode.startsWith('+');
    const codeToWrite = isAppendMode ? newCode.slice(1) : newCode;

    if (target === 'main') {
      ensureParentDir(SCENE_CODE_FILE);

      if (isAppendMode) {
        // Append to existing code
        const existingCode = existsSync(SCENE_CODE_FILE) ? readFileSync(SCENE_CODE_FILE, 'utf-8') : '';
        writeFileSync(SCENE_CODE_FILE, existingCode + '\n' + codeToWrite);
      } else {
        // Overwrite
        writeFileSync(SCENE_CODE_FILE, codeToWrite);
      }

      const result = await executeMain();

      print(JSON.stringify({
        success: result.success,
        file: 'main',
        mode: isAppendMode ? 'append' : 'write',
        entities: result.entities,
        error: result.error,
        hint: result.success
          ? `main ${isAppendMode ? '추가' : '저장'} 및 실행 완료. ${result.entities.length}개 엔티티.`
          : '실행 실패. 코드를 확인하세요.',
      }, null, 2));
      return;
    }

    // Write module
    if (!existsSync(MODULES_DIR)) {
      mkdirSync(MODULES_DIR, { recursive: true });
    }
    const modulePath = resolve(MODULES_DIR, `${target}.js`);

    if (isAppendMode) {
      // Append to existing module
      const existingCode = existsSync(modulePath) ? readFileSync(modulePath, 'utf-8') : '';
      writeFileSync(modulePath, existingCode + '\n' + codeToWrite);
    } else {
      // Overwrite
      writeFileSync(modulePath, codeToWrite);
    }

    // Re-execute main (to pick up module changes)
    const result = await executeMain();

    print(JSON.stringify({
      success: result.success,
      file: target,
      mode: isAppendMode ? 'append' : 'write',
      entities: result.entities,
      error: result.error,
      hint: result.success
        ? `'${target}' 모듈 ${isAppendMode ? '추가' : '저장'} 후 main 재실행 완료.`
        : 'main 실행 실패. 코드를 확인하세요.',
    }, null, 2));
    return;
  }

  // get_scene_code: Get the code that created the current scene
  if (command === 'get_scene_code') {
    if (existsSync(SCENE_CODE_FILE)) {
      const code = readFileSync(SCENE_CODE_FILE, 'utf-8');
      print(JSON.stringify({
        success: true,
        code,
        hint: '이 코드를 수정하여 run_cad_code로 다시 실행할 수 있습니다.',
      }, null, 2));
    } else {
      print(JSON.stringify({
        success: false,
        error: 'No scene code found',
        hint: 'run_cad_code로 코드를 실행하면 자동 저장됩니다.',
      }, null, 2));
    }
    return;
  }

  // === Module System Commands ===

  // save_module: Save current scene code as a reusable module
  if (command === 'save_module') {
    const moduleName = args[1];
    if (!moduleName) {
      print(JSON.stringify({
        success: false,
        error: 'Module name required',
        hint: 'save_module <name>',
      }, null, 2));
      return;
    }

    if (!existsSync(SCENE_CODE_FILE)) {
      print(JSON.stringify({
        success: false,
        error: 'No scene code to save',
        hint: 'run_cad_code로 코드를 먼저 실행하세요.',
      }, null, 2));
      return;
    }

    // Validate module name (alphanumeric, underscore, hyphen only)
    if (!/^[a-zA-Z0-9_-]+$/.test(moduleName)) {
      print(JSON.stringify({
        success: false,
        error: 'Invalid module name',
        hint: '영문, 숫자, 언더스코어, 하이픈만 사용 가능합니다.',
      }, null, 2));
      return;
    }

    // Create modules directory if needed
    if (!existsSync(MODULES_DIR)) {
      mkdirSync(MODULES_DIR, { recursive: true });
    }

    const modulePath = resolve(MODULES_DIR, `${moduleName}.js`);
    copyFileSync(SCENE_CODE_FILE, modulePath);

    print(JSON.stringify({
      success: true,
      module: moduleName,
      path: modulePath,
      hint: `run_module ${moduleName}로 실행할 수 있습니다.`,
    }, null, 2));
    return;
  }

  // list_modules: List all saved modules
  if (command === 'list_modules') {
    if (!existsSync(MODULES_DIR)) {
      print(JSON.stringify({
        success: true,
        modules: [],
        hint: 'save_module <name>으로 모듈을 저장하세요.',
      }, null, 2));
      return;
    }

    const files = readdirSync(MODULES_DIR);
    const modules = files
      .filter(f => f.endsWith('.js'))
      .map(f => f.replace('.js', ''));

    print(JSON.stringify({
      success: true,
      modules,
      count: modules.length,
      hint: modules.length > 0
        ? 'run_module <name>으로 실행하거나 get_module <name>으로 코드를 확인하세요.'
        : 'save_module <name>으로 모듈을 저장하세요.',
    }, null, 2));
    return;
  }

  // get_module: Get module code
  if (command === 'get_module') {
    const moduleName = args[1];
    if (!moduleName) {
      print(JSON.stringify({
        success: false,
        error: 'Module name required',
        hint: 'get_module <name>',
      }, null, 2));
      return;
    }

    const modulePath = resolve(MODULES_DIR, `${moduleName}.js`);
    if (!existsSync(modulePath)) {
      print(JSON.stringify({
        success: false,
        error: `Module '${moduleName}' not found`,
        hint: 'list_modules로 저장된 모듈을 확인하세요.',
      }, null, 2));
      return;
    }

    const code = readFileSync(modulePath, 'utf-8');
    print(JSON.stringify({
      success: true,
      module: moduleName,
      code,
      hint: '이 코드를 수정하여 run_cad_code로 실행할 수 있습니다.',
    }, null, 2));
    return;
  }

  // delete_module: Delete a saved module
  if (command === 'delete_module') {
    const moduleName = args[1];
    if (!moduleName) {
      print(JSON.stringify({
        success: false,
        error: 'Module name required',
        hint: 'delete_module <name>',
      }, null, 2));
      return;
    }

    const modulePath = resolve(MODULES_DIR, `${moduleName}.js`);
    if (!existsSync(modulePath)) {
      print(JSON.stringify({
        success: false,
        error: `Module '${moduleName}' not found`,
        hint: 'list_modules로 저장된 모듈을 확인하세요.',
      }, null, 2));
      return;
    }

    unlinkSync(modulePath);
    print(JSON.stringify({
      success: true,
      module: moduleName,
      hint: `모듈 '${moduleName}'이 삭제되었습니다.`,
    }, null, 2));
    return;
  }

  // === Phase 4: LLM-Friendly Scene Navigation ===

  // overview: Hierarchical scene summary
  if (command === 'overview') {
    const executor = CADExecutor.create('cad-scene');

    // Load existing scene
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

    // Get all entities
    const listResult = executor.exec('list_entities', {});
    if (!listResult.success || !listResult.data) {
      print('📊 Scene Overview: Empty scene');
      executor.free();
      return;
    }

    const entities: Array<{ name: string; type: string }> = JSON.parse(listResult.data);

    // Build hierarchy - collect all groups first
    const groups: Map<string, { type: string; children: string[] }> = new Map();
    const childToParent: Map<string, string> = new Map();

    for (const e of entities) {
      if (e.type === 'Group') {
        const detailResult = executor.exec('get_entity', { name: e.name });
        let children: string[] = [];
        if (detailResult.success && detailResult.data) {
          const detail = JSON.parse(detailResult.data);
          children = detail.children || [];
          // Map children to their parent
          for (const childName of children) {
            childToParent.set(childName, e.name);
          }
        }
        groups.set(e.name, { type: 'Group', children });
      }
    }

    // Find standalone entities (not in any group)
    const standaloneEntities: string[] = [];
    for (const e of entities) {
      if (!childToParent.has(e.name) && e.type !== 'Group') {
        standaloneEntities.push(e.name);
      }
    }

    // Find root groups (groups not inside another group)
    const rootGroups = Array.from(groups.entries()).filter(([name]) => !childToParent.has(name));

    // Build output
    const lines: string[] = [];
    lines.push(`📊 Scene Overview (${entities.length} entities)`);
    lines.push('');

    if (rootGroups.length > 0) {
      lines.push('📁 Groups:');
      for (const [name, group] of rootGroups) {
        const childCount = group.children.length;
        const nestedGroups = group.children.filter(c => groups.has(c)).length;
        lines.push(`  └─ ${name} (${childCount} children${nestedGroups > 0 ? `, ${nestedGroups} subgroups` : ''})`);

        // Show subgroups (1 level deep)
        for (const childName of group.children) {
          const subgroup = groups.get(childName);
          if (subgroup) {
            lines.push(`     └─ ${childName} (${subgroup.children.length} children)`);
          }
        }
      }
    }

    if (standaloneEntities.length > 0) {
      lines.push('');
      lines.push(`📦 Standalone: ${standaloneEntities.length} entities`);
      if (standaloneEntities.length <= 10) {
        lines.push(`   ${standaloneEntities.join(', ')}`);
      } else {
        lines.push(`   ${standaloneEntities.slice(0, 10).join(', ')}... (+${standaloneEntities.length - 10} more)`);
      }
    }

    // Add scene bounds
    const sceneInfoResult = executor.exec('get_scene_info', {});
    if (sceneInfoResult.success && sceneInfoResult.data) {
      const info = JSON.parse(sceneInfoResult.data);
      if (info.bounds && info.bounds.min && info.bounds.max) {
        const b = info.bounds;
        lines.push('');
        lines.push(`📐 Bounds: (${b.min[0].toFixed(0)}, ${b.min[1].toFixed(0)}) → (${b.max[0].toFixed(0)}, ${b.max[1].toFixed(0)})`);
        lines.push(`   Size: ${(b.max[0] - b.min[0]).toFixed(0)} x ${(b.max[1] - b.min[1]).toFixed(0)}`);
      }
    }

    print(lines.join('\n'));
    executor.free();
    return;
  }

  // list_groups: Show only group hierarchy
  if (command === 'list_groups') {
    const executor = CADExecutor.create('cad-scene');

    if (existsSync(SCENE_FILE)) {
      try {
        const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
        if (sceneData.entities && Array.isArray(sceneData.entities)) {
          for (const entity of sceneData.entities) {
            replayEntity(executor, entity);
          }
        }
      } catch {
        // empty
      }
    }

    const listResult = executor.exec('list_entities', {});
    if (!listResult.success || !listResult.data) {
      print('No groups found.');
      executor.free();
      return;
    }

    const entities: Array<{ name: string; type: string }> = JSON.parse(listResult.data);
    const groupList = entities.filter(e => e.type === 'Group');

    if (groupList.length === 0) {
      print('No groups found. Use create_group to organize entities.');
      executor.free();
      return;
    }

    // Build parent map
    const childToParent: Map<string, string> = new Map();
    for (const g of groupList) {
      const detailResult = executor.exec('get_entity', { name: g.name });
      if (detailResult.success && detailResult.data) {
        const detail = JSON.parse(detailResult.data);
        for (const childName of (detail.children || [])) {
          childToParent.set(childName, g.name);
        }
      }
    }

    const lines: string[] = [`📁 Groups (${groupList.length}):`];
    for (const g of groupList) {
      const detailResult = executor.exec('get_entity', { name: g.name });
      let childCount = 0;
      if (detailResult.success && detailResult.data) {
        const detail = JSON.parse(detailResult.data);
        childCount = detail.children?.length || 0;
      }
      const parent = childToParent.get(g.name);
      const parentInfo = parent ? ` (in ${parent})` : ' (root)';
      lines.push(`  • ${g.name}: ${childCount} children${parentInfo}`);
    }

    print(lines.join('\n'));
    executor.free();
    return;
  }

  // describe_group: Detailed info about a specific group
  if (command === 'describe_group') {
    const groupName = args[1];
    if (!groupName) {
      print('Usage: describe_group <group_name>');
      return;
    }

    const executor = CADExecutor.create('cad-scene');

    if (existsSync(SCENE_FILE)) {
      try {
        const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
        if (sceneData.entities && Array.isArray(sceneData.entities)) {
          for (const entity of sceneData.entities) {
            replayEntity(executor, entity);
          }
        }
      } catch {
        // empty
      }
    }

    const detailResult = executor.exec('get_entity', { name: groupName });
    if (!detailResult.success) {
      print(`Group '${groupName}' not found.`);
      executor.free();
      return;
    }

    const detail = JSON.parse(detailResult.data as string);
    if (detail.entity_type !== 'Group') {
      print(`'${groupName}' is not a group (it's a ${detail.entity_type}).`);
      executor.free();
      return;
    }

    const children = detail.children || [];
    const lines: string[] = [];
    lines.push(`📁 Group: ${groupName}`);
    lines.push(`   Children: ${children.length}`);

    // Categorize children
    const subgroups: string[] = [];
    const primitives: { [key: string]: string[] } = {};

    for (const childName of children) {
      const childResult = executor.exec('get_entity', { name: childName });
      if (childResult.success && childResult.data) {
        const childDetail = JSON.parse(childResult.data);
        if (childDetail.entity_type === 'Group') {
          subgroups.push(childName);
        } else {
          const type = childDetail.entity_type || 'Unknown';
          if (!primitives[type]) primitives[type] = [];
          primitives[type].push(childName);
        }
      }
    }

    if (subgroups.length > 0) {
      lines.push(`   Subgroups (${subgroups.length}): ${subgroups.join(', ')}`);
    }

    for (const [type, names] of Object.entries(primitives)) {
      if (names.length <= 5) {
        lines.push(`   ${type}s (${names.length}): ${names.join(', ')}`);
      } else {
        lines.push(`   ${type}s (${names.length}): ${names.slice(0, 5).join(', ')}...`);
      }
    }

    // Get bounds
    const boundsResult = executor.exec('get_world_bounds', { name: groupName });
    if (boundsResult.success && boundsResult.data) {
      const b = JSON.parse(boundsResult.data);
      if (typeof b.min_x === 'number') {
        lines.push(`   Bounds: (${b.min_x.toFixed(0)}, ${b.min_y.toFixed(0)}) → (${b.max_x.toFixed(0)}, ${b.max_y.toFixed(0)})`);
      }
    }

    // Get transform
    if (detail.transform) {
      const t = detail.transform;
      if (t.translate && (t.translate[0] !== 0 || t.translate[1] !== 0)) {
        lines.push(`   Position: (${t.translate[0].toFixed(1)}, ${t.translate[1].toFixed(1)})`);
      }
      if (t.rotate && t.rotate !== 0) {
        lines.push(`   Rotation: ${(t.rotate * 180 / Math.PI).toFixed(1)}°`);
      }
      if (t.scale && (t.scale[0] !== 1 || t.scale[1] !== 1)) {
        lines.push(`   Scale: (${t.scale[0].toFixed(2)}, ${t.scale[1].toFixed(2)})`);
      }
    }

    print(lines.join('\n'));
    executor.free();
    return;
  }

  // translate_scene: Move entire scene
  if (command === 'translate_scene') {
    const dx = parseFloat(args[1] || '0');
    const dy = parseFloat(args[2] || '0');

    if (isNaN(dx) || isNaN(dy)) {
      print('Usage: translate_scene <dx> <dy>');
      return;
    }

    const executor = CADExecutor.create('cad-scene');

    if (existsSync(SCENE_FILE)) {
      try {
        const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
        if (sceneData.entities && Array.isArray(sceneData.entities)) {
          for (const entity of sceneData.entities) {
            replayEntity(executor, entity);
          }
        }
      } catch {
        // empty
      }
    }

    // Get all root-level entities
    const listResult = executor.exec('list_entities', {});
    if (!listResult.success || !listResult.data) {
      print('Scene is empty.');
      executor.free();
      return;
    }

    const entities: Array<{ name: string; parent?: string }> = JSON.parse(listResult.data);
    const rootEntities = entities.filter(e => !e.parent);

    let movedCount = 0;
    for (const e of rootEntities) {
      const result = executor.exec('translate', { name: e.name, dx, dy });
      if (result.success) movedCount++;
    }

    // Save scene
    const jsonResult = executor.exec('export_json', {});
    if (jsonResult.success && jsonResult.data) {
      ensureParentDir(SCENE_FILE);
      writeFileSync(SCENE_FILE, jsonResult.data);
    }

    print(`✓ Moved ${movedCount} root entities by (${dx}, ${dy})`);
    executor.free();
    return;
  }

  // scale_scene: Scale entire scene
  if (command === 'scale_scene') {
    const factor = parseFloat(args[1] || '1');

    if (isNaN(factor) || factor <= 0) {
      print('Usage: scale_scene <factor> (e.g., 0.8 to shrink, 1.2 to grow)');
      return;
    }

    const executor = CADExecutor.create('cad-scene');

    if (existsSync(SCENE_FILE)) {
      try {
        const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
        if (sceneData.entities && Array.isArray(sceneData.entities)) {
          for (const entity of sceneData.entities) {
            replayEntity(executor, entity);
          }
        }
      } catch {
        // empty
      }
    }

    // Get all root-level entities
    const listResult = executor.exec('list_entities', {});
    if (!listResult.success || !listResult.data) {
      print('Scene is empty.');
      executor.free();
      return;
    }

    const entities: Array<{ name: string; parent?: string }> = JSON.parse(listResult.data);
    const rootEntities = entities.filter(e => !e.parent);

    let scaledCount = 0;
    for (const e of rootEntities) {
      const result = executor.exec('scale', { name: e.name, sx: factor, sy: factor });
      if (result.success) scaledCount++;
    }

    // Save scene
    const jsonResult = executor.exec('export_json', {});
    if (jsonResult.success && jsonResult.data) {
      ensureParentDir(SCENE_FILE);
      writeFileSync(SCENE_FILE, jsonResult.data);
    }

    print(`✓ Scaled ${scaledCount} root entities by ${factor}x`);
    executor.free();
    return;
  }

  // center_scene: Center scene at origin
  if (command === 'center_scene') {
    const executor = CADExecutor.create('cad-scene');

    if (existsSync(SCENE_FILE)) {
      try {
        const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
        if (sceneData.entities && Array.isArray(sceneData.entities)) {
          for (const entity of sceneData.entities) {
            replayEntity(executor, entity);
          }
        }
      } catch {
        // empty
      }
    }

    // Get scene bounds
    const sceneInfoResult = executor.exec('get_scene_info', {});
    if (!sceneInfoResult.success || !sceneInfoResult.data) {
      print('Scene is empty.');
      executor.free();
      return;
    }

    const info = JSON.parse(sceneInfoResult.data);
    if (!info.bounds || !info.bounds.min || !info.bounds.max) {
      print('Cannot determine scene bounds.');
      executor.free();
      return;
    }

    const b = info.bounds;
    const centerX = (b.min[0] + b.max[0]) / 2;
    const centerY = (b.min[1] + b.max[1]) / 2;

    // Get all root-level entities
    const listResult = executor.exec('list_entities', {});
    if (!listResult.success || !listResult.data) {
      print('Scene is empty.');
      executor.free();
      return;
    }

    const entities: Array<{ name: string; parent?: string }> = JSON.parse(listResult.data);
    const rootEntities = entities.filter(e => !e.parent);

    let movedCount = 0;
    for (const e of rootEntities) {
      const result = executor.exec('translate', { name: e.name, dx: -centerX, dy: -centerY });
      if (result.success) movedCount++;
    }

    // Save scene
    const jsonResult = executor.exec('export_json', {});
    if (jsonResult.success && jsonResult.data) {
      ensureParentDir(SCENE_FILE);
      writeFileSync(SCENE_FILE, jsonResult.data);
    }

    print(`✓ Centered scene. Moved ${movedCount} entities by (${(-centerX).toFixed(1)}, ${(-centerY).toFixed(1)})`);
    executor.free();
    return;
  }

  // bring_to_front: Move entity to front
  if (command === 'bring_to_front') {
    const entityName = args[1];
    if (!entityName) {
      print('Usage: bring_to_front <entity_name>');
      return;
    }

    const executor = CADExecutor.create('cad-scene');

    if (existsSync(SCENE_FILE)) {
      try {
        const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
        if (sceneData.entities && Array.isArray(sceneData.entities)) {
          for (const entity of sceneData.entities) {
            replayEntity(executor, entity);
          }
        }
      } catch {
        // empty
      }
    }

    // Check entity exists
    const existsResult = executor.exec('exists', { name: entityName });
    if (!existsResult.success || (existsResult.data && !JSON.parse(existsResult.data).exists)) {
      print(`Entity '${entityName}' not found.`);
      executor.free();
      return;
    }

    // Find max z_index by reading scene.json
    let maxZ = 0;
    if (existsSync(SCENE_FILE)) {
      const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
      if (sceneData.entities) {
        for (const e of sceneData.entities) {
          const z = e.metadata?.z_index || 0;
          if (z > maxZ) maxZ = z;
        }
      }
    }

    const newZ = maxZ + 1;
    const result = executor.exec('set_z_order', { name: entityName, z_index: newZ });

    if (result.success) {
      const jsonResult = executor.exec('export_json', {});
      if (jsonResult.success && jsonResult.data) {
        ensureParentDir(SCENE_FILE);
        writeFileSync(SCENE_FILE, jsonResult.data);
      }
      print(`✓ '${entityName}' moved to front (z_index: ${newZ})`);
    } else {
      print(`Failed to move '${entityName}' to front`);
    }

    executor.free();
    return;
  }

  // send_to_back: Move entity to back
  if (command === 'send_to_back') {
    const entityName = args[1];
    if (!entityName) {
      print('Usage: send_to_back <entity_name>');
      return;
    }

    const executor = CADExecutor.create('cad-scene');

    if (existsSync(SCENE_FILE)) {
      try {
        const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
        if (sceneData.entities && Array.isArray(sceneData.entities)) {
          for (const entity of sceneData.entities) {
            replayEntity(executor, entity);
          }
        }
      } catch {
        // empty
      }
    }

    // Check entity exists
    const existsResult = executor.exec('exists', { name: entityName });
    if (!existsResult.success || (existsResult.data && !JSON.parse(existsResult.data).exists)) {
      print(`Entity '${entityName}' not found.`);
      executor.free();
      return;
    }

    // Find min z_index by reading scene.json
    let minZ = 0;
    if (existsSync(SCENE_FILE)) {
      const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
      if (sceneData.entities) {
        for (const e of sceneData.entities) {
          const z = e.metadata?.z_index || 0;
          if (z < minZ) minZ = z;
        }
      }
    }

    const newZ = minZ - 1;
    const result = executor.exec('set_z_order', { name: entityName, z_index: newZ });

    if (result.success) {
      const jsonResult = executor.exec('export_json', {});
      if (jsonResult.success && jsonResult.data) {
        ensureParentDir(SCENE_FILE);
        writeFileSync(SCENE_FILE, jsonResult.data);
      }
      print(`✓ '${entityName}' moved to back (z_index: ${newZ})`);
    } else {
      print(`Failed to move '${entityName}' to back`);
    }

    executor.free();
    return;
  }

  // where: Simple position query
  if (command === 'where') {
    const entityName = args[1];
    if (!entityName) {
      print('Usage: where <entity_name>');
      return;
    }

    const executor = CADExecutor.create('cad-scene');

    if (existsSync(SCENE_FILE)) {
      try {
        const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
        if (sceneData.entities && Array.isArray(sceneData.entities)) {
          for (const entity of sceneData.entities) {
            replayEntity(executor, entity);
          }
        }
      } catch {
        // empty
      }
    }

    const detailResult = executor.exec('get_entity', { name: entityName });
    if (!detailResult.success) {
      print(`Entity '${entityName}' not found.`);
      executor.free();
      return;
    }

    const detail = JSON.parse(detailResult.data as string);
    const lines: string[] = [];

    // Entity type and parent
    const parentInfo = detail.parent_id ? ` (in group: ${detail.parent_id})` : ' (root level)';
    lines.push(`📍 ${entityName} [${detail.entity_type}]${parentInfo}`);

    // World bounds
    const boundsResult = executor.exec('get_world_bounds', { name: entityName });
    if (boundsResult.success && boundsResult.data) {
      const b = JSON.parse(boundsResult.data);
      if (typeof b.min_x === 'number') {
        const centerX = (b.min_x + b.max_x) / 2;
        const centerY = (b.min_y + b.max_y) / 2;
        lines.push(`   Center: (${centerX.toFixed(1)}, ${centerY.toFixed(1)})`);
        lines.push(`   Size: ${(b.max_x - b.min_x).toFixed(1)} x ${(b.max_y - b.min_y).toFixed(1)}`);
      }
    }

    // Local transform
    if (detail.transform) {
      const t = detail.transform;
      if (t.translate && (t.translate[0] !== 0 || t.translate[1] !== 0)) {
        lines.push(`   Local offset: (${t.translate[0].toFixed(1)}, ${t.translate[1].toFixed(1)})`);
      }
    }

    print(lines.join('\n'));
    executor.free();
    return;
  }

  // run_module: Load and run a saved module
  if (command === 'run_module') {
    const moduleName = args[1];
    if (!moduleName) {
      print(JSON.stringify({
        success: false,
        error: 'Module name required',
        hint: 'run_module <name>',
      }, null, 2));
      return;
    }

    const modulePath = resolve(MODULES_DIR, `${moduleName}.js`);
    if (!existsSync(modulePath)) {
      print(JSON.stringify({
        success: false,
        error: `Module '${moduleName}' not found`,
        hint: 'list_modules로 저장된 모듈을 확인하세요.',
      }, null, 2));
      return;
    }

    const code = readFileSync(modulePath, 'utf-8');

    // Preprocess: import 문 처리
    const preprocessed = preprocessCode(code);

    if (preprocessed.errors.length > 0) {
      print(JSON.stringify({
        success: false,
        module: moduleName,
        error: `Import errors: ${preprocessed.errors.join(', ')}`,
        importedModules: preprocessed.importedModules,
        hint: 'list_modules로 사용 가능한 모듈을 확인하세요.',
      }, null, 2));
      return;
    }

    // Create fresh executor (reset)
    const executor = CADExecutor.create('cad-scene');
    const result = await runCadCode(executor, preprocessed.code);

    if (result.success) {
      // Save scene
      const jsonResult = executor.exec('export_json', {});
      if (jsonResult.success && jsonResult.data) {
        ensureParentDir(SCENE_FILE);
        writeFileSync(SCENE_FILE, jsonResult.data);
      }

      // Update scene.code.js with original module code
      ensureParentDir(SCENE_CODE_FILE);
      writeFileSync(SCENE_CODE_FILE, code);
    }

    print(JSON.stringify({
      success: result.success,
      module: moduleName,
      entitiesCreated: result.entitiesCreated,
      importedModules: preprocessed.importedModules,
      error: result.error,
      logs: result.logs,
      hint: result.success
        ? `모듈 '${moduleName}' 실행 완료. ${result.entitiesCreated.length}개 엔티티 생성.${preprocessed.importedModules.length > 0 ? ` (${preprocessed.importedModules.join(', ')} 포함)` : ''}`
        : '모듈 실행 실패. 오류 메시지를 확인하세요.',
    }, null, 2));

    executor.free();
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
      // Clear scene.code.js too
      if (existsSync(SCENE_CODE_FILE)) {
        writeFileSync(SCENE_CODE_FILE, '');
      }
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

      case 'Polygon':
        if (geometry?.Polygon) {
          const points = geometry.Polygon.points.flat();
          executor.exec('draw_polygon', { name, points, style });
        }
        break;

      case 'Bezier':
        if (geometry?.Bezier) {
          const { start, segments, closed } = geometry.Bezier;
          // Flatten: [start_x, start_y, cp1_x, cp1_y, cp2_x, cp2_y, end_x, end_y, ...]
          const points: number[] = [...start];
          for (const seg of segments) {
            points.push(...seg[0], ...seg[1], ...seg[2]);
          }
          executor.exec('draw_bezier', { name, points, closed, style });
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

    // Apply z_index if present
    if (metadata?.z_index !== undefined && metadata.z_index !== 0) {
      executor.exec('set_z_order', { name, z_index: metadata.z_index });
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
