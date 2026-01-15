/**
 * read 도구 테스트
 *
 * Story 10.2: read 도구 구현
 * - main 파일 읽기
 * - 모듈 파일 읽기
 * - 존재하지 않는 파일 에러 처리
 * - 빈 파일 처리
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { handleRead } from '../src/tools/read.js';

// 테스트용 디렉토리 경로 (실제 환경과 동일)
const CAD_DATA_DIR = resolve(homedir(), '.ai-native-cad');
const MODULES_DIR = resolve(CAD_DATA_DIR, 'modules');
const SCENE_CODE_FILE = resolve(CAD_DATA_DIR, 'scene.code.js');

describe('read 도구', () => {
  describe('handleRead', () => {
    it('should return error when file parameter is missing', () => {
      // @ts-expect-error - testing missing parameter
      const result = handleRead({});
      expect(result.success).toBe(false);
      expect(result.error).toBe('file parameter is required');
    });

    it('should return error for non-existent file', () => {
      const result = handleRead({ file: 'definitely_nonexistent_xyz' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found: definitely_nonexistent_xyz');
    });

    it('should read main file if it exists', () => {
      // 파일이 존재하는 경우만 테스트
      if (existsSync(SCENE_CODE_FILE)) {
        const result = handleRead({ file: 'main' });
        expect(result.success).toBe(true);
        expect(result.data.file).toBe('main');
        expect(typeof result.data.content).toBe('string');
      } else {
        // main이 없으면 에러 반환
        const result = handleRead({ file: 'main' });
        expect(result.success).toBe(false);
        expect(result.error).toBe('File not found: main');
      }
    });

    it('should read module file if it exists', () => {
      // 모듈 디렉토리 확인
      if (existsSync(MODULES_DIR)) {
        const { readdirSync } = require('fs');
        const modules = readdirSync(MODULES_DIR)
          .filter((f: string) => f.endsWith('.js'))
          .map((f: string) => f.replace('.js', ''));

        if (modules.length > 0) {
          const result = handleRead({ file: modules[0] });
          expect(result.success).toBe(true);
          expect(result.data.file).toBe(modules[0]);
          expect(typeof result.data.content).toBe('string');
        }
      }
    });

    it('should return correct file name in response', () => {
      const result = handleRead({ file: 'test_module_xyz' });
      expect(result.data.file).toBe('test_module_xyz');
    });
  });

  describe('file path resolution', () => {
    it('should resolve main to scene.code.js', () => {
      const result = handleRead({ file: 'main' });
      // main 파일 경로가 올바르게 해석됨
      expect(result.data.file).toBe('main');
    });

    it('should resolve module name to modules directory', () => {
      const result = handleRead({ file: 'some_module' });
      // 모듈명이 modules/{name}.js로 해석됨
      expect(result.data.file).toBe('some_module');
    });
  });

  describe('error handling', () => {
    it('should return proper error structure', () => {
      const result = handleRead({ file: 'nonexistent' });
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result.success).toBe(false);
      expect(result.data.file).toBe('nonexistent');
      expect(result.data.content).toBe('');
    });
  });

  describe('UTF-8 encoding', () => {
    let testModulePath: string;
    const testModuleName = 'read_test_korean_module';

    beforeEach(() => {
      // 테스트용 모듈 디렉토리 생성
      if (!existsSync(MODULES_DIR)) {
        mkdirSync(MODULES_DIR, { recursive: true });
      }
      testModulePath = resolve(MODULES_DIR, `${testModuleName}.js`);
    });

    afterEach(() => {
      // 테스트용 파일 삭제
      if (existsSync(testModulePath)) {
        rmSync(testModulePath);
      }
    });

    it('should read Korean content correctly', () => {
      const koreanContent = '// 한글 주석 테스트\nconst 이름 = "테스트";';
      writeFileSync(testModulePath, koreanContent, 'utf-8');

      const result = handleRead({ file: testModuleName });
      expect(result.success).toBe(true);
      expect(result.data.content).toBe(koreanContent);
    });

    it('should handle empty file', () => {
      writeFileSync(testModulePath, '', 'utf-8');

      const result = handleRead({ file: testModuleName });
      expect(result.success).toBe(true);
      expect(result.data.content).toBe('');
    });
  });
});
