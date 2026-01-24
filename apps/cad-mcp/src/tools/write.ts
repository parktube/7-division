/**
 * write 도구 - 파일 전체 작성
 *
 * Story 10.4: Claude Code Write 패턴 준수
 * - 파일 전체 작성
 * - 작성 후 자동 실행
 * - 기존 파일 덮어쓰기 경고
 * - 실행 실패 시 롤백
 *
 * Story 11.20: Dual-source 지원
 * - builtin 모듈 수정 차단
 * - 사용자 모듈만 쓰기 가능
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { dirname } from 'path';
import { getFilePath, isValidFileName, isBuiltinModule } from '../utils/paths.js';
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

    // Builtin 모듈 보호: 같은 이름으로 쓰기 차단
    // 참조 후 다른 이름으로 저장하도록 안내
    if (isBuiltinModule(file)) {
      return {
        success: false,
        data: { file, created: false, written: false },
        error: `Cannot write to builtin module name "${file}". ` +
          `To customize: read("${file}") to reference the original, ` +
          `then write("${file}_custom", <your code>) with a new name.`,
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
      data: { file: input?.file ?? '', created: false, written: false },
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
  try {
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
  } catch {
    // Rollback failure is non-fatal - log and continue
    // Invalid file name during rollback means the original write also failed validation
  }
}

/**
 * Get original content for rollback (returns null if file doesn't exist or invalid)
 */
export function getOriginalContent(file: string): string | null {
  try {
    const filePath = getFilePath(file);
    if (!existsSync(filePath)) {
      return null;
    }
    return readFileSync(filePath, 'utf-8');
  } catch {
    // Invalid file name or read error - treat as non-existent
    return null;
  }
}
