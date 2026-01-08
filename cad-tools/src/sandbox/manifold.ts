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
 */
export async function getManifold(): Promise<ManifoldToplevel> {
  // Fast path: already initialized
  if (manifoldInstance) {
    return manifoldInstance;
  }

  // Ensure only one initialization runs even with concurrent calls
  if (!initPromise) {
    initPromise = (async () => {
      logger.debug('Initializing Manifold WASM module...');
      const instance = await Module();
      instance.setup();
      manifoldInstance = instance;
      logger.debug('Manifold WASM module initialized');
      return instance;
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
 */
export function crossSectionToPolygon(cs: CrossSection): Polygon2D {
  return cs.toPolygons() as Polygon2D;
}

/**
 * 2D Boolean 연산 수행
 *
 * @param polygonA 첫 번째 폴리곤
 * @param polygonB 두 번째 폴리곤
 * @param operation Boolean 연산 타입
 * @returns 결과 폴리곤
 */
export async function booleanOperation(
  polygonA: Polygon2D,
  polygonB: Polygon2D,
  operation: BooleanOp
): Promise<Polygon2D> {
  const manifold = await getManifold();

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
 * Circle을 폴리곤으로 변환
 */
export async function circleToPolygon(
  cx: number,
  cy: number,
  radius: number,
  segments: number = 32
): Promise<Polygon2D> {
  const manifold = await getManifold();
  const cs = manifold.CrossSection.circle(radius, segments).translate([cx, cy]);
  const polygon = crossSectionToPolygon(cs);
  cs.delete();
  return polygon;
}

/**
 * Rectangle을 폴리곤으로 변환
 */
export async function rectToPolygon(
  cx: number,
  cy: number,
  width: number,
  height: number
): Promise<Polygon2D> {
  const manifold = await getManifold();
  const cs = manifold.CrossSection.square([width, height], true).translate([cx, cy]);
  const polygon = crossSectionToPolygon(cs);
  cs.delete();
  return polygon;
}

/**
 * 복수 폴리곤 Union (batch)
 */
export async function booleanUnionBatch(polygons: Polygon2D[]): Promise<Polygon2D> {
  if (polygons.length === 0) return [];
  if (polygons.length === 1) return polygons[0];

  const manifold = await getManifold();
  const crossSections = polygons.map(p => polygonToCrossSection(manifold, p));

  const result = manifold.CrossSection.union(crossSections);
  const polygon = crossSectionToPolygon(result);

  // 메모리 정리
  crossSections.forEach(cs => cs.delete());
  result.delete();

  return polygon;
}

/**
 * 폴리곤 offset (확장/축소)
 */
export async function offsetPolygon(
  polygon: Polygon2D,
  delta: number,
  joinType: 'square' | 'round' | 'miter' = 'round',
  miterLimit: number = 2.0,
  circularSegments: number = 0
): Promise<Polygon2D> {
  const manifold = await getManifold();
  const cs = polygonToCrossSection(manifold, polygon);

  // JoinType string 매핑 (manifold-3d v3.x API)
  const joinTypeMap: Record<string, string> = { square: 'Square', round: 'Round', miter: 'Miter' };
  const result = cs.offset(delta, joinTypeMap[joinType], miterLimit, circularSegments);

  const resultPolygon = crossSectionToPolygon(result);

  cs.delete();
  result.delete();

  return resultPolygon;
}
