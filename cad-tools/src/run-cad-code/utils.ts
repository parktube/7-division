/**
 * run_cad_code 유틸리티 함수
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { MODULES_DIR, SCENE_CODE_FILE } from './constants.js';

/**
 * 모듈 목록 조회
 */
export function getModuleList(): string[] {
  if (!existsSync(MODULES_DIR)) return [];
  return readdirSync(MODULES_DIR)
    .filter(f => f.endsWith('.js'))
    .map(f => f.replace(/\.js$/, ''));
}

/**
 * 코드에서 import 구문 추출
 * import 'module_name' 형태를 파싱
 */
export function getCodeImports(code: string): string[] {
  const importRegex = /import\s+['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match;
  while ((match = importRegex.exec(code)) !== null) {
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
  if (!existsSync(MODULES_DIR)) {
    mkdirSync(MODULES_DIR, { recursive: true });
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
  return resolve(MODULES_DIR, `${moduleName}.js`);
}

/**
 * main 코드 읽기
 */
export function readMainCode(): string {
  return readFileOrEmpty(SCENE_CODE_FILE);
}

/**
 * 코드에서 클래스 정의 추출
 */
export function extractClasses(code: string): string[] {
  const classRegex = /class\s+(\w+)/g;
  const classes: string[] = [];
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}

/**
 * 코드에서 함수 정의 추출
 */
export function extractFunctions(code: string): string[] {
  const funcRegex = /function\s+(\w+)/g;
  const functions: string[] = [];
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    functions.push(match[1]);
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
