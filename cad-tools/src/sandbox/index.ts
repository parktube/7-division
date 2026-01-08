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
  getManifoldSync,
  type Polygon2D,
  type BooleanOp,
  polygonToCrossSection,
  crossSectionToPolygon,
} from './manifold.js';
import type { CrossSection } from 'manifold-3d';
import { convertText, type TextOptions } from './text.js';

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
 *
 * 변환 순서: Scale → Rotate → Translate (SRT)
 * - 로컬 좌표를 월드 좌표로 변환할 때 표준 순서
 * - 엔티티는 로컬 원점(0,0) 기준으로 정의되어 있음
 * - scale로 크기 조절 → rotate로 회전 → translate로 최종 위치 이동
 */
function applyTransform(
  point: [number, number],
  transform: EntityGeometry['local']['transform']
): [number, number] {
  // 1. Apply scale (local space)
  let x = point[0] * transform.scale[0];
  let y = point[1] * transform.scale[1];

  // 2. Apply rotation (around origin)
  if (transform.rotate !== 0) {
    const cos = Math.cos(transform.rotate);
    const sin = Math.sin(transform.rotate);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    x = rx;
    y = ry;
  }

  // 3. Apply translation (to world position)
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
    // Use original radius - transform will be applied later via applyTransform
    basePolygon = circleToPolygon(circle.center, circle.radius);
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
  const transformed = basePolygon.map(contour =>
    contour.map(point => applyTransform(point, transform))
  );

  // Ensure CCW winding for Manifold
  return ensureCCW(transformed);
}

/**
 * Polygon의 winding order 확인 (양수 = CCW, 음수 = CW)
 * Shoelace formula 사용
 */
function getPolygonArea(points: [number, number][]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i][0] * points[j][1];
    area -= points[j][0] * points[i][1];
  }
  return area / 2;
}

/**
 * CCW winding order로 정규화 (Manifold는 CCW 필요)
 */
function ensureCCW(polygon: Polygon2D): Polygon2D {
  return polygon.map(contour => {
    const area = getPolygonArea(contour);
    // 음수면 CW → 뒤집어서 CCW로
    return area < 0 ? [...contour].reverse() : contour;
  });
}

/**
 * Polygon2D를 flat points 배열로 변환 (drawPolygon용)
 */
