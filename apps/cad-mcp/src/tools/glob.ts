/**
 * glob 도구 - 파일 목록 조회
 *
 * Story 10.1: Claude Code Glob 패턴 준수
 * - main 파일 + 모듈 목록 반환
 * - 패턴 매칭 지원 (와일드카드)
 *
 * Story 11.20: Dual-source 지원
 * - builtin/user source 구분 표시
 * - 동일 이름 시 user가 builtin 오버라이드
 */

import { existsSync, readdirSync } from 'fs';
import {
  MODULES_DIR,
  SCENE_CODE_FILE,
  BUILTIN_MODULES_DIR,
} from '../run-cad-code/constants.js';
import { type ModuleSource } from '../utils/paths.js';

export interface GlobInput {
  pattern?: string;
}

/** 파일 정보 (source 포함) */
export interface FileInfo {
  name: string;
  source: ModuleSource;
}

export interface GlobOutput {
  success: boolean;
  data: {
    files: FileInfo[];
  };
  error?: string;
}

// 패턴 최대 길이 (ReDoS 방지)
const MAX_PATTERN_LENGTH = 100;

/**
 * Simple glob pattern matching (ReDoS-safe)
 * Supports * (any characters) and ? (single character)
 * Uses iterative matching instead of regex to prevent ReDoS
 */
function matchPattern(pattern: string, filename: string): boolean {
  // 패턴 길이 제한 (ReDoS 방지)
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return false;
  }

  // Iterative matching (non-backtracking)
  let pi = 0; // pattern index
  let fi = 0; // filename index
  let starIdx = -1; // last * position in pattern
  let matchIdx = -1; // position in filename when * was matched

  while (fi < filename.length) {
    if (pi < pattern.length && (pattern[pi] === '?' || pattern[pi] === filename[fi])) {
      // Single character match or ? wildcard
      pi++;
      fi++;
    } else if (pi < pattern.length && pattern[pi] === '*') {
      // * wildcard - save state
      starIdx = pi;
      matchIdx = fi;
      pi++;
    } else if (starIdx !== -1) {
      // No match, but we have a previous * - backtrack
      pi = starIdx + 1;
      matchIdx++;
      fi = matchIdx;
    } else {
      // No match
      return false;
    }
  }

  // Check remaining pattern (should be all *)
  while (pi < pattern.length && pattern[pi] === '*') {
    pi++;
  }

  return pi === pattern.length;
}

/**
 * Get list of module files from a directory
 */
function getModulesFromDir(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.js'))
      .map(f => f.replace('.js', ''));
  } catch {
    // 디렉토리 읽기 실패 시 빈 배열 반환 (권한 문제, 경로 오류 등)
    // 에러 전파 대신 graceful degradation 선택
    return [];
  }
}

/**
 * Get list of module files with source information
 * User modules override builtin modules with the same name
 */
function getModuleList(): FileInfo[] {
  const builtinModules = getModulesFromDir(BUILTIN_MODULES_DIR);
  const userModules = getModulesFromDir(MODULES_DIR);

  // Build result with source info
  const result: FileInfo[] = [];
  const seen = new Set<string>();

  // User modules first (they override builtin)
  for (const name of userModules) {
    result.push({ name, source: 'user' });
    seen.add(name);
  }

  // Builtin modules (skip if user has same name)
  for (const name of builtinModules) {
    if (!seen.has(name)) {
      result.push({ name, source: 'builtin' });
    }
  }

  // Sort by name for consistent output
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Check if main file exists
 */
function mainExists(): boolean {
  return existsSync(SCENE_CODE_FILE);
}

/**
 * Execute glob operation
 */
export function handleGlob(input: GlobInput): GlobOutput {
  try {
    const modules = getModuleList();
    const hasMain = mainExists();

    // Build full file list (main first if exists)
    let allFiles: FileInfo[] = [];
    if (hasMain) {
      allFiles.push({ name: 'main', source: 'user' });
    }
    allFiles = allFiles.concat(modules);

    // Apply pattern filter if provided
    let resultFiles: FileInfo[];
    const pattern = input.pattern;
    if (pattern) {
      resultFiles = allFiles.filter(f => matchPattern(pattern, f.name));
    } else {
      resultFiles = allFiles;
    }

    return {
      success: true,
      data: {
        files: resultFiles,
      },
    };
  } catch (e) {
    return {
      success: false,
      data: { files: [] },
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
