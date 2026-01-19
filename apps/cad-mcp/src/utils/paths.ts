/**
 * 공통 경로 유틸리티
 *
 * DRY 원칙: glob, read, edit, write, lsp 도구에서 공유
 * - getFilePath: 파일명 → 실제 경로 변환
 * - isValidFileName: Path Traversal 방지
 */

import { resolve } from 'path';
import { MODULES_DIR, SCENE_CODE_FILE } from '../run-cad-code/constants.js';

// 파일명 허용 패턴 (Path Traversal 방지)
// 영문, 숫자, 언더스코어, 하이픈만 허용
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

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
 * Get file path for given file name
 * - 'main' → scene.code.js
 * - other → modules/{name}.js
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
