/**
 * read 도구 - 파일 읽기
 *
 * Story 10.2: Claude Code Read 패턴 준수
 * - main 파일 읽기
 * - 모듈 파일 읽기
 * - edit/write 전 반드시 확인 유도
 *
 * Story 10.3: Read-first 추적
 * - 세션 내 read 호출 기록
 * - edit 시 경고 메시지 생성용
 */

import { existsSync, readFileSync } from 'fs';
import { MODULES_DIR, SCENE_CODE_FILE } from '../run-cad-code/constants.js';
import { resolve } from 'path';

/**
 * Read-first 추적 시스템
 * 세션 내에서 read된 파일 목록 관리
 */
const readHistory = new Set<string>();

/**
 * Track that a file has been read
 */
export function trackRead(file: string): void {
  readHistory.add(file);
}

/**
 * Check if a file has been read in this session
 */
export function hasBeenRead(file: string): boolean {
  return readHistory.has(file);
}

/**
 * Clear read history (for testing)
 */
export function clearReadHistory(): void {
  readHistory.clear();
}

export interface ReadInput {
  file: string;
}

export interface ReadOutput {
  success: boolean;
  data: {
    file: string;
    content: string;
  };
  error?: string;
}

/**
 * Get file path for given file name
 */
function getFilePath(file: string): string {
  if (file === 'main') {
    return SCENE_CODE_FILE;
  }
  return resolve(MODULES_DIR, `${file}.js`);
}

/**
 * Execute read operation
 */
export function handleRead(input: ReadInput): ReadOutput {
  try {
    const { file } = input;

    if (!file) {
      return {
        success: false,
        data: { file: '', content: '' },
        error: 'file parameter is required',
      };
    }

    const filePath = getFilePath(file);

    // Check file existence
    if (!existsSync(filePath)) {
      return {
        success: false,
        data: { file, content: '' },
        error: `File not found: ${file}`,
      };
    }

    // Read file content (UTF-8)
    const content = readFileSync(filePath, 'utf-8');

    // Track read for Read-first pattern
    trackRead(file);

    return {
      success: true,
      data: {
        file,
        content,
      },
    };
  } catch (e) {
    return {
      success: false,
      data: { file: input.file || '', content: '' },
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
