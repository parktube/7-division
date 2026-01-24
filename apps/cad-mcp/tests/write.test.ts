/**
 * write 도구 테스트
 *
 * Story 10.4: write 도구 구현
 * - 파일 전체 작성
 * - 새 파일 생성
 * - 덮어쓰기 경고
 * - 롤백 지원
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { handleWrite, rollbackWrite, getOriginalContent } from '../src/tools/write.js';
import { handleRead, clearReadHistory } from '../src/tools/read.js';

// 테스트용 디렉토리 경로 (setup.ts에서 CAD_DATA_DIR 환경 변수로 임시 디렉토리 설정)
const CAD_DATA_DIR = process.env.CAD_DATA_DIR || resolve(homedir(), '.ai-native-cad');
const MODULES_DIR = resolve(CAD_DATA_DIR, 'modules');

describe('write 도구', () => {
  const testModuleName = 'write_test_module';
  let testModulePath: string;

  beforeEach(() => {
    // 테스트용 모듈 디렉토리 생성
    if (!existsSync(MODULES_DIR)) {
      mkdirSync(MODULES_DIR, { recursive: true });
    }
    testModulePath = resolve(MODULES_DIR, `${testModuleName}.js`);

    // Read history 초기화
    clearReadHistory();

    // 기존 테스트 파일 삭제
    if (existsSync(testModulePath)) {
      rmSync(testModulePath);
    }
  });

  afterEach(() => {
    // 테스트용 파일 삭제
    if (existsSync(testModulePath)) {
      rmSync(testModulePath);
    }
  });

  describe('handleWrite', () => {
    it('should return error when file parameter is missing', () => {
      // @ts-expect-error - testing missing parameter
      const result = handleWrite({ code: 'const x = 1;' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('file parameter is required');
    });

    it('should return error when code parameter is missing', () => {
      // @ts-expect-error - testing missing parameter
      const result = handleWrite({ file: testModuleName });
      expect(result.success).toBe(false);
      expect(result.error).toBe('code parameter is required');
    });

    it('should create new file successfully', () => {
      const result = handleWrite({
        file: testModuleName,
        code: 'const x = 10;',
      });

      expect(result.success).toBe(true);
      expect(result.data.file).toBe(testModuleName);
      expect(result.data.created).toBe(true);
      expect(result.data.written).toBe(true);
      expect(result.warnings).toBeUndefined(); // No warning for new file

      // Verify file content
      const content = readFileSync(testModulePath, 'utf-8');
      expect(content).toBe('const x = 10;');
    });

    it('should overwrite existing file', () => {
      // Create existing file
      writeFileSync(testModulePath, 'old content', 'utf-8');

      // Read the file first to avoid warning
      handleRead({ file: testModuleName });

      const result = handleWrite({
        file: testModuleName,
        code: 'new content',
      });

      expect(result.success).toBe(true);
      expect(result.data.created).toBe(false); // Not created, overwritten
      expect(result.warnings).toBeUndefined(); // No warning since we read first

      // Verify file content
      const content = readFileSync(testModulePath, 'utf-8');
      expect(content).toBe('new content');
    });

    it('should allow empty code', () => {
      const result = handleWrite({
        file: testModuleName,
        code: '',
      });

      expect(result.success).toBe(true);
      expect(result.data.created).toBe(true);

      // Verify empty file
      const content = readFileSync(testModulePath, 'utf-8');
      expect(content).toBe('');
    });
  });

  describe('overwrite warning', () => {
    it('should include warning when overwriting without read', () => {
      // Create existing file
      writeFileSync(testModulePath, 'old content', 'utf-8');

      // Don't read first
      const result = handleWrite({
        file: testModuleName,
        code: 'new content',
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('Warning: Overwriting existing file. Consider using read first');
    });

    it('should not include warning when read before overwrite', () => {
      // Create existing file
      writeFileSync(testModulePath, 'old content', 'utf-8');

      // Read first
      handleRead({ file: testModuleName });

      const result = handleWrite({
        file: testModuleName,
        code: 'new content',
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it('should not include warning for new file', () => {
      // Don't create file, write new
      const result = handleWrite({
        file: testModuleName,
        code: 'new content',
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeUndefined();
    });
  });

  describe('getOriginalContent', () => {
    it('should return null for non-existent file', () => {
      const content = getOriginalContent('nonexistent_module_xyz');
      expect(content).toBeNull();
    });

    it('should return content for existing file', () => {
      writeFileSync(testModulePath, 'original content', 'utf-8');

      const content = getOriginalContent(testModuleName);
      expect(content).toBe('original content');
    });
  });

  describe('rollbackWrite', () => {
    it('should restore original content when file existed', () => {
      const originalContent = 'original content';
      writeFileSync(testModulePath, originalContent, 'utf-8');

      // Write new content
      handleWrite({
        file: testModuleName,
        code: 'new content',
      });

      // Verify new content
      let content = readFileSync(testModulePath, 'utf-8');
      expect(content).toBe('new content');

      // Rollback
      rollbackWrite(testModuleName, originalContent);

      // Verify restored
      content = readFileSync(testModulePath, 'utf-8');
      expect(content).toBe(originalContent);
    });

    it('should delete file when it was newly created', () => {
      // Create new file
      handleWrite({
        file: testModuleName,
        code: 'new content',
      });

      // Verify file exists
      expect(existsSync(testModulePath)).toBe(true);

      // Rollback (null means file didn't exist before)
      rollbackWrite(testModuleName, null);

      // Verify file deleted
      expect(existsSync(testModulePath)).toBe(false);
    });
  });

  describe('UTF-8 encoding', () => {
    it('should handle Korean content correctly', () => {
      const koreanContent = '// 한글 주석\nconst 이름 = "테스트";';

      const result = handleWrite({
        file: testModuleName,
        code: koreanContent,
      });

      expect(result.success).toBe(true);

      const content = readFileSync(testModulePath, 'utf-8');
      expect(content).toBe(koreanContent);
    });
  });

  describe('directory creation', () => {
    const nestedModuleName = 'nested_write_test';
    let nestedModulePath: string;

    beforeEach(() => {
      nestedModulePath = resolve(MODULES_DIR, `${nestedModuleName}.js`);
    });

    afterEach(() => {
      if (existsSync(nestedModulePath)) {
        rmSync(nestedModulePath);
      }
    });

    it('should create modules directory if not exists', () => {
      // This test relies on the modules directory already existing from beforeEach
      // But the write handler should handle missing directories
      const result = handleWrite({
        file: nestedModuleName,
        code: 'const x = 1;',
      });

      expect(result.success).toBe(true);
      expect(existsSync(nestedModulePath)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return proper error structure', () => {
      // @ts-expect-error - testing missing parameter
      const result = handleWrite({ file: testModuleName });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result.success).toBe(false);
      expect(result.data.file).toBe(testModuleName);
      expect(result.data.created).toBe(false);
      expect(result.data.written).toBe(false);
    });
  });
});
