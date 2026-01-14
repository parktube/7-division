# Story 9.6: npm 패키지 배포

Status: drafted

## Story

As a **사용자**,
I want **`npx @ai-native-cad/mcp start`로 MCP 서버를 시작할 수 있기를**,
so that **한 줄 명령으로 로컬 개발 환경이 준비된다** (FR56).

## Acceptance Criteria

1. **Given** npm registry에 @ai-native-cad/mcp가 배포되었을 때
   **When** `npx @ai-native-cad/mcp start`를 실행하면
   **Then** MCP 서버(stdio + WebSocket)가 시작된다
   **And** "Server running at ws://127.0.0.1:3001" 메시지가 출력된다

2. **Given** 패키지를 배포할 때
   **When** npm publish를 실행하면
   **Then** WASM 바이너리가 패키지에 포함된다
   **And** 의존성 설치 없이 바로 실행 가능하다

3. **Given** 버전을 업데이트할 때
   **When** package.json 버전을 올리고 publish하면
   **Then** 새 버전이 npm에 배포된다

## Pre-requisites

- [ ] @ai-native-cad npm 스코프 가용성 확인 (또는 대안 네임스페이스)
- [ ] npm 계정 및 토큰 준비
- [ ] 2FA 설정 (npm publish 보안)

## Tasks / Subtasks

- [ ] Task 1: npm org 설정 (AC: #1)
  - [ ] 1.1 @ai-native-cad 스코프 가용성 확인
  - [ ] 1.2 npm org 생성 (또는 개인 스코프 사용)
  - [ ] 1.3 publish 권한 설정

- [ ] Task 2: package.json 설정 (AC: #1, #2)
  - [ ] 2.1 apps/cad-mcp/package.json 업데이트
  - [ ] 2.2 name: "@ai-native-cad/mcp" 설정
  - [ ] 2.3 bin 필드 설정 (CLI 진입점)
  - [ ] 2.4 files 필드 설정 (배포 포함 파일)
  - [ ] 2.5 main/exports 필드 설정

- [ ] Task 3: CLI 진입점 구현 (AC: #1)
  - [ ] 3.1 apps/cad-mcp/bin/cad-mcp.js 생성
  - [ ] 3.2 start 명령 구현
  - [ ] 3.3 --help, --version 옵션
  - [ ] 3.4 shebang (#!/usr/bin/env node)

- [ ] Task 4: WASM 번들링 (AC: #2)
  - [ ] 4.1 WASM 파일 복사 스크립트 (prebuild)
  - [ ] 4.2 files 필드에 WASM 포함 확인
  - [ ] 4.3 WASM 로드 경로 동적 해석 (__dirname 기반)

- [ ] Task 5: 빌드 스크립트 설정 (AC: #2)
  - [ ] 5.1 prepublishOnly 스크립트 추가
  - [ ] 5.2 TypeScript 빌드 (dist/)
  - [ ] 5.3 타입 선언 파일 생성 (.d.ts)

- [ ] Task 6: 배포 자동화 (AC: #3)
  - [ ] 6.1 .github/workflows/publish-mcp.yml 생성
  - [ ] 6.2 tag push 트리거 (v*.*.*)
  - [ ] 6.3 npm publish step (NPM_TOKEN 시크릿)
  - [ ] 6.4 dry-run 테스트

- [ ] Task 7: 배포 검증 (AC: #1~#3)
  - [ ] 7.1 로컬 npm pack 테스트
  - [ ] 7.2 npx 실행 테스트
  - [ ] 7.3 버전 업데이트 후 재배포 테스트

## Dev Notes

### Architecture Compliance

**Source:** [docs/architecture.md Part 2.5]

**사용자 설치:**
```bash
npx @ai-native-cad/mcp start
```

**npm 패키지 관리:** `unpublish`는 72시간 이내만 가능. 운영 환경에서는 `npm deprecate` 권장.

### Technical Requirements

**package.json 설정:**

```json
{
  "name": "@ai-native-cad/mcp",
  "version": "1.0.0",
  "description": "MCP Server for AI-Native CAD",
  "bin": {
    "cad-mcp": "./bin/cad-mcp.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "bin",
    "wasm/*.wasm"
  ],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "pnpm run build && pnpm run copy-wasm"
  },
  "engines": {
    "node": ">=22"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

**CLI 진입점:**

```javascript
#!/usr/bin/env node
// bin/cad-mcp.js

import { CadMcpServer } from '../dist/server.js';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'start') {
  const server = new CadMcpServer();
  await server.start();
} else if (command === '--version' || command === '-v') {
  const pkg = await import('../package.json', { assert: { type: 'json' } });
  console.log(pkg.default.version);
} else {
  console.log(`
Usage: cad-mcp <command>

Commands:
  start     Start MCP server (stdio + WebSocket)
  --version Show version
  --help    Show this help
  `);
}
```

**GitHub Actions 배포:**

```yaml
# .github/workflows/publish-mcp.yml
name: Publish MCP to npm

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: pnpm install

      - name: Build WASM
        run: pnpm run build:wasm

      - name: Build MCP
        run: pnpm --filter @ai-native-cad/mcp build

      - name: Publish
        run: pnpm --filter @ai-native-cad/mcp publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### File Structure

```
apps/cad-mcp/
├── bin/
│   └── cad-mcp.js        # CLI 진입점 (shebang)
├── dist/                  # TypeScript 빌드 출력
├── wasm/
│   └── cad_engine_bg.wasm # WASM 바이너리 (복사)
├── src/
│   ├── server.ts          # 메인 서버
│   └── ...
├── package.json           # npm 설정
└── tsconfig.json
```

### Dependencies

- **선행 스토리**: Story 9.4 (MCP stdio 서버 구현)
- **후행 스토리**: Story 9.8 (버전 호환성 체크)

### npm 스코프 대안

| 옵션 | 설명 |
|------|------|
| @ai-native-cad/mcp | 선호 (조직 스코프) |
| @parktube/cad-mcp | 개인 스코프 대안 |
| ai-native-cad-mcp | 스코프 없음 (비권장) |

### WASM 번들링 전략

```bash
# cad-engine 빌드 후 복사
cp cad-engine/pkg/cad_engine_bg.wasm apps/cad-mcp/wasm/

# 또는 prepublishOnly에서 자동화
"prepublishOnly": "cp ../../../cad-engine/pkg/*.wasm ./wasm/"
```

**런타임 WASM 로드:**
```typescript
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(__dirname, '../wasm/cad_engine_bg.wasm');
```

### Potential Risks

| 위험 | 완화 전략 |
|------|----------|
| npm 스코프 충돌 | 사전 가용성 확인, 대안 준비 |
| WASM 경로 오류 | __dirname 기반 절대 경로 |
| 버전 실수 | tag 기반 자동 배포만 허용 |
| unpublish 불가 | deprecate 사용, 신중한 publish |

### Testing Requirements

**로컬 테스트:**
```bash
cd apps/cad-mcp

# 패키지 빌드
pnpm build

# 로컬 설치 테스트
npm pack
npm install -g ./ai-native-cad-mcp-1.0.0.tgz

# 실행 테스트
cad-mcp start
```

**npx 테스트 (배포 후):**
```bash
npx @ai-native-cad/mcp start
# → Server running at ws://127.0.0.1:3001
```

### References

- [Source: docs/architecture.md#2.5] - Deployment Strategy
- [Source: docs/epics.md#Story-9.6] - Story 정의 및 AC
- [npm docs] - publishing packages

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

