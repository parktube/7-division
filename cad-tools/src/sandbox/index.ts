/**
 * QuickJS Sandbox - JavaScript 코드를 안전하게 실행
 *
 * CAD 함수를 QuickJS 샌드박스에 바인딩하고 코드 실행
 */

import { getQuickJS, type QuickJSContext } from 'quickjs-emscripten';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CADExecutor } from '../executor.js';
import { logger } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 수정 명령어 목록 (생성 제외)
const MODIFY_COMMANDS = new Set([
  'translate', 'rotate', 'scale', 'set_pivot',
  'set_fill', 'set_stroke', 'set_z_order',
  'delete', 'add_to_group',
  // z-order 명령어들
  'draw_order',  // 통합 z-order API
  'bring_to_front', 'send_to_back',
  'bring_forward', 'send_backward',
  'move_above', 'move_below'
]);

interface SelectionData {
  selected_entities?: string[];
  locked_entities?: string[];
  hidden_entities?: string[];
  timestamp?: number;
}

function resolveSelectionFile(): string {
  if (process.env.CAD_SELECTION_PATH) {
    return resolve(process.env.CAD_SELECTION_PATH);
  }
  // Default: viewer/selection.json relative to repo root
  return resolve(__dirname, '../../../viewer/selection.json');
}

function loadLockedEntities(): Set<string> {
  const selectionFile = resolveSelectionFile();
  if (existsSync(selectionFile)) {
    try {
      const data: SelectionData = JSON.parse(readFileSync(selectionFile, 'utf-8'));
      return new Set(data.locked_entities || []);
    } catch {
      return new Set();
    }
  }
  return new Set();
}

/**
 * 코드 실행 결과
 */
export interface RunCodeResult {
  success: boolean;
  entitiesCreated: string[];
  error?: string;
  logs: string[];
  warnings: string[];  // Lock 경고 등
}

/**
 * JavaScript 코드를 QuickJS 샌드박스에서 실행
 */