function polygonToFlatPoints(polygon: Polygon2D): number[] {
  // 첫 번째 contour만 사용 (holes 미지원)
  if (polygon.length === 0 || polygon[0].length === 0) {
    return [];
  }
  if (polygon.length > 1) {
    logger.warn(`[sandbox] polygonToFlatPoints: discarding ${polygon.length - 1} inner contour(s) (holes not supported)`);
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

  // Manifold lazy 초기화: Boolean/기하 연산 사용 시에만 WASM 로드
  const MANIFOLD_OPERATIONS = [
    'booleanUnion', 'booleanDifference', 'booleanIntersect',
    'offsetPolygon', 'getArea', 'convexHull', 'decompose'
  ];
  const needsManifold = MANIFOLD_OPERATIONS.some(op => code.includes(op));
  if (needsManifold) {
    await getManifold();  // Singleton이므로 한 번만 로드됨
  }

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

    // drawText(name, text, x, y, fontSize, options?) - 텍스트를 베지어 경로로 변환하여 그리기
    // options: { fontPath?: string, align?: 'left' | 'center' | 'right' }
    // 각 글자를 개별 베지어로 생성 후 그룹화 (서브패스 연결선 방지)
    bindCadFunction(vm, 'drawText', (
      name: string,
      text: string,
      x: number,
      y: number,
      fontSize: number,
      options?: TextOptions
    ) => {
      const result = convertText(text, x, y, fontSize, options || {});
      if (!result) {
        logger.error(`[sandbox] drawText: failed to convert text '${text}'`);
        return false;
      }

      // Single glyph: create directly with the given name (no temp entity)
      if (result.paths.length === 1) {
        const success = callCad('draw_bezier', { name, path: result.paths[0] });
        if (success) {
          callCad('set_fill', { name, fill: { color: [0, 0, 0, 1] } });
        }
        return success;
      }

      // Multiple glyphs: create individual beziers then group
      const glyphNames: string[] = [];
      for (let i = 0; i < result.paths.length; i++) {
        const glyphName = `${name}_g${i}`;
        const success = callCad('draw_bezier', { name: glyphName, path: result.paths[i] });
        if (success) {
          callCad('set_fill', { name: glyphName, fill: { color: [0, 0, 0, 1] } });
          glyphNames.push(glyphName);
        }
      }

      if (glyphNames.length > 0) {
        callCad('create_group', { name, children: glyphNames });
        return true;
      }

      return false;
    });

    // getTextMetrics(text, fontSize, fontPath?) - 텍스트 치수 조회
    bindCadQueryFunction(vm, 'getTextMetrics', (
      text: string,
      fontSize: number,
      fontPath?: string
    ) => {
      const result = convertText(text, 0, 0, fontSize, { fontPath });
      if (!result) {
        return null;
      }
      return {
        width: result.width,
        height: result.height,
      };
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

    // duplicate(sourceName, newName): 엔티티 복제
    bindCadFunction(vm, 'duplicate', (sourceName: string, newName: string) => {
      // 1. Get source entity full data
      const result = executor.exec('get_entity', { name: sourceName });
      if (!result.success || !result.data) {
        logger.error(`[sandbox] duplicate: source entity '${sourceName}' not found`);
        return false;
      }

      const entity = JSON.parse(result.data);
      const entityType = entity.type;

      // 2. Create new entity based on type
      let createSuccess = false;
      const localGeom = entity.local?.geometry;

      if (!localGeom) {
        logger.error(`[sandbox] duplicate: cannot read geometry from '${sourceName}'`);
        return false;
      }

      // Create based on entity type
      if (entityType === 'Circle' && localGeom.Circle) {
        const { center, radius } = localGeom.Circle;
        createSuccess = callCad('draw_circle', { name: newName, x: center[0], y: center[1], radius });
      } else if (entityType === 'Rect' && localGeom.Rect) {
        const { center, width, height } = localGeom.Rect;
        createSuccess = callCad('draw_rect', { name: newName, x: center[0], y: center[1], width, height });
      } else if (entityType === 'Polygon' && localGeom.Polygon) {
        const points = localGeom.Polygon.points.flat();
        createSuccess = callCad('draw_polygon', { name: newName, points });
      } else if (entityType === 'Line' && localGeom.Line) {
        const points = localGeom.Line.points.flat();
        createSuccess = callCad('draw_line', { name: newName, points });
      } else if (entityType === 'Arc' && localGeom.Arc) {
        const { center, radius, start_angle, end_angle } = localGeom.Arc;
        createSuccess = callCad('draw_arc', {
          name: newName, cx: center[0], cy: center[1], radius, start_angle, end_angle
        });
      } else if (entityType === 'Bezier' && localGeom.Bezier) {
        // Reconstruct SVG path from bezier data
        const { start, segments, closed } = localGeom.Bezier;
        let path = `M ${start[0]},${start[1]}`;
        for (const seg of segments) {
          if (seg.length === 3) {
            // Cubic bezier: 2 control points + end point
            path += ` C ${seg[0][0]},${seg[0][1]} ${seg[1][0]},${seg[1][1]} ${seg[2][0]},${seg[2][1]}`;
          } else if (seg.length === 2) {
            // Quadratic bezier: 1 control point + end point
            path += ` Q ${seg[0][0]},${seg[0][1]} ${seg[1][0]},${seg[1][1]}`;
          }
        }
        if (closed) path += ' Z';
        createSuccess = callCad('draw_bezier', { name: newName, path });
      } else if (entityType === 'Group') {
        logger.error(`[sandbox] duplicate: Group duplication not supported yet`);
        return false;
      } else {
        logger.error(`[sandbox] duplicate: unsupported entity type '${entityType}'`);
        return false;
      }

      if (!createSuccess) {
        logger.error(`[sandbox] duplicate: failed to create '${newName}'`);
        return false;
      }

      // 3. Copy transform
      const transform = entity.local?.transform;
      if (transform) {
        if (transform.translate && (transform.translate[0] !== 0 || transform.translate[1] !== 0)) {
          callCad('translate', { name: newName, dx: transform.translate[0], dy: transform.translate[1] });
        }
        if (transform.rotate && transform.rotate !== 0) {
          callCad('rotate', { name: newName, angle: transform.rotate });
        }
        if (transform.scale && (transform.scale[0] !== 1 || transform.scale[1] !== 1)) {
          callCad('scale', { name: newName, sx: transform.scale[0], sy: transform.scale[1] });
        }
      }

      // 4. Copy style (already have entity from get_entity)
      if (entity.style) {
        if (entity.style.fill) {
          callCad('set_fill', { name: newName, fill: entity.style.fill });
        }
        if (entity.style.stroke) {
          callCad('set_stroke', { name: newName, stroke: entity.style.stroke });
        }
      }

      return true;
    });

    // mirror(sourceName, newName, axis): 엔티티를 축 기준으로 미러 복제
    // axis: 'x' (좌우 반전) | 'y' (상하 반전)
    bindCadFunction(vm, 'mirror', (sourceName: string, newName: string, axis: 'x' | 'y') => {
      const result = executor.exec('get_entity', { name: sourceName });
      if (!result.success || !result.data) {
        logger.error(`[sandbox] mirror: source entity '${sourceName}' not found`);
        return false;
      }

      const entity = JSON.parse(result.data);
      const entityType = entity.type;
      const localGeom = entity.local?.geometry;
      const worldBounds = entity.world?.bounds;

      if (!localGeom || !worldBounds) {
        logger.error(`[sandbox] mirror: cannot read geometry from '${sourceName}'`);
        return false;
      }

      // 미러 축 계산 (world bounds의 중심점)
      const centerX = (worldBounds.min_x + worldBounds.max_x) / 2;
      const centerY = (worldBounds.min_y + worldBounds.max_y) / 2;

      // 좌표 미러 함수
      const mirrorPoint = (x: number, y: number): [number, number] => {
        if (axis === 'x') {
          return [2 * centerX - x, y]; // X축 기준 반전
        } else {
          return [x, 2 * centerY - y]; // Y축 기준 반전
        }
      };

      let createSuccess = false;

      if (entityType === 'Circle' && localGeom.Circle) {
        const { center, radius } = localGeom.Circle;
        const transform = entity.local?.transform;
        const worldCenter = [
          center[0] + (transform?.translate?.[0] || 0),
          center[1] + (transform?.translate?.[1] || 0)
        ];
        const [mx, my] = mirrorPoint(worldCenter[0], worldCenter[1]);
        createSuccess = callCad('draw_circle', { name: newName, x: mx, y: my, radius });

      } else if (entityType === 'Rect' && localGeom.Rect) {
        const { center, width, height } = localGeom.Rect;
        const transform = entity.local?.transform;
        const worldCenter = [
          center[0] + (transform?.translate?.[0] || 0),
          center[1] + (transform?.translate?.[1] || 0)
        ];
        const [mx, my] = mirrorPoint(worldCenter[0], worldCenter[1]);
        createSuccess = callCad('draw_rect', { name: newName, x: mx, y: my, width, height });

      } else if (entityType === 'Polygon' && localGeom.Polygon) {
        const transform = entity.local?.transform;
        const tx = transform?.translate?.[0] || 0;
        const ty = transform?.translate?.[1] || 0;

        const mirroredPoints: number[] = [];
        for (const pt of localGeom.Polygon.points) {
          const worldPt = [pt[0] + tx, pt[1] + ty];
          const [mx, my] = mirrorPoint(worldPt[0], worldPt[1]);
          mirroredPoints.push(mx, my);
        }
        createSuccess = callCad('draw_polygon', { name: newName, points: mirroredPoints });

      } else if (entityType === 'Line' && localGeom.Line) {
        const transform = entity.local?.transform;
        const tx = transform?.translate?.[0] || 0;
        const ty = transform?.translate?.[1] || 0;

        const mirroredPoints: number[] = [];
        for (const pt of localGeom.Line.points) {
          const worldPt = [pt[0] + tx, pt[1] + ty];
          const [mx, my] = mirrorPoint(worldPt[0], worldPt[1]);
          mirroredPoints.push(mx, my);
        }
        createSuccess = callCad('draw_line', { name: newName, points: mirroredPoints });

      } else {
        logger.error(`[sandbox] mirror: unsupported entity type '${entityType}'`);
        return false;
      }

      if (!createSuccess) {
        logger.error(`[sandbox] mirror: failed to create '${newName}'`);
        return false;
      }

      // 스타일 복사 (이미 get_entity로 가져온 entity 재사용)
      if (entity.style) {
        if (entity.style.fill) {
          callCad('set_fill', { name: newName, fill: entity.style.fill });
        }
        if (entity.style.stroke) {
          callCad('set_stroke', { name: newName, stroke: entity.style.stroke });
        }
      }

      return true;
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
      const csA = polygonToCrossSection(getManifoldSync(), polyA);
      const csB = polygonToCrossSection(getManifoldSync(), polyB);

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

    // === Geometry Analysis (Manifold) ===

    // offsetPolygon(name, delta, resultName, joinType?): 폴리곤 확장/축소
    // delta > 0: 확장, delta < 0: 축소
    // joinType: 'round' (기본), 'square', 'miter'
    bindCadFunction(vm, 'offsetPolygon', (
      name: string,
      delta: number,
      resultName: string,
      joinType: 'round' | 'square' | 'miter' = 'round'
    ) => {
      const result = executor.exec('get_entity', { name });
      if (!result.success || !result.data) {
        logger.error(`[sandbox] offsetPolygon: entity '${name}' not found`);
        return false;
      }

      const entity = JSON.parse(result.data) as EntityGeometry;
      const polygon = entityToPolygon(entity);
      if (!polygon) {
        logger.error(`[sandbox] offsetPolygon: '${name}' is not a closed shape`);
        return false;
      }

      const cs = polygonToCrossSection(getManifoldSync(), polygon);
      // JoinType string 매핑 (manifold-3d v3.x API)
      const joinTypeMap: Record<string, string> = { square: 'Square', round: 'Round', miter: 'Miter' };
      const offsetCs = cs.offset(delta, joinTypeMap[joinType], 2.0, 0);
      const resultPolygon = crossSectionToPolygon(offsetCs);

      cs.delete();
      offsetCs.delete();

      if (resultPolygon.length === 0) {
        logger.warn(`[sandbox] offsetPolygon: result is empty (delta too large?)`);
        return false;
      }

      const flatPoints = polygonToFlatPoints(resultPolygon);
      return callCad('draw_polygon', { name: resultName, points: flatPoints });
    });

    // getArea(name): 폴리곤 면적 계산
    bindCadQueryFunction(vm, 'getArea', (name: string) => {
      const result = executor.exec('get_entity', { name });
      if (!result.success || !result.data) {
        logger.error(`[sandbox] getArea: entity '${name}' not found`);
        return null;
      }

      const entity = JSON.parse(result.data) as EntityGeometry;
      const polygon = entityToPolygon(entity);
      if (!polygon) {
        logger.error(`[sandbox] getArea: '${name}' is not a closed shape`);
        return null;
      }

      const cs = polygonToCrossSection(getManifoldSync(), polygon);
      const area = cs.area();
      cs.delete();

      return area;
    });

    // convexHull(name, resultName): 볼록 껍질 생성
    bindCadFunction(vm, 'convexHull', (name: string, resultName: string) => {
      const result = executor.exec('get_entity', { name });
      if (!result.success || !result.data) {
        logger.error(`[sandbox] convexHull: entity '${name}' not found`);
        return false;
      }

      const entity = JSON.parse(result.data) as EntityGeometry;
      const polygon = entityToPolygon(entity);
      if (!polygon) {
        logger.error(`[sandbox] convexHull: '${name}' is not a closed shape`);
        return false;
      }

      const cs = polygonToCrossSection(getManifoldSync(), polygon);
      const hullCs = cs.hull();
      const resultPolygon = crossSectionToPolygon(hullCs);

      cs.delete();
      hullCs.delete();

      const flatPoints = polygonToFlatPoints(resultPolygon);
      return callCad('draw_polygon', { name: resultName, points: flatPoints });
    });

    // decompose(name, prefix): 분리된 컴포넌트들을 개별 폴리곤으로 추출
    // Union 결과 등에서 서로 떨어진 도형들을 분리할 때 유용
    // 결과: prefix_0, prefix_1, ... 형태로 생성
    // 반환: 생성된 엔티티 이름 배열 또는 null
    bindCadQueryFunction(vm, 'decompose', (name: string, prefix: string) => {
      const result = executor.exec('get_entity', { name });
      if (!result.success || !result.data) {
        logger.error(`[sandbox] decompose: entity '${name}' not found`);
        return null;
      }

      const entity = JSON.parse(result.data) as EntityGeometry;
      const polygon = entityToPolygon(entity);
      if (!polygon) {
        logger.error(`[sandbox] decompose: '${name}' is not a closed shape`);
        return null;
      }

      const cs = polygonToCrossSection(getManifoldSync(), polygon);
      const components = cs.decompose();

      const createdNames: string[] = [];

      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        const compPolygon = crossSectionToPolygon(comp);
        const flatPoints = polygonToFlatPoints(compPolygon);
        const compName = `${prefix}_${i}`;

        if (callCad('draw_polygon', { name: compName, points: flatPoints })) {
          createdNames.push(compName);
        }
        comp.delete();
      }

      cs.delete();

      return createdNames.length > 0 ? createdNames : null;
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
