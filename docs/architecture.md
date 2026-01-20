---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
inputDocuments:
  - docs/prd.md
  - docs/epics.md
  - docs/ux-design-specification.md
workflowType: 'architecture'
lastStep: 7
project_name: 'AI-Native CAD'
user_name: 'Hoons'
date: '2026-01-14'
---

# Architecture Document - AI-Native CAD

**Last Updated:** 2026-01-16
**Status:** Epic 1~10 완료, Epic 11 (MAMA Integration) 계획 중

_이 문서는 BMAD Architecture Workflow로 작성되었습니다._

---

## Part 1: Core Architecture (Epic 1~8)

Epic 1~8에서 구축된 핵심 CAD 엔진과 뷰어입니다.

### 1.1 Overview

```
Claude Code CLI → cad-tools (WASM) → scene.json → Viewer
```

| 컴포넌트 | 기술 | 역할 |
|---------|------|------|
| cad-engine | Rust → WASM | 도형, 변환, Boolean, 좌표 계산 |
| cad-tools | TypeScript/Node.js | JS 샌드박스, CLI |
| viewer | React 19 + Vite | 3패널 UI, Canvas 렌더링 |

### 1.2 Core Principles

**"Dumb View" 패턴**: 데이터를 가진 쪽이 계산한다

| 계층 | 책임 | 하면 안 되는 것 |
|------|------|----------------|
| WASM (cad-engine) | geometry, transform, bounds 계산 | - |
| cad-tools | JS 실행, WASM 호출, scene.json export | 계산 |
| Viewer | 렌더링, UI 이벤트 | **계산 금지** |

**좌표계 규칙** (ADR-005):
- Y-up, 원점 중앙
- 변환 순서: Scale → Rotate → Translate
- 각도: 라디안

### 1.3 Tech Stack (완료)

| 컴포넌트 | 기술 | 버전 |
|---------|------|------|
| CAD 엔진 | Rust → WASM | 1.85+ |
| 기하 엔진 | Manifold WASM | - |
| CLI 도구 | TypeScript/Node.js | 22.x LTS |
| Viewer | React + Vite + TailwindCSS | 19 / 7 / 4 |
| 테스트 | Vitest | 3.x |

### 1.4 Data Flow (현재)

```
cad-tools (WASM)
      ↓ write
  scene.json
      ↓ polling (100ms)
  viewer/src/hooks/useScene.ts
      ↓
  React 컴포넌트
      ↓ write
  selection.json
      ↓ read
  cad-tools (LLM)
```

---

## Part 2: Web Architecture (Epic 9)

### 2.1 Project Context Analysis

#### Requirements Overview

**Functional Requirements:**
- FR1-FR50: CAD 엔진 기능 (완료) - 도형, 변환, Boolean, 텍스트
- FR51-FR58: 웹 아키텍처 (계획) - 모노레포, WebSocket, MCP, 배포

**Non-Functional Requirements:**
- NFR1-17: 기본 성능 요구사항 (완료)
- **새로운 NFR (웹 아키텍처):**
  - 파일 폴링 → WebSocket 전환 (~500ms → ~15-50ms)
  - GitHub Pages 정적 호스팅
  - 로컬 MCP 서버와 통신

**Scale & Complexity:**
- Primary domain: Full-stack (WASM + MCP + React)
- Complexity level: High
- Estimated architectural components: 3 (cad-engine, cad-mcp, viewer)

#### Technical Constraints & Dependencies

1. **WASM 위치 결정**: MCP 서버에서 실행 (Option A 선택), Viewer는 렌더링만 담당
   - Option A (채택): MCP에서 WASM 실행 → 파일 영속성, 단일 연산 경로
   - Option B (기각): Viewer에서 WASM 실행 → 브라우저 휘발성, 복잡한 동기화
2. **Electron 제외**: 웹 전용으로 단순화, 유지보수 부담 제거
3. **모듈 파일 영속성**: MCP가 파일 관리, 브라우저는 휘발성
4. **GitHub Pages 제약**: 정적 파일만, 서버 로직 불가

#### Cross-Cutting Concerns Identified

1. **실시간 동기화**: scene.json 변경 → WebSocket → Viewer 갱신
2. **모듈 시스템**: MCP가 모듈 파일 저장/로드, Viewer에서 표시
3. **오프라인 우선**: CAD 기능은 API 없이 로컬에서 동작

### 2.2 Web as Entry Point 전략

**핵심 인사이트**: Electron의 유지보수 부담을 피하고, 웹을 모든 것의 시작점으로 설정

| 문제 | Electron | Web + Local MCP |
|------|----------|-----------------|
| **업데이트** | 앱 재배포 + 사용자 재설치 | GitHub Pages 배포만 |
| **유지보수** | 두 플랫폼 (Win/Mac) 빌드 | 웹 하나만 |
| **온보딩** | '로컬 서버 실행해라' (어려움) | 웹 가이드 + npx 한 줄 |
| **개발 속도** | 느림 (electron-vite, 빌드) | 빠름 (Vite HMR) |
| **첫 경험까지** | 5분+ (다운로드, 설치) | 1분 이내 |

**웹 온보딩 흐름:**

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Pages Viewer (MCP 미연결 상태)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   🎨 AI-Native CAD                                          │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │  🔌 MCP 연결이 필요합니다                            │    │
│   │                                                    │    │
│   │  AI와 함께 CAD를 사용하려면 로컬 MCP가 필요해요.      │    │
│   │                                                    │    │
│   │  [📋 설치 가이드 보기]  [🎬 데모 영상]               │    │
│   │                                                    │    │
│   │  npx @ai-native-cad/mcp start                     │    │
│   │                                    [📋 복사]       │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
│   💡 이미 MCP가 실행 중이라면 자동으로 연결됩니다            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Viewer 연결 상태 머신:**
```
[Disconnected] ──연결시도──▶ [Connecting] ──성공──▶ [Connected]
      │                           │
      ▼                           ▼
 [Onboarding UI]            [Retry + Guide]
```

**온보딩 에러 시나리오 및 복구:**

| 에러 | 원인 | 사용자 메시지 | 복구 방법 |
|------|------|--------------|----------|
| MCP 설치 실패 | npm/npx 환경 문제 | "Node.js가 설치되어 있는지 확인하세요" | Node.js 설치 링크 제공 |
| 포트 충돌 | 3000번 포트 사용 중 | "다른 앱이 포트를 사용 중입니다" | 자동 fallback (3001-3003) |
| 방화벽 차단 | localhost 연결 차단 | "방화벽 설정을 확인하세요" | 방화벽 예외 추가 가이드 |
| MCP 크래시 | 런타임 오류 | "MCP가 예기치 않게 종료되었습니다" | 재시작 명령어 + 로그 위치 안내 |
| 버전 불일치 | MCP/Viewer 버전 차이 | "MCP 업데이트가 필요합니다" | `npx @ai-native-cad/mcp@latest start` |
| VPN/프록시 | WebSocket 차단 | "VPN이 연결을 차단할 수 있습니다" | localhost 예외 설정 |
| 브라우저 미지원 | IE, 구형 브라우저 | "최신 브라우저를 사용하세요" | Chrome/Firefox/Safari 권장 |