export async function runCadCode(
  executor: CADExecutor,
  code: string,
  lockMode: 'warn' | 'strict' = 'warn'
): Promise<RunCodeResult> {
  const logs: string[] = [];
  const warnings: string[] = [];
  const entitiesCreatedSet = new Set<string>();

  // 잠긴 엔티티 로드
  const lockedEntities = loadLockedEntities();

  try {
    const QuickJS = await getQuickJS();
    const vm = QuickJS.newContext();

    // CAD 명령어 실행 헬퍼
    const callCad = (command: string, params: Record<string, unknown>): boolean => {
      // Lock 검사: 수정 명령이고 name 파라미터가 있을 때
      const entityName = params.name as string | undefined;
      if (MODIFY_COMMANDS.has(command) && entityName && lockedEntities.has(entityName)) {
        const warning = `Warning: "${entityName}" is locked by user`;
        warnings.push(warning);
        logger.warn(`[sandbox] ${warning}`);

        if (lockMode === 'strict') {
          return false;  // 실행 거부
        }
        // warn 모드: 경고 후 계속 실행
      }

      const result = executor.exec(command, params);
      // draw_* 또는 create_group 명령어만 새 엔티티 생성으로 기록
      if (result.success && result.entity && (command.startsWith('draw_') || command === 'create_group')) {
        entitiesCreatedSet.add(result.entity);
      }
      if (!result.success) {
        logger.error(`[sandbox] ${command}: ${result.error}`);
      }
      return result.success;
    };

    // === Primitives (5) ===
    bindCadFunction(vm, 'drawCircle', (name: string, x: number, y: number, radius: number) => {
      return callCad('draw_circle', { name, x, y, radius });
    });

    bindCadFunction(vm, 'drawRect', (name: string, x: number, y: number, width: number, height: number) => {
      return callCad('draw_rect', { name, x, y, width, height });
    });

    bindCadFunction(vm, 'drawLine', (name: string, points: number[]) => {
      return callCad('draw_line', { name, points });
    });

    bindCadFunction(vm, 'drawArc', (name: string, cx: number, cy: number, radius: number, startAngle: number, endAngle: number) => {
      // angle은 라디안
      return callCad('draw_arc', { name, cx, cy, radius, start_angle: startAngle, end_angle: endAngle, angle_unit: 'radian' });
    });

    bindCadFunction(vm, 'drawPolygon', (name: string, points: number[]) => {
      return callCad('draw_polygon', { name, points });
    });

    bindCadFunction(vm, 'drawBezier', (name: string, points: number[], closed?: boolean) => {
      return callCad('draw_bezier', { name, points, closed: closed || false });
    });

    // === Transforms (4) ===
    // translate(name, dx, dy, options?) - options: { space: 'world' | 'local' }
    bindCadFunction(vm, 'translate', (name: string, dx: number, dy: number, options?: { space?: 'world' | 'local' }) => {
      return callCad('translate', { name, dx, dy, space: options?.space || 'world' });
    });

    // rotate(name, angle, options?) - angle은 라디안
    bindCadFunction(vm, 'rotate', (name: string, angle: number, options?: { space?: 'world' | 'local' }) => {
      return callCad('rotate', { name, angle, angle_unit: 'radian', space: options?.space || 'world' });
    });

    // scale(name, sx, sy, options?) - options: { space: 'world' | 'local' }
    bindCadFunction(vm, 'scale', (name: string, sx: number, sy: number, options?: { space?: 'world' | 'local' }) => {
      return callCad('scale', { name, sx, sy, space: options?.space || 'world' });
    });

    bindCadFunction(vm, 'setPivot', (name: string, px: number, py: number) => {
      return callCad('set_pivot', { name, px, py });
    });

    // === Groups (2) ===
    bindCadFunction(vm, 'createGroup', (name: string, children: string[]) => {
      return callCad('create_group', { name, children: children || [] });
    });

    bindCadFunction(vm, 'addToGroup', (groupName: string, entityName: string) => {
      return callCad('add_to_group', { group_name: groupName, entity_name: entityName });
    });

    // === Style (2) ===
    bindCadFunction(vm, 'setFill', (name: string, color: number[]) => {
      return callCad('set_fill', { name, fill: { color } });
    });

    bindCadFunction(vm, 'setStroke', (name: string, color: number[], width?: number) => {
      return callCad('set_stroke', { name, stroke: { color, width: width || 1 } });
    });

    // === Z-Order (통합 API) ===
    // drawOrder(name, mode): 단일 함수로 모든 z-order 조작
    // mode:
    //   - 'front': 맨 앞으로
    //   - 'back': 맨 뒤로
    //   - '+N' 또는 N: N단계 앞으로 (예: '+1', 1)
    //   - '-N': N단계 뒤로 (예: '-1', -1)
    //   - 'above:target': target 위로
    //   - 'below:target': target 아래로
    bindCadFunction(vm, 'drawOrder', (name: string, mode: string | number) => {
      const modeStr = typeof mode === 'number' ? String(mode) : mode;
      return callCad('draw_order', { name, mode: modeStr });
    });

    // === Utility (2) ===
    bindCadFunction(vm, 'deleteEntity', (name: string) => {
      return callCad('delete', { name });
    });

    bindCadFunction(vm, 'exists', (name: string) => {
      const result = executor.exec('exists', { name });
      if (result.success && result.data) {
        const parsed = JSON.parse(result.data);
        return parsed.exists;
      }
      return false;
    });

    // === World Transform API (Phase 2) ===
    bindCadQueryFunction(vm, 'getWorldTransform', (name: string) => {
      const result = executor.exec('get_world_transform', { name });
      if (result.success && result.data) {
        return JSON.parse(result.data);
      }
      return null;
    });

    bindCadQueryFunction(vm, 'getWorldPoint', (name: string, x: number, y: number) => {
      const result = executor.exec('get_world_point', { name, x, y });
      if (result.success && result.data) {
        return JSON.parse(result.data);
      }
      return null;
    });

    bindCadQueryFunction(vm, 'getWorldBounds', (name: string) => {
      const result = executor.exec('get_world_bounds', { name });
      if (result.success && result.data) {
        return JSON.parse(result.data);
      }
      return null;
    });

    // === Query API (FR42) ===
    // get_entity: returns local/world coordinates for dual coordinate workflow
    bindCadQueryFunction(vm, 'get_entity', (name: string) => {
      const result = executor.exec('get_entity', { name });
      if (result.success && result.data) {
        return JSON.parse(result.data);
      }
      return null;
    });

    // getDrawOrder: 계층적 드로우 오더 조회 (Progressive Disclosure)
    // group_name이 빈 문자열이면 root level, 그룹 이름이면 해당 그룹의 자식들
    bindCadQueryFunction(vm, 'getDrawOrder', (groupName?: string) => {
      const result = executor.exec('get_draw_order', { group_name: groupName || '' });
      if (result.success && result.data) {
        return JSON.parse(result.data);
      }
      return null;
    });

    // console.log 바인딩
    const consoleObj = vm.newObject();
    const logFn = vm.newFunction('log', (...args) => {
      const message = args.map((arg) => {
        const val = vm.dump(arg);
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      }).join(' ');
      logs.push(message);
      logger.info(`[sandbox] ${message}`);
    });
    vm.setProp(consoleObj, 'log', logFn);
    vm.setProp(vm.global, 'console', consoleObj);
    logFn.dispose();
    consoleObj.dispose();

    // 코드 실행
    const result = vm.evalCode(code);

    if (result.error) {
      const errorObj = vm.dump(result.error);
      result.error.dispose();
      vm.dispose();

      // QuickJS 에러 객체에서 메시지 추출
      const errAny = errorObj as { message?: string; name?: string } | null;
      const errorMessage = errAny?.message || errAny?.name || String(errorObj);

      return {
        success: false,
        entitiesCreated: Array.from(entitiesCreatedSet),
        error: errorMessage,
        logs,
        warnings,
      };
    }

    result.value.dispose();
    vm.dispose();

    return {
      success: true,
      entitiesCreated: Array.from(entitiesCreatedSet),
      logs,
      warnings,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`[runCadCode] ${errorMessage}`);

    return {
      success: false,
      entitiesCreated: Array.from(entitiesCreatedSet),
      error: errorMessage,
      logs,
      warnings,
    };
  }
}

