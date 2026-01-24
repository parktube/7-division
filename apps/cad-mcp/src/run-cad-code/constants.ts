/**
 * run_cad_code 모듈 상수
 *
 * 글로벌 패키지와 로컬 실행 모두에서 일관된 경로 사용
 * ~/.ai-native-cad/ 디렉토리에 모든 상태 저장
 *
 * Story 11.20: Dual-source 지원
 * - builtin: 패키지에 포함된 읽기 전용 모듈/knowledge
 * - user: 사용자 데이터 (읽기/쓰기)
 *
 * Testing: CAD_DATA_DIR 환경 변수로 테스트 격리 지원
 * getter로 구현하여 런타임에 env var 읽음
 */
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

// ============================================================
// Path Getters (런타임 평가로 테스트 격리 지원)
// ============================================================

/**
 * CAD 데이터 디렉토리
 * - 기본값: ~/.ai-native-cad
 * - 테스트: CAD_DATA_DIR 환경 변수로 오버라이드
 */
export function getStateDir(): string {
  return process.env.CAD_DATA_DIR || resolve(homedir(), '.ai-native-cad');
}

/** 코드 파일 경로 */
export function getSceneCodeFile(): string {
  return resolve(getStateDir(), 'scene.code.js');
}

/** 사용자 모듈 디렉토리 */
export function getModulesDir(): string {
  return resolve(getStateDir(), 'modules');
}

/** 씬 파일 경로 */
export function getSceneFile(): string {
  return resolve(getStateDir(), 'scene.json');
}

// ============================================================
// Legacy Exports (backward compatibility)
// 기존 코드와의 호환성을 위해 getter 호출 결과를 export
// 주의: import 시점에 평가되므로 테스트에서는 getter 직접 사용 권장
// ============================================================

/** @deprecated Use getStateDir() for test isolation */
export const STATE_DIR = getStateDir();

/** @deprecated Use getSceneCodeFile() for test isolation */
export const SCENE_CODE_FILE = getSceneCodeFile();

/** @deprecated Use getModulesDir() for test isolation */
export const MODULES_DIR = getModulesDir();

/** @deprecated Use getSceneFile() for test isolation */
export const SCENE_FILE = getSceneFile();

// ============================================================
// Builtin Assets (패키지 내 - 테스트 격리 불필요)
// ============================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
export const BUILTIN_ASSETS_DIR = resolve(__dirname, '../../assets');
export const BUILTIN_MODULES_DIR = resolve(BUILTIN_ASSETS_DIR, 'modules');
export const BUILTIN_KNOWLEDGE_DIR = resolve(BUILTIN_ASSETS_DIR, 'knowledge');
