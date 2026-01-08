/**
 * QuickJS Sandbox - JavaScript 코드를 안전하게 실행
 *
 * CAD 함수를 QuickJS 샌드박스에 바인딩하고 코드 실행
 */

import { getQuickJS, type QuickJSContext } from 'quickjs-emscripten';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import type { CADExecutor } from '../executor.js';
import { logger } from '../logger.js';
import {
  getManifold,
  type Polygon2D,
  type BooleanOp,
  polygonToCrossSection,
  crossSectionToPolygon,
} from './manifold.js';
import type { CrossSection } from 'manifold-3d';

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

function getDefaultUserDataDir(): string {
  const appName = 'CADViewer';
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

function resolveSelectionFile(): string {
  if (process.env.CAD_SELECTION_PATH) {
    return resolve(process.env.CAD_SELECTION_PATH);
  }
  // Try repo viewer/ first (development), then userData (production)
  const repoSelection = resolve(__dirname, '../../../viewer/selection.json');
  if (existsSync(repoSelection)) {
    return repoSelection;
  }
  return resolve(getDefaultUserDataDir(), 'selection.json');
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

// === Geometry to Polygon2D conversion ===

interface EntityGeometry {
  type: string;
  local: {
    geometry: Record<string, unknown>;
    transform: {
      translate: [number, number];
      rotate: number;
      scale: [number, number];
    };
  };
}

const CIRCLE_SEGMENTS = 32;

/**
 * Circle geometry를 Polygon2D로 변환
 */
function circleToPolygon(
  center: [number, number],
  radius: number,
  segments: number = CIRCLE_SEGMENTS
): Polygon2D {
  const points: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    points.push([
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle),
    ]);
  }
  return [points];
}

/**
 * Rect geometry를 Polygon2D로 변환
 */
function rectToPolygon(
  center: [number, number],
  width: number,
  height: number
): Polygon2D {
  const hw = width / 2;
  const hh = height / 2;
  return [[
    [center[0] - hw, center[1] - hh],
    [center[0] + hw, center[1] - hh],
    [center[0] + hw, center[1] + hh],
    [center[0] - hw, center[1] + hh],
  ]];
}

/**
 * Transform을 적용한 point 반환
 */
function applyTransform(
  point: [number, number],
  transform: EntityGeometry['local']['transform']
): [number, number] {
  // Apply scale
  let x = point[0] * transform.scale[0];
  let y = point[1] * transform.scale[1];

  // Apply rotation
  if (transform.rotate !== 0) {
    const cos = Math.cos(transform.rotate);
    const sin = Math.sin(transform.rotate);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    x = rx;
    y = ry;
  }

  // Apply translation
  x += transform.translate[0];
  y += transform.translate[1];

  return [x, y];
}

/**
 * Entity geometry를 Polygon2D로 변환 (transform 적용)
 */
function entityToPolygon(entity: EntityGeometry): Polygon2D | null {
  const { geometry, transform } = entity.local;
  let basePolygon: Polygon2D | null = null;

  if (entity.type === 'Circle' && 'Circle' in geometry) {
    const circle = geometry.Circle as { center: [number, number]; radius: number };
    // Scale affects radius
    const scaledRadius = circle.radius * Math.max(transform.scale[0], transform.scale[1]);
    basePolygon = circleToPolygon(circle.center, scaledRadius);
  } else if (entity.type === 'Rect' && 'Rect' in geometry) {
    const rect = geometry.Rect as { center: [number, number]; width: number; height: number };
    basePolygon = rectToPolygon(rect.center, rect.width, rect.height);
  } else if (entity.type === 'Polygon' && 'Polygon' in geometry) {
    const poly = geometry.Polygon as { points: [number, number][] };
    basePolygon = [poly.points];
  } else {
    return null; // Line, Arc, Bezier, Empty 등은 Boolean 미지원
  }

  // Apply transform to all points
  return basePolygon.map(contour =>
    contour.map(point => applyTransform(point, transform))
  );
}

/**
 * Polygon2D를 flat points 배열로 변환 (drawPolygon용)
 */
