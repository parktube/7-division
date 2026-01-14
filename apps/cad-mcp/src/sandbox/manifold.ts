/**
 * Manifold Integration Module
 *
 * manifold-3d WASM 모듈을 사용한 2D Boolean 연산 지원
 */

import Module, { type ManifoldToplevel, type CrossSection } from 'manifold-3d';
import { logger } from '../logger.js';

// 싱글톤 Manifold 인스턴스
let manifoldInstance: ManifoldToplevel | null = null;
let initPromise: Promise<ManifoldToplevel> | null = null;

/**
 * Manifold WASM 모듈 초기화 (싱글톤, race-condition safe)
 *
 * - 동시 호출 시 하나의 Promise만 실행
 * - 초기화 실패 시 Promise 리셋하여 재시도 가능
 */
export async function getManifold(): Promise<ManifoldToplevel> {
  // Fast path: already initialized
  if (manifoldInstance) {
    return manifoldInstance;
  }

  // Ensure only one initialization runs even with concurrent calls
  if (!initPromise) {
    initPromise = (async () => {
      try {
        logger.debug('Initializing Manifold WASM module...');
        const instance = await Module();
        instance.setup();
        manifoldInstance = instance;
        logger.debug('Manifold WASM module initialized');
        return instance;
      } catch (error) {
        // Reset promise on failure to allow retry
        initPromise = null;
        logger.error(`Manifold WASM initialization failed: ${error}`);
        throw error;
      }
    })();
  }

  return initPromise;
}

/**
 * Manifold 인스턴스 동기 반환 (이미 초기화된 경우만)
 * Boolean 연산 등에서 sync context에서 사용
 * @throws 초기화되지 않은 경우 에러
 */
export function getManifoldSync(): ManifoldToplevel {
  if (!manifoldInstance) {
    throw new Error('Manifold not initialized. Call getManifold() first.');
  }
  return manifoldInstance;
}

/**
 * Manifold 초기화 여부 확인
 */
export function isManifoldInitialized(): boolean {
  return manifoldInstance !== null;
}

/**
 * 2D 폴리곤 타입 (외부 윤곽 + 내부 구멍들)
 * 각 contour는 [x, y] 좌표 배열 (CCW winding for outer, CW for holes)
 */
export type Polygon2D = [number, number][][];

/**
 * Boolean 연산 타입
 */
export type BooleanOp = 'union' | 'difference' | 'intersection';

/**
 * JoinType 문자열 매핑 (manifold-3d v3.x API)
 * offset 연산에서 사용
 */
export const JOIN_TYPE_MAP: Record<string, string> = {
  square: 'Square',
  round: 'Round',
  miter: 'Miter',
};

/**
 * 폴리곤에서 CrossSection 생성
 */
export function polygonToCrossSection(
  manifold: ManifoldToplevel,
  polygon: Polygon2D
): CrossSection {
  return new manifold.CrossSection(polygon);
}

/**
 * 점이 폴리곤 내부에 있는지 확인 (ray casting algorithm)
 */
function pointInContour(
  point: [number, number],
  contour: [number, number][]
): boolean {
  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const [xi, yi] = contour[i];
    const [xj, yj] = contour[j];

    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * 컨투어의 signed area 계산 (Shoelace formula)
 * CCW = positive, CW = negative
 */
function signedArea(contour: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < contour.length; i++) {
    const j = (i + 1) % contour.length;
    area += contour[i][0] * contour[j][1];
    area -= contour[j][0] * contour[i][1];
  }
  return area / 2;
}

/**
 * 컨투어 A가 컨투어 B에 완전히 포함되는지 확인
 * (A의 첫 번째 점이 B 내부에 있으면 포함된 것으로 간주)
 */
function contourInsideContour(
  inner: [number, number][],
  outer: [number, number][]
): boolean {
  if (inner.length === 0) return false;
  return pointInContour(inner[0], outer);
}

