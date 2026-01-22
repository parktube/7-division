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
 *
 * Story 11.20: Dual-source 지원
 * - builtin/user 모듈 모두 읽기 가능
 * - 결과에 source 정보 포함
 */

import { readFileSync } from 'fs';
import { resolveFile, isValidFileName, type ModuleSource } from '../utils/paths.js';

// Re-export for backward compatibility (edit.ts, write.ts, lsp.ts에서 import)
export { isValidFileName } from '../utils/paths.js';

/**
 * Read-first 추적 시스템
 * 세션 내에서 read된 파일 목록 관리
 *
 * Note: 모듈 레벨 상태는 의도적 설계
 * CAD-MCP는 로컬 단일 사용자용으로, 세션 간 공유가 필요함
 * (같은 프로세스에서 여러 도구 호출이 Read-first 패턴 추적에 활용)
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
    source: ModuleSource;
  };
  error?: string;
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
        data: { file: '', content: '', source: 'user' },
        error: 'file parameter is required',
      };
    }

    // Path Traversal 방지: 파일명 검증
    if (!isValidFileName(file)) {
      return {
        success: false,
        data: { file, content: '', source: 'user' },
        error: `Invalid file name: ${file}. Only alphanumeric, underscore, and hyphen allowed.`,
      };
    }

    // Resolve file with dual-source support
    const resolved = resolveFile(file);

    // Check file existence
    if (!resolved.exists) {
      return {
        success: false,
        data: { file, content: '', source: 'user' },
        error: `File not found: ${file}`,
      };
    }

    // Read file content (UTF-8)
    const content = readFileSync(resolved.path, 'utf-8');

    // Track read for Read-first pattern
    trackRead(file);

    return {
      success: true,
      data: {
        file,
        content,
        source: resolved.source,
      },
    };
  } catch (e) {
    return {
      success: false,
      data: { file: input?.file ?? '', content: '', source: 'user' },
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
