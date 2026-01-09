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
  JOIN_TYPE_MAP,
} from './manifold.js';
import type { CrossSection } from 'manifold-3d';
import { convertText, type TextOptions } from './text.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Manifold lazy 초기화: Boolean/기하 연산 사용 시에만 WASM 로드
const MANIFOLD_OPERATIONS = [
  'booleanUnion', 'booleanDifference', 'booleanIntersect',
  'offsetPolygon', 'getArea', 'convexHull', 'decompose'
] as const;
const MANIFOLD_PATTERN = new RegExp(`\\b(${MANIFOLD_OPERATIONS.join('|')})\\b`);

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
 * Arc를 "파이 조각" 폴리곤으로 변환 (Boolean 연산용)
 * 중심점에서 시작하여 호를 따라가고 다시 중심으로 돌아옴
 */
function arcToPolygon(
  center: [number, number],
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number = 32
): Polygon2D {
  const points: [number, number][] = [];

  // 시작점: 중심
  points.push([center[0], center[1]]);

  // 호를 따라 점들 생성
  const angleDiff = endAngle - startAngle;
  const arcSegments = Math.max(2, Math.ceil(Math.abs(angleDiff) / (Math.PI * 2) * segments));

  for (let i = 0; i <= arcSegments; i++) {
    const angle = startAngle + (i / arcSegments) * angleDiff;
    points.push([
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius,
    ]);
  }

  // 끝점: 중심으로 돌아감 (자동으로 닫힘)
  return [points];
}

/**
 * Transform을 적용한 point 반환
 *
 * 변환 순서: (원점 이동 →) Scale → Rotate → (원점 복귀 →) Translate
 * - 기하를 중심 기준으로 변환하기 위해 중심점을 사용
 * - localCenter: 기하의 로컬 중심점 (scale/rotate가 이 점 기준으로 적용됨)
 *
 * @param point - 변환할 점
 * @param transform - 적용할 변환
 * @param localCenter - 기하의 로컬 중심점 (scale/rotate 기준점)
 */
function applyTransform(
  point: [number, number],
  transform: EntityGeometry['local']['transform'],
  localCenter: [number, number] = [0, 0]
): [number, number] {
  // 1. Translate to origin (relative to local center)
  let x = point[0] - localCenter[0];
  let y = point[1] - localCenter[1];

  // 2. Apply scale
  x *= transform.scale[0];
  y *= transform.scale[1];

  // 3. Apply rotation (around origin)
  if (transform.rotate !== 0) {
    const cos = Math.cos(transform.rotate);
    const sin = Math.sin(transform.rotate);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    x = rx;
    y = ry;
  }

  // 4. Translate back to local center
  x += localCenter[0];
  y += localCenter[1];

  // 5. Apply world translation
  x += transform.translate[0];
  y += transform.translate[1];

  return [x, y];
}

/**
 * Entity geometry를 Polygon2D로 변환 (transform 적용)
 *
 * 각 geometry 타입의 center를 기준으로 scale/rotate 적용
 */
