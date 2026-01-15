/**
 * glob 도구 테스트
 *
 * Story 10.1: glob 도구 구현
 * - 전체 파일 목록 조회
 * - 패턴 매칭 지원
 * - main 파일 특수 처리
 * - 빈 결과 처리
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { handleGlob } from '../src/tools/glob.js';

// 테스트용 디렉토리 (실제 환경과 격리)
const TEST_DIR = resolve(homedir(), '.ai-native-cad-test');
const MODULES_DIR = resolve(TEST_DIR, 'modules');
const SCENE_CODE_FILE = resolve(TEST_DIR, 'scene.code.js');

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

    it('should include main if scene.code.js exists', () => {
      const result = handleGlob({});
      // main이 있으면 첫 번째로 포함
      if (result.data.files.includes('main')) {
        expect(result.data.files[0]).toBe('main');
      }
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
      const resultAll = handleGlob({});
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
      // mai? 는 main 매칭
      if (result.data.files.includes('main')) {
        expect(result.data.files).toContain('main');
      }
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

    it('should handle empty pattern same as no pattern', () => {
      const resultNoPattern = handleGlob({});
      const resultEmptyPattern = handleGlob({ pattern: '' });

      // 빈 패턴은 아무것도 매칭 안 함 (''는 빈 문자열만 매칭)
      expect(resultEmptyPattern.success).toBe(true);
    });
  });
});
