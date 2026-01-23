/**
 * run_cad_code 유틸리티 함수
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { getModulesDir, getSceneCodeFile } from './constants.js';
import { resolveFile } from '../utils/paths.js';

/**
 * 모듈 목록 조회
 */
export function getModuleList(): string[] {
  const modulesDir = getModulesDir();
  if (!existsSync(modulesDir)) return [];
  return readdirSync(modulesDir)
    .filter(f => f.endsWith('.js'))
    .map(f => f.replace(/\.js$/, ''));
}

/**
 * 코드에서 import 구문 추출
 * ES6 import 문법 지원: import 'x', import { a } from 'x', import * as x from 'x'
 * Note: 주석 내부의 import는 무시됨
 */
export function getCodeImports(code: string): string[] {
  // 먼저 블록/라인 주석 제거
  const codeWithoutComments = code
    .replace(/\/\*[\s\S]*?\*\//g, '')  // Block comments
    .replace(/\/\/.*$/gm, '');          // Line comments

  const importRegex = /import\s+(?:\{[^}]*\}\s+from\s+|(?:\*\s+(?:as\s+\w+\s+)?from\s+)?)?['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match;
  while ((match = importRegex.exec(codeWithoutComments)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/**
 * 부모 디렉토리 생성
 */
export function ensureParentDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 모듈 디렉토리 생성
 */
export function ensureModulesDir(): void {
  const modulesDir = getModulesDir();
  if (!existsSync(modulesDir)) {
    mkdirSync(modulesDir, { recursive: true });
  }
}

/**
 * 파일 읽기 (없으면 빈 문자열)
 */
export function readFileOrEmpty(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
}

/**
 * 모듈 경로 조회
 */
export function getModulePath(moduleName: string): string {
  return resolve(getModulesDir(), `${moduleName}.js`);
}

/**
 * main 코드 읽기
 */
export function readMainCode(): string {
  return readFileOrEmpty(getSceneCodeFile());
}

/**
 * 코드에서 클래스 정의 추출
 * Matches: class Foo, export class Foo, const X = class Y
 */
export function extractClasses(code: string): string[] {
  const classRegex = /(?:export\s+)?(?:class\s+(\w+)|const\s+\w+\s*=\s*class\s+(\w+))/g;
  const classes: string[] = [];
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    const name = match[1] || match[2];
    if (name) classes.push(name);
  }
  return classes;
}

/**
 * 코드에서 함수 정의 추출
 * Matches: function foo, async function foo, export function foo,
 *          const bar = () => {}, const baz = async () => {}, const qux = function
 */
export function extractFunctions(code: string): string[] {
  const funcRegex = /(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g;
  const functions: string[] = [];
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    const name = match[1] || match[2];
    if (name) functions.push(name);
  }
  return functions;
}

/**
 * 코드 라인 수 계산
 */
export function countLines(code: string): number {
  if (!code) return 0;
  return code.split('\n').length;
}

/**
 * 코드의 특정 라인 범위 추출
 * @param code 전체 코드
 * @param start 시작 라인 (1부터)
 * @param end 끝 라인 (포함)
 */
export function extractLines(code: string, start: number, end: number): string {
  const lines = code.split('\n');
  const startIdx = Math.max(0, start - 1);
  const endIdx = Math.min(lines.length, end);
  return lines.slice(startIdx, endIdx).join('\n');
}

/**
 * Import 전처리 결과
 */
export interface PreprocessResult {
  code: string;
  importedModules: string[];
  errors: string[];
}

/**
 * 코드에서 import 구문을 모듈 코드로 치환
 * ES6 import 문법 지원: import 'x', import { a } from 'x', import * as x from 'x'
 */
export function preprocessCode(
  code: string,
  importedModules: Set<string> = new Set()
): PreprocessResult {
  const errors: string[] = [];
  const newlyImported: string[] = [];

  const importPattern = /import\s+(?:\{[^}]*\}\s+from\s+|(?:\*\s+(?:as\s+\w+\s+)?from\s+)?)?['"]([^'"]+)['"]\s*;?/g;

  const processedCode = code.replace(importPattern, (_match, moduleName) => {
    if (importedModules.has(moduleName)) {
      return `// [import] '${moduleName}' already loaded`;
    }

    // Dual-source: user modules 우선, 없으면 builtin 확인
    let resolved;
    try {
      resolved = resolveFile(moduleName);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      errors.push(`could not resolve module '${moduleName}': ${errMsg}`);
      return `// [import] ERROR: '${moduleName}' resolve failed`;
    }

    if (!resolved.exists) {
      errors.push(`could not load module '${moduleName}'`);
      return `// [import] ERROR: '${moduleName}' not found`;
    }

    // Wrap readFileSync in try/catch to handle race condition (file deleted after exists check)
    let moduleCode: string;
    try {
      moduleCode = readFileSync(resolved.path, 'utf-8');
    } catch (readError) {
      const errMsg = readError instanceof Error ? readError.message : String(readError);
      errors.push(`could not read module '${moduleName}': ${errMsg}`);
      return `// [import] ERROR: '${moduleName}' read failed`;
    }
    importedModules.add(moduleName);
    newlyImported.push(moduleName);

    // 재귀적으로 중첩 import 처리
    const nested = preprocessCode(moduleCode, importedModules);
    errors.push(...nested.errors);
    newlyImported.push(...nested.importedModules);

    return `// ===== [import] ${moduleName} =====\n${nested.code}\n// ===== [/import] ${moduleName} =====\n`;
  });

  return {
    code: processedCode,
    importedModules: newlyImported,
    errors,
  };
}