function polygonToFlatPoints(polygon: Polygon2D): number[] {
  // 첫 번째 contour만 사용 (holes 미지원)
  if (polygon.length === 0 || polygon[0].length === 0) {
    return [];
  }
  const points: number[] = [];
  for (const [x, y] of polygon[0]) {
    points.push(x, y);
  }
  return points;
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

  // Manifold 초기화 (Boolean 연산용, lazy singleton)
  // Boolean 연산 사용 여부와 관계없이 미리 초기화 (singleton이라 비용 최소)
  const manifold = await getManifold();

  try {
    const QuickJS = await getQuickJS();
    const vm = QuickJS.newContext();

    // CAD 명령어 실행 헬퍼
    const callCad = (command: string, params: Record<string, unknown>): boolean => {
      // Lock 검사: 수정 명령이고 대상 엔티티 파라미터가 있을 때
      // name 또는 entity_name (add_to_group 등) 모두 확인
      const entityName = (params.name ?? params.entity_name) as string | undefined;
      if (MODIFY_COMMANDS.has(command) && entityName && lockedEntities.has(entityName)) {
        const warning = `Warning: '${entityName}' is locked by user`;
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

    // drawBezier(name, path) - SVG path 문자열
    // M x,y = 시작점, C cp1x,cp1y cp2x,cp2y x,y = 큐빅, S cp2x,cp2y x,y = 부드러운 연결, Z = 닫기
    bindCadFunction(vm, 'drawBezier', (name: string, path: string) => {
      return callCad('draw_bezier', { name, path });
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
    // getEntity: returns local/world coordinates for dual coordinate workflow
    const getEntityFn = (name: string) => {
      const result = executor.exec('get_entity', { name });
      if (result.success && result.data) {
        return JSON.parse(result.data);
      }
      return null;
    };
    bindCadQueryFunction(vm, 'getEntity', getEntityFn);
    // Deprecated alias for backwards compatibility
    bindCadQueryFunction(vm, 'get_entity', getEntityFn);

    // getDrawOrder: 계층적 드로우 오더 조회 (Progressive Disclosure)
    // group_name이 빈 문자열이면 root level, 그룹 이름이면 해당 그룹의 자식들
    bindCadQueryFunction(vm, 'getDrawOrder', (groupName?: string) => {
      const result = executor.exec('get_draw_order', { group_name: groupName || '' });
      if (result.success && result.data) {
        return JSON.parse(result.data);
      }
      return null;
    });

    // === Boolean Operations (Manifold) ===
    // booleanUnion(nameA, nameB, resultName): 두 도형의 합집합
    // booleanDifference(nameA, nameB, resultName): A에서 B를 뺀 차집합
    // booleanIntersect(nameA, nameB, resultName): 두 도형의 교집합
    // 지원 도형: Circle, Rect, Polygon (닫힌 도형만)

    const performBooleanOp = (
      nameA: string,
      nameB: string,
      resultName: string,
      operation: BooleanOp
    ): boolean => {
      // Get entity data
      const resultA = executor.exec('get_entity', { name: nameA });
      const resultB = executor.exec('get_entity', { name: nameB });

      if (!resultA.success || !resultA.data) {
        logger.error(`[sandbox] Boolean: entity '${nameA}' not found`);
        return false;
      }
      if (!resultB.success || !resultB.data) {
        logger.error(`[sandbox] Boolean: entity '${nameB}' not found`);
        return false;
      }

      const entityA = JSON.parse(resultA.data) as EntityGeometry;
      const entityB = JSON.parse(resultB.data) as EntityGeometry;

      // Convert to polygons
      const polyA = entityToPolygon(entityA);
      const polyB = entityToPolygon(entityB);

      if (!polyA) {
        logger.error(`[sandbox] Boolean: '${nameA}' is not a closed shape (${entityA.type})`);
        return false;
      }
      if (!polyB) {
        logger.error(`[sandbox] Boolean: '${nameB}' is not a closed shape (${entityB.type})`);
        return false;
      }

      // Perform Boolean operation using Manifold
      const csA = polygonToCrossSection(manifold, polyA);
      const csB = polygonToCrossSection(manifold, polyB);

      let resultCs: CrossSection;
      switch (operation) {
        case 'union':
          resultCs = csA.add(csB);
          break;
        case 'difference':
          resultCs = csA.subtract(csB);
          break;
        case 'intersection':
          resultCs = csA.intersect(csB);
          break;
      }

      const resultPolygon = crossSectionToPolygon(resultCs);

      // Cleanup WASM objects
      csA.delete();
      csB.delete();
      resultCs.delete();

      // Check if result is empty
      if (resultPolygon.length === 0 || resultPolygon[0].length === 0) {
        logger.warn(`[sandbox] Boolean ${operation}: result is empty`);
        return false;
      }

      // Create result entity using drawPolygon
      const flatPoints = polygonToFlatPoints(resultPolygon);
      return callCad('draw_polygon', { name: resultName, points: flatPoints });
    };

    bindCadFunction(vm, 'booleanUnion', (nameA: string, nameB: string, resultName: string) => {
      return performBooleanOp(nameA, nameB, resultName, 'union');
    });

    bindCadFunction(vm, 'booleanDifference', (nameA: string, nameB: string, resultName: string) => {
      return performBooleanOp(nameA, nameB, resultName, 'difference');
    });

    bindCadFunction(vm, 'booleanIntersect', (nameA: string, nameB: string, resultName: string) => {
      return performBooleanOp(nameA, nameB, resultName, 'intersection');
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
