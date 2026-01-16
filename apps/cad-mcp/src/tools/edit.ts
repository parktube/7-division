/**
 * edit 도구 - 파일 부분 수정
 *
 * Story 10.3: Claude Code Edit 패턴 준수
 * - old_code → new_code 교체
 * - 수정 후 자동 실행
 * - 실행 실패 시 롤백
 * - Read-first 경고
 *
 * Note: Race Condition 고려사항
 * - read → write 사이 시간 차에서 동시 요청 시 데이터 손실 가능
 * - CAD-MCP는 단일 사용자 로컬 도구로 동시 요청이 드물어 허용 가능한 리스크
 * - MCP 서버 레벨에서 실행 실패 시 rollbackEdit으로 복구
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { getFilePath, isValidFileName } from '../utils/paths.js';
import { hasBeenRead } from './read.js';

export interface EditInput {
  file: string;
  old_code: string;
  new_code: string;
}

export interface EditOutput {
  success: boolean;
  data: {
    file: string;
    replaced: boolean;
    updatedCode?: string;
  };
  warnings?: string[];
  error?: string;
}

/**
 * Read file content
 */
function readFileContent(file: string): string | null {
  const filePath = getFilePath(file);
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, 'utf-8');
}

/**
 * Write file content
 */
function writeFileContent(file: string, content: string): void {
  const filePath = getFilePath(file);
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Execute edit operation
 *
 * Note: This handler performs file modification.
 * The actual code execution (sandbox) is handled by MCP server
 * to maintain separation of concerns.
 */
export function handleEdit(input: EditInput): EditOutput {
  const warnings: string[] = [];

  try {
    const { file, old_code, new_code } = input;

    // Validate required parameters
    if (!file) {
      return {
        success: false,
        data: { file: '', replaced: false },
        error: 'file parameter is required',
      };
    }

    // Path Traversal 방지: 파일명 검증
    if (!isValidFileName(file)) {
      return {
        success: false,
        data: { file, replaced: false },
        error: `Invalid file name: ${file}. Only alphanumeric, underscore, and hyphen allowed.`,
      };
    }

    if (old_code === undefined) {
      return {
        success: false,
        data: { file, replaced: false },
        error: 'old_code parameter is required',
      };
    }

    if (new_code === undefined) {
      return {
        success: false,
        data: { file, replaced: false },
        error: 'new_code parameter is required',
      };
    }

    // Read-first warning check
    if (!hasBeenRead(file)) {
      warnings.push('Warning: Consider using read first to verify the file content');
    }

    // Read current file content
    const currentContent = readFileContent(file);
    if (currentContent === null) {
      return {
        success: false,
        data: { file, replaced: false },
        error: `File not found: ${file}`,
      };
    }

    // Check if old_code exists in file
    if (!currentContent.includes(old_code)) {
      return {
        success: false,
        data: { file, replaced: false },
        warnings: warnings.length > 0 ? warnings : undefined,
        error: 'old_code not found in file',
      };
    }

    // Replace old_code with new_code (first occurrence only)
    const updatedContent = currentContent.replace(old_code, new_code);

    // Write the modified content
    writeFileContent(file, updatedContent);

    return {
      success: true,
      data: {
        file,
        replaced: true,
        updatedCode: updatedContent,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (e) {
    return {
      success: false,
      data: { file: input.file || '', replaced: false },
      warnings: warnings.length > 0 ? warnings : undefined,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Rollback edit by restoring original content
 */
export function rollbackEdit(file: string, originalContent: string): void {
  writeFileContent(file, originalContent);
}