/**
 * CrossSection을 폴리곤으로 변환
 *
 * manifold-3d의 toPolygons()는 SimplePolygon[] 반환
 * (SimplePolygon = Vec2[] = [number, number][])
 *
 * 분리된 컨투어(disjoint polygons)를 올바르게 처리:
 * - 포함 관계에 따라 outer/hole 분류
 * - 독립된 outer가 여러 개면 가장 큰 것만 반환 + 경고
 */
export function crossSectionToPolygon(cs: CrossSection): Polygon2D {
  const result = cs.toPolygons();

  // 방어적 타입 정규화
  if (!Array.isArray(result) || result.length === 0) {
    return [];
  }

  // 결과를 Polygon2D 형태로 변환
  let contours: [number, number][][] = [];

  const first = result[0];
  if (Array.isArray(first) && first.length > 0 && Array.isArray(first[0])) {
    contours = result as [number, number][][];
  } else if (Array.isArray(first) && typeof first[0] === 'number') {
    contours = [result as unknown as [number, number][]];
  } else {
    return result as Polygon2D;
  }

  // 단일 컨투어면 바로 반환
  if (contours.length <= 1) {
    return contours;
  }

  // 각 컨투어의 면적 계산 및 정렬 (큰 것부터)
  const contoursWithArea = contours.map((c, idx) => ({
    contour: c,
    area: Math.abs(signedArea(c)),
    idx,
  }));
  contoursWithArea.sort((a, b) => b.area - a.area);

  // 포함 관계 분석: 각 컨투어가 어느 컨투어에 포함되는지 확인
  const parentIdx: (number | null)[] = new Array(contours.length).fill(null);

  for (let i = 0; i < contoursWithArea.length; i++) {
    const inner = contoursWithArea[i];
    // 자신보다 큰 컨투어 중 포함하는 가장 작은 것 찾기
    for (let j = i - 1; j >= 0; j--) {
      const outer = contoursWithArea[j];
      if (contourInsideContour(inner.contour, outer.contour)) {
        parentIdx[inner.idx] = outer.idx;
        break;
      }
    }
  }

  // outer 컨투어들 식별 (부모가 없거나 부모의 부모가 있는 경우 = 중첩 홀)
  const isOuter: boolean[] = new Array(contours.length).fill(false);
  for (let i = 0; i < contours.length; i++) {
    const parent = parentIdx[i];
    if (parent === null) {
      // 부모 없음 = outer
      isOuter[i] = true;
    } else {
      const grandparent = parentIdx[parent];
      if (grandparent !== null) {
        // 부모도 hole 안에 있음 = 중첩된 outer (도넛 안의 작은 원)
        isOuter[i] = true;
      }
    }
  }

  // 독립된 outer 개수 확인
  const outerIndices = isOuter
    .map((is, idx) => (is ? idx : -1))
    .filter((idx) => idx >= 0);

  if (outerIndices.length > 1) {
    // 분리된 폴리곤 감지 - 경고 출력
    logger.warn(
      `[manifold] Disjoint polygons detected: ${outerIndices.length} separate outer contours. ` +
        `Use decompose() to handle them separately. Returning largest polygon only.`
    );
  }

  // 가장 큰 outer와 그에 속하는 hole들만 반환
  const primaryOuterIdx = contoursWithArea[0].idx;
  const resultPolygon: Polygon2D = [contours[primaryOuterIdx]];

  // 이 outer에 직접 속하는 hole들 추가
  for (let i = 0; i < contours.length; i++) {
    if (parentIdx[i] === primaryOuterIdx && !isOuter[i]) {
      resultPolygon.push(contours[i]);
    }
  }

  return resultPolygon;
}

/**
 * CrossSection을 여러 개의 분리된 폴리곤으로 변환
 * decompose()를 사용하여 분리된 컴포넌트들을 각각 별도 폴리곤으로 반환
 *
 * @returns 분리된 폴리곤 배열 (각각이 outer + holes 구조)
 */
