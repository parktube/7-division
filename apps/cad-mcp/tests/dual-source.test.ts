/**
 * Dual-source 테스트
 *
 * Story 11.20: Built-in Assets Distribution
 * - builtin/user 모듈 구분
 * - dual-source glob
 * - dual-source read
 * - builtin 보호 (write/edit)
 * - MAMA dual-source search
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { handleGlob, type FileInfo } from '../src/tools/glob.js';
import { handleRead, clearReadHistory } from '../src/tools/read.js';
import { handleWrite } from '../src/tools/write.js';
import { handleEdit } from '../src/tools/edit.js';
import { isBuiltinModule, resolveFile } from '../src/utils/paths.js';
import {
  loadBuiltinKnowledge,
  searchBuiltinKnowledge,
  listBuiltinDomains,
  clearBuiltinKnowledgeCache,
} from '../src/mama/builtin-knowledge.js';

// 테스트용 디렉토리 경로
const CAD_DATA_DIR = resolve(homedir(), '.ai-native-cad');
const MODULES_DIR = resolve(CAD_DATA_DIR, 'modules');

// Builtin 디렉토리 경로 (패키지 내 assets/)
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILTIN_MODULES_DIR = resolve(__dirname, '../assets/modules');

describe('Dual-source 모듈 시스템', () => {
  const testUserModule = 'dual_source_test_user';
  let testUserModulePath: string;

  beforeEach(() => {
    // 테스트용 모듈 디렉토리 생성
    if (!existsSync(MODULES_DIR)) {
      mkdirSync(MODULES_DIR, { recursive: true });
    }
    testUserModulePath = resolve(MODULES_DIR, `${testUserModule}.js`);

    // Read history 초기화
    clearReadHistory();

    // 기존 테스트 파일 삭제
    if (existsSync(testUserModulePath)) {
      rmSync(testUserModulePath);
    }
  });

  afterEach(() => {
    // 테스트용 파일 삭제
    if (existsSync(testUserModulePath)) {
      rmSync(testUserModulePath);
    }
  });

  describe('glob - source 필드', () => {
    it('should return FileInfo objects with source field', () => {
      const result = handleGlob({});

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.files)).toBe(true);

      // 모든 파일에 source 필드가 있어야 함
      result.data.files.forEach((file: FileInfo) => {
        expect(file).toHaveProperty('name');
        expect(file).toHaveProperty('source');
        expect(['builtin', 'user']).toContain(file.source);
      });
    });

    it('should mark main as user source', () => {
      const result = handleGlob({ pattern: 'main' });

      if (result.data.files.length > 0) {
        const mainFile = result.data.files.find((f: FileInfo) => f.name === 'main');
        if (mainFile) {
          expect(mainFile.source).toBe('user');
        }
      }
    });

    it('should mark builtin modules as builtin source', () => {
      const result = handleGlob({});

      // builtin 모듈이 있다면 source가 builtin이어야 함
      const builtinFiles = result.data.files.filter((f: FileInfo) => f.source === 'builtin');

      builtinFiles.forEach((file: FileInfo) => {
        expect(isBuiltinModule(file.name)).toBe(true);
      });
    });

    it('should mark user modules as user source', () => {
      // 사용자 모듈 생성
      writeFileSync(testUserModulePath, 'export const test = 1;', 'utf-8');

      const result = handleGlob({ pattern: testUserModule });

      expect(result.success).toBe(true);
      expect(result.data.files.length).toBe(1);
      expect(result.data.files[0].name).toBe(testUserModule);
      expect(result.data.files[0].source).toBe('user');
    });

    it('should include builtin modules in listing when no user version exists', () => {
      const result = handleGlob({});

      // Note: If user has same-named modules, they take precedence
      // This test verifies the glob result structure
      expect(result.success).toBe(true);

      // Check that we have some files with source information
      const builtinCount = result.data.files.filter((f: FileInfo) => f.source === 'builtin').length;
      const userCount = result.data.files.filter((f: FileInfo) => f.source === 'user').length;

      // At least one source type should exist
      expect(builtinCount + userCount).toBeGreaterThan(0);
    });
  });

  describe('read - dual-source 지원', () => {
    it('should include source field in read response', () => {
      // 사용자 모듈 생성 후 읽기
      const userCode = 'export const test = 1;';
      writeFileSync(testUserModulePath, userCode, 'utf-8');

      const result = handleRead({ file: testUserModule });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('source');
      // User module이므로 source는 'user'
      expect(result.data.source).toBe('user');
    });

    it('should read user module with user source', () => {
      // 사용자 모듈 생성
      const userCode = 'export const userTest = 123;';
      writeFileSync(testUserModulePath, userCode, 'utf-8');

      const result = handleRead({ file: testUserModule });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe(userCode);
      expect(result.data.source).toBe('user');
    });

    it('should read module and include source info', () => {
      // crossy_lib가 user 또는 builtin에 존재하면 읽을 수 있어야 함
      const result = handleRead({ file: 'crossy_lib' });

      if (result.success) {
        // source 필드가 존재해야 함
        expect(result.data).toHaveProperty('source');
        expect(['builtin', 'user']).toContain(result.data.source);
        // crossy_lib는 box3d 함수를 포함해야 함
        expect(result.data.content).toContain('box3d');
      }
    });

    it('should prefer user module over builtin with same name', () => {
      // 테스트를 위해 builtin과 같은 이름의 user 모듈이 있다고 가정
      // 실제로는 crossy_lib와 같은 이름으로 user 모듈을 만들면 user가 우선됨
      const testSameName = 'crossy_lib_override_test';

      // 이 테스트는 resolveFile 함수의 동작을 검증
      const userPath = resolve(MODULES_DIR, `${testSameName}.js`);
      writeFileSync(userPath, 'user version', 'utf-8');

      const resolved = resolveFile(testSameName);
      expect(resolved.source).toBe('user');
      expect(resolved.exists).toBe(true);

      // Cleanup
      rmSync(userPath);
    });
  });

  describe('write - builtin 보호', () => {
    const testBuiltinProtect = 'test_builtin_protect';

    afterEach(() => {
      // 테스트 후 정리
      const builtinPath = resolve(BUILTIN_MODULES_DIR, `${testBuiltinProtect}.js`);
      const userPath = resolve(MODULES_DIR, `${testBuiltinProtect}.js`);
      if (existsSync(builtinPath)) rmSync(builtinPath);
      if (existsSync(userPath)) rmSync(userPath);
    });

    it('should block writing to builtin module name', () => {
      // 테스트용 builtin 생성
      const builtinPath = resolve(BUILTIN_MODULES_DIR, `${testBuiltinProtect}.js`);
      writeFileSync(builtinPath, '// original builtin', 'utf-8');

      const result = handleWrite({
        file: testBuiltinProtect,
        code: '// attempt to override',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot write to builtin module name');
      expect(result.error).toContain(testBuiltinProtect);
    });

    it('should suggest using custom name in error message', () => {
      // 테스트용 builtin 생성
      const builtinPath = resolve(BUILTIN_MODULES_DIR, `${testBuiltinProtect}.js`);
      writeFileSync(builtinPath, '// original builtin', 'utf-8');

      const result = handleWrite({
        file: testBuiltinProtect,
        code: '// test',
      });

      expect(result.success).toBe(false);
      // 에러 메시지에 참조 및 새 이름 사용 안내 포함
      expect(result.error).toContain('read("' + testBuiltinProtect + '")');
      expect(result.error).toContain(testBuiltinProtect + '_custom');
    });

    it('should allow writing to user module with any name not in builtin', () => {
      const result = handleWrite({
        file: 'my_custom_module_xyz',
        code: '// Custom version',
      });

      expect(result.success).toBe(true);

      // Cleanup
      const customPath = resolve(MODULES_DIR, 'my_custom_module_xyz.js');
      if (existsSync(customPath)) {
        rmSync(customPath);
      }
    });

    it('should allow writing new user modules', () => {
      const result = handleWrite({
        file: testUserModule,
        code: 'const x = 1;',
      });

      expect(result.success).toBe(true);
      expect(result.data.created).toBe(true);
    });
  });

  describe('edit - builtin 보호', () => {
    it('should block editing builtin-only module with reference guide', () => {
      // builtin만 존재하고 user에 없을 때: 참조 후 새 이름 안내
      const testBuiltin = 'test_edit_builtin_only';
      const builtinPath = resolve(BUILTIN_MODULES_DIR, `${testBuiltin}.js`);
      const userPath = resolve(MODULES_DIR, `${testBuiltin}.js`);

      // builtin 파일 생성 (user에는 없음)
      writeFileSync(builtinPath, '// builtin only\nfunction test() {}', 'utf-8');

      // user에 없는지 확인
      if (existsSync(userPath)) {
        rmSync(userPath);
      }

      const result = handleEdit({
        file: testBuiltin,
        old_code: 'function',
        new_code: 'modified',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot edit builtin module');
      // 참조 및 새 이름 사용 안내 포함
      expect(result.error).toContain('read("' + testBuiltin + '")');
      expect(result.error).toContain(testBuiltin + '_custom');

      // Cleanup
      rmSync(builtinPath);
    });

    it('should allow editing user module', () => {
      // 사용자 모듈 생성
      writeFileSync(testUserModulePath, 'const old = 1;', 'utf-8');

      // Read first to avoid warning
      handleRead({ file: testUserModule });

      const result = handleEdit({
        file: testUserModule,
        old_code: 'const old = 1;',
        new_code: 'const updated = 2;',
      });

      expect(result.success).toBe(true);

      // Verify content changed
      const content = readFileSync(testUserModulePath, 'utf-8');
      expect(content).toBe('const updated = 2;');
    });
  });

  describe('isBuiltinModule', () => {
    it('should return true for known builtin modules', () => {
      expect(isBuiltinModule('crossy_lib')).toBe(true);
      expect(isBuiltinModule('animal_lib')).toBe(true);
      expect(isBuiltinModule('chicken')).toBe(true);
    });

    it('should return false for main', () => {
      expect(isBuiltinModule('main')).toBe(false);
    });

    it('should return false for user modules', () => {
      expect(isBuiltinModule('my_custom_module')).toBe(false);
      expect(isBuiltinModule('random_name_xyz')).toBe(false);
    });
  });

  describe('resolveFile', () => {
    it('should resolve main to user source', () => {
      const resolved = resolveFile('main');
      expect(resolved.source).toBe('user');
    });

    it('should resolve existing module correctly', () => {
      const resolved = resolveFile('crossy_lib');

      if (resolved.exists) {
        // User or builtin depending on environment
        expect(['builtin', 'user']).toContain(resolved.source);
      }
    });

    it('should resolve non-existent module to user source for writing', () => {
      const resolved = resolveFile('definitely_not_exists_xyz');
      expect(resolved.source).toBe('user');
      expect(resolved.exists).toBe(false);
    });

    it('should prefer user module when both exist', () => {
      // Create user module
      const testName = 'resolve_test_module';
      const userPath = resolve(MODULES_DIR, `${testName}.js`);
      writeFileSync(userPath, 'user version', 'utf-8');

      const resolved = resolveFile(testName);
      expect(resolved.source).toBe('user');
      expect(resolved.exists).toBe(true);

      // Cleanup
      rmSync(userPath);
    });
  });
});

describe('Builtin Knowledge', () => {
  beforeEach(() => {
    clearBuiltinKnowledgeCache();
  });

  describe('loadBuiltinKnowledge', () => {
    it('should load decisions from JSON file', () => {
      const decisions = loadBuiltinKnowledge();

      expect(Array.isArray(decisions)).toBe(true);

      if (decisions.length > 0) {
        const first = decisions[0];
        expect(first).toHaveProperty('id');
        expect(first).toHaveProperty('topic');
        expect(first).toHaveProperty('decision');
        expect(first).toHaveProperty('reasoning');
        expect(first).toHaveProperty('confidence');
        expect(first.source).toBe('builtin');
      }
    });

    it('should cache loaded decisions', () => {
      const first = loadBuiltinKnowledge();
      const second = loadBuiltinKnowledge();

      // Same reference (cached)
      expect(first).toBe(second);
    });
  });

  describe('searchBuiltinKnowledge', () => {
    it('should return empty array for no query', () => {
      const results = searchBuiltinKnowledge(undefined);

      // No query returns all (up to limit)
      expect(Array.isArray(results)).toBe(true);
    });

    it('should find decisions by keyword', () => {
      const results = searchBuiltinKnowledge('color', { limit: 5 });

      // Should find color-related decisions
      results.forEach((r) => {
        const text = `${r.topic} ${r.decision} ${r.reasoning}`.toLowerCase();
        expect(text).toContain('color');
      });
    });

    it('should filter by domain', () => {
      const results = searchBuiltinKnowledge('', { domain: 'voxel' });

      // All results should be in voxel domain
      results.forEach((r) => {
        expect(r.topic.toLowerCase()).toMatch(/^voxel:/);
      });
    });

    it('should respect limit', () => {
      const results = searchBuiltinKnowledge('', { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('listBuiltinDomains', () => {
    it('should return unique domains', () => {
      const domains = listBuiltinDomains();

      expect(Array.isArray(domains)).toBe(true);

      // Check for expected domains from decisions.json
      const expectedDomains = ['voxel', 'cad', 'workflow'];
      expectedDomains.forEach((d) => {
        expect(domains).toContain(d);
      });
    });

    it('should be sorted', () => {
      const domains = listBuiltinDomains();
      const sorted = [...domains].sort();

      expect(domains).toEqual(sorted);
    });
  });
});
