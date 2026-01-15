/**
 * run_cad_code 모듈 상수
 *
 * 글로벌 패키지와 로컬 실행 모두에서 일관된 경로 사용
 * ~/.ai-native-cad/ 디렉토리에 모든 상태 저장
 */
import { resolve } from 'node:path';
import { homedir } from 'node:os';

// CAD 데이터 디렉토리 (홈 디렉토리 기준 - 일관된 경로)
export const STATE_DIR = resolve(homedir(), '.ai-native-cad');

// 코드 파일 경로
export const SCENE_CODE_FILE = resolve(STATE_DIR, 'scene.code.js');

// 모듈 디렉토리
export const MODULES_DIR = resolve(STATE_DIR, 'modules');

// 씬 파일 경로
export const SCENE_FILE = resolve(STATE_DIR, 'scene.json');