export function crossSectionToPolygons(cs: CrossSection): Polygon2D[] {
  // decompose()로 분리된 컴포넌트 추출
  const components = cs.decompose();

  if (components.length === 0) {
    return [];
  }

  const result: Polygon2D[] = [];

  try {
    for (const comp of components) {
      const polygon = crossSectionToPolygon(comp);
      if (polygon.length > 0 && polygon[0].length > 0) {
        result.push(polygon);
      }
    }
  } finally {
    // Cleanup all WASM objects
    for (const comp of components) {
      comp.delete();
    }
  }

  return result;
}

/**
 * 2D Boolean 연산 수행 (sync - manifold 인스턴스 필요)
 *
 * @param manifold Manifold 인스턴스 (getManifoldSync()로 획득)
 * @param polygonA 첫 번째 폴리곤
 * @param polygonB 두 번째 폴리곤
 * @param operation Boolean 연산 타입
 * @returns 결과 폴리곤
 */
export function booleanOperationSync(
  manifold: ManifoldToplevel,
  polygonA: Polygon2D,
  polygonB: Polygon2D,
  operation: BooleanOp
): Polygon2D {
  // CrossSection 생성
  const csA = polygonToCrossSection(manifold, polygonA);
  const csB = polygonToCrossSection(manifold, polygonB);

  let result: CrossSection;

  switch (operation) {
    case 'union':
      result = csA.add(csB);
      break;
    case 'difference':
      result = csA.subtract(csB);
      break;
    case 'intersection':
      result = csA.intersect(csB);
      break;
  }

  // 결과 폴리곤 추출
  const polygon = crossSectionToPolygon(result);

  // 메모리 정리 (중요!)
  csA.delete();
  csB.delete();
  result.delete();

  return polygon;
}

/**
 * Circle을 폴리곤으로 변환 (sync - manifold 인스턴스 필요)
 */
export function circleToPolygonSync(
  manifold: ManifoldToplevel,
  cx: number,
  cy: number,
  radius: number,
  segments: number = 32
): Polygon2D {
  const cs = manifold.CrossSection.circle(radius, segments).translate([cx, cy]);
  const polygon = crossSectionToPolygon(cs);
  cs.delete();
  return polygon;
}

/**
 * Rectangle을 폴리곤으로 변환 (sync - manifold 인스턴스 필요)
 */
export function rectToPolygonSync(
  manifold: ManifoldToplevel,
  cx: number,
  cy: number,
  width: number,
  height: number
): Polygon2D {
  const cs = manifold.CrossSection.square([width, height], true).translate([cx, cy]);
  const polygon = crossSectionToPolygon(cs);
  cs.delete();
  return polygon;
}

/**
 * 복수 폴리곤 Union (batch, sync - manifold 인스턴스 필요)
 */
export function booleanUnionBatchSync(
  manifold: ManifoldToplevel,
  polygons: Polygon2D[]
): Polygon2D {
  if (polygons.length === 0) return [];
  if (polygons.length === 1) return polygons[0];

  const crossSections = polygons.map(p => polygonToCrossSection(manifold, p));

  const result = manifold.CrossSection.union(crossSections);
  const polygon = crossSectionToPolygon(result);

  // 메모리 정리
  crossSections.forEach(cs => cs.delete());
  result.delete();

  return polygon;
}

/**
 * 폴리곤 offset (확장/축소, sync - manifold 인스턴스 필요)
 */
export function offsetPolygonSync(
  manifold: ManifoldToplevel,
  polygon: Polygon2D,
  delta: number,
  joinType: 'square' | 'round' | 'miter' = 'round',
  miterLimit: number = 2.0,
  circularSegments: number = 0
): Polygon2D {
  const cs = polygonToCrossSection(manifold, polygon);

  const result = cs.offset(delta, JOIN_TYPE_MAP[joinType], miterLimit, circularSegments);

  const resultPolygon = crossSectionToPolygon(result);

  cs.delete();
  result.delete();

  return resultPolygon;
}
