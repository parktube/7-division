import { defineConfig } from 'vitest/config';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// 테스트 격리: config 로드 시점에 임시 디렉토리 생성
// process.env 직접 설정으로 모듈 import 전에 환경 변수 적용
const testDataDir = mkdtempSync(join(tmpdir(), 'cad-mcp-test-'));
mkdirSync(join(testDataDir, 'modules'), { recursive: true });
mkdirSync(join(testDataDir, 'data'), { recursive: true });
process.env.CAD_DATA_DIR = testDataDir;
console.log(`[Test] Using isolated test directory: ${testDataDir}`);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    env: {
      CAD_DATA_DIR: testDataDir,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
