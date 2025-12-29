/**
 * Vitest Setup - WASM 모듈 초기화
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// @ts-ignore - WASM module lacks type declarations
import initSync from '../../cad-engine/pkg/cad_engine.js';

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// WASM 바이너리 로드 및 초기화
const wasmPath = resolve(__dirname, '../../cad-engine/pkg/cad_engine_bg.wasm');
const wasmBytes = readFileSync(wasmPath);
initSync(wasmBytes);
