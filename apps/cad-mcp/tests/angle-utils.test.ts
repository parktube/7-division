import { describe, it, expect } from 'vitest';
import { degToRad, radToDeg, normalizeAngle } from '../src/angle-utils.js';

describe('angle-utils', () => {
  describe('degToRad', () => {
    it('should convert 0 degrees to 0 radians', () => {
      expect(degToRad(0)).toBe(0);
    });

    it('should convert 90 degrees to PI/2 radians', () => {
      expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
    });

    it('should convert 180 degrees to PI radians', () => {
      expect(degToRad(180)).toBeCloseTo(Math.PI);
    });

    it('should convert 360 degrees to 2*PI radians', () => {
      expect(degToRad(360)).toBeCloseTo(2 * Math.PI);
    });

    it('should handle negative degrees', () => {
      expect(degToRad(-90)).toBeCloseTo(-Math.PI / 2);
    });
  });

  describe('radToDeg', () => {
    it('should convert 0 radians to 0 degrees', () => {
      expect(radToDeg(0)).toBe(0);
    });

    it('should convert PI/2 radians to 90 degrees', () => {
      expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
    });

    it('should convert PI radians to 180 degrees', () => {
      expect(radToDeg(Math.PI)).toBeCloseTo(180);
    });

    it('should convert 2*PI radians to 360 degrees', () => {
      expect(radToDeg(2 * Math.PI)).toBeCloseTo(360);
    });
  });

  describe('normalizeAngle', () => {
    it('should return radian as-is when unit is radian', () => {
      expect(normalizeAngle(Math.PI / 2, 'radian')).toBe(Math.PI / 2);
    });

    it('should convert degree to radian when unit is degree', () => {
      expect(normalizeAngle(90, 'degree')).toBeCloseTo(Math.PI / 2);
    });

    it('should default to radian when unit is not specified', () => {
      expect(normalizeAngle(Math.PI / 2)).toBe(Math.PI / 2);
    });

    it('should handle zero angle', () => {
      expect(normalizeAngle(0, 'degree')).toBe(0);
      expect(normalizeAngle(0, 'radian')).toBe(0);
    });
  });
});
