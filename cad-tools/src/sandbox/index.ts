/**
 * QuickJS Sandbox - JavaScript 코드를 안전하게 실행
 *
 * CAD 함수를 QuickJS 샌드박스에 바인딩하고 코드 실행
 */

import { getQuickJS, type QuickJSContext } from 'quickjs-emscripten';
import type { CADExecutor } from '../executor.js';
import { logger } from '../logger.js';

/**
 * 코드 실행 결과
 */
export interface RunCodeResult {
  success: boolean;
  entitiesCreated: string[];
  error?: string;
  logs: string[];
}

/**
 * JavaScript 코드를 QuickJS 샌드박스에서 실행
 */
export async function runCadCode(
  executor: CADExecutor,
  code: string
): Promise<RunCodeResult> {
  const logs: string[] = [];
  const entitiesCreatedSet = new Set<string>();

  try {
    const QuickJS = await getQuickJS();
    const vm = QuickJS.newContext();

    // CAD 명령어 실행 헬퍼
    const callCad = (command: string, params: Record<string, unknown>): boolean => {
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
    bindCadFunction(vm, 'translate', (name: string, dx: number, dy: number) => {
      return callCad('translate', { name, dx, dy });
    });

    bindCadFunction(vm, 'rotate', (name: string, angle: number) => {
      // angle은 라디안
      return callCad('rotate', { name, angle, angle_unit: 'radian' });
    });

    bindCadFunction(vm, 'scale', (name: string, sx: number, sy: number) => {
      return callCad('scale', { name, sx, sy });
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

    // === Z-Order (1) ===
    bindCadFunction(vm, 'setZOrder', (name: string, zIndex: number) => {
      return callCad('set_z_order', { name, z_index: zIndex });
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
      let errorMessage: string;
      if (typeof errorObj === 'object' && errorObj !== null) {
        errorMessage = (errorObj as { message?: string; name?: string }).message
          || (errorObj as { name?: string }).name
          || JSON.stringify(errorObj);
      } else {
        errorMessage = String(errorObj);
      }

      return {
        success: false,
        entitiesCreated: Array.from(entitiesCreatedSet),
        error: errorMessage,
        logs,
      };
    }

    result.value.dispose();
    vm.dispose();

    return {
      success: true,
      entitiesCreated: Array.from(entitiesCreatedSet),
      logs,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`[runCadCode] ${errorMessage}`);

    return {
      success: false,
      entitiesCreated: Array.from(entitiesCreatedSet),
      error: errorMessage,
      logs,
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
