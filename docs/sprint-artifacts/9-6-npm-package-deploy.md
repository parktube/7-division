# Story 9.6: npm 패키지 배포

Status: in-progress

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

- [ ] @ai-native-cad npm 스코프 가용성 확인 (또는 대안 네임스페이스) **← 미완료**
- [ ] npm 계정 및 토큰 준비 **← 미완료**
- [ ] 2FA 설정 (npm publish 보안) **← 미완료**

## Tasks / Subtasks

- [ ] Task 1: npm org 설정 (AC: #1) **← 미완료**
  - [ ] 1.1 @ai-native-cad 스코프 가용성 확인
  - [ ] 1.2 npm org 생성 (또는 개인 스코프 사용)
  - [ ] 1.3 publish 권한 설정

- [x] Task 2: package.json 설정 (AC: #1, #2)
  - [x] 2.1 apps/cad-mcp/package.json 업데이트
  - [x] 2.2 name: "@ai-native-cad/mcp" 설정
  - [x] 2.3 bin 필드 설정 (CLI 진입점)
  - [x] 2.4 files 필드 설정 (배포 포함 파일)
  - [x] 2.5 main/exports 필드 설정

- [x] Task 3: CLI 진입점 구현 (AC: #1)
  - [x] 3.1 apps/cad-mcp/src/mcp-cli.ts 생성 (bin/cad-mcp.js 대신)
  - [x] 3.2 start 명령 구현
  - [x] 3.3 shebang (#!/usr/bin/env node)
  - Note: --help/--version 불필요 (MCP는 stdio 프로토콜, CLI 도구 아님)

- [x] Task 4: WASM 번들링 (AC: #2)
  - [x] 4.1 WASM 파일 복사 스크립트 (prebuild)
  - [x] 4.2 files 필드에 WASM 포함 확인
  - [x] 4.3 WASM 로드 경로: `../wasm/cad_engine.js` (npm standalone)
  - [x] 4.4 wasm/.npmignore 추가 (.gitignore 무시)

- [x] Task 5: 빌드 스크립트 설정 (AC: #2)
  - [x] 5.1 prepublishOnly 스크립트 추가
  - [x] 5.2 TypeScript 빌드 (dist/)
  - [x] 5.3 타입 선언 파일 생성 (.d.ts)

- [x] Task 6: 배포 자동화 (AC: #3)
  - [x] 6.1 .github/workflows/npm-publish.yml 생성
  - [x] 6.2 release 트리거 설정
  - [x] 6.3 npm publish step (NPM_TOKEN 시크릿)
  - [ ] 6.4 dry-run 테스트 **← 미실행**

- [x] Task 7: 로컬 배포 검증 (AC: #1, #2)
  - [x] 7.1 pnpm pack → 226KB tarball 생성
  - [x] 7.2 /tmp에 설치 후 `npx ai-native-cad-mcp` 테스트 통과
  - [x] 7.3 `npx ai-native-cad-mcp start` → WebSocket 서버 정상 시작
  - [ ] 7.4 npm registry 배포 후 검증 **← Pre-requisites 필요**

- [x] Task 8: Standalone 패키지 구성 (AC: #2)
  - [x] 8.1 @ai-native-cad/shared 의존성 제거
  - [x] 8.2 shared/ws-messages.ts를 mcp/src/shared/에 복사
  - [x] 8.3 import 경로 로컬로 변경

### Review Follow-ups (AI)

> 코드 리뷰 날짜: 2026-01-14 | 리뷰어: Claude Opus 4.5

**✅ AC 검증 결과 (2026-01-14 로컬 테스트)**
- AC #1 ✅ 로컬 설치 후 `npx ai-native-cad-mcp start` 정상 동작
- AC #2 ✅ WASM 바이너리 포함 (382KB), standalone 패키지 완성
- AC #3 ⏳ npm-publish.yml 존재, release 태그 생성 대기

**🟡 MEDIUM (Pre-requisites 대기)**
- [ ] [AI-Review][MEDIUM] npm 실제 배포 안됨 - @ai-native-cad npm org 생성 필요
- [ ] [AI-Review][MEDIUM] NPM_TOKEN 시크릿 설정 필요

**🟢 구현 완료 (코드)**
- ✓ package.json에 bin, files, prepublishOnly 설정
- ✓ npm-publish.yml 워크플로우 파일 존재
- ✓ mcp-cli.ts에 start 명령 구현

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
// apps/cad-mcp/src/mcp-cli.ts

import { runMCPServer } from './mcp-server.js';

const command = process.argv[2];

if (command === 'start') {
  runMCPServer();
} else {
  console.log('Usage: npx @ai-native-cad/mcp start');
  process.exit(command ? 1 : 0);
}
// Note: --help/--version 불필요 (MCP는 stdio 프로토콜 사용)
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

**구현된 파일:**
```
apps/cad-mcp/package.json          # bin, files, prepublishOnly 설정
apps/cad-mcp/src/mcp-cli.ts        # CLI 진입점 (start 명령)
.github/workflows/npm-publish.yml  # npm 배포 워크플로우
```

**남은 작업:**
- Pre-requisites 완료 (npm org 설정, 토큰)
- Release 태그 생성하여 실제 배포
- npx 실행 검증

