/**
 * CAD CLI - Claude Code가 직접 도구를 실행하는 CLI
 *
 * Claude Code가 tool_use 대신 Bash로 호출
 * LLM 없이 직접 CADExecutor 실행
 *
 * Usage:
 *   node cli.js draw_circle '{"name":"head","x":0,"y":0,"radius":50}'
 *   node cli.js export_json
 *   node cli.js export_svg
 *   node cli.js capture_viewport
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
import { logger } from './logger.js';
import { init as initLexer, parse as parseImports } from 'es-module-lexer';
import {
  handleRunCadCodeSearch,
  handleRunCadCodeInfo,
  handleRunCadCodeLines,
  handleRunCadCodeStatus,
  getModuleList,
  getCodeImports,
  readFileOrEmpty,
} from './run-cad-code/index.js';

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
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      resolve(data.trim());
    };

    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
      // Reset timeout on each readable event
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(finish, 100);
    });
    process.stdin.on('end', finish);

    // Initial timeout for pipes with no data
    timeoutId = setTimeout(finish, 100);
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

// Selection file path for get_selection and --selection
function resolveSelectionFile(): string {
  if (process.env.CAD_SELECTION_PATH) {
    return resolve(process.env.CAD_SELECTION_PATH);
  }
  const repoSelection = resolve(__dirname, '../../viewer/selection.json');
  if (existsSync(repoSelection)) {
    return repoSelection;
  }
  return resolve(defaultUserDataDir(), 'selection.json');
}
const SELECTION_FILE = resolveSelectionFile();

// Sketch file path for --clear-sketch (Story 8.2)
function resolveSketchFile(): string {
  if (process.env.CAD_SKETCH_PATH) {
    return resolve(process.env.CAD_SKETCH_PATH);
  }
  const repoSketch = resolve(__dirname, '../../viewer/sketch.json');
  return repoSketch;
}
const SKETCH_FILE = resolveSketchFile();

/** Clear sketch overlay (Story 8.2) */
function clearSketch(): void {
  try {
    writeFileSync(SKETCH_FILE, '{"strokes":[]}');
  } catch (err) {
    // Log error but don't fail - sketch file might not exist or be writable
    logger.debug(`[cli] clearSketch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Helper: Get selection result (used by both get_selection command and --selection flag) */
function getSelectionResult(): { success: boolean; selection?: unknown; error?: string; hint: string } {
  if (existsSync(SELECTION_FILE)) {
    try {
      const selection = JSON.parse(readFileSync(SELECTION_FILE, 'utf-8'));
      return {
        success: true,
        selection,
        hint: selection.last_selected
          ? `선택된 도형: '${selection.last_selected}'. 이 도형을 수정하려면 translate/rotate/scale 사용.`
          : '선택된 도형 없음. 뷰어에서 도형을 클릭하세요.',
      };
    } catch {
      return {
        success: false,
        error: '선택 정보를 읽을 수 없습니다',
        hint: '뷰어에서 도형을 클릭하여 선택하세요',
      };
    }
  }
  return {
    success: true,
    selection: { selected_ids: [], last_selected: null, timestamp: null },
    hint: '아직 선택된 도형이 없습니다. 뷰어에서 도형을 클릭하세요.',
  };
}

/** Helper: Capture viewport result (used by both capture_viewport command and --capture flag) */
async function captureViewportResult(): Promise<{ success: boolean; path?: string; error?: string; message?: string; hint: string }> {
  // Use app internal path (viewer/capture.png relative to cad-tools)
  const outputPath = resolve(__dirname, '../../viewer/capture.png');
  const { captureViewport } = await import('./capture.js');
  const result = await captureViewport({
    outputPath,
    width: 1600,
    height: 1000,
    waitMs: 2000,
  });
  if (result.success) {
    return {
      success: true,
      path: result.path,
      message: 'Viewport captured. Use Read tool to view the image.',
      hint: `Read file: ${result.path}`,
    };
  }
  // Provide method-specific hint for troubleshooting
  const hint = result.method === 'electron'
    ? 'CADViewer 앱이 실행 중인지 확인하세요 (userData/.server-port 파일 확인)'
    : '뷰어 서버가 실행 중인지 확인하세요 (node viewer/server.cjs 또는 npm run dev)';
  return {
    success: false,
    error: result.error,
    hint,
  };
}

interface SceneState {
  sceneName: string;
  entities: string[];
}

/** Entity from scene.json for replay */
interface SceneEntity {
  entity_type: 'Circle' | 'Rect' | 'Line' | 'Arc' | 'Polygon' | 'Bezier' | 'Group';
  geometry: {
    Circle?: { center: [number, number]; radius: number };
    Rect?: { center: [number, number]; width: number; height: number };
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
  parent_id?: string;
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
 * es-module-lexer를 사용하여 주석/문자열 내 import 오인식 방지
 * 순환 참조 방지를 위해 이미 포함된 모듈 추적
 *
 * 지원 패턴:
 * - import { func1, func2 } from 'module-name';
 * - import * as X from 'module-name';
 * - import 'module-name';
 */
interface PreprocessResult {
  code: string;
  importedModules: string[];
  errors: string[];
}

// es-module-lexer initialization promise
const lexerReady = initLexer;

async function preprocessCode(code: string, importedModules: Set<string> = new Set()): Promise<PreprocessResult> {
  const errors: string[] = [];
  const newlyImported: string[] = [];

  // Ensure lexer is initialized
  await lexerReady;

  try {
    const [imports] = parseImports(code);

    // Process imports in reverse order (to preserve positions while replacing)
    const sortedImports = [...imports].sort((a, b) => b.ss - a.ss);

    let processedCode = code;
    for (const imp of sortedImports) {
      const moduleName = imp.n;
      if (!moduleName) continue;

      let replacement: string;

      if (importedModules.has(moduleName)) {
        replacement = `// [import] '${moduleName}' already loaded`;
      } else {
        const modulePath = resolve(MODULES_DIR, `${moduleName}.js`);

        if (!existsSync(modulePath)) {
          errors.push(`Module '${moduleName}' not found`);
          replacement = `// [import] ERROR: '${moduleName}' not found`;
        } else {
          // 모듈 코드 읽기
          const moduleCode = readFileSync(modulePath, 'utf-8');
          importedModules.add(moduleName);
          newlyImported.push(moduleName);

          // 모듈 내부의 import도 재귀적으로 처리
          const nested = await preprocessCode(moduleCode, importedModules);
          errors.push(...nested.errors);
          newlyImported.push(...nested.importedModules);

          replacement = `// ===== [import] ${moduleName} =====\n${nested.code}\n// ===== [/import] ${moduleName} =====\n`;
        }
      }

      // Replace import statement (ss: statement start, se: statement end)
      processedCode = processedCode.slice(0, imp.ss) + replacement + processedCode.slice(imp.se);
    }

    return {
      code: processedCode,
      importedModules: newlyImported,
      errors,
    };
  } catch (err) {
    // Fallback to regex for non-standard syntax (e.g., "import * from 'module'")
    logger.debug(`[preprocessCode] AST parse failed, using regex fallback: ${err instanceof Error ? err.message : String(err)}`);
    return preprocessCodeFallback(code, importedModules);
  }
}

