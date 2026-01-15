/**
 * glob 도구 - 파일 목록 조회
 *
 * Story 10.1: Claude Code Glob 패턴 준수
 * - main 파일 + 모듈 목록 반환
 * - 패턴 매칭 지원 (와일드카드)
 */

import { existsSync, readdirSync } from 'fs';
import { MODULES_DIR, SCENE_CODE_FILE } from '../run-cad-code/constants.js';

export interface GlobInput {
  pattern?: string;
}

export interface GlobOutput {
  success: boolean;
  data: {
    files: string[];
  };
  error?: string;
}

/**
 * Simple glob pattern matching
 * Supports * (any characters) and ? (single character)
 */
function matchPattern(pattern: string, filename: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except * and ?
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`).test(filename);
}

/**
 * Get list of module files
 */
function getModuleList(): string[] {
  if (!existsSync(MODULES_DIR)) {
    return [];
  }
  try {
    return readdirSync(MODULES_DIR)
      .filter(f => f.endsWith('.js'))
      .map(f => f.replace('.js', ''));
  } catch {
    return [];
  }
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
    let allFiles: string[] = [];
    if (hasMain) {
      allFiles.push('main');
    }
    allFiles = allFiles.concat(modules);

    // Apply pattern filter if provided
    let resultFiles: string[];
    if (input.pattern) {
      resultFiles = allFiles.filter(f => matchPattern(input.pattern!, f));
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
