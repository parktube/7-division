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
 * 폴리곤에서 CrossSection 생성
 */
export function polygonToCrossSection(
  manifold: ManifoldToplevel,
  polygon: Polygon2D
): CrossSection {
  return new manifold.CrossSection(polygon);
}

/**
 * CrossSection을 폴리곤으로 변환
 *
 * manifold-3d의 toPolygons()는 SimplePolygon[] 반환
 * (SimplePolygon = Vec2[] = [number, number][])
 * 방어적으로 반환값이 배열의 배열인지 확인
 */
export function crossSectionToPolygon(cs: CrossSection): Polygon2D {
  const result = cs.toPolygons();

  // 방어적 타입 정규화: 결과가 다중 contour 배열인지 확인
  if (!Array.isArray(result) || result.length === 0) {
    return [];
  }

  // 첫 번째 요소가 좌표쌍 배열인지 확인 (정상 케이스)
  const first = result[0];
  if (Array.isArray(first) && first.length > 0 && Array.isArray(first[0])) {
    // [[x,y], [x,y], ...] 형태 = 정상적인 contour 배열
    return result as Polygon2D;
  }

  // 단일 contour인 경우 배열로 감싸기 (방어적 처리)
  if (Array.isArray(first) && typeof first[0] === 'number') {
    return [result as unknown as [number, number][]];
  }

  return result as Polygon2D;
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

  // JoinType string 매핑 (manifold-3d v3.x API)
  const joinTypeMap: Record<string, string> = { square: 'Square', round: 'Round', miter: 'Miter' };
  const result = cs.offset(delta, joinTypeMap[joinType], miterLimit, circularSegments);

  const resultPolygon = crossSectionToPolygon(result);

  cs.delete();
  result.delete();

  return resultPolygon;
}
