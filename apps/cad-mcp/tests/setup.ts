/**
 * Vitest Setup - WASM 모듈 초기화
 *
 * Note: 테스트 격리 (CAD_DATA_DIR 환경 변수)는 global-setup.ts에서 처리
 * Node.js target으로 빌드된 WASM은 require 시 자동 초기화됨
 */

// @ts-ignore - WASM module lacks type declarations
// Node.js target WASM: 모듈 로드 시 __wbindgen_start() 자동 호출
import '../../../cad-engine/pkg/cad_engine.js';
