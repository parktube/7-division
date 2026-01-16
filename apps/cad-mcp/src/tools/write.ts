/**
 * write 도구 - 파일 전체 작성
 *
 * Story 10.4: Claude Code Write 패턴 준수
 * - 파일 전체 작성
 * - 작성 후 자동 실행
 * - 기존 파일 덮어쓰기 경고
 * - 실행 실패 시 롤백
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { dirname } from 'path';
import { getFilePath, isValidFileName } from '../utils/paths.js';
import { hasBeenRead } from './read.js';

export interface WriteInput {
  file: string;
  code: string;
}

export interface WriteOutput {
  success: boolean;
  data: {
    file: string;
    created: boolean;
    written: boolean;
  };
  warnings?: string[];
  error?: string;
}

/**
 * Ensure directory exists
 */
function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Execute write operation
 *
 * Note: This handler performs file writing.
 * The actual code execution (sandbox) is handled by MCP server
 * to maintain separation of concerns.
 */
export function handleWrite(input: WriteInput): WriteOutput {
  const warnings: string[] = [];

  try {
    const { file, code } = input;

    // Validate required parameters
    if (!file) {
      return {
        success: false,
        data: { file: '', created: false, written: false },
        error: 'file parameter is required',
      };
    }

    // Path Traversal 방지: 파일명 검증
    if (!isValidFileName(file)) {
      return {
        success: false,
        data: { file, created: false, written: false },
        error: `Invalid file name: ${file}. Only alphanumeric, underscore, and hyphen allowed.`,
      };
    }

    if (code === undefined) {
      return {
        success: false,
        data: { file, created: false, written: false },
        error: 'code parameter is required',
      };
    }

    const filePath = getFilePath(file);
    const fileExists = existsSync(filePath);

    // Overwrite warning for existing files that weren't read first
    if (fileExists && !hasBeenRead(file)) {
      warnings.push('Warning: Overwriting existing file. Consider using read first');
    }

    // Ensure directory exists (for modules)
    ensureDir(filePath);

    // Write the file
    writeFileSync(filePath, code, 'utf-8');

    return {
      success: true,
      data: {
        file,
        created: !fileExists,
        written: true,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (e) {
    return {
      success: false,
      data: { file: input.file || '', created: false, written: false },
      warnings: warnings.length > 0 ? warnings : undefined,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Rollback write operation
 * - If file existed before: restore original content
 * - If file was newly created: delete the file
 */
export function rollbackWrite(file: string, originalContent: string | null): void {
  const filePath = getFilePath(file);

  if (originalContent === null) {
    // File was newly created, delete it
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } else {
    // File existed, restore original content
    writeFileSync(filePath, originalContent, 'utf-8');
  }
}

/**
 * Get original content for rollback (returns null if file doesn't exist)
 */
export function getOriginalContent(file: string): string | null {
  const filePath = getFilePath(file);
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, 'utf-8');
}
