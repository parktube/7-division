/**
 * 공통 경로 유틸리티
 *
 * DRY 원칙: glob, read, edit, write, lsp 도구에서 공유
 * - getFilePath: 파일명 → 실제 경로 변환
 * - isValidFileName: Path Traversal 방지
 *
 * Story 11.20: Dual-source 지원
 * - builtin: 패키지 내장 모듈 (읽기 전용)
 * - user: 사용자 모듈 (읽기/쓰기)
 */

import { resolve } from 'path';
import { existsSync } from 'fs';
import {
  MODULES_DIR,
  SCENE_CODE_FILE,
  BUILTIN_MODULES_DIR,
} from '../run-cad-code/constants.js';

// 파일명 허용 패턴 (Path Traversal 방지)
// 영문, 숫자, 언더스코어, 하이픈만 허용
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** 모듈 소스 타입 */
export type ModuleSource = 'builtin' | 'user';

/** 파일 해석 결과 */
export interface ResolvedFile {
  path: string;
  source: ModuleSource;
  exists: boolean;
}

/**
 * Validate file name to prevent path traversal attacks
 * @returns true if safe, false if potentially malicious
 */
export function isValidFileName(file: string): boolean {
  if (file === 'main') return true;
  if (!file || file.length > 100) return false;
  return SAFE_FILENAME_PATTERN.test(file);
}

/**
 * Get builtin module path
 */
export function getBuiltinPath(file: string): string {
  return resolve(BUILTIN_MODULES_DIR, `${file}.js`);
}

/**
 * Get user module path
 */
export function getUserPath(file: string): string {
  return resolve(MODULES_DIR, `${file}.js`);
}

/**
 * Check if a module exists as builtin
 */
export function isBuiltinModule(file: string): boolean {
  if (file === 'main') return false;
  const builtinPath = getBuiltinPath(file);
  return existsSync(builtinPath);
}

/**
 * Resolve file to its actual path with source information
 * Priority: user > builtin (사용자 모듈이 builtin을 오버라이드 가능)
 *
 * @returns ResolvedFile with path, source, and exists flag
 */
export function resolveFile(file: string): ResolvedFile {
  if (!isValidFileName(file)) {
    throw new Error(`Invalid file name: '${file}'. Only alphanumeric, underscore, and hyphen characters allowed.`);
  }

  // main은 항상 user source
  if (file === 'main') {
    return {
      path: SCENE_CODE_FILE,
      source: 'user',
      exists: existsSync(SCENE_CODE_FILE),
    };
  }

  const userPath = getUserPath(file);
  const builtinPath = getBuiltinPath(file);

  // 사용자 모듈이 있으면 우선
  if (existsSync(userPath)) {
    return {
      path: userPath,
      source: 'user',
      exists: true,
    };
  }

  // builtin 모듈 확인
  if (existsSync(builtinPath)) {
    return {
      path: builtinPath,
      source: 'builtin',
      exists: true,
    };
  }

  // 둘 다 없으면 user 경로 반환 (쓰기용)
  return {
    path: userPath,
    source: 'user',
    exists: false,
  };
}

/**
 * Get file path for given file name (backward compatibility)
 * - 'main' → scene.code.js
 * - other → user modules/{name}.js (쓰기용)
 *
 * @throws Error if file name is invalid (Path Traversal prevention)
 */
export function getFilePath(file: string): string {
  // Defensive validation: always check file name validity
  if (!isValidFileName(file)) {
    throw new Error(`Invalid file name: '${file}'. Only alphanumeric, underscore, and hyphen characters allowed.`);
  }

  if (file === 'main') {
    return SCENE_CODE_FILE;
  }
  return resolve(MODULES_DIR, `${file}.js`);
}
