/**
 * Angle Unit Utilities
 * LLM이 degree로 직관적으로 각도를 표현할 수 있도록 지원
 */

export type AngleUnit = 'degree' | 'radian';

/**
 * Degree를 Radian으로 변환
 */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Radian을 Degree로 변환
 */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * 각도를 라디안으로 정규화 (WASM 전달용)
 * @param value - 각도 값
 * @param unit - 단위 ('degree' | 'radian'), 기본값 'radian'
 * @returns 라디안 값
 */
export function normalizeAngle(
  value: number,
  unit: AngleUnit = 'radian'
): number {
  return unit === 'degree' ? degToRad(value) : value;
}
