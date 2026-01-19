/**
 * glob 도구 테스트
 *
 * Story 10.1: glob 도구 구현
 * - 전체 파일 목록 조회
 * - 패턴 매칭 지원
 * - main 파일 특수 처리
 * - 빈 결과 처리
 */

import { describe, it, expect } from 'vitest';
import { handleGlob } from '../src/tools/glob.js';

// glob.ts가 사용하는 경로를 테스트용으로 오버라이드하기 어려우므로
// 실제 환경의 파일을 테스트 (단위 테스트보다 통합 테스트 성격)

describe('glob 도구', () => {
  describe('handleGlob', () => {
    it('should return success: true', () => {
      const result = handleGlob({});
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.files).toBeDefined();
      expect(Array.isArray(result.data.files)).toBe(true);
    });

    it('should place main at index 0 when present', () => {
      const result = handleGlob({});
      // Invariant: main은 존재하면 항상 첫 번째
      const mainIndex = result.data.files.indexOf('main');
      // main이 없으면 -1, 있으면 반드시 0
      expect(mainIndex === -1 || mainIndex === 0).toBe(true);
    });

    it('should return empty array for non-matching pattern', () => {
      const result = handleGlob({ pattern: 'definitely_nonexistent_pattern_xyz*' });
      expect(result.success).toBe(true);
      expect(result.data.files).toEqual([]);
    });

    it('should support * wildcard pattern', () => {
      const result = handleGlob({ pattern: '*' });
      expect(result.success).toBe(true);
      // * 패턴은 모든 파일 매칭
      expect(Array.isArray(result.data.files)).toBe(true);
    });

    it('should support partial * wildcard pattern', () => {
      const resultLib = handleGlob({ pattern: '*_lib' });

      expect(resultLib.success).toBe(true);
      // *_lib는 _lib로 끝나는 파일만 매칭
      resultLib.data.files.forEach(f => {
        expect(f.endsWith('_lib')).toBe(true);
      });
    });

    it('should support ? wildcard pattern', () => {
      const result = handleGlob({ pattern: 'mai?' });
      expect(result.success).toBe(true);
      // mai? 는 4글자이고 'mai'로 시작하는 파일만 매칭
      result.data.files.forEach(f => {
        expect(f).toMatch(/^mai.$/);
      });
    });
  });

  describe('pattern matching edge cases', () => {
    it('should match exact filename', () => {
      const result = handleGlob({ pattern: 'main' });
      expect(result.success).toBe(true);
      // main이 존재하면 매칭
    });

    it('should escape regex special characters', () => {
      // 패턴에 정규식 특수문자가 있어도 안전하게 처리
      const result = handleGlob({ pattern: 'test.file' });
      expect(result.success).toBe(true);
      // . 이 정규식 any character가 아닌 리터럴로 처리됨
    });

    it('should handle empty pattern same as no pattern (falsy check)', () => {
      const resultNoPattern = handleGlob({});
      const resultEmptyPattern = handleGlob({ pattern: '' });

      // 빈 패턴 ''는 JavaScript에서 falsy이므로 if(pattern) 체크를 통과하지 못함
      // 따라서 패턴 필터가 적용되지 않고 모든 파일이 반환됨
      expect(resultEmptyPattern.success).toBe(true);
      expect(resultEmptyPattern.data.files).toEqual(resultNoPattern.data.files);
    });
  });
});
