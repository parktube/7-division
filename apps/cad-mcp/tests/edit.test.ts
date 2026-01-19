/**
 * edit 도구 테스트
 *
 * Story 10.3: edit 도구 구현
 * - 파일 부분 수정
 * - old_code → new_code 교체
 * - Read-first 경고
 * - 롤백 지원
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { handleEdit, rollbackEdit } from '../src/tools/edit.js';
import { handleRead, clearReadHistory } from '../src/tools/read.js';

// 테스트용 디렉토리 경로 (실제 환경과 동일)
const CAD_DATA_DIR = resolve(homedir(), '.ai-native-cad');
const MODULES_DIR = resolve(CAD_DATA_DIR, 'modules');

describe('edit 도구', () => {
  const testModuleName = 'edit_test_module';
  let testModulePath: string;

  beforeEach(() => {
    // 테스트용 모듈 디렉토리 생성
    if (!existsSync(MODULES_DIR)) {
      mkdirSync(MODULES_DIR, { recursive: true });
    }
    testModulePath = resolve(MODULES_DIR, `${testModuleName}.js`);

    // 테스트용 파일 생성
    writeFileSync(testModulePath, 'const x = 10;\nconst y = 20;', 'utf-8');

    // Read history 초기화
    clearReadHistory();
  });

  afterEach(() => {
    // 테스트용 파일 삭제
    if (existsSync(testModulePath)) {
      rmSync(testModulePath);
    }
  });

  describe('handleEdit', () => {
    it('should return error when file parameter is missing', () => {
      // @ts-expect-error - testing missing parameter
      const result = handleEdit({ old_code: 'x', new_code: 'y' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('file parameter is required');
    });

    it('should return error when old_code parameter is missing', () => {
      // @ts-expect-error - testing missing parameter
      const result = handleEdit({ file: testModuleName, new_code: 'y' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('old_code parameter is required');
    });

    it('should return error when new_code parameter is missing', () => {
      // @ts-expect-error - testing missing parameter
      const result = handleEdit({ file: testModuleName, old_code: 'x' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('new_code parameter is required');
    });

    it('should return error for non-existent file', () => {
      const result = handleEdit({
        file: 'nonexistent_module_xyz',
        old_code: 'x',
        new_code: 'y',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found: nonexistent_module_xyz');
    });

    it('should return error when old_code not found in file', () => {
      const result = handleEdit({
        file: testModuleName,
        old_code: 'nonexistent code',
        new_code: 'new code',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('old_code not found in file');
    });

    it('should successfully replace old_code with new_code', () => {
      // First read the file to avoid warning
      handleRead({ file: testModuleName });

      const result = handleEdit({
        file: testModuleName,
        old_code: 'const x = 10',
        new_code: 'const x = 100',
      });

      expect(result.success).toBe(true);
      expect(result.data.replaced).toBe(true);
      expect(result.data.file).toBe(testModuleName);

      // Verify file content
      const content = readFileSync(testModulePath, 'utf-8');
      expect(content).toBe('const x = 100;\nconst y = 20;');
    });

    it('should replace all occurrences (replaceAll for consistency with run_cad_code)', () => {
      // Create file with duplicate content
      writeFileSync(testModulePath, 'const a = 1;\nconst a = 1;', 'utf-8');

      const result = handleEdit({
        file: testModuleName,
        old_code: 'const a = 1',
        new_code: 'const a = 2',
      });

      expect(result.success).toBe(true);

      // Verify all occurrences are replaced
      const content = readFileSync(testModulePath, 'utf-8');
      expect(content).toBe('const a = 2;\nconst a = 2;');
    });

    it('should support empty new_code for deletion', () => {
      handleRead({ file: testModuleName });

      const result = handleEdit({
        file: testModuleName,
        old_code: 'const x = 10;\n',
        new_code: '',
      });

      expect(result.success).toBe(true);

      const content = readFileSync(testModulePath, 'utf-8');
      expect(content).toBe('const y = 20;');
    });
  });

  describe('Read-first warning', () => {
    it('should include warning when file was not read first', () => {
      const result = handleEdit({
        file: testModuleName,
        old_code: 'const x = 10',
        new_code: 'const x = 100',
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('Warning: Consider using read first to verify the file content');
    });

    it('should not include warning when file was read first', () => {
      // Read the file first
      handleRead({ file: testModuleName });

      const result = handleEdit({
        file: testModuleName,
        old_code: 'const x = 10',
        new_code: 'const x = 100',
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeUndefined();
    });
  });

  describe('rollbackEdit', () => {
    it('should restore original content', () => {
      const originalContent = 'const original = true;';
      writeFileSync(testModulePath, originalContent, 'utf-8');

      // Modify the file
      handleEdit({
        file: testModuleName,
        old_code: 'const original = true',
        new_code: 'const modified = true',
      });

      // Verify modification
      let content = readFileSync(testModulePath, 'utf-8');
      expect(content).toBe('const modified = true;');

      // Rollback
      rollbackEdit(testModuleName, originalContent);

      // Verify rollback
      content = readFileSync(testModulePath, 'utf-8');
      expect(content).toBe(originalContent);
    });
  });

  describe('UTF-8 encoding', () => {
    it('should handle Korean content correctly', () => {
      const koreanContent = '// 한글 주석\nconst 이름 = "테스트";';
      writeFileSync(testModulePath, koreanContent, 'utf-8');

      handleRead({ file: testModuleName });

      const result = handleEdit({
        file: testModuleName,
        old_code: '테스트',
        new_code: '수정됨',
      });

      expect(result.success).toBe(true);

      const content = readFileSync(testModulePath, 'utf-8');
      expect(content).toBe('// 한글 주석\nconst 이름 = "수정됨";');
    });
  });

  describe('error handling', () => {
    it('should return proper error structure', () => {
      const result = handleEdit({
        file: 'nonexistent',
        old_code: 'x',
        new_code: 'y',
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result.success).toBe(false);
      expect(result.data.file).toBe('nonexistent');
      expect(result.data.replaced).toBe(false);
    });

    it('should include warnings even on error', () => {
      // Don't read first
      const result = handleEdit({
        file: testModuleName,
        old_code: 'nonexistent code',
        new_code: 'new code',
      });

      expect(result.success).toBe(false);
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('Warning: Consider using read first to verify the file content');
    });
  });
});