**브라우저 호환성 체크:**

```typescript
function checkBrowserSupport(): { supported: boolean; reason?: string } {
  if (!('WebSocket' in window)) {
    return { supported: false, reason: 'WebSocket 미지원 브라우저' };
  }
  if (typeof WebAssembly === 'undefined') {
    return { supported: false, reason: 'WebAssembly 미지원 브라우저' };
  }
  return { supported: true };
}
```

### 2.3 Technology Stack

#### Existing Stack (Epic 1-8)

| 컴포넌트 | 기술 | 버전 | 상태 |
|---------|------|------|------|
| CAD 엔진 | Rust → WASM | 1.85+ | 유지 |
| 기하 엔진 | Manifold WASM | - | 유지 |
| CLI 도구 | TypeScript/Node.js | 22.x LTS | MCP로 확장 |
| Viewer | React + Vite + TailwindCSS | 19 / 7 / 4 | WebSocket 추가 |
| 데스크탑 | Electron | 34 | **제거** |
| 테스트 | Vitest | 3.x | 유지 |

#### New Technologies to Add

| 컴포넌트 | 기술 | 버전 | 용도 | 보안 노트 |
|---------|------|------|------|----------|
| WebSocket Server | ws (Node.js) | 8.19.x | MCP → Viewer 실시간 푸시 | maxPayload 설정 필수 |
| WebSocket Client | native WebSocket | - | Viewer → MCP 연결 | - |
| MCP SDK | @modelcontextprotocol/sdk | >=1.25.2 | Claude Code stdio 연동 | **필수**: ReDoS 패치 포함 |
| 런타임 검증 | Zod | 4.x | 메시지 타입 검증 | 신규 추가 |
| 포트 탐색 | get-port | 7.x | 포트 충돌 시 자동 할당 | - |
| 모노레포 | pnpm workspace | 10.x | 패키지 관리, 의존성 공유 | - |

#### Monorepo Migration Plan

```
현재 구조:                    모노레포 구조:
─────────────                ─────────────────────
cad-engine/         →        cad-engine/           (그대로)
cad-tools/          →        apps/cad-mcp/         (MCP 서버 추가)
viewer/             →        apps/viewer/          (WebSocket 추가)
cad-electron/       →        (제거)
                             packages/shared/      (신규: Zod 스키마, 타입)
                             pnpm-workspace.yaml   (신규)
```

### 2.4 Core Architectural Decisions

#### Security Model

**결정: Localhost-Only (Phase 1-3)**

| 항목 | 결정 | 근거 |
|------|------|------|
| 인증 | 없음 | localhost 접근만 허용 |
| 프로토콜 | ws:// | 로컬 환경에서 TLS 불필요 |
| 접근 제한 | 127.0.0.1 바인딩 | 외부 네트워크 접근 차단 |

```typescript
// WebSocket 서버: localhost만 바인딩
const wss = new WebSocketServer({
  host: '127.0.0.1',  // localhost만 접근 가능
  port,
  maxPayload: 10 * 1024 * 1024,  // 10MB
});
```

