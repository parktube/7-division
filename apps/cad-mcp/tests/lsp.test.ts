/**
 * lsp 도구 테스트
 *
 * Story 10.5: lsp 도구 구현
 * - built-in 함수 탐색 (domains, describe, schema)
 * - 모듈 심볼 추출 (symbols)
 * - 에러 처리
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { handleLsp } from '../src/tools/lsp.js';
import { DOMAINS, FUNCTION_SIGNATURES } from '../src/schema.js';

// 테스트용 디렉토리 경로 (실제 환경과 동일)
const CAD_DATA_DIR = resolve(homedir(), '.ai-native-cad');
const MODULES_DIR = resolve(CAD_DATA_DIR, 'modules');
const SCENE_CODE_FILE = resolve(CAD_DATA_DIR, 'scene.code.js');

describe('lsp 도구', () => {
  const testModuleName = 'lsp_test_module';
  let testModulePath: string;

  beforeEach(() => {
    // 테스트용 모듈 디렉토리 생성
    if (!existsSync(MODULES_DIR)) {
      mkdirSync(MODULES_DIR, { recursive: true });
    }
    testModulePath = resolve(MODULES_DIR, `${testModuleName}.js`);

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

  describe('domains operation', () => {
    it('should return list of domains (AC1)', () => {
      const result = handleLsp({ operation: 'domains' });

      expect(result.success).toBe(true);
      expect(result.data.domains).toBeDefined();
      expect(result.data.domains).toContain('primitives');
      expect(result.data.domains).toContain('transforms');
      expect(result.data.domains).toContain('style');
      expect(result.data.domains).toContain('groups');
      expect(result.data.domains).toContain('query');
      expect(result.data.domains).toContain('boolean');
      expect(result.data.domains).toContain('geometry');
      expect(result.data.domains).toContain('utility');
    });

    it('should match DOMAINS keys', () => {
      const result = handleLsp({ operation: 'domains' });

      expect(result.success).toBe(true);
      expect(result.data.domains).toEqual(Object.keys(DOMAINS));
    });
  });

  describe('describe operation', () => {
    it('should return function signatures for domain (AC2)', () => {
      const result = handleLsp({ operation: 'describe', domain: 'primitives' });

      expect(result.success).toBe(true);
      expect(result.data.functions).toBeDefined();
      expect(result.data.functions!.length).toBeGreaterThan(0);

      // Check that drawCircle is included
      const drawCircle = result.data.functions!.find(f => f.name === 'drawCircle');
      expect(drawCircle).toBeDefined();
      expect(drawCircle!.signature).toContain('drawCircle');
      expect(drawCircle!.description).toBeDefined();
    });

    it('should return error for missing domain (AC7)', () => {
      const result = handleLsp({ operation: 'describe' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('domain parameter is required for describe operation');
    });

    it('should return error for unknown domain (AC7)', () => {
      const result = handleLsp({ operation: 'describe', domain: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown domain: nonexistent');
    });

    it('should include all functions for each domain', () => {
      for (const domainName of Object.keys(DOMAINS)) {
        const result = handleLsp({ operation: 'describe', domain: domainName });

        expect(result.success).toBe(true);
        expect(result.data.functions!.length).toBe(DOMAINS[domainName as keyof typeof DOMAINS].length);
      }
    });
  });

  describe('schema operation', () => {
    it('should return detailed schema for function (AC3)', () => {
      const result = handleLsp({ operation: 'schema', name: 'drawCircle' });

      expect(result.success).toBe(true);
      expect(result.data.schema).toBeDefined();
      expect(result.data.schema!.name).toBe('drawCircle');
      expect(result.data.schema!.signature).toBe(FUNCTION_SIGNATURES.drawCircle.signature);
      expect(result.data.schema!.description).toBe(FUNCTION_SIGNATURES.drawCircle.description);
      expect(result.data.schema!.example).toBe(FUNCTION_SIGNATURES.drawCircle.example);
    });

    it('should return error for missing name', () => {
      const result = handleLsp({ operation: 'schema' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('name parameter is required for schema operation');
    });

    it('should return error for unknown function (AC8)', () => {
      const result = handleLsp({ operation: 'schema', name: 'unknownFunc' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown function: unknownFunc');
    });
  });

  describe('symbols operation', () => {
    it('should extract class symbols from module (AC4)', () => {
      const moduleCode = `
class House {
  constructor(name, x, y) {
    this.name = name;
    this.x = x;
    this.y = y;
  }
  build() {
    drawRect(this.name + '_wall', 0, 0, 40, 30);
  }
  setColor(color) {
    setFill(this.name, color);
  }
}`;
      writeFileSync(testModulePath, moduleCode, 'utf-8');

      const result = handleLsp({ operation: 'symbols', file: testModuleName });

      expect(result.success).toBe(true);
      expect(result.data.symbols).toBeDefined();

      const houseSymbol = result.data.symbols!.find(s => s.name === 'House');
      expect(houseSymbol).toBeDefined();
      expect(houseSymbol!.kind).toBe('class');
      expect(houseSymbol!.signature).toBe('constructor(name, x, y)');
      expect(houseSymbol!.methods).toContain('build');
      expect(houseSymbol!.methods).toContain('setColor');
    });

    it('should extract function symbols (AC5)', () => {
      const moduleCode = `
function createHouse(name, x, y) {
  return new House(name, x, y);
}

function drawBackground() {
  drawRect('bg', 0, 0, 100, 100);
}`;
      writeFileSync(testModulePath, moduleCode, 'utf-8');

      const result = handleLsp({ operation: 'symbols', file: testModuleName });

      expect(result.success).toBe(true);

      const createHouse = result.data.symbols!.find(s => s.name === 'createHouse');
      expect(createHouse).toBeDefined();
      expect(createHouse!.kind).toBe('function');
      expect(createHouse!.signature).toContain('createHouse(name, x, y)');

      const drawBackground = result.data.symbols!.find(s => s.name === 'drawBackground');
      expect(drawBackground).toBeDefined();
      expect(drawBackground!.kind).toBe('function');
    });

    it('should extract const symbols (AC5)', () => {
      const moduleCode = `
const DEFAULT_HEIGHT = 50;
const DEFAULT_WIDTH = 100;
let counter = 0;
var globalConfig = { debug: true };`;
      writeFileSync(testModulePath, moduleCode, 'utf-8');

      const result = handleLsp({ operation: 'symbols', file: testModuleName });

      expect(result.success).toBe(true);

      const defaultHeight = result.data.symbols!.find(s => s.name === 'DEFAULT_HEIGHT');
      expect(defaultHeight).toBeDefined();
      expect(defaultHeight!.kind).toBe('const');

      const counter = result.data.symbols!.find(s => s.name === 'counter');
      expect(counter).toBeDefined();
      expect(counter!.kind).toBe('let');

      const globalConfig = result.data.symbols!.find(s => s.name === 'globalConfig');
      expect(globalConfig).toBeDefined();
      expect(globalConfig!.kind).toBe('var');
    });

    it('should extract symbols from main file (AC6)', () => {
      // Only test if main file exists
      if (existsSync(SCENE_CODE_FILE)) {
        const result = handleLsp({ operation: 'symbols', file: 'main' });
        expect(result.success).toBe(true);
        expect(result.data.symbols).toBeDefined();
      }
    });

    it('should return error for missing file parameter', () => {
      const result = handleLsp({ operation: 'symbols' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('file parameter is required for symbols operation');
    });

    it('should return error for non-existent file (AC9)', () => {
      const result = handleLsp({ operation: 'symbols', file: 'nonexistent_module_xyz' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found: nonexistent_module_xyz');
    });

    it('should handle arrow functions as function symbols', () => {
      const moduleCode = `
const add = (a, b) => a + b;
const multiply = (x, y) => {
  return x * y;
};`;
      writeFileSync(testModulePath, moduleCode, 'utf-8');

      const result = handleLsp({ operation: 'symbols', file: testModuleName });

      expect(result.success).toBe(true);

      const add = result.data.symbols!.find(s => s.name === 'add');
      expect(add).toBeDefined();
      expect(add!.kind).toBe('function');

      const multiply = result.data.symbols!.find(s => s.name === 'multiply');
      expect(multiply).toBeDefined();
      expect(multiply!.kind).toBe('function');
    });

    it('should handle mixed symbols', () => {
      const moduleCode = `
class Tree {
  constructor(name, x, y, height) {
    this.name = name;
  }
  draw() {}
}

function createTree(name, x, y) {
  return new Tree(name, x, y, 50);
}

const DEFAULT_HEIGHT = 50;
const getHeight = () => DEFAULT_HEIGHT;`;
      writeFileSync(testModulePath, moduleCode, 'utf-8');

      const result = handleLsp({ operation: 'symbols', file: testModuleName });

      expect(result.success).toBe(true);

      // Should have 4 symbols: Tree (class), createTree (function), DEFAULT_HEIGHT (const), getHeight (function)
      expect(result.data.symbols!.length).toBeGreaterThanOrEqual(4);

      const tree = result.data.symbols!.find(s => s.name === 'Tree');
      expect(tree).toBeDefined();
      expect(tree!.kind).toBe('class');

      const createTreeFn = result.data.symbols!.find(s => s.name === 'createTree');
      expect(createTreeFn).toBeDefined();
      expect(createTreeFn!.kind).toBe('function');

      const defaultHeight = result.data.symbols!.find(s => s.name === 'DEFAULT_HEIGHT');
      expect(defaultHeight).toBeDefined();
      expect(defaultHeight!.kind).toBe('const');

      const getHeight = result.data.symbols!.find(s => s.name === 'getHeight');
      expect(getHeight).toBeDefined();
      expect(getHeight!.kind).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should return error for missing operation', () => {
      // @ts-expect-error - testing missing parameter
      const result = handleLsp({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('operation parameter is required');
    });

    it('should return error for unknown operation', () => {
      // @ts-expect-error - testing invalid operation
      const result = handleLsp({ operation: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown operation: invalid');
    });
  });

  describe('UTF-8 encoding', () => {
    it('should handle Korean content in modules', () => {
      const moduleCode = `
// 한글 주석
class 집 {
  constructor(이름) {
    this.이름 = 이름;
  }
  짓기() {}
}

const 기본높이 = 50;`;
      writeFileSync(testModulePath, moduleCode, 'utf-8');

      const result = handleLsp({ operation: 'symbols', file: testModuleName });

      expect(result.success).toBe(true);

      // Note: Korean identifiers should be extracted
      const houseClass = result.data.symbols!.find(s => s.name === '집');
      expect(houseClass).toBeDefined();
      expect(houseClass!.kind).toBe('class');
    });
  });
});