/** Fallback preprocessor using regex (for non-standard import syntax) */
function preprocessCodeFallback(code: string, importedModules: Set<string> = new Set()): PreprocessResult {
  const errors: string[] = [];
  const newlyImported: string[] = [];

  const importPattern = /import\s+(?:\{[^}]*\}\s+from\s+|(?:\*\s+(?:as\s+\w+\s+)?from\s+)?)?['"]([^'"]+)['"]\s*;?/g;

  const processedCode = code.replace(importPattern, (_match, moduleName) => {
    if (importedModules.has(moduleName)) {
      return `// [import] '${moduleName}' already loaded`;
    }

    const modulePath = resolve(MODULES_DIR, `${moduleName}.js`);

    if (!existsSync(modulePath)) {
      errors.push(`Module '${moduleName}' not found`);
      return `// [import] ERROR: '${moduleName}' not found`;
    }

    const moduleCode = readFileSync(modulePath, 'utf-8');
    importedModules.add(moduleName);
    newlyImported.push(moduleName);

    const nested = preprocessCodeFallback(moduleCode, importedModules);
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
// run_cad_code Helper Functions
// ============================================================================

/** Get current entities from scene */
function getSceneEntities(): string[] {
  if (!existsSync(SCENE_FILE)) return [];
  try {
    const scene = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
    return (scene.entities || []).map((e: SceneEntity) => e.metadata?.name).filter(Boolean);
  } catch {
    return [];
  }
}

/** Common execution result type */
type ExecutionResult = { success: boolean; error?: string; entities: string[]; warnings?: string[] };

/**
 * Core execution logic: preprocess, execute, and save scene
 * Shared by executeMainCode and executeAndCommitScene
 */
async function executeCodeCore(
  code: string,
  options?: { logWarnings?: boolean }
): Promise<ExecutionResult> {
  const executor = CADExecutor.create('cad-scene');
  let result: { success: boolean; error?: string; entitiesCreated?: string[]; warnings?: string[] } = { success: true };

  if (code.trim()) {
    const preprocessed = await preprocessCode(code);
    if (preprocessed.errors.length > 0) {
      executor.free();
      return { success: false, error: `Import errors: ${preprocessed.errors.join(', ')}`, entities: [] };
    }
    result = await runCadCode(executor, preprocessed.code);
  }

  // Save scene if successful
  if (result.success) {
    const jsonResult = executor.exec('export_json', {});
    if (jsonResult.success && jsonResult.data) {
      ensureParentDir(SCENE_FILE);
      writeFileSync(SCENE_FILE, jsonResult.data);
    }
  }

  executor.free();

  // Optional: log warnings
  if (options?.logWarnings && result.warnings?.length) {
    result.warnings.forEach(w => logger.warn(w));
  }

  return {
    success: result.success,
    error: result.error,
    entities: result.entitiesCreated || [],
    warnings: result.warnings || [],
  };
}

/** Execute main code from file and update scene.json */
async function executeMainCode(): Promise<ExecutionResult> {
  const mainCode = existsSync(SCENE_CODE_FILE) ? readFileSync(SCENE_CODE_FILE, 'utf-8') : '';
  return executeCodeCore(mainCode, { logWarnings: true });
}

// ============================================================================
// run_cad_code Mode Handlers
// ============================================================================

interface RunCadCodeResult {
  handled: boolean;
  output?: string;
}

/** Handle --deps mode: show dependency graph */
function handleRunCadCodeDeps(): RunCadCodeResult {
  const modules = getModuleList();
  const deps: Record<string, string[]> = {};

  // main dependencies
  const mainCode = readFileOrEmpty(SCENE_CODE_FILE);
  deps['main'] = getCodeImports(mainCode);

  // module dependencies (with defensive error handling)
  for (const mod of modules) {
    const modPath = resolve(MODULES_DIR, `${mod}.js`);
    try {
      const modCode = readFileSync(modPath, 'utf-8');
      deps[mod] = getCodeImports(modCode);
    } catch {
      // File may have been deleted between getModuleList() and read
      deps[mod] = [];
    }
  }

  return {
    handled: true,
    output: JSON.stringify({
      success: true,
      dependencies: deps,
      hint: '각 파일이 import하는 모듈 목록',
    }, null, 2),
  };
}

/** Handle --delete mode: delete module */
async function handleRunCadCodeDelete(target: string | undefined): Promise<RunCadCodeResult> {
  if (!target) {
    return {
      handled: true,
      output: JSON.stringify({
        success: false,
        error: '삭제할 파일명을 지정하세요.',
        hint: 'run_cad_code --delete <name>',
      }, null, 2),
    };
  }

  if (target === 'main') {
    // Clear main instead of deleting
    writeFileSync(SCENE_CODE_FILE, '');
    const result = await executeMainCode();
    return {
      handled: true,
      output: JSON.stringify({
        success: true,
        file: 'main',
        message: 'main 초기화 완료',
        entities: result.entities,
      }, null, 2),
    };
  }

  const modulePath = resolve(MODULES_DIR, `${target}.js`);
  if (!existsSync(modulePath)) {
    return {
      handled: true,
      output: JSON.stringify({
        success: false,
        error: `'${target}' 모듈을 찾을 수 없습니다.`,
      }, null, 2),
    };
  }

  unlinkSync(modulePath);
  return {
    handled: true,
    output: JSON.stringify({
      success: true,
      file: target,
      message: `'${target}' 모듈 삭제 완료`,
      files: ['main', ...getModuleList()],
    }, null, 2),
  };
}

/** Handle no-argument mode: show project structure */
function handleRunCadCodeStructure(): RunCadCodeResult {
  const modules = getModuleList();
  const mainCode = existsSync(SCENE_CODE_FILE) ? readFileSync(SCENE_CODE_FILE, 'utf-8') : '';
  const entities = getSceneEntities();

  return {
    handled: true,
    output: JSON.stringify({
      success: true,
      files: ['main', ...modules],
      main: mainCode || '// 빈 프로젝트입니다. main에 코드를 작성하세요.',
      entities,
      hint: '읽기: run_cad_code <name> | 쓰기: run_cad_code <name> "code" | 탐색: --status, --info, --search, --lines | 유틸: --capture, --selection',
    }, null, 2),
  };
}

/** Handle read mode: read file contents */
function handleRunCadCodeRead(target: string): RunCadCodeResult {
  if (target === 'main') {
    const mainCode = existsSync(SCENE_CODE_FILE) ? readFileSync(SCENE_CODE_FILE, 'utf-8') : '';
    return {
      handled: true,
      output: JSON.stringify({
        success: true,
        file: 'main',
        code: mainCode || '// 빈 main 파일입니다.',
      }, null, 2),
    };
  }

  // Read module
  const modulePath = resolve(MODULES_DIR, `${target}.js`);
  if (!existsSync(modulePath)) {
    return {
      handled: true,
      output: JSON.stringify({
        success: false,
        error: `'${target}' 파일을 찾을 수 없습니다.`,
        hint: `사용 가능: main, ${getModuleList().join(', ') || '(모듈 없음)'}`,
      }, null, 2),
    };
  }

  const moduleCode = readFileSync(modulePath, 'utf-8');
  return {
    handled: true,
    output: JSON.stringify({
      success: true,
      file: target,
      code: moduleCode,
    }, null, 2),
  };
}

/**
 * Execute code and commit scene on success (transactional execution)
 * Delegates to executeCodeCore for shared logic
 */
async function executeAndCommitScene(code: string): Promise<ExecutionResult> {
  return executeCodeCore(code);
}

/**
 * Provide user-friendly error message for common errors
 */
function enhanceErrorMessage(error: string, isAppendMode: boolean): string {
  // Variable redefinition error
  if (error.includes('redefinition') || error.includes('already been declared')) {
    const match = error.match(/identifier\s+'?(\w+)'?/i) || error.match(/variable\s+'?(\w+)'?/i);
    const varName = match ? match[1] : 'unknown';
    return `Variable '${varName}' already defined in existing code. ${isAppendMode ? 'In append mode, you can reference existing variables directly without re-declaring them.' : ''}`;
  }
  return error;
}

/** Handle write mode: write code to file and execute */
async function handleRunCadCodeWrite(target: string, newCode: string): Promise<RunCadCodeResult> {
  const isAppendMode = newCode.startsWith('+');
  const codeToWrite = isAppendMode ? newCode.slice(1) : newCode;

  if (target === 'main') {
    ensureParentDir(SCENE_CODE_FILE);

    // Build combined code for testing
    const existingCode = existsSync(SCENE_CODE_FILE) ? readFileSync(SCENE_CODE_FILE, 'utf-8') : '';
    const combinedCode = isAppendMode ? existingCode + '\n' + codeToWrite : codeToWrite;

    // Story 8.1 + 8.4: Test execution BEFORE writing file (transaction pattern)
    const result = await executeAndCommitScene(combinedCode);

    // Only save file if execution succeeded
    if (result.success) {
      writeFileSync(SCENE_CODE_FILE, combinedCode);
    }
    // If failed, file remains unchanged (rollback behavior)

    // Build contextual hints
    const hints: string[] = [];
    if (result.success) {
      hints.push(`main ${isAppendMode ? '추가' : '저장'} 및 실행 완료. ${result.entities.length}개 엔티티.`);
      if (result.entities.length > 0) {
        hints.push('수정 시 reset 대신 drawOrder/setFill/translate로 기존 엔티티 직접 수정');
      }
    } else {
      hints.push('실행 실패. 코드를 확인하세요.');
      if (isAppendMode) {
        hints.push('파일은 변경되지 않았습니다 (롤백됨).');
      }
    }

    // Enhance error message for better UX
    const enhancedError = result.error ? enhanceErrorMessage(result.error, isAppendMode) : undefined;

    return {
      handled: true,
      output: JSON.stringify({
        success: result.success,
        file: 'main',
        mode: isAppendMode ? 'append' : 'write',
        entities: result.entities,
        error: enhancedError,
        hint: hints[0],
        hints,
      }, null, 2),
    };
  }

  // Write module
  if (!existsSync(MODULES_DIR)) {
    mkdirSync(MODULES_DIR, { recursive: true });
  }
  const modulePath = resolve(MODULES_DIR, `${target}.js`);

  // Build combined code for testing
  const existingModuleCode = existsSync(modulePath) ? readFileSync(modulePath, 'utf-8') : '';
  const combinedModuleCode = isAppendMode ? existingModuleCode + '\n' + codeToWrite : codeToWrite;

  // Story 8.1 + 8.4: Test execution with module change BEFORE writing
  // We need to temporarily test as if the module was updated
  const mainCode = existsSync(SCENE_CODE_FILE) ? readFileSync(SCENE_CODE_FILE, 'utf-8') : '';

  // Safer approach: backup existing module before writing
  const backupPath = `${modulePath}.bak`;
  if (existingModuleCode) {
    writeFileSync(backupPath, existingModuleCode);
  }

  let result: ExecutionResult;
  try {
    // Write module and test execution
    writeFileSync(modulePath, combinedModuleCode);
    result = await executeAndCommitScene(mainCode);

    // Rollback module if execution failed
    if (!result.success) {
      if (existingModuleCode) {
        writeFileSync(modulePath, existingModuleCode);
      } else {
        unlinkSync(modulePath);
      }
    }
  } finally {
    // Clean up backup file
    if (existsSync(backupPath)) {
      unlinkSync(backupPath);
    }
  }

  // Build contextual hints for module write
  const moduleHints: string[] = [];
  if (result.success) {
    moduleHints.push(`'${target}' 모듈 ${isAppendMode ? '추가' : '저장'} 후 main 재실행 완료.`);
    moduleHints.push('모듈 클래스 사용 시 getWorldBounds()로 앵커 위치 확인');
  } else {
    moduleHints.push('main 실행 실패. 코드를 확인하세요.');
    moduleHints.push('모듈 파일은 변경되지 않았습니다 (롤백됨).');
  }

  // Enhance error message
  const enhancedError = result.error ? enhanceErrorMessage(result.error, isAppendMode) : undefined;

  return {
    handled: true,
    output: JSON.stringify({
      success: result.success,
      file: target,
      mode: isAppendMode ? 'append' : 'write',
      entities: result.entities,
      error: enhancedError,
      hint: moduleHints[0],
      hints: moduleHints,
    }, null, 2),
  };
}

// ============================================================================
// AX Domain Descriptions
// ============================================================================

const DOMAIN_DESCRIPTIONS: Record<string, string> = {
  primitives: `📦 PRIMITIVES - 기본 도형 그리기

📋 FUNCTIONS (run_cad_code로 사용)
- drawCircle(name, x, y, radius)        // 원
- drawRect(name, x, y, width, height)   // 사각형
- drawLine(name, points[])              // 선분 [x1,y1, x2,y2, ...]
- drawArc(name, cx, cy, r, start, end)  // 호 (라디안)
- drawPolygon(name, points[])           // 다각형 (닫힌 도형)
- drawBezier(name, path)                // 베지어 커브 (SVG path)

🎯 WORKFLOW
1. query 도메인으로 현재 상태 확인
2. primitives로 도형 그리기
3. style로 색상/스타일 적용
4. transforms로 위치/크기 조정

💡 TIPS
- 이름은 의미있게: "head", "left_arm", "door"
- 좌표계: Y+ 위쪽, 중심 (0,0)
- drawBezier: 'M x,y C cp1 cp2 end S cp2 end Z'`,

  style: `🎨 STYLE - 색상 및 스타일 적용

📋 FUNCTIONS (run_cad_code로 사용)
- setFill(name, [r,g,b,a])              // 채우기 색상
- setStroke(name, [r,g,b,a], width?)    // 선 스타일
- drawOrder(name, order)                // z-order 조정

📋 drawOrder options
- 'front' / 'back'     // 맨 앞/뒤
- 1 / -1               // 한 단계 앞/뒤
- 'above:target'       // target 위로
- 'below:target'       // target 아래로

💡 COLOR FORMAT
- RGBA 배열: [r, g, b, a] (각 0.0 ~ 1.0)
- 빨강: [1, 0, 0, 1]
- 반투명 파랑: [0, 0, 1, 0.5]`,

  transforms: `🔄 TRANSFORMS - 도형 변환

📋 FUNCTIONS (run_cad_code로 사용)
- translate(name, dx, dy, opts?)        // 이동, opts: {space:'world'|'local'}
- rotate(name, angle, opts?)            // 회전 (라디안)
- scale(name, sx, sy, opts?)            // 크기 조절
- setPivot(name, px, py)                // 회전/스케일 중심점
- deleteEntity(name)                    // 삭제
- duplicate(source, newName)            // 복제
- mirror(source, newName, axis)         // 미러 복제 ('x'|'y')

💡 TIPS
- space 옵션: 'world' (기본) / 'local' (부모 기준)
- duplicate: 지오메트리, 스타일, 변환 모두 복사
- mirror: 'x'=좌우 반전, 'y'=상하 반전`,

  query: `🔍 QUERY - 씬 조회

📋 FUNCTIONS (run_cad_code로 사용)
- exists(name)                          // 존재 여부 (boolean)
- getEntity(name)                       // 상세 정보 (local/world 좌표)
- getWorldBounds(name)                  // 월드 바운딩 박스
- getDrawOrder(groupName?)              // z-order 순서 조회
- fitToViewport(w, h, opts?)            // 자동 스케일 계산

📋 CLI COMMANDS
- run_cad_code --status                 // 프로젝트 요약
- run_cad_code --selection              // 선택된 도형 조회
- run_cad_code --capture                // 뷰어 스크린샷

💡 TIPS
- getEntity: local/world 좌표 모두 반환
- fitToViewport: 실제 치수→뷰포트 스케일 계산
- --selection: 사용자가 클릭한 도형 확인`,

  export: `💾 EXPORT - 내보내기

📋 CLI COMMANDS
- run_cad_code --capture               // 뷰어 스크린샷 (PNG)
- npx tsx cad-cli.ts export_json       // JSON 출력
- npx tsx cad-cli.ts export_svg        // SVG 출력

💡 TIPS
- scene.json은 run_cad_code 실행 시 자동 저장
- --capture는 뷰어 실행 중이어야 함 (localhost:5173)`,

  session: `📁 SESSION - 세션 관리

📋 CLI COMMANDS
- npx tsx cad-cli.ts reset             // 새 씬 시작
- npx tsx cad-cli.ts status            // 현재 상태
- run_cad_code --clear-sketch          // 스케치 클리어

💡 TIPS
- reset은 되돌릴 수 없음
- --clear-sketch: 코드 실행/캡처 후 sketch.json 초기화`,

  group: `🗂️ GROUP - 그룹화

📋 FUNCTIONS (run_cad_code로 사용)
- createGroup(name, children[])        // 그룹 생성
- addToGroup(groupName, entityName)    // 그룹에 추가

🎯 WORKFLOW
1. primitives로 개별 도형 그리기
2. createGroup으로 그룹 생성
3. 그룹 단위로 transforms 적용

💡 TIPS
- 중첩 그룹 가능 (그룹이 그룹의 자식)
- 그룹 변환 시 자식도 함께 변환`,

  // ============================================================================
  // 새로운 도메인: Boolean, Geometry, Text
  // ============================================================================

  boolean: `⚙️ BOOLEAN - 도형 합치기/빼기 (Manifold 엔진)

📋 FUNCTIONS (run_cad_code로 사용)
- booleanUnion(a, b, result)           // 합집합 (A + B)
- booleanDifference(a, b, result)      // 차집합 (A - B)
- booleanIntersect(a, b, result)       // 교집합 (A ∩ B)

📋 지원 도형
- Circle, Rect, Polygon, Arc (닫힌 도형만)

🎯 EXAMPLE
drawRect('wall', 0, 0, 100, 80);
drawRect('window', 20, 30, 15, 20);
booleanDifference('wall', 'window', 'wall_with_hole');
// → 벽에 창문 구멍 생성

💡 TIPS
- 결과는 항상 Polygon 타입
- 원본 도형(a, b)은 유지됨
- 복잡한 형태도 여러 번 조합 가능`,

  geometry: `📐 GEOMETRY - 기하 분석/변형 (Manifold 엔진)

📋 FUNCTIONS (run_cad_code로 사용)
- offsetPolygon(name, delta, result, join?)  // 확장(+)/축소(-)
- getArea(name)                        // 면적 계산
- convexHull(name, result)             // 볼록 껍질 생성
- decompose(name, prefix)              // 분리된 컴포넌트 추출

📋 offsetPolygon joinType
- 'round'  // 둥근 모서리 (기본)
- 'square' // 직각 모서리
- 'miter'  // 뾰족한 모서리

🎯 EXAMPLE
drawPolygon('shape', [0,0, 100,0, 100,50, 0,50]);
offsetPolygon('shape', 10, 'expanded', 'round');
// → 10단위 확장된 폴리곤 생성

💡 TIPS
- delta > 0: 확장, delta < 0: 축소
- getArea: 닫힌 도형만 가능
- decompose: Boolean 결과가 분리된 경우 사용`,

  text: `📝 TEXT - 텍스트 렌더링 (opentype.js)

📋 FUNCTIONS (run_cad_code로 사용)
- drawText(name, text, x, y, size, opts?)   // 텍스트→베지어
- getTextMetrics(text, size, fontPath?)     // 크기 미리 계산

📋 drawText options
- fontPath: TTF/OTF 경로 (생략 시 시스템 폰트)
- align: 'left' (기본) | 'center' | 'right'
- color: [r, g, b, a]

🎯 EXAMPLE
drawText('title', '안녕하세요', 0, 0, 24);
drawText('label', 'Center', 100, 50, 16, { align: 'center' });
const m = getTextMetrics('Hello', 24);
// m = { width: 58.4, height: 24 }

💡 TIPS
- 결과는 Bezier 엔티티 (벡터)
- 한글/영문 모두 지원
- setFill/setStroke로 스타일링 가능`
};

function showDomains(): void {
  print(`
📚 CAD CLI DOMAINS

📦 도형 생성
  primitives  - 기본 도형 (circle, rect, line, arc, polygon, bezier)
  text        - ⭐ 텍스트 렌더링 (drawText, getTextMetrics)

🔄 도형 조작
  transforms  - 변환 (translate, rotate, scale, pivot, duplicate, mirror)
  boolean     - ⭐ 합치기/빼기 (union, difference, intersect)
  geometry    - ⭐ 기하 분석 (offset, area, convexHull, decompose)

🎨 스타일 & 구조
  style       - 색상/z-order (fill, stroke, drawOrder)
  group       - 그룹화 (createGroup, addToGroup)

🔍 조회 & 내보내기
  query       - 씬 조회 (getEntity, exists, fitToViewport)
  export      - 내보내기 (capture, json, svg)
  session     - 세션 관리 (reset, --clear-sketch)

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
  // Primitives (z-order 자동 할당, 겹치면 drawOrder로 조정)
  draw_circle: ['set_fill로 색상 추가', '겹치면 drawOrder 사용'],
  draw_rect: ['(x,y)는 사각형 중심 기준', '겹치면 drawOrder 사용'],
  draw_line: ['set_stroke로 선 색상/두께 변경'],
  draw_arc: ['set_stroke로 선 스타일 변경'],
  draw_polygon: ['set_fill로 색상 추가', '겹치면 drawOrder 사용'],
  draw_bezier: ['SVG path 형식: M x,y C cp1 cp2 end S cp2 end Z', 'set_fill로 색상 추가 (Z로 닫힌 경우)'],

  // Style
  set_fill: ['set_stroke로 선도 스타일링', 'list_entities로 확인'],
  set_stroke: ['set_fill로 채우기 추가', 'list_entities로 확인'],

  // Transform - 작업 전 정확한 좌표/크기 계산 필수!
  translate: [
    '계산 → 검산 → 실행 → get_entity로 확인',
  ],
  rotate: ['get_entity로 결과 확인'],
  scale: [
    '계산 → 검산 → 실행 → get_entity로 확인',
  ],
  delete: ['list_entities로 남은 엔티티 확인'],
  set_pivot: ['rotate로 pivot 기준 회전', 'get_entity로 결과 확인'],

  // Z-Order
  set_z_order: [
    '그룹 간 순서 변경 시 그룹 자체의 z-order 수정 필요',
    'get_entity로 현재 z_index 확인',
  ],
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
  capture_viewport: [
    '이미지로 형태/의도 파악, 좌표/크기는 sketch.json에서',
    '계산 → 검산 → 실행',
  ],

  // Groups (객체지향 씬 설계)
  create_group: [
    '⚠️ 자식은 (0,0) 로컬 좌표로 생성했어야 함! 아니면 translate 시 위치 중첩',
    'translate(groupName, x, y)로 그룹 전체 이동',
    'drawOrder로 그룹 z-order 설정',
  ],
  ungroup: ['list_entities로 해제 결과 확인', 'create_group으로 다시 그룹화'],
  add_to_group: ['get_entity로 추가 결과 확인', 'remove_from_group으로 제거'],
  remove_from_group: ['list_entities로 결과 확인', 'add_to_group으로 다시 추가'],

  // Code Execution
  run_cad_code: [
    '수정 시 reset 대신 drawOrder/setFill/translate 등으로 기존 엔티티 직접 수정',
    '외부 요소 배치 시 getWorldBounds()로 대상 위치 확인',
    '--status로 프로젝트 현황 확인',
    'capture_viewport로 결과 확인',
  ],
  save_module: ['run_cad_code로 모듈 코드 확인', 'list_modules로 저장된 모듈 확인'],
  run_module: ['capture_viewport로 결과 확인', 'create_group으로 그룹화'],
  list_modules: ['run_cad_code로 모듈 내용 확인'],
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
    print(JSON.stringify(getSelectionResult(), null, 2));
    return;
  }

  if (command === 'capture_viewport') {
    print(JSON.stringify(await captureViewportResult(), null, 2));
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
  // - run_cad_code --search <pattern> → 코드 검색
  // - run_cad_code --info <name>      → 모듈 상세 정보
  // - run_cad_code --lines <name> <range> → 부분 읽기
  // - run_cad_code --status           → 프로젝트 상태 요약
  // - run_cad_code --clear-sketch     → 스케치 클리어 (Story 8.2)
  if (command === 'run_cad_code') {
    // Story 8.2: Check for --clear-sketch flag anywhere in args
    const clearSketchFlag = args.includes('--clear-sketch');
    // Filter out the flag from args for normal processing
    const filteredArgs = args.filter(a => a !== '--clear-sketch');

    let target = filteredArgs[1];  // main, module name, --delete, --deps, or undefined
    let newCode = filteredArgs[2]; // code to write, '-' for stdin, or undefined

    // Check for special flags
    const isDeleteMode = target === '--delete';
    const isDepsMode = target === '--deps';
    const isSearchMode = target === '--search';
    const isInfoMode = target === '--info';
    const isLinesMode = target === '--lines';
    const isStatusMode = target === '--status';
    const isCaptureMode = target === '--capture';
    const isSelectionMode = target === '--selection';

    if (isDeleteMode) {
      target = filteredArgs[2]; // module name to delete
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

    // Dispatch to appropriate handler
    let result: RunCadCodeResult;

    if (isSearchMode) {
      result = handleRunCadCodeSearch(filteredArgs[2]);
    } else if (isInfoMode) {
      result = handleRunCadCodeInfo(filteredArgs[2]);
    } else if (isLinesMode) {
      result = handleRunCadCodeLines(filteredArgs[2], filteredArgs[3]);
    } else if (isStatusMode) {
      result = handleRunCadCodeStatus();
    } else if (isDepsMode) {
      result = handleRunCadCodeDeps();
    } else if (isCaptureMode) {
      const captureResult = await captureViewportResult();
      // Story 8.2: Clear sketch after capture if flag is set
      if (clearSketchFlag && captureResult.success) {
        clearSketch();
        (captureResult as Record<string, unknown>).sketchCleared = true;
      }
      result = { handled: true, output: JSON.stringify(captureResult, null, 2) };
    } else if (isSelectionMode) {
      result = { handled: true, output: JSON.stringify(getSelectionResult(), null, 2) };
    } else if (isDeleteMode) {
      result = await handleRunCadCodeDelete(target);
    } else if (!target) {
      result = handleRunCadCodeStructure();
    } else if (!newCode) {
      result = handleRunCadCodeRead(target);
    } else {
      result = await handleRunCadCodeWrite(target, newCode);
      // Story 8.2: Clear sketch after successful write if flag is set
      if (clearSketchFlag && result.output) {
        try {
          const parsed = JSON.parse(result.output);
          if (parsed.success) {
            clearSketch();
            parsed.sketchCleared = true;
            result.output = JSON.stringify(parsed, null, 2);
          }
        } catch (e) {
          // JSON parse errors are expected for non-JSON output, log for debugging only
          if (!(e instanceof SyntaxError)) {
            logger.debug(`[cli] Unexpected error in clearSketch: ${e}`);
          }
        }
      }
    }

    if (result.output) {
      print(result.output);
    }
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

    // Get bounds (format: { min: [x, y], max: [x, y] })
    const boundsResult = executor.exec('get_world_bounds', { name: groupName });
    if (boundsResult.success && boundsResult.data) {
      const b = JSON.parse(boundsResult.data);
      if (Array.isArray(b.min) && Array.isArray(b.max)) {
        const [minX, minY] = b.min;
        const [maxX, maxY] = b.max;
        lines.push(`   Bounds: (${minX.toFixed(0)}, ${minY.toFixed(0)}) → (${maxX.toFixed(0)}, ${maxY.toFixed(0)})`);
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
    let sceneEntities: SceneEntity[] = [];

    if (existsSync(SCENE_FILE)) {
      try {
        const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
        if (sceneData.entities && Array.isArray(sceneData.entities)) {
          sceneEntities = sceneData.entities;
          for (const entity of sceneEntities) {
            replayEntity(executor, entity);
          }
        }
      } catch {
        // empty
      }
    }

    // Get root-level entities from scene.json (has parent_id field)
    const rootEntities = sceneEntities.filter(e => !e.parent_id);
    if (rootEntities.length === 0) {
      print('Scene is empty.');
      executor.free();
      return;
    }

    let movedCount = 0;
    for (const e of rootEntities) {
      const name = e.metadata?.name;
      if (!name) continue;
      const result = executor.exec('translate', { name, dx, dy });
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
    let sceneEntities: SceneEntity[] = [];

    if (existsSync(SCENE_FILE)) {
      try {
        const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
        if (sceneData.entities && Array.isArray(sceneData.entities)) {
          sceneEntities = sceneData.entities;
          for (const entity of sceneEntities) {
            replayEntity(executor, entity);
          }
        }
      } catch {
        // empty
      }
    }

    // Get root-level entities from scene.json (has parent_id field)
    const rootEntities = sceneEntities.filter(e => !e.parent_id);
    if (rootEntities.length === 0) {
      print('Scene is empty.');
      executor.free();
      return;
    }

    let scaledCount = 0;
    for (const e of rootEntities) {
      const name = e.metadata?.name;
      if (!name) continue;
      const result = executor.exec('scale', { name, sx: factor, sy: factor });
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
    let sceneEntities: SceneEntity[] = [];

    if (existsSync(SCENE_FILE)) {
      try {
        const sceneData = JSON.parse(readFileSync(SCENE_FILE, 'utf-8'));
        if (sceneData.entities && Array.isArray(sceneData.entities)) {
          sceneEntities = sceneData.entities;
          for (const entity of sceneEntities) {
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

    // Get root-level entities from scene.json (has parent_id field)
    const rootEntities = sceneEntities.filter(e => !e.parent_id);
    if (rootEntities.length === 0) {
      print('Scene is empty.');
      executor.free();
      return;
    }

    let movedCount = 0;
    for (const e of rootEntities) {
      const name = e.metadata?.name;
      if (!name) continue;
      const result = executor.exec('translate', { name, dx: -centerX, dy: -centerY });
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

    // World bounds (format: { min: [x, y], max: [x, y] })
    const boundsResult = executor.exec('get_world_bounds', { name: entityName });
    if (boundsResult.success && boundsResult.data) {
      const b = JSON.parse(boundsResult.data);
      if (Array.isArray(b.min) && Array.isArray(b.max)) {
        const [minX, minY] = b.min;
        const [maxX, maxY] = b.max;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        lines.push(`   Center: (${centerX.toFixed(1)}, ${centerY.toFixed(1)})`);
        lines.push(`   Size: ${(maxX - minX).toFixed(1)} x ${(maxY - minY).toFixed(1)}`);
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
    const preprocessed = await preprocessCode(code);

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

    // Lock 경고 출력
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach(w => logger.warn(w));
    }

    print(JSON.stringify({
      success: result.success,
      module: moduleName,
      entitiesCreated: result.entitiesCreated,
      importedModules: preprocessed.importedModules,
      error: result.error,
      logs: result.logs,
      warnings: result.warnings,
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
          const { center, width, height } = geometry.Rect;
          executor.exec('draw_rect', {
            name,
            x: center[0],
            y: center[1],
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
          // Convert to SVG path: "M x,y C cp1x,cp1y cp2x,cp2y ex,ey ..."
          let path = `M ${start[0]},${start[1]}`;
          for (const seg of segments) {
            const [cp1, cp2, end] = seg;
            path += ` C ${cp1[0]},${cp1[1]} ${cp2[0]},${cp2[1]} ${end[0]},${end[1]}`;
          }
          if (closed) path += ' Z';
          executor.exec('draw_bezier', { name, path, style });
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