**MCP SDK 보안 설정:**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const mcpServer = new Server(
  { name: 'ai-native-cad', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// stdio transport는 DNS rebinding 위험 없음 (네트워크 미사용)
```

**Rationale:**
- 로컬 개발 도구이므로 원격 접근 불필요
- MCP stdio transport는 네트워크 미사용으로 DNS rebinding 위험 없음
- WebSocket 서버는 127.0.0.1 바인딩으로 외부 접근 차단
- 단순성 우선 (인증 로직 없이 빠른 개발)

#### Communication Architecture

**결정: WebSocket**

| 항목 | 값 |
|------|-----|
| 프로토콜 | WebSocket (ws://) |
| 기본 포트 | 3001 (환경변수 `CAD_MCP_PORT`로 변경 가능) |
| 지연시간 | p50 < 15ms, p95 < 50ms (목표) |
| 양방향 | O |

**포트 충돌 완화 전략:**

```typescript
import getPort from 'get-port';

const port = process.env.CAD_MCP_PORT
  ? parseInt(process.env.CAD_MCP_PORT)
  : await getPort({ port: [3001, 3002, 3003, 3004] });

console.log(`MCP WebSocket server on port ${port}`);
```

```typescript
// Viewer: 다중 포트 시도 후 온보딩 UI
const DEFAULT_PORTS = [3001, 3002, 3003, 3004];

async function connectToMCP() {
  for (const port of DEFAULT_PORTS) {
    try {
      await tryConnect(`ws://localhost:${port}`);
      return; // 성공
    } catch (e) { continue; }
  }
  showOnboardingUI(); // 모든 포트 실패
}
```

**데이터 흐름:**
```
Claude Code ──stdio──▶ MCP Server ──WebSocket──▶ Viewer
                           │
                      WASM Engine
                      File System
```

**Rationale:**
- 파일 폴링(~500ms) 대비 30배 이상 빠름
- Viewer에서 selection 이벤트 실시간 전송 가능
- 연결 상태 관리로 온보딩 UX 개선

#### Data Flow Architecture

**결정: MCP 내부 통합**

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server (Node.js)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ MCP stdio   │    │ WASM Engine │    │ WebSocket   │      │
│  │ Server      │───▶│ (sandbox)   │───▶│ Server      │──▶ Viewer
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│        ▲                   │                                  │
│        │                   ▼                                  │
│  Claude Code         File System                              │
│                    (modules/, scene.json)                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Rationale:**
- 단일 프로세스로 복잡도 감소
- 파일 변경 감시 불필요 (직접 푸시)
- 트랜잭션 일관성 보장

#### File & Module Management

**결정: 프로젝트 디렉터리**

```
~/my-cad-project/           # 사용자 프로젝트
├── modules/
│   ├── main.js
│   └── house_lib.js
├── scene.json
└── .cad/
    └── config.json
```

**Rationale:**
- Git 버전 관리 가능
- 프로젝트별 독립성
- 기존 cad-tools 방식과 호환

**scene.json 무결성 전략:**

```typescript
import { writeFile, rename, copyFile } from 'fs/promises';
import { join } from 'path';

async function saveSceneAtomic(projectDir: string, scene: SceneData) {
  const targetPath = join(projectDir, 'scene.json');
  const tempPath = join(projectDir, '.scene.json.tmp');
  const backupPath = join(projectDir, 'scene.json.backup');

  // 1. 임시 파일에 쓰기
  await writeFile(tempPath, JSON.stringify(scene, null, 2));

  // 2. 기존 파일 백업 (존재하는 경우)
  try {
    await copyFile(targetPath, backupPath);
  } catch (e) {
    // 첫 저장 시에는 기존 파일 없음
  }

  // 3. 임시 파일을 최종 위치로 이동 (atomic)
  await rename(tempPath, targetPath);
}
```

| 위험 | 완화 전략 |
|------|----------|
| 동시 쓰기 | MCP 단일 프로세스가 유일한 writer |
| 불완전한 쓰기 | temp file → atomic rename |
| 파일 손상 | scene.json.backup 자동 생성 |

**외부 파일 변경 대응:**

| 케이스 | 대응 | 상태 |
|--------|------|------|
| 사용자 수동 편집 | MCP가 덮어씀 - Viewer에서 "MCP 사용 중 직접 편집 금지" 안내 | Phase 1 |
| Git 작업 (checkout 등) | ⚠️ MCP 재시작 필요 (파일 감시 미구현) | Phase 1 |

> **⚠️ Phase 1 UX 제약**: MCP 실행 중 Git 작업(checkout, merge 등) 후에는 **MCP 재시작 필수**. 재시작하지 않으면 오래된 scene.json 사용으로 데이터 불일치 발생.

**CLI 시작 시 경고 메시지 (구현 권장):**
```
$ npx @ai-native-cad/mcp start
✓ MCP Server started on port 3001

⚠️  Phase 1 제약사항:
   Git checkout/merge 후에는 MCP를 재시작하세요.
   (자동 파일 감지는 향후 추가 예정)
```

> **향후 개선**: fs.watch 기반 자동 재로드 기능은 Phase 2 이후 검토 예정.

#### MCP Server Architecture

**결정: stdio + WebSocket 듀얼 서버**

```typescript
// apps/cad-mcp/src/server.ts
export class CadMcpServer {
  private mcpServer: Server;          // @modelcontextprotocol/sdk (stdio)
  private wsServer: WebSocketServer;  // ws (port 3001)
  private engine: CadEngine;          // WASM

  async handleToolCall(name: string, args: unknown) {
    const result = this.engine.execute(name, args);
    this.wsServer.broadcast({ type: 'scene_update', data: result });
    return result;
  }
}
```

**포트/프로토콜:**

| 통신 | 프로토콜 | 용도 |
|------|---------|------|
| Claude Code ↔ MCP | stdio | MCP 도구 호출 |
| MCP ↔ Viewer | WebSocket (3001) | 실시간 동기화 |

### 2.5 Deployment Strategy

**결정: GitHub Pages + npm**

| 컴포넌트 | 배포 위치 | 방법 |
|---------|----------|------|
| Viewer | GitHub Pages | `gh-pages` 브랜치 자동 배포 |
| MCP | npm registry | `@ai-native-cad/mcp` 패키지 |

**사용자 설치:**
```bash
npx @ai-native-cad/mcp start
```

> **npm 패키지 관리**: `unpublish`는 72시간 이내만 가능. 운영 환경에서는 `npm deprecate` 권장.

**버전 동기화 정책:**

| 항목 | 정책 |
|------|------|
| 교환 시점 | WebSocket 연결 핸드셰이크 시 |
| 호환성 기준 | Major 버전 일치 필수 |
| 불일치 시 동작 | 경고 배너 + 제한 기능 모드 |
| 업데이트 방법 | `npx @ai-native-cad/mcp start` 재실행 |

```typescript
// 연결 시 초기 핸드셰이크 메시지
interface ConnectionMessage {
  type: 'connection';
  data: {
    mcpVersion: string;       // "1.2.3"
    protocolVersion: number;  // 1
    minViewerVersion: string; // "1.0.0"
  };
  timestamp: number;
}

// 호환성 체크 결과
interface CompatibilityResult {
  isCompatible: boolean;
  warnings: string[];
  disabledFeatures: string[];
  requiresUpgrade: 'mcp' | 'viewer' | null;
}

// Viewer 호환성 체크
function checkCompatibility(
  mcpVersion: string,
  viewerVersion: string,
  minViewerVersion?: string
): CompatibilityResult {
  // Pre-release 버전 제거 (예: "1.23.0-beta.0" → "1.23.0")
  const cleanVersion = (v: string) => v.split('-')[0];
  const [mcpMajor] = cleanVersion(mcpVersion).split('.').map(Number);
  const [viewerMajor, viewerMinor] = cleanVersion(viewerVersion).split('.').map(Number);

  const result: CompatibilityResult = {
    isCompatible: true,
    warnings: [],
    disabledFeatures: [],
    requiresUpgrade: null,
  };

  // Major 버전 불일치: 호환 불가
  if (mcpMajor !== viewerMajor) {
    result.isCompatible = false;
    result.requiresUpgrade = mcpMajor > viewerMajor ? 'viewer' : 'mcp';
    return result;
  }

  // Viewer가 minViewerVersion 미만 (minViewerVersion 제공 시만 체크)
  if (minViewerVersion) {
    const [minMajor, minMinor] = cleanVersion(minViewerVersion).split('.').map(Number);
    if (viewerMajor < minMajor || (viewerMajor === minMajor && viewerMinor < minMinor)) {
      result.isCompatible = false;
      result.requiresUpgrade = 'viewer';
      return result;
    }
  }

  return result;
}
```

**불일치 시 UX:**

| 상태 | 동작 | 메시지 |
|------|------|--------|
| Major 불일치 | 연결 차단 | "MCP 업데이트 필요: `npx @ai-native-cad/mcp start`" |
| Minor 불일치 | 경고 배너 | "일부 기능 비활성화됨. 최신 버전 권장." |
| 호환 | 정상 연결 | - |

### 2.6 Implementation Patterns & Consistency Rules

#### Established Patterns (Epic 1-8)

| 영역 | 패턴 | 예시 |
|------|------|------|
| 파일명 | kebab-case | `layer-panel.tsx` |
| 컴포넌트 | PascalCase | `LayerPanel` |
| 변수/함수 | camelCase | `getEntity()` |
| 상수 | SCREAMING_SNAKE | `MODIFY_COMMANDS` |
| 모듈 import | 문자열 리터럴 | `import 'house_lib'` |
| 엔티티 네이밍 | snake_case | `house_wall`, `arm_r` |

#### WebSocket Message Format

**결정: Type + Data 구조**

```typescript
type WSMessageType = 'scene_update' | 'selection' | 'connection' | 'error' | 'ping' | 'pong';

interface WSMessage {
  type: WSMessageType;
  data: Record<string, unknown>;
  timestamp: number;
}

// 예시
{ type: 'scene_update', data: { entities: [...] }, timestamp: 1704067200000 }
{ type: 'selection', data: { selected: ['entity_1'] }, timestamp: 1704067200100 }
{ type: 'error', data: { message: 'WASM error' }, timestamp: 1704067200200 }
```

**런타임 메시지 검증 (Zod):**

```typescript
import { z } from 'zod';

const SceneUpdateDataSchema = z.object({
  entities: z.array(z.record(z.unknown())),
});

const SelectionDataSchema = z.object({
  selected: z.array(z.string()),
});

const ConnectionDataSchema = z.object({
  mcpVersion: z.string(),
  protocolVersion: z.number().int().positive(),
  minViewerVersion: z.string().optional(),
});

const ErrorDataSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
});

const WSMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('scene_update'),
    data: SceneUpdateDataSchema,
    timestamp: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('selection'),
    data: SelectionDataSchema,
    timestamp: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('connection'),
    data: ConnectionDataSchema,
    timestamp: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('error'),
    data: ErrorDataSchema,
    timestamp: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('ping'),
    data: z.object({}),
    timestamp: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('pong'),
    data: z.object({}),
    timestamp: z.number().int().positive(),
  }),
]);

type WSMessage = z.infer<typeof WSMessageSchema>;

function validateMessage(raw: unknown): WSMessage {
  return WSMessageSchema.parse(raw);
}

// WebSocket 서버에서 사용
ws.on('message', (raw: string) => {
  try {
    const parsed = JSON.parse(raw);
    const message = validateMessage(parsed);
    handleMessage(message);
  } catch (e) {
    console.error('Message validation failed:', e);
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Invalid message format' },
      timestamp: Date.now()
    }));
  }
});
```

**메시지 타입별 data 스키마:**

| type | data 구조 | 설명 |
|------|----------|------|
| `scene_update` | `{ entities: Entity[] }` | 씬 변경 시 전체 엔티티 배열 |
| `selection` | `{ selected: string[] }` | 선택된 엔티티 ID 배열 |
| `error` | `{ message: string, code?: string }` | 오류 정보 |
| `connection` | `{ mcpVersion, protocolVersion }` | 핸드셰이크 |
| `ping` / `pong` | `{}` | 연결 확인 |

#### MCP Tool Response Format

**기존 패턴 유지:**

```typescript
interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  warnings?: string[];
  actionHints?: {
    next_steps?: string[];
    module_hints?: string[];
  };
}
```

#### Error Handling Patterns

| 컴포넌트 | 에러 유형 | 처리 방식 |
|---------|----------|----------|
| **Viewer** | WebSocket 연결 실패 | 재연결 시도 → Onboarding UI |
| **Viewer** | 메시지 파싱 실패 | console.error + 무시 |
| **Viewer** | 메시지 크기 초과 (close 1009) | "메시지 크기 초과" 알림 + 재연결 |
| **MCP** | WASM 실행 에러 | ToolResult.error 반환 |
| **MCP** | WebSocket 연결 끊김 | 로그 + 재연결 대기 |

**재연결 정책 (Exponential Backoff):**

```typescript
class WebSocketManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000; // 1초
  private reconnectTimer: number | null = null;

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showError('MCP 연결 실패');
      this.showOnboardingUI();
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.showStatus(`재연결 시도 중... (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await this.connect();
        this.reconnectAttempts = 0;
        this.showStatus('연결됨');
        this.syncOnReconnect();
      } catch (e) {
        this.scheduleReconnect();
      }
    }, delay);
  }

  dispose() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  private selectionQueue: string[] = [];

  queueSelection(entityId: string) {
    if (!this.isConnected) {
      this.selectionQueue.push(entityId);
    }
  }

  syncOnReconnect() {
    if (this.isConnected && this.selectionQueue.length > 0) {
      this.send({ type: 'selection', data: { selected: this.selectionQueue } });
      this.selectionQueue = [];
    }
  }
}
```

| 시도 | 대기시간 | 총 경과 |
|------|---------|---------|
| 1 | 1초 | 1초 |
| 2 | 2초 | 3초 |
| 3 | 4초 | 7초 |
| 4 | 8초 | 15초 |
| 5 | 16초 | 31초 |
| 실패 | - | Onboarding UI |

#### Enforcement Guidelines

**All AI Agents MUST:**

1. WebSocket 메시지는 반드시 `type` 필드 포함
2. MCP 도구 응답은 `success` 필드 필수
3. 파일명은 kebab-case, 컴포넌트는 PascalCase
4. 엔티티 이름은 snake_case (기존 패턴 유지)
5. 에러 발생 시 사용자에게 명확한 메시지 제공

**Anti-Patterns:**

```typescript
// ❌ 잘못: type 없는 WebSocket 메시지
ws.send({ scene: {...} })

// ✅ 올바름: type 필드 포함
ws.send({ type: 'scene_update', data: { entities: [...] }, timestamp: Date.now() })

// ❌ 잘못: success 없는 도구 응답
return { entities: [...] }

// ✅ 올바름: success 필드 포함
return { success: true, data: { entities: [...] } }
```

### 2.7 Project Structure & Boundaries

#### Shared Types Strategy

**결정: 하이브리드 전략 (워크스페이스 + npm standalone)**

| 컴포넌트 | 스키마 소스 | 이유 |
|---------|------------|------|
| `apps/viewer` | `@ai-native-cad/shared` (workspace) | 개발 시 타입 일치 보장 |
| `apps/cad-mcp` | `src/shared/` (로컬 복사본) | npm standalone 배포용 |

**구현 방식:**
1. `packages/shared/src/ws-messages.ts` - Zod 스키마 정의 (Single Source of Truth)
2. `apps/viewer` - `@ai-native-cad/shared` workspace 의존성으로 import
3. `apps/cad-mcp/src/shared/` - npm 배포용 로컬 복사본
   - Story 9-6 AC#2: "의존성 설치 없이 바로 실행 가능"
   - `npx @ai-native-cad/mcp start`가 추가 패키지 없이 동작

**스키마 동기화 규칙:**
- 스키마 변경 시 `packages/shared/` → `apps/cad-mcp/src/shared/` 동기화 필수
- 두 파일은 항상 동일해야 함 (diff로 검증)

**패키지 설정:**

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// packages/shared/package.json
{
  "name": "@ai-native-cad/shared",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

**공유 타입 예시:**

```typescript
// packages/shared/src/schemas.ts
import { z } from 'zod';

export const SceneUpdateSchema = z.object({
  type: z.literal('scene_update'),
  data: z.object({
    entities: z.array(z.unknown()),
  }),
  timestamp: z.number(),
});

export type SceneUpdate = z.infer<typeof SceneUpdateSchema>;
```

#### Complete Project Directory Structure

```
r2-7f-division/                          # 프로젝트 루트
├── pnpm-workspace.yaml                  # 워크스페이스 설정
├── package.json                         # 루트 패키지 (스크립트)
├── .gitignore
├── README.md
├── CLAUDE.md                            # AI 가이드
│
├── cad-engine/                          # Rust WASM 엔진 (그대로)
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs
│   │   └── scene/
│   ├── pkg/                             # WASM 빌드 결과물
│   └── tests/
│
├── apps/
│   ├── viewer/                          # React Viewer (기존 viewer/)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.js
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── components/
│   │       │   ├── canvas/
│   │       │   ├── layer-panel/
│   │       │   ├── info-panel/
│   │       │   ├── toolbar/
│   │       │   └── onboarding/          # 신규: MCP 연결 가이드
│   │       ├── hooks/
│   │       │   ├── useWebSocket.ts      # 신규: WebSocket 연결
│   │       │   ├── useScene.ts
│   │       │   └── useSelection.ts
│   │       ├── contexts/
│   │       └── types/
│   │
│   └── cad-mcp/                         # MCP 서버 (기존 cad-tools/)
│       ├── package.json                 # @ai-native-cad/mcp
│       ├── tsconfig.json
│       └── src/
│           ├── cli.ts                   # npx 진입점
│           ├── server.ts                # MCP + WebSocket 서버
│           ├── mcp/
│           │   ├── tools.ts             # MCP 도구 정의
│           │   └── handlers.ts          # MCP 도구 핸들러
│           ├── ws/
│           │   ├── server.ts            # WebSocket 서버
│           │   └── messages.ts          # 메시지 타입
│           ├── sandbox/                 # 기존 cad-tools/src/sandbox/
│           │   ├── index.ts
│           │   ├── executor.ts
│           │   └── bindings.ts
│           └── capture/                 # 기존 capture.ts
│
├── packages/
│   └── shared/                          # 공유 타입/스키마
│       ├── package.json                 # @ai-native-cad/shared
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                 # 진입점
│           ├── schemas.ts               # Zod 스키마
│           └── types.ts                 # TypeScript 타입
│
├── docs/
│   ├── prd.md
│   ├── architecture.md                  # 이 문서
│   ├── epics.md
│   └── adr/
│
└── .github/
    └── workflows/
        ├── ci.yml                       # 테스트/린트
        └── deploy-viewer.yml            # GitHub Pages 배포
```

#### Architectural Boundaries

**API Boundaries:**

| 경계 | 프로토콜 | 소스 → 타겟 |
|------|---------|------------|
| Claude Code → MCP | stdio | 외부 → apps/cad-mcp |
| MCP → Viewer | WebSocket (3001) | apps/cad-mcp → apps/viewer |
| MCP → WASM | 함수 호출 | apps/cad-mcp → cad-engine/pkg |

**Component Communication:**

```
┌──────────────────────────────────────────────────────────────┐
│                        apps/viewer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │  Canvas  │  │  Layer   │  │  Info    │                   │
│  │  Panel   │  │  Panel   │  │  Panel   │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
│       └─────────────┼─────────────┘                          │
│              ┌──────▼──────┐                                 │
│              │ useWebSocket│ ◀──── WebSocket ────┐           │
│              └─────────────┘                      │           │
└──────────────────────────────────────────────────│───────────┘
                                                   │
┌──────────────────────────────────────────────────│───────────┐
│                       apps/cad-mcp               │           │
│  ┌─────────────┐    ┌─────────────┐    ┌───────▼─────┐     │
│  │ MCP Server  │───▶│   Sandbox   │───▶│ WS Server   │     │
│  │   (stdio)   │    │   (WASM)    │    │  (port 3001)│     │
│  └──────▲──────┘    └─────────────┘    └─────────────┘     │
└─────────│────────────────────────────────────────────────────┘
          │
    Claude Code
```

### 2.8 Implementation Phases

| Phase | 범위 | 산출물 |
|-------|------|--------|
| **Phase 1** | 모노레포 전환 + WebSocket | pnpm workspace, useWebSocket |
| **Phase 2** | MCP 서버 완성 | @ai-native-cad/mcp (npm) |
| **Phase 3** | GitHub Pages 배포 | 온보딩 UI, 자동 배포 |
| **Phase 4** | 안정화 | 버전 호환성, 에러 복구 |

#### Phase별 상세 태스크

**Phase 1: 모노레포 전환 + WebSocket**
- [ ] pnpm-workspace.yaml 생성
- [ ] viewer/ → apps/viewer/ 이동
- [ ] cad-tools/ → apps/cad-mcp/ 이동 (기존 코드 유지)
- [ ] apps/viewer/src/hooks/useWebSocket.ts 구현
- [ ] cad-electron/ 제거

**Phase 2: MCP 서버 완성**
- [ ] apps/cad-mcp/src/server.ts (stdio + WebSocket 듀얼)
- [ ] apps/cad-mcp/src/mcp/tools.ts (MCP 도구 정의)
- [ ] apps/cad-mcp/src/ws/server.ts (WebSocket 서버)
- [ ] package.json bin 필드 추가 (npx 지원)
- [ ] npm 패키지 배포 (@ai-native-cad/mcp)

**Phase 3: GitHub Pages 배포**
- [ ] apps/viewer/src/components/onboarding/ 구현
- [ ] .github/workflows/deploy-viewer.yml 생성
- [ ] GitHub Pages 설정
- [ ] 버전 호환성 체크 구현

**Phase 4: 안정화**
- [ ] 재연결 로직 테스트
- [ ] 브라우저 호환성 테스트 (Chrome, Firefox, Safari)
- [ ] 에러 시나리오 테스트

#### Phase 전환 호환성 & 롤백 전략

**Breaking Changes 처리:**
- Major 버전 변경 시 1개 이전 버전 호환성 유지
- 연결 시 버전 체크 후 경고 표시

**롤백 절차:**

```bash
# npm 패키지 롤백 (72시간 이내만 가능)
npm unpublish @ai-native-cad/mcp@x.y.z

# 72시간 이후: deprecate 사용 (권장)
npm deprecate @ai-native-cad/mcp@x.y.z "보안 이슈로 사용 중단"

# 이전 안정 버전을 latest로 재지정
npm dist-tag add @ai-native-cad/mcp@x.y.z-1 latest

# GitHub Pages 롤백
git revert HEAD
git push origin gh-pages
```

### 2.9 Architecture Validation

#### Performance Validation Plan

**WebSocket 성능 목표:**

| 메트릭 | 목표 | 측정 방법 |
|--------|------|----------|
| RTT (Round-Trip Time) | p50 < 15ms, p95 < 50ms | synthetic harness |
| 메시지 처리량 | 100+ msg/sec | stress test |
| 메모리 사용량 | < 100MB (1000 엔티티) | heap snapshot |

**Phase별 검증 체크리스트:**

| Phase | 검증 항목 | 도구 |
|-------|----------|------|
| Phase 1 | WebSocket RTT 측정 | `console.time()` + 로깅 |
| Phase 2 | MCP → Viewer E2E 지연 | Vitest 벤치마크 |
| Phase 3 | 브라우저 호환성 (Chrome, Firefox, Safari) | 수동 테스트 |

**벤치마크 스크립트 (Phase 2):**

```typescript
// apps/cad-mcp/src/__benchmarks__/ws-latency.bench.ts
import { bench } from 'vitest';

bench('WebSocket RTT', async () => {
  await sendAndWaitForResponse({ type: 'ping' });
});
```

#### Requirements Coverage

| 요구사항 | 아키텍처 커버리지 | 검증 |
|---------|-----------------|------|
| FR1-50 (CAD 엔진) | `cad-engine/` + `apps/cad-mcp/sandbox/` | ✅ 기존 구현 유지 |
| FR51-58 (웹 아키텍처) | `apps/cad-mcp/`, `apps/viewer/` | ⏳ Epic 9 구현 예정 |
| NFR1-17 (성능) | WASM 직접 호출 | ✅ < 1ms |
| NFR 신규 (실시간) | WebSocket (p50 < 15ms) | ✅ localhost 기준 달성 가능 |

#### Technical Risk Assessment

| 위험 | 영향 | 완화 전략 | 상태 |
|------|------|----------|------|
| WebSocket 연결 불안정 | 중간 | 재연결 로직 + 온보딩 UI | 설계 완료 |
| npm 패키지 배포 | 낮음 | 표준 npm 배포 프로세스 | 경험 보유 |
| 브라우저 CORS | 낮음 | localhost 예외 | 해결됨 |

#### Pattern Consistency Check

| 패턴 | 문서 정의 | 일관성 |
|------|----------|--------|
| WebSocket 메시지 | `type + data + timestamp` | ✅ |
| MCP 도구 응답 | `success + data/error` | ✅ |
| 파일명 규칙 | kebab-case | ✅ 기존 패턴 유지 |
| 컴포넌트 네이밍 | PascalCase | ✅ |
| 엔티티 네이밍 | snake_case | ✅ |

#### Implementation Readiness

**블로킹 이슈:** 없음

**다음 단계:**
1. Phase 1: 모노레포 전환 (`pnpm-workspace.yaml`)
2. Phase 1: `apps/viewer/` WebSocket hook 구현
3. Phase 2: `apps/cad-mcp/` stdio + WS 듀얼 서버
4. Phase 3: GitHub Pages 배포 파이프라인

#### Validation Summary

| 항목 | 상태 |
|------|------|
| 요구사항 커버리지 | ✅ 100% (웹 전환 범위) |
| 기술 위험 | ✅ 관리 가능 |
| 패턴 일관성 | ✅ 검증됨 |
| 구현 준비도 | ✅ Ready |

**Overall Status: READY FOR IMPLEMENTATION ✅**

---

## Part 3: AX Improvement (Epic 10)

### 3.1 Problem Statement

LLM이 MCP CAD 도구를 올바르게 사용하지 못하는 문제:

| 문제 | 원인 | 결과 |
|------|------|------|
| Read-first 패턴 무시 | `cad_code`가 "실행기"로 인식됨 | 기존 코드 확인 없이 새 코드 작성 |
| 기존 모듈 무시 | 모듈 목록 확인 없이 작업 | 중복 모듈 생성 |
| 통합 도구 한계 | 하나의 도구에 다기능 통합 | "기본 모드"만 사용 |

**근본 원인 분석:**

| 항목 | Claude Code | MCP CAD (현재) |
|------|-------------|----------------|
| 도구 구조 | Read/Edit/Write **분리** | cad_code 하나에 **통합** |
| 행동 명확성 | 이름 = 행동 | 이름 ≠ 행동 |
| Read-first 강제 | Description 명시 + 에러 반환 | 없음 |
| 결과 | 올바른 패턴 | **잘못된 패턴** |

**핵심 통찰**: LLM은 이미 Claude Code 도구 패턴을 학습함. 같은 이름 = 같은 행동 기대.

### 3.2 Solution: Claude Code Pattern Alignment

MCP CAD 도구를 **Claude Code 패턴과 완전히 일치**하도록 재설계.

#### 도구 매핑

| Claude Code | MCP CAD (신규) | 역할 |
|-------------|----------------|------|
| Glob | `glob` | 파일 목록 (main + 모듈) |
| Read | `read` | 파일 읽기 |
| Edit | `edit` | 파일 부분 수정 → 자동 실행 |
| Write | `write` | 파일 전체 작성 → 자동 실행 |
| LSP | `lsp` | 코드 인텔리전스 (함수 탐색) |
| Bash | `bash` | 명령 실행 (씬 조회, 내보내기 등) |

#### 제거되는 도구

| 기존 도구 | 대체 | 이유 |
|----------|------|------|
| `cad_code` | `read`, `edit`, `write` | 분리된 도구로 Read-first 유도 |
| `module` | `glob`, `read`, `edit`, `write` | 파일 관리 패턴 통합 |
| `discovery` | `lsp` | Claude Code LSP와 일치 |
| `scene` | `bash` | 명령 실행 패턴 통합 |
| `export` | `bash` | 명령 실행 패턴 통합 |

### 3.3 New Tool Architecture

#### File Management (glob, read, edit, write)

```javascript
// 파일 목록
glob({})                              // ['main', 'iso_lib', 'city_lib']
glob({ pattern: '*_lib' })            // ['iso_lib', 'city_lib']

// 파일 읽기
read({ file: 'main' })                // main 코드 반환
read({ file: 'iso_lib' })             // 모듈 코드 반환

// 파일 수정 (부분) → 자동 실행
edit({
  file: 'main',
  old_code: 'drawCircle(...)',
  new_code: 'drawRect(...)'
})

// 파일 작성 (전체) → 자동 실행
write({ file: 'main', code: '...' })
write({ file: 'new_lib', code: '...' })  // 새 모듈 생성
```

#### Code Intelligence (lsp)

```javascript
// 도메인 목록
lsp({ operation: 'domains' })

// 함수 설명
lsp({ operation: 'describe', domain: 'primitives' })

// 함수 스키마
lsp({ operation: 'schema', name: 'drawCircle' })
```

#### Command Execution (bash)

```javascript
// 씬 조회
bash({ command: 'info' })             // 씬 정보
bash({ command: 'tree' })             // 씬 트리 구조
bash({ command: 'groups' })           // 그룹 목록
bash({ command: 'draw_order' })       // z-order

// 씬 조작
bash({ command: 'reset' })            // 씬 초기화

// 내보내기
bash({ command: 'capture' })          // 스크린샷 (PNG)
bash({ command: 'svg' })              // SVG 출력
bash({ command: 'json' })             // JSON 출력
```

### 3.4 Description Strategy

각 도구의 description에 Claude Code와 동일한 패턴 강조:

```typescript
const TOOL_DESCRIPTIONS = {
  glob: 'CAD 파일 목록 조회. main과 모듈 파일들.',
  read: '파일 읽기. edit/write 전에 반드시 먼저 확인.',
  edit: '파일 부분 수정 → 자동 실행. ⚠️ read로 먼저 확인 필수.',
  write: '파일 전체 작성 → 자동 실행. ⚠️ 기존 파일은 read로 먼저 확인.',
  lsp: 'CAD 함수 탐색. 도메인 목록, 함수 시그니처, 스키마 조회.',
  bash: '명령 실행. 씬 조회(info/tree/groups), 내보내기(capture/svg/json).',
};
```

### 3.5 Implementation Plan

| Phase | 범위 | 산출물 |
|-------|------|--------|
| 1 | 도구 설계 | ADR-008 (완료), 스키마 정의 |
| 2 | 구현 | glob, read, edit, write, lsp, bash |
| 3 | 마이그레이션 | 레거시 도구 deprecated → 제거 |
| 4 | 문서화 | CLAUDE.md, docs 업데이트 |

#### Phase 2 상세 태스크

```
apps/cad-mcp/src/
├── tools/
│   ├── glob.ts      # 파일 목록
│   ├── read.ts      # 파일 읽기
│   ├── edit.ts      # 파일 수정 → 실행
│   ├── write.ts     # 파일 작성 → 실행
│   ├── lsp.ts       # 코드 인텔리전스
│   └── bash.ts      # 명령 실행
└── schema.ts        # 새 스키마 정의
```

### 3.6 Expected Benefits

| 항목 | Before | After |
|------|--------|-------|
| Read-first 패턴 준수 | ~30% | >95% |
| 기존 모듈 재사용 | ~40% | >90% |
| 도구 학습 비용 | 새로운 학습 필요 | 0 (Claude Code 패턴 그대로) |
| 도구 개수 | 5개 (통합) | 6개 (분리, 명확) |

### 3.7 Related Documents

- [ADR-008](./adr/008-tool-pattern-alignment.md) - MCP 도구 패턴 정렬 결정

### 3.8 HMR 스타일 코드 실행 (Story 10.10)

#### 문제: 코드 재실행 시 누적 변환

**현재 아키텍처 문제:**

```
edit → main.js 저장 → 실행 (이전 씬 위에) → scene.json 저장
                              ↑ translate()가 누적됨
```

- 코드에 `translate('entity', 10, 0)`가 있으면
- 매 edit마다 translate가 추가 적용됨
- 결과: 의도치 않은 위치 이동

#### 해결: HMR (Hot Module Replacement) 스타일 실행

**새로운 아키텍처:**

```
edit → main.js 저장 → reset() + 실행 → 브로드캐스트 + scene.json 저장
                      ↑ 매번 clean 상태
```

**핵심 변경:**

| 항목 | Before | After |
|------|--------|-------|
| 실행 전 상태 | 이전 씬 유지 (누적) | reset() (clean) |
| 실행 후 저장 | scene.json 저장 | scene.json 저장 (유지) |
| 진실의 원천 | scene.json | main.js (실행), scene.json (폴백) |
| MCP 재시작 시 | scene.json 로드 | main.js 실행 → scene.json 폴백 |
| 롤백 시 | 파일만 복원 | 파일 복원 + 원본 재실행 |

**구현 변경 (mcp-server.ts):**

```typescript
async function executeRunCadCode(code: string) {
  const exec = getExecutor();

  // HMR 스타일: 매번 clean 상태에서 시작
  exec.exec('reset', {});

  const result = await runCadCode(exec, code, 'warn');

  if (result.success) {
    const sceneJson = exec.exportScene();
    const scene = JSON.parse(sceneJson);
    wsServer.broadcastScene(scene);
    saveScene(exec);  // scene.json 동기화 유지
  }

  return result;
}
```

**MCP 서버 시작 시:**

```typescript
let restored = false;

// 1차: main.js 실행으로 복원
if (existsSync(SCENE_CODE_FILE)) {
  const result = await executeRunCadCode(readMainCode());
  if (result.success) {
    restored = true;
    logger.info('Scene restored from main.js');
  }
}

// 2차: main.js 실패 시 scene.json 폴백
if (!restored) {
  restored = loadScene(exec);
  if (restored) {
    logger.info('Scene restored from scene.json (fallback)');
  }
}
```

**롤백 시 씬 복원:**

```typescript
// edit/write 핸들러 내부
if (!execResult.success) {
  rollbackEdit(file, originalContent);

  // 원본 코드 재실행으로 씬 복원
  exec.exec('reset', {});
  const origCode = readMainCode();
  const result = await runCadCode(exec, origCode, 'warn');
  if (result.success) {
    broadcastScene();
    saveScene(exec);
  }

  return { error: execResult.error, hint: '씬은 이전 상태로 복원됨' };
}
```

#### 장점

1. **누적 문제 완전 해결**: 매번 clean 상태에서 시작
2. **안정성 유지**: scene.json 폴백으로 복원 보장
3. **롤백 UX 개선**: 실패해도 이전 씬 상태 유지
4. **HMR 패러다임**: 웹 개발자에게 익숙한 패턴

#### bash reset 명령 동작

- `bash({ command: 'reset' })`: 수동 reset, main.js 재실행 안 함
- 사용자가 의도적으로 빈 씬을 원할 때 사용
- edit/write 후 자동 reset과 구분됨

---

## Part 4: MAMA Integration (Epic 11) - 계획됨

> AI 파트너십 강화를 위한 Memory-Augmented Meta Agent 통합

### 4.1 Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAMA + CAD Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐         ┌─────────────────┐                    │
│  │  메인 LLM   │         │  MAMA           │                    │
│  │  (Claude)   │◄───────►│  + 로컬 LLM     │                    │
│  │             │         │  (exaone 2.4B)  │                    │
│  │  • 사용자 대화│         │                 │                    │
│  │  • 복잡한 추론│         │  • ActionHints  │                    │
│  │  • 최종 코드 │         │  • 결정 저장    │                    │
│  └─────────────┘         │  • 모듈 추천    │                    │
│                          └─────────────────┘                    │
│                                   │                              │
│                                   ▼                              │
│                          ┌─────────────────┐                    │
│                          │  Local DB       │                    │
│                          │  (SQLite)       │                    │
│                          └─────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Core Tools (4개)

| 도구 | 용도 |
|------|------|
| `save` | Decision 또는 Checkpoint 저장 |
| `search` | 시맨틱 검색 또는 최근 항목 조회 |
| `update` | 결정 결과 추적 (success/failed/partial) |
| `load_checkpoint` | 세션 복원 |

**원칙**: 도구 수 최소화 → Claude 추론 유연성 증가

### 4.3 LLM-Agnostic Architecture

```typescript
// 공통 인터페이스
interface LLMAdapter {
  chat(messages: Message[], tools: ToolDef[]): Promise<LLMResponse>;
}

// Claude Adapter
class ClaudeAdapter implements LLMAdapter { ... }

// Ollama Adapter (로컬)
class OllamaAdapter implements LLMAdapter { ... }
```

**장점**: 도구 실행 로직은 LLM과 **완전 분리**. 어댑터만 교체하면 어떤 LLM이든 사용 가능.

### 4.4 LLM 역할 분담

| 역할 | 메인 LLM (Claude/Ollama) | 로컬 LLM (exaone 2.4B) |
|------|-------------------------|------------------------|
| 사용자 대화 | ✅ | ❌ |
| 설계 추론 | ✅ | ❌ |
| **ActionHints 생성** | ✅ | ❌ |
| **번역 (한↔영)** | ❌ | ✅ |
| **검색 결과 랭킹** | ❌ | ✅ |
| 최종 코드 결정 | ✅ | ❌ |

**핵심**: 로컬 LLM은 추론 불가 → 번역 + 랭킹만 담당 (현재 MAMA 수준)

### 4.5 Hook 시스템 (Claude Code 패턴 미러링)

```
CAD 내부 Hook 시스템:
┌─────────────────────────────────────────────────────────────┐
│ onSessionInit (SessionStart 패턴)                            │
│ - 마지막 체크포인트 로드                                        │
│ - 최근 결정 요약 제공                                          │
│ - 프로젝트별 힌트 준비                                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ preExecute (PreToolUse 패턴)                                 │
│ - Lock Guard: 잠긴 엔티티 수정 차단                             │
│ - MAMA Hook: 동적 제약 조건 체크                               │
│ - Dynamic Hints: 상황별 힌트 주입                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ [run_cad_code 실행]                                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ ActionHints (PostToolUse 패턴)                               │
│ - next_steps: 다음 작업 제안                                   │
│ - module_hints: 관련 모듈 추천                                 │
│ - save_suggestion: 결정 저장 제안                              │
└─────────────────────────────────────────────────────────────┘
```

**원칙**: Claude Code Hook 패턴을 내부화하여 모든 LLM에서 동일하게 작동

### 4.6 배포 아키텍처

**결정**: MCP 서버 내부 통합 (별도 플러그인 X)

```
apps/cad-mcp/
├── src/
│   ├── mama/           # MAMA 모듈 (통합)
│   │   ├── db.ts
│   │   ├── tools.ts
│   │   └── search.ts
│   └── ...
└── package.json        # 단일 패키지로 배포
```

**장점**: npm install 시 MAMA 포함, 별도 설정 불필요

### 4.7 저장 구조

```
~/.ai-native-cad/
├── data/
│   └── mama.db         # 단일 DB (topic prefix로 도메인 구분)
└── domains/            # 도메인 지식 (읽기 전용)
    ├── voxel/
    │   ├── DOMAIN.md
    │   ├── workflows/
    │   ├── rules/
    │   └── functions/
    ├── furniture/
    └── interior/
```

**원칙**: DB는 결정/체크포인트만, 도메인 지식은 폴더로 관리

### 4.8 데이터 스키마

```sql
-- decisions: 설계 결정 저장 (MAMA Core)
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,           -- 'furniture:chair', 'voxel:chicken' 등
  decision TEXT NOT NULL,
  reasoning TEXT,
  outcome TEXT,                  -- 'success', 'failed', 'partial'
  confidence REAL DEFAULT 0.5,
  created_at INTEGER
);

-- decision_edges: 결정 관계 (Reasoning Graph)
CREATE TABLE decision_edges (
  from_id TEXT,
  to_id TEXT,
  relationship TEXT,             -- 'supersedes', 'builds_on', 'debates', 'synthesizes'
  PRIMARY KEY (from_id, to_id, relationship)
);

-- sessions: 세션/체크포인트
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  summary TEXT,
  next_steps TEXT,
  open_files TEXT,
  created_at INTEGER
);

-- hints: 도구별 동적 힌트
CREATE TABLE hints (
  id INTEGER PRIMARY KEY,
  tool_name TEXT NOT NULL,
  hint_text TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  tags TEXT,                     -- JSON: ["wall", "room", "extend"]
  source TEXT                    -- 'user', 'system', 'learned'
);
```

### 4.9 Reasoning Graph

```
Decision A (topic: auth_strategy)
    │
    ├─builds_on→ Decision B (topic: auth_implementation)
    │
    └─debates→ Decision C (topic: auth_alternative)
                   │
                   └─synthesizes→ Decision D (최종 결론)
```

**관계 유형**:
- `supersedes`: 같은 topic의 새 결정이 이전 결정을 대체
- `builds_on`: 기존 결정 위에 구축
- `debates`: 대안 제시
- `synthesizes`: 여러 결정을 종합

### 4.10 Related Documents

- [ADR-0011](./adr/0011-mama-core-reuse.md) - MAMA Core 4 Tools 재사용
- [ADR-0018](./adr/0018-llm-agnostic-hooks.md) - LLM-Agnostic Hook Abstraction
- [ADR-0023](./adr/0023-llm-agnostic-agent-architecture.md) - LLM-Agnostic 아키텍처

---

## Related Documents

- [PRD](./prd.md) - 제품 요구사항
- [Epics](./epics.md) - 에픽 목록
- [ADR-007](./adr/007-web-architecture.md) - 웹 아키텍처 결정
- [ADR-008](./adr/008-tool-pattern-alignment.md) - MCP 도구 패턴 정렬

---

_Architecture Document - AI-Native CAD | BMAD Architecture Workflow_
