/**
 * run_cad_code 모듈 상수
 *
 * 글로벌 패키지와 로컬 실행 모두에서 일관된 경로 사용
 * ~/.ai-native-cad/ 디렉토리에 모든 상태 저장
 *
 * Story 11.20: Dual-source 지원
 * - builtin: 패키지에 포함된 읽기 전용 모듈/knowledge
 * - user: 사용자 데이터 (읽기/쓰기)
 */
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

// CAD 데이터 디렉토리 (홈 디렉토리 기준 - 일관된 경로)
export const STATE_DIR = resolve(homedir(), '.ai-native-cad');

// 코드 파일 경로
export const SCENE_CODE_FILE = resolve(STATE_DIR, 'scene.code.js');

// 사용자 모듈 디렉토리
export const MODULES_DIR = resolve(STATE_DIR, 'modules');

// 씬 파일 경로
export const SCENE_FILE = resolve(STATE_DIR, 'scene.json');

// Builtin assets 경로 (패키지 내 assets/ 디렉토리)
const __dirname = dirname(fileURLToPath(import.meta.url));
export const BUILTIN_ASSETS_DIR = resolve(__dirname, '../../assets');
export const BUILTIN_MODULES_DIR = resolve(BUILTIN_ASSETS_DIR, 'modules');
export const BUILTIN_KNOWLEDGE_DIR = resolve(BUILTIN_ASSETS_DIR, 'knowledge');