function entityToPolygon(entity: EntityGeometry): Polygon2D | null {
  const { geometry, transform } = entity.local;
  let basePolygon: Polygon2D | null = null;
  let localCenter: [number, number] = [0, 0];

  if (entity.type === 'Circle' && 'Circle' in geometry) {
    const circle = geometry.Circle as { center: [number, number]; radius: number };
    localCenter = circle.center;
    basePolygon = circleToPolygon(circle.center, circle.radius);
  } else if (entity.type === 'Rect' && 'Rect' in geometry) {
    const rect = geometry.Rect as { center: [number, number]; width: number; height: number };
    localCenter = rect.center;
    basePolygon = rectToPolygon(rect.center, rect.width, rect.height);
  } else if (entity.type === 'Polygon' && 'Polygon' in geometry) {
    const poly = geometry.Polygon as { points: [number, number][]; holes?: [number, number][][] };
    // Polygon의 중심점 계산 (bounding box 기반)
    if (poly.points.length > 0) {
      const xs = poly.points.map(p => p[0]);
      const ys = poly.points.map(p => p[1]);
      localCenter = [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2,
      ];
    }
    // holes도 함께 포함
    basePolygon = poly.holes && poly.holes.length > 0
      ? [poly.points, ...poly.holes]
      : [poly.points];
  } else if (entity.type === 'Arc' && 'Arc' in geometry) {
    // Arc를 "파이 조각" 폴리곤으로 변환 (중심 + 호)
    const arc = geometry.Arc as {
      center: [number, number];
      radius: number;
      start_angle: number;
      end_angle: number;
    };
    localCenter = arc.center;
    basePolygon = arcToPolygon(arc.center, arc.radius, arc.start_angle, arc.end_angle);
  } else {
    return null; // Line, Bezier, Empty 등은 Boolean 미지원
  }

  // Apply transform to all points (localCenter 기준 scale/rotate)
  const transformed = basePolygon.map(contour =>
    contour.map(point => applyTransform(point, transform, localCenter))
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
 * Polygon winding order 정규화 (Manifold 규약)
 * - 외곽선 (첫 번째 contour): CCW (counter-clockwise)
 * - 구멍 (나머지 contours): CW (clockwise)
 */
function ensureCCW(polygon: Polygon2D): Polygon2D {
  return polygon.map((contour, index) => {
    const area = getPolygonArea(contour);
    const isOuter = index === 0;

    if (isOuter) {
      // 외곽선: CCW 필요 (area > 0)
      return area < 0 ? [...contour].reverse() : contour;
    } else {
      // 구멍: CW 필요 (area < 0)
      return area > 0 ? [...contour].reverse() : contour;
    }
  });
}

/**
 * Polygon2D를 flat points 배열로 변환 (drawPolygon용 - holes 없는 경우)
 */
function polygonToFlatPoints(polygon: Polygon2D): number[] {
  if (polygon.length === 0 || polygon[0].length === 0) {
    return [];
  }
  // holes가 있으면 디버그 로그 (첫 번째 contour만 사용됨)
  // Note: holes가 있는 폴리곤은 createPolygonEntity에서 draw_polygon_with_holes로 처리됨
  if (polygon.length > 1) {
    logger.debug(`[sandbox] polygonToFlatPoints: polygon has ${polygon.length - 1} holes (outer contour only)`);
  }
  const points: number[] = [];
  for (const [x, y] of polygon[0]) {
    points.push(x, y);
  }
  return points;
}

/**
 * Polygon2D에 구멍이 있는지 확인
 */
function hasHoles(polygon: Polygon2D): boolean {
  return polygon.length > 1;
}

/**
 * Polygon2D로 Entity를 생성합니다 (holes 자동 처리).
 * holes가 있으면 draw_polygon_with_holes, 없으면 draw_polygon 사용.
 */
function createPolygonEntity(
  callCad: (cmd: string, args: Record<string, unknown>) => boolean,
  name: string,
  polygon: Polygon2D
): boolean {
  if (polygon.length === 0 || polygon[0].length === 0) {
    return false;
  }

  // 외곽선 (첫 번째 contour)
  const flatPoints = polygonToFlatPoints(polygon);

  if (hasHoles(polygon)) {
    // holes가 있으면 draw_polygon_with_holes 사용
    // holes: [[[x1,y1], [x2,y2], ...], ...]
    const holes = polygon.slice(1);  // 첫 번째 제외한 나머지가 holes
    return callCad('draw_polygon_with_holes', { name, points: flatPoints, holes });
  } else {
    // holes 없으면 기존 draw_polygon 사용
    return callCad('draw_polygon', { name, points: flatPoints });
  }
}

// === 엔티티 복제/미러링 헬퍼 함수들 ===

type CallCadFn = (cmd: string, args: Record<string, unknown>) => boolean;
type TransformPointFn = (x: number, y: number) => [number, number];

// Identity transform (좌표 변환 없음)
const identityTransform: TransformPointFn = (x, y) => [x, y];

/**
 * Bezier 세그먼트를 SVG path 문자열로 변환
 * Cubic (length 3)과 Quadratic (length 2) 모두 지원
 */
function buildBezierPath(
  start: [number, number],
  segments: number[][][],
  closed: boolean,
  transformPoint: TransformPointFn = identityTransform,
  translate: [number, number] = [0, 0]
): string {
  const [tx, ty] = translate;
  const [sx, sy] = transformPoint(start[0] + tx, start[1] + ty);
  let path = `M ${sx},${sy}`;

  for (const seg of segments) {
    if (seg.length === 3) {
      // Cubic bezier: 2 control points + end point
      const [cp1, cp2, end] = seg;
      const [cp1x, cp1y] = transformPoint(cp1[0] + tx, cp1[1] + ty);
      const [cp2x, cp2y] = transformPoint(cp2[0] + tx, cp2[1] + ty);
      const [ex, ey] = transformPoint(end[0] + tx, end[1] + ty);
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`;
    } else if (seg.length === 2) {
      // Quadratic bezier: 1 control point + end point
      const [cp, end] = seg;
      const [cpx, cpy] = transformPoint(cp[0] + tx, cp[1] + ty);
      const [ex, ey] = transformPoint(end[0] + tx, end[1] + ty);
      path += ` Q ${cpx},${cpy} ${ex},${ey}`;
    }
  }
  if (closed) path += ' Z';
  return path;
}

/**
 * 엔티티 스타일 복사 (fill, stroke)
 * 실제 entity.style 구조: { fill?: { color: number[] }, stroke?: { color: number[], width?: number } }
 */
function copyEntityStyle(
  callCad: CallCadFn,
  targetName: string,
  style?: {
    fill?: { color?: number[] } | number[];
    stroke?: { color?: number[]; width?: number } | number[];
  }
): void {
  if (style?.fill) {
    // fill이 { color: [...] } 또는 직접 배열일 수 있음
    const fillColor = Array.isArray(style.fill) ? style.fill : style.fill.color;
    if (fillColor) {
      callCad('set_fill', { name: targetName, fill: { color: fillColor } });
    }
  }
  if (style?.stroke) {
    // stroke가 { color: [...], width: n } 또는 직접 배열일 수 있음
    const strokeColor = Array.isArray(style.stroke) ? style.stroke : style.stroke.color;
    const strokeWidth = Array.isArray(style.stroke) ? 1 : (style.stroke.width ?? 1);
    if (strokeColor) {
      callCad('set_stroke', { name: targetName, stroke: { color: strokeColor, width: strokeWidth } });
    }
  }
}

/**
 * 엔티티 transform 복사 (translate, rotate, scale)
 */
function copyEntityTransform(
  callCad: CallCadFn,
  targetName: string,
  transform?: { translate?: [number, number]; rotate?: number; scale?: [number, number] }
): void {
  if (!transform) return;
  if (transform.translate && (transform.translate[0] !== 0 || transform.translate[1] !== 0)) {
    callCad('translate', { name: targetName, dx: transform.translate[0], dy: transform.translate[1], space: 'local' });
  }
  if (transform.rotate && transform.rotate !== 0) {
    callCad('rotate', { name: targetName, angle: transform.rotate, angle_unit: 'radian' });
  }
  if (transform.scale && (transform.scale[0] !== 1 || transform.scale[1] !== 1)) {
    callCad('scale', { name: targetName, sx: transform.scale[0], sy: transform.scale[1], space: 'local' });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LocalGeometry = Record<string, any>;

/**
 * 엔티티를 geometry 기반으로 생성 (좌표 변환 콜백 지원)
 * duplicate와 mirror에서 공통 사용
 *
 * @param callCad - CAD 명령 실행 함수
 * @param name - 생성할 엔티티 이름
 * @param entityType - 엔티티 타입 (Circle, Rect, Polygon, Line, Arc, Bezier)
 * @param localGeom - 로컬 geometry 데이터
 * @param translate - 적용할 translate [tx, ty]
 * @param transformPoint - 좌표 변환 함수 (미러링 등에 사용)
 * @returns 생성 성공 여부
 */
function createEntityFromGeometry(
  callCad: CallCadFn,
  name: string,
  entityType: string,
  localGeom: LocalGeometry,
  translate: [number, number] = [0, 0],
  transformPoint: TransformPointFn = identityTransform
): boolean {
  const [tx, ty] = translate;

  if (entityType === 'Circle' && localGeom.Circle) {
    const { center, radius } = localGeom.Circle;
    const [x, y] = transformPoint(center[0] + tx, center[1] + ty);
    return callCad('draw_circle', { name, x, y, radius });
  }

  if (entityType === 'Rect' && localGeom.Rect) {
    const { center, width, height } = localGeom.Rect;
    const [x, y] = transformPoint(center[0] + tx, center[1] + ty);
    return callCad('draw_rect', { name, x, y, width, height });
  }

  if (entityType === 'Polygon' && localGeom.Polygon) {
    const points: number[] = [];
    for (const pt of localGeom.Polygon.points) {
      const [x, y] = transformPoint(pt[0] + tx, pt[1] + ty);
      points.push(x, y);
    }

    const holes = localGeom.Polygon.holes;
    if (holes && holes.length > 0) {
      const transformedHoles: [number, number][][] = [];
      for (const hole of holes) {
        const transformedHole: [number, number][] = [];
        for (const pt of hole) {
          transformedHole.push(transformPoint(pt[0] + tx, pt[1] + ty));
        }
        transformedHoles.push(transformedHole);
      }
      return callCad('draw_polygon_with_holes', { name, points, holes: transformedHoles });
    }
    return callCad('draw_polygon', { name, points });
  }

  if (entityType === 'Line' && localGeom.Line) {
    const points: number[] = [];
    for (const pt of localGeom.Line.points) {
      const [x, y] = transformPoint(pt[0] + tx, pt[1] + ty);
      points.push(x, y);
    }
    return callCad('draw_line', { name, points });
  }

  if (entityType === 'Arc' && localGeom.Arc) {
    const { center, radius, start_angle, end_angle } = localGeom.Arc;
    const [cx, cy] = transformPoint(center[0] + tx, center[1] + ty);
    return callCad('draw_arc', { name, cx, cy, radius, start_angle, end_angle, angle_unit: 'radian' });
  }

  if (entityType === 'Bezier' && localGeom.Bezier) {
    const { start, segments, closed } = localGeom.Bezier;
    const path = buildBezierPath(start, segments, closed, transformPoint, translate);
    return callCad('draw_bezier', { name, path });
  }

  return false;
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
  const needsManifold = MANIFOLD_PATTERN.test(code);
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
    // options: { fontPath?: string, align?: 'left' | 'center' | 'right', color?: [r,g,b,a] }
    // 각 글자를 개별 베지어로 생성 후 그룹화 (서브패스 연결선 방지)
    bindCadFunction(vm, 'drawText', (
      name: string,
      text: string,
      x: number,
      y: number,
      fontSize: number,
      options?: TextOptions
    ) => {
      // NaN/Infinity 검증
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(fontSize)) {
        logger.error(`[sandbox] drawText: x, y, fontSize must be finite numbers`);
        return false;
      }
      if (fontSize <= 0) {
        logger.error(`[sandbox] drawText: fontSize must be positive`);
        return false;
      }

      const result = convertText(text, x, y, fontSize, options || {});
      if (!result) {
        logger.error(`[sandbox] drawText: failed to convert text '${text}'`);
        return false;
      }

      // 기본 색상: 검정 (사용자 지정 가능)
      const fillColor = options?.color ?? [0, 0, 0, 1];

      // Single glyph: create directly with the given name (no temp entity)
      if (result.paths.length === 1) {
        const success = callCad('draw_bezier', { name, path: result.paths[0] });
        if (success) {
          callCad('set_fill', { name, fill: { color: fillColor } });
        }
        return success;
      }

      // Multiple glyphs: create individual beziers then group
      const glyphNames: string[] = [];
      let failedCount = 0;
      for (let i = 0; i < result.paths.length; i++) {
        const glyphName = `${name}_g${i}`;
        const success = callCad('draw_bezier', { name: glyphName, path: result.paths[i] });
        if (success) {
          callCad('set_fill', { name: glyphName, fill: { color: fillColor } });
          glyphNames.push(glyphName);
        } else {
          failedCount++;
        }
      }

      // Partial success warning
      if (failedCount > 0 && glyphNames.length > 0) {
        logger.warn(`[sandbox] drawText: ${failedCount}/${result.paths.length} glyphs failed for '${text}'`);
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
      // fontSize 검증
      if (!Number.isFinite(fontSize) || fontSize <= 0) {
        logger.error(`[sandbox] getTextMetrics: fontSize must be a positive finite number, got ${fontSize}`);
        return null;
      }
      const result = convertText(text, 0, 0, fontSize, { fontPath });
      if (!result) {
        return null;
      }
      return {
        width: result.width,
        height: result.height,
      };
    });

    // === Story 8.3: Auto Scale Calculation ===
    // fitToViewport(realWidth, realHeight, options?) - 실제 치수를 뷰포트에 맞는 스케일로 변환
    // options: { viewport?: [width, height], margin?: number (0-1, default 0.1) }
    // 반환: { scale, offsetX, offsetY, code }
    bindCadQueryFunction(vm, 'fitToViewport', (
      realWidth: number,
      realHeight: number,
      options?: { viewport?: [number, number]; margin?: number }
    ) => {
      // NaN/Infinity 검증
      if (!Number.isFinite(realWidth) || !Number.isFinite(realHeight)) {
        logger.error(`[sandbox] fitToViewport: realWidth and realHeight must be finite numbers`);
        return null;
      }
      if (realWidth <= 0 || realHeight <= 0) {
        logger.error(`[sandbox] fitToViewport: realWidth and realHeight must be positive`);
        return null;
      }

      // 기본 뷰포트: 1600x1000 (일반적인 캡처 크기)
      const viewportWidth = options?.viewport?.[0] ?? 1600;
      const viewportHeight = options?.viewport?.[1] ?? 1000;
      const margin = options?.margin ?? 0.1;  // 10% 여백

      // 사용 가능한 영역 (여백 제외)
      const availableWidth = viewportWidth * (1 - margin * 2);
      const availableHeight = viewportHeight * (1 - margin * 2);

      // 스케일 계산 (가로/세로 중 작은 값 사용)
      const scaleX = availableWidth / realWidth;
      const scaleY = availableHeight / realHeight;
      const scale = Math.min(scaleX, scaleY);

      // 오프셋 계산 (뷰포트 중앙에 위치)
      // 뷰포트 중심: (viewportWidth/2, viewportHeight/2)
      // 도면 크기 (스케일 적용 후): realWidth * scale, realHeight * scale
      // 도면 중심을 뷰포트 중심에 맞추기 위한 오프셋
      const scaledWidth = realWidth * scale;
      const scaledHeight = realHeight * scale;
      const offsetX = (viewportWidth - scaledWidth) / 2;
      const offsetY = (viewportHeight - scaledHeight) / 2;

      // 사용자가 바로 복사해서 쓸 수 있는 코드 스니펫
      // 도면 좌하단이 원점이라고 가정하고, 스케일 적용 후 오프셋으로 중앙 배치
      const code = `const SCALE = ${scale.toFixed(6)};
const S = (v) => v * SCALE;
const OX = ${offsetX.toFixed(1)}, OY = ${offsetY.toFixed(1)};
const P = (x, y) => [S(x) + OX, S(y) + OY];

// 사용 예:
// const [px, py] = P(realX, realY);
// drawRect('r', px, py, S(realWidth), S(realHeight));`;

      return {
        scale: parseFloat(scale.toFixed(6)),
        offsetX: parseFloat(offsetX.toFixed(1)),
        offsetY: parseFloat(offsetY.toFixed(1)),
        viewportWidth,
        viewportHeight,
        code,
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
    // 내부 재귀 헬퍼 함수
    const duplicateInternal = (sourceName: string, newName: string): boolean => {
      const result = executor.exec('get_entity', { name: sourceName });
      if (!result.success || !result.data) {
        logger.error(`[sandbox] duplicate: source entity '${sourceName}' not found`);
        return false;
      }

      const entity = JSON.parse(result.data);
      const entityType = entity.type;
      const localGeom = entity.local?.geometry;

      if (!localGeom && entityType !== 'Group') {
        logger.error(`[sandbox] duplicate: cannot read geometry from '${sourceName}'`);
        return false;
      }

      let createSuccess = false;

      if (entityType === 'Group') {
        // Group 복제: 자식들을 재귀적으로 복제 후 새 그룹 생성
        const children = entity.children || [];
        const duplicatedChildren: string[] = [];
        for (let i = 0; i < children.length; i++) {
          const childName = children[i];
          const dupChildName = `${newName}_${i}`;
          if (duplicateInternal(childName, dupChildName)) {
            duplicatedChildren.push(dupChildName);
          }
        }
        // 빈 그룹도 허용 (원본이 빈 그룹이면 복제도 빈 그룹)
        createSuccess = callCad('create_group', { name: newName, children: duplicatedChildren });
      } else {
        // 일반 엔티티: 헬퍼 함수 사용 (transform 없이 로컬 좌표 그대로)
        createSuccess = createEntityFromGeometry(callCad, newName, entityType, localGeom);
      }

      if (!createSuccess) {
        logger.error(`[sandbox] duplicate: failed to create '${newName}'`);
        return false;
      }

      // Transform과 Style 복사 (헬퍼 함수 사용)
      copyEntityTransform(callCad, newName, entity.local?.transform);
      copyEntityStyle(callCad, newName, entity.style);

      return true;
    };

    bindCadFunction(vm, 'duplicate', (sourceName: string, newName: string) => {
      return duplicateInternal(sourceName, newName);
    });

    // mirror(sourceName, newName, axis): 엔티티를 축 기준으로 미러 복제
    // axis: 'x' (좌우 반전) | 'y' (상하 반전)
    // 내부 미러링 헬퍼 (재귀 호출용)
    const mirrorInternal = (
      sourceName: string,
      newName: string,
      axis: 'x' | 'y',
      mirrorPointFn: TransformPointFn
    ): boolean => {
      const result = executor.exec('get_entity', { name: sourceName });
      if (!result.success || !result.data) {
        logger.error(`[sandbox] mirror: source entity '${sourceName}' not found`);
        return false;
      }

      const entity = JSON.parse(result.data);
      const entityType = entity.type;
      const localGeom = entity.local?.geometry;
      const transform = entity.local?.transform;
      const translate: [number, number] = [
        transform?.translate?.[0] || 0,
        transform?.translate?.[1] || 0
      ];

      let createSuccess = false;

      if (entityType === 'Arc' && localGeom?.Arc) {
        // Arc는 각도 미러링이 필요하므로 별도 처리
        const { center, radius, start_angle, end_angle } = localGeom.Arc;
        const [cx, cy] = mirrorPointFn(center[0] + translate[0], center[1] + translate[1]);

        // 각도 미러링: axis='x'(좌우) → π-angle, axis='y'(상하) → -angle, start/end 교환
        let newStart: number, newEnd: number;
        if (axis === 'x') {
          newStart = Math.PI - end_angle;
          newEnd = Math.PI - start_angle;
        } else {
          newStart = -end_angle;
          newEnd = -start_angle;
        }
        createSuccess = callCad('draw_arc', {
          name: newName, cx, cy, radius, start_angle: newStart, end_angle: newEnd, angle_unit: 'radian'
        });

      } else if (entityType === 'Group') {
        // Group 미러링: 자식들을 재귀적으로 미러링 후 새 그룹 생성
        const children = entity.children || [];
        const mirroredChildren: string[] = [];
        for (let i = 0; i < children.length; i++) {
          const childName = children[i];
          const mirroredChildName = `${newName}_${i}`;
          if (mirrorInternal(childName, mirroredChildName, axis, mirrorPointFn)) {
            mirroredChildren.push(mirroredChildName);
          } else {
            logger.warn(`[sandbox] mirror: failed to mirror child '${childName}'`);
          }
        }
        // 빈 그룹도 허용 (원본이 빈 그룹이면 미러도 빈 그룹)
        createSuccess = callCad('create_group', { name: newName, children: mirroredChildren });

      } else if (localGeom) {
        // Circle, Rect, Polygon, Line, Bezier: 헬퍼 함수 사용
        createSuccess = createEntityFromGeometry(
          callCad, newName, entityType, localGeom, translate, mirrorPointFn
        );
      }

      if (!createSuccess) {
        logger.error(`[sandbox] mirror: failed to create '${newName}'`);
        return false;
      }

      // Transform 복사 (rotate는 미러링, scale은 그대로)
      if (transform) {
        // Scale은 그대로 복사
        if (transform.scale && (transform.scale[0] !== 1 || transform.scale[1] !== 1)) {
          callCad('scale', { name: newName, sx: transform.scale[0], sy: transform.scale[1], space: 'local' });
        }
        // Rotate는 미러링 (X축 미러: -angle, Y축 미러: π - angle)
        if (transform.rotate && transform.rotate !== 0) {
          const mirroredRotate = axis === 'x' ? -transform.rotate : Math.PI - transform.rotate;
          callCad('rotate', { name: newName, angle: mirroredRotate });
        }
      }

      // 스타일 복사 (헬퍼 함수 사용)
      copyEntityStyle(callCad, newName, entity.style);

      return true;
    };

    bindCadFunction(vm, 'mirror', (sourceName: string, newName: string, axis: 'x' | 'y') => {
      // 소스 엔티티의 world bounds로 미러 축 계산
      const result = executor.exec('get_entity', { name: sourceName });
      if (!result.success || !result.data) {
        logger.error(`[sandbox] mirror: source entity '${sourceName}' not found`);
        return false;
      }

      const entity = JSON.parse(result.data);
      const worldBounds = entity.world?.bounds;

      if (!worldBounds) {
        logger.error(`[sandbox] mirror: cannot read world bounds from '${sourceName}'`);
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

      return mirrorInternal(sourceName, newName, axis, mirrorPoint);
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
      const manifold = getManifoldSync();
      const csA = polygonToCrossSection(manifold, polyA);
      const csB = polygonToCrossSection(manifold, polyB);

      let resultCs: CrossSection | null = null;
      let resultPolygon: Polygon2D;
      try {
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
        resultPolygon = crossSectionToPolygon(resultCs);
      } finally {
        // Cleanup WASM objects (guaranteed even on exception)
        csA.delete();
        csB.delete();
        resultCs?.delete();
      }

      // Check if result is empty
      if (resultPolygon.length === 0 || resultPolygon[0].length === 0) {
        logger.warn(`[sandbox] Boolean ${operation}: result is empty`);
        return false;
      }

      // Create result entity (holes 자동 처리)
      return createPolygonEntity(callCad, resultName, resultPolygon);
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

    // offsetPolygon(name, delta, resultName, options?): 폴리곤 확장/축소
    // delta > 0: 확장, delta < 0: 축소
    // options.joinType: 'round' (기본), 'square', 'miter'
    // options.miterLimit: miter 조인 최대 길이 (기본 2.0)
    // options.circularSegments: round 조인 세그먼트 수 (기본 0=자동)
    bindCadFunction(vm, 'offsetPolygon', (
      name: string,
      delta: number,
      resultName: string,
      options?: {
        joinType?: 'round' | 'square' | 'miter';
        miterLimit?: number;
        circularSegments?: number;
      } | 'round' | 'square' | 'miter'  // 하위 호환: 4번째 인자로 joinType만 받던 기존 API 지원
    ) => {
      // 하위 호환: 문자열로 joinType만 전달하는 기존 API 지원
      const opts = typeof options === 'string'
        ? { joinType: options }
        : options ?? {};
      const joinType = opts.joinType ?? 'round';

      // joinType 검증
      const validJoinTypes = ['round', 'square', 'miter'] as const;
      if (!validJoinTypes.includes(joinType as typeof validJoinTypes[number])) {
        logger.error(`[sandbox] offsetPolygon: invalid joinType '${joinType}', must be one of: ${validJoinTypes.join(', ')}`);
        return false;
      }

      const miterLimit = opts.miterLimit ?? 2.0;
      const circularSegments = opts.circularSegments ?? 0;

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
      let offsetCs: CrossSection | null = null;
      let resultPolygon: Polygon2D;
      try {
        offsetCs = cs.offset(delta, JOIN_TYPE_MAP[joinType], miterLimit, circularSegments);
        resultPolygon = crossSectionToPolygon(offsetCs);
      } finally {
        cs.delete();
        offsetCs?.delete();
      }

      if (resultPolygon.length === 0) {
        logger.warn(`[sandbox] offsetPolygon: result is empty (delta too large?)`);
        return false;
      }

      // holes 자동 처리
      return createPolygonEntity(callCad, resultName, resultPolygon);
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
      try {
        return cs.area();
      } finally {
        cs.delete();
      }
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
      let hullCs: CrossSection | null = null;
      let resultPolygon: Polygon2D;
      try {
        hullCs = cs.hull();
        resultPolygon = crossSectionToPolygon(hullCs);
      } finally {
        cs.delete();
        hullCs?.delete();
      }

      // convexHull은 단일 컨투어로 holes 없음
      return createPolygonEntity(callCad, resultName, resultPolygon);
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
      let components: CrossSection[] = [];
      try {
        components = cs.decompose();

        const createdNames: string[] = [];

        for (let i = 0; i < components.length; i++) {
          const comp = components[i];
          const compPolygon = crossSectionToPolygon(comp);
          const compName = `${prefix}_${i}`;

          // 각 컴포넌트도 holes를 가질 수 있음
          if (createPolygonEntity(callCad, compName, compPolygon)) {
            createdNames.push(compName);
          }
        }

        return createdNames.length > 0 ? createdNames : null;
      } finally {
        // Cleanup all WASM objects
        cs.delete();
        for (const comp of components) {
          comp.delete();
        }
      }
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