/**
 * CAD 함수를 QuickJS에 바인딩 (boolean 반환)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CadFunction = (...args: any[]) => boolean;

function bindCadFunction(
  vm: QuickJSContext,
  name: string,
  fn: CadFunction
): void {
  const wrapped = vm.newFunction(name, (...handles) => {
    const args = handles.map((h) => vm.dump(h));
    const success = fn(...args);
    return success ? vm.true : vm.false;
  });
  vm.setProp(vm.global, name, wrapped);
  wrapped.dispose();
}

/**
 * CAD 조회 함수를 QuickJS에 바인딩 (값 반환)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CadQueryFunction = (...args: any[]) => unknown;

function bindCadQueryFunction(
  vm: QuickJSContext,
  name: string,
  fn: CadQueryFunction
): void {
  const wrapped = vm.newFunction(name, (...handles) => {
    const args = handles.map((h) => vm.dump(h));
    const result = fn(...args);
    if (result === null || result === undefined) {
      return vm.null;
    }
    // JSON 직렬화 가능한 값을 QuickJS 값으로 변환
    const jsonStr = JSON.stringify(result);
    const evalResult = vm.evalCode(`(${jsonStr})`);
    if (evalResult.error) {
      evalResult.error.dispose();
      return vm.null;
    }
    return evalResult.value;
  });
  vm.setProp(vm.global, name, wrapped);
  wrapped.dispose();
}
