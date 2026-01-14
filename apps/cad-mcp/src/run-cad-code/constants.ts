/**
 * run_cad_code 모듈 상수
 */
import { resolve } from 'node:path';

// Viewer 디렉토리 (scene.json, scene.code.js 등)
export const STATE_DIR = resolve(process.cwd(), '../viewer');

// 코드 파일 경로
export const SCENE_CODE_FILE = resolve(STATE_DIR, 'scene.code.js');

// 모듈 디렉토리
export const MODULES_DIR = resolve(STATE_DIR, '.cad-modules');
