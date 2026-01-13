---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
inputDocuments:
  - docs/prd.md
  - docs/epics.md
  - docs/epic-9-proposal.md
  - docs/ux-design-specification.md
workflowType: 'architecture'
lastStep: 7
project_name: 'AI-Native CAD'
user_name: 'Hoons'
date: '2026-01-13'
outputFile: 'web-architecture.md'
---

# Web Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
- FR1-FR50: CAD 엔진 기능 (완료) - 도형, 변환, Boolean, 텍스트
- FR51-FR66: MAMA Integration (계획) - 세션 연속성, 결정 저장, 힌트 시스템

**Non-Functional Requirements:**
- NFR1-17: 기본 성능 요구사항 (완료)
- NFR18-20: MAMA 로컬 DB (계획)
- **새로운 NFR (웹 아키텍처):**
  - 파일 폴링 → WebSocket 전환 (~500ms → ~15-50ms)
  - GitHub Pages 정적 호스팅
  - 로컬 MCP 서버와 통신

**Scale & Complexity:**
- Primary domain: Full-stack (WASM + MCP + React)
- Complexity level: High
- Estimated architectural components: 3 (cad-engine, cad-mcp, viewer)

### Technical Constraints & Dependencies

1. **WASM 위치 결정 (Option A)**: MCP에서 실행, Viewer는 렌더링만
2. **Electron 제외**: 웹 전용으로 단순화, 유지보수 부담 제거
3. **모듈 파일 영속성**: MCP가 파일 관리, 브라우저는 휘발성
4. **GitHub Pages 제약**: 정적 파일만, 서버 로직 불가

### Cross-Cutting Concerns Identified

1. **실시간 동기화**: scene.json 변경 → WebSocket → Viewer 갱신
2. **모듈 시스템**: MCP가 모듈 파일 저장/로드, Viewer에서 표시
3. **MAMA 통합**: cad-mcp 내부에 MAMA 포함 (별도 패키지 불필요)
4. **오프라인 우선**: CAD 기능은 API 없이 로컬에서 동작

### Web as Entry Point 전략

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

## Technology Stack Evaluation

### Primary Technology Domain

**기존 코드베이스 전환** - 새 프로젝트가 아닌 웹 아키텍처로 마이그레이션

### Existing Technology Stack (Epic 1-8)

| 컴포넌트 | 기술 | 버전 | 상태 |
|---------|------|------|------|
| CAD 엔진 | Rust → WASM | 1.85+ | 유지 |
| 기하 엔진 | Manifold WASM | - | 유지 |
| CLI 도구 | TypeScript/Node.js | 22.x LTS | MCP로 확장 |
| Viewer | React + Vite + TailwindCSS | 19 / 7 / 4 | WebSocket 추가 |
| 데스크탑 | Electron | 34 | **제거** |
| 테스트 | Vitest | 3.x | 유지 |

### Monorepo Migration Plan

```
현재 구조:                    모노레포 구조:
─────────────                ─────────────────────
cad-engine/         →        cad-engine/           (그대로)
cad-tools/          →        apps/cad-mcp/         (MCP 서버 추가)
viewer/             →        apps/viewer/          (WebSocket 추가)
cad-electron/       →        (제거)
                             pnpm-workspace.yaml   (신규)
```

### New Technologies to Add

| 컴포넌트 | 기술 | 버전 | 용도 | 보안 노트 |
|---------|------|------|------|----------|
| WebSocket Server | ws (Node.js) | 8.19.x | MCP → Viewer 실시간 푸시 | maxPayload 설정 필수 |
| WebSocket Client | native WebSocket | - | Viewer → MCP 연결 | - |
| MCP SDK | @modelcontextprotocol/sdk | >=1.25.2 | Claude Code stdio 연동 | **필수**: ReDoS/DNS rebinding 패치 (CVE-2025-66414) |
| 런타임 검증 | Zod | 3.x | 메시지 타입 검증 | 신규 추가 |
| 포트 탐색 | get-port | 7.x | 포트 충돌 시 자동 할당 | - |
| 모노레포 | pnpm workspace | 9.x | 패키지 관리, 의존성 공유 | - |

**보안 요구사항:**
- MCP SDK는 반드시 >=1.25.2 사용 (v1.25.2에서 ReDoS 취약점 패치, DNS rebinding 보호 추가)
- `enableDnsRebindingProtection` 옵션 활성화 필수

### Rationale for Migration (Not New Starter)

1. **기존 코드 재사용**: cad-tools/src/sandbox/ 전체 재활용
2. **검증된 스택 유지**: React 19, Vite 7, TailwindCSS 4
3. **점진적 전환**: 동작하는 코드 위에서 확장
4. **위험 최소화**: 새 스타터로 재작성 시 회귀 버그 위험

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Communication: WebSocket
- Data Flow: MCP 내부 통합
- File Storage: 프로젝트 디렉터리

**Important Decisions (Shape Architecture):**
- MCP Server 구조: stdio + WebSocket 듀얼 서버
- Deployment: GitHub Pages (Viewer) + npm (MCP)
- 보안 모델: localhost-only (인증 없음, 로컬 접근만 허용)

**Deferred Decisions (Post-MVP):**
- isomorphic-git 내장 버전관리
- WSS (Secure WebSocket) - 현재는 localhost ws:// 사용

### Security Model

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
  maxPayload: 10 * 1024 * 1024,
});
```

**Rationale:**
- 로컬 개발 도구이므로 원격 접근 불필요
- MCP SDK `enableDnsRebindingProtection` 활성화로 DNS rebinding 공격 방지
- 단순성 우선 (인증 로직 없이 빠른 개발)

**Post-MVP 확장 시:**
- 원격 접근 필요 시 WSS + 토큰 인증 추가
- mTLS 또는 JWT handshake 고려

### Communication Architecture

**결정: WebSocket**

| 항목 | 값 |
|------|-----|
| 프로토콜 | WebSocket (ws://) |
| 기본 포트 | 3000 (환경변수 `CAD_MCP_PORT`로 변경 가능) |
| 지연시간 | p50 < 15ms, p95 < 50ms (목표) |
| 양방향 | O |

**포트 충돌 완화 전략:**

```typescript
// MCP 서버: 환경변수 → 자동 할당 fallback
import getPort from 'get-port';

const port = process.env.CAD_MCP_PORT
  ? parseInt(process.env.CAD_MCP_PORT)
  : await getPort({ port: [3000, 3001, 3002, 3003] });

console.log(`MCP WebSocket server on port ${port}`);
```

```typescript
// Viewer: 다중 포트 시도 후 온보딩 UI
const DEFAULT_PORTS = [3000, 3001, 3002, 3003];

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

### Data Flow Architecture

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

### File & Module Management

**결정: 프로젝트 디렉터리**

```
~/my-cad-project/           # 사용자 프로젝트
├── modules/
│   ├── main.js
│   └── house_lib.js
├── scene.json
└── .cad/
    └── memory.db           # MAMA DB (Epic 9)
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
| 파일 손상 | scene.json.backup 자동 생성 (단일 세대, 덮어쓰기) |

> **백업 정리**: 단일 `.backup` 파일로 충분. 다중 세대 백업 필요 시 Git 히스토리 활용.

**동시 쓰기 엣지 케이스:**

| 케이스 | 발생 조건 | 대응 |
|--------|----------|------|
| 사용자 수동 편집 | CAD 작업 중 scene.json 직접 수정 | MCP가 덮어씀 (사용자 변경 손실) - 작업 중 수동 편집 금지 안내 |
| Git 작업 | checkout, merge로 파일 변경 | MCP 재시작 필요 - Viewer에서 "파일 변경 감지" 알림 |
| 다중 MCP 인스턴스 | 같은 프로젝트에 2개 이상 MCP | 포트 충돌로 자연 방지, 파일 lock은 Phase 2에서 검토 |

> **참고**: MVP에서는 "단일 MCP = 단일 writer" 가정이 합리적. 다중 사용자/인스턴스 시나리오는 Phase 3 이후 검토.

### MCP Server Architecture

**결정: stdio + WebSocket 듀얼 서버**

```typescript
// apps/cad-mcp/src/server.ts
export class CadMcpServer {
  private mcpServer: Server;          // @modelcontextprotocol/sdk (stdio)
  private wsServer: WebSocketServer;  // ws (port 3000)
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
| MCP ↔ Viewer | WebSocket (3000) | 실시간 동기화 |

### Deployment Strategy

**결정: GitHub Pages + npm**

| 컴포넌트 | 배포 위치 | 방법 |
|---------|----------|------|
| Viewer | GitHub Pages | `gh-pages` 브랜치 자동 배포 |
| MCP | npm registry | `@ai-native-cad/mcp` 패키지 |

**사용자 설치:**
```bash
npx @ai-native-cad/mcp start
```

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

// Viewer 호환성 체크
function isCompatible(mcpVersion: string, viewerVersion: string): boolean {
  const [mcpMajor] = mcpVersion.split('.').map(Number);
  const [viewerMajor] = viewerVersion.split('.').map(Number);
  return mcpMajor === viewerMajor; // Major 버전 일치 필요
}
```

**불일치 시 UX:**
- 경고 배너: "MCP 버전이 오래되었습니다. `npx @ai-native-cad/mcp start`로 업데이트하세요."
- 기본 기능은 동작, 신규 기능은 비활성화

### Future Extension: isomorphic-git

**상태: Post-MVP**

LLM이 직접 버전관리를 "이해하고" 수행하는 시스템:

```javascript
// 샌드박스 바인딩 (향후 추가)
snapshot(message)    // 현재 상태 저장
getHistory()         // 이력 조회 → [{ sha, message, timestamp }, ...]
restore(sha)         // 특정 커밋으로 복원
diff(sha1, sha2)     // 두 커밋 간 차이 비교 (sha: Git 커밋 해시)
```

**사용 시나리오:**
- "아까 다리 높이 바꾸기 전으로" → LLM이 이력 검색 후 복원
- "뭐가 바뀌었어?" → diff로 의미있는 설명 생성

**구현 위치:** `apps/cad-mcp/src/git/`

## Implementation Patterns & Consistency Rules

### Established Patterns (Epic 1-8)

| 영역 | 패턴 | 예시 |
|------|------|------|
| 파일명 | kebab-case | `layer-panel.tsx` |
| 컴포넌트 | PascalCase | `LayerPanel` |
| 변수/함수 | camelCase | `getEntity()` |
| 상수 | SCREAMING_SNAKE | `MODIFY_COMMANDS` |
| 모듈 import | 문자열 리터럴 | `import 'house_lib'` |
| 엔티티 네이밍 | snake_case | `house_wall`, `arm_r` |

### WebSocket Message Format

**결정: Type + Data 구조**

```typescript
interface WSMessage {
  type: 'scene_update' | 'selection' | 'connection' | 'error';
  data: unknown;
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

// Zod 스키마 정의
const WSMessageSchema = z.object({
  type: z.enum(['scene_update', 'selection', 'connection', 'error']),
  data: z.unknown(),
  timestamp: z.number(),
});

// 검증 함수
function validateMessage(raw: unknown): WSMessage {
  return WSMessageSchema.parse(raw); // 실패 시 예외 발생
}

// WebSocket 서버에서 사용
ws.on('message', (raw: string) => {
  try {
    const parsed = JSON.parse(raw);
    const message = validateMessage(parsed);
    handleMessage(message);
  } catch (e) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Invalid message format' },
      timestamp: Date.now()
    }));
  }
});
```

**서버 보안 설정:**

```typescript
// WebSocket 서버 옵션
const wss = new WebSocketServer({
  port,
  maxPayload: 10 * 1024 * 1024, // 10MB 메시지 크기 제한
});
```

**Rationale:**
- 타입 안전성 보장 (컴파일타임 + 런타임)
- 기존 scene.json 구조와 일관성
- 디버깅 용이 (timestamp)
- DoS 방지 (메시지 크기 제한)

> **data 필드 검증**: 현재 `z.unknown()`으로 유연성 확보. 메시지 타입별 상세 스키마는 구현 단계에서 정의 (예: `SceneUpdateSchema`, `SelectionSchema`).

### MCP Tool Response Format

**기존 패턴 유지 + actionHints 확장:**

```typescript
interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  warnings?: string[];
  actionHints?: {           // MAMA용 (Epic 9)
    next_steps?: string[];
    module_hints?: string[];
  };
}
```

### Error Handling Patterns

| 컴포넌트 | 에러 유형 | 처리 방식 |
|---------|----------|----------|
| **Viewer** | WebSocket 연결 실패 | 재연결 시도 → Onboarding UI |
| **Viewer** | 메시지 파싱 실패 | console.error + 무시 |
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

    // setTimeout으로 재귀 대신 반복 (콜스택 안전)
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await this.connect();
        this.reconnectAttempts = 0; // 성공 시 리셋
        this.showStatus('연결됨');
        this.syncOnReconnect();
      } catch (e) {
        this.scheduleReconnect(); // 다음 시도 예약
      }
    }, delay);
  }

  dispose() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  // 연결 끊김 중 사용자 작업 큐잉
  private selectionQueue: string[] = [];

  queueSelection(entityId: string) {
    if (!this.isConnected) {
      this.selectionQueue.push(entityId);
    }
  }

  syncOnReconnect() {
    // 큐잉된 selection 동기화
    if (this.selectionQueue.length > 0) {
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

> **동기화 범위**: MVP에서는 `selectionQueue`만 처리 (사용자 선택 상태). 툴바/레이어 변경 등은 MCP 요청이므로 연결 필수 → 끊김 시 UI에서 비활성화.

### Testing Patterns

| 컴포넌트 | 테스트 위치 | 프레임워크 |
|---------|------------|-----------|
| MCP 로직 | `*.test.ts` (co-located) | Vitest |
| Viewer 유틸 | `*.test.ts` (co-located) | Vitest |
| Viewer UI | 수동/E2E | - |
| WASM 엔진 | `cad-engine/tests/` | Rust test |

### Enforcement Guidelines

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

## Project Structure & Boundaries

### Shared Types Strategy

**결정: apps/cad-mcp 내부에서 정의, Viewer는 복사**

| 옵션 | 장점 | 단점 | 결정 |
|------|------|------|------|
| `packages/shared-types` | 완전한 타입 공유 | 초기 설정 복잡 | ❌ |
| `apps/cad-mcp` 내부 | 단순, MCP가 source of truth | Viewer에서 import 불가 | ✅ |

**구현 방식:**
1. `apps/cad-mcp/src/types/` 에 모든 타입 정의
2. Viewer는 동일한 타입을 `apps/viewer/src/types/` 에 복사
3. 타입 변경 시 양쪽 수동 동기화 (Phase 1-2 범위에서 충분)

**Post-MVP 확장:**
- 타입 불일치가 빈번해지면 `packages/shared-types` 도입 검토

**타입 동기화 CI 검증 (권장):**

```yaml
# .github/workflows/ci.yml
- name: Verify type sync
  run: |
    diff apps/cad-mcp/src/types/ws-message.ts apps/viewer/src/types/ws-message.ts
    diff apps/cad-mcp/src/types/tool-result.ts apps/viewer/src/types/tool-result.ts
```

타입 파일이 불일치하면 CI 실패 → 수동 동기화 강제

```typescript
// apps/cad-mcp/src/types/ws-message.ts
export interface WSMessage {
  type: 'scene_update' | 'selection' | 'connection' | 'error';
  data: unknown;
  timestamp: number;
}

// apps/viewer/src/types/ws-message.ts (동일하게 복사)
```

### Complete Project Directory Structure

```
r2-7f-division/                          # 프로젝트 루트
├── pnpm-workspace.yaml                  # 워크스페이스 설정
├── package.json                         # 루트 패키지 (스크립트)
├── .gitignore
├── README.md
├── CLAUDE.md                            # AI 가이드
├── CHANGELOG.md
├── CONTRIBUTING.md
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
│           ├── capture/                 # 기존 capture.ts
│           └── mama/                    # (Post-MVP: Epic 9)
│
├── docs/
│   ├── prd.md
│   ├── architecture.md                  # 데스크탑 아키텍처
│   ├── web-architecture.md              # 웹 아키텍처 (이 문서)
│   ├── epics.md
│   └── adr/
│
└── .github/
    └── workflows/
        ├── ci.yml                       # 테스트/린트
        └── deploy-viewer.yml            # GitHub Pages 배포
```

### Architectural Boundaries

**API Boundaries:**

| 경계 | 프로토콜 | 소스 → 타겟 |
|------|---------|------------|
| Claude Code → MCP | stdio | 외부 → apps/cad-mcp |
| MCP → Viewer | WebSocket (3000) | apps/cad-mcp → apps/viewer |
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
│  │   (stdio)   │    │   (WASM)    │    │  (port 3000)│     │
│  └──────▲──────┘    └─────────────┘    └─────────────┘     │
└─────────│────────────────────────────────────────────────────┘
          │
    Claude Code
```

### Requirements to Structure Mapping

| Epic | 디렉터리 | 설명 |
|------|---------|------|
| Epic 1-8 | `cad-engine/`, `apps/cad-mcp/sandbox/` | CAD 엔진 + 샌드박스 |
| 웹 아키텍처 | `apps/viewer/`, `apps/cad-mcp/ws/` | WebSocket 통신 |
| Epic 9 (Post-MVP) | `apps/cad-mcp/mama/` | MAMA 통합 |

### Implementation Phases

| Phase | 범위 | 산출물 |
|-------|------|--------|
| **Phase 1** | 모노레포 전환 + WebSocket | pnpm workspace, useWebSocket |
| **Phase 2** | MCP 서버 완성 | @ai-native-cad/mcp (npm) |
| **Phase 3** | GitHub Pages 배포 | 온보딩 UI, 자동 배포 |
| **Phase 4** | MAMA 통합 (Post-MVP) | Epic 9 구현 |

### Phase 전환 호환성 & 롤백 전략

**Phase 1 → Phase 2 전환:**

| 상태 | useWebSocket | MCP 서버 | 동작 |
|------|--------------|---------|------|
| Phase 1 개발 중 | 구현됨 | 미완성 | Mock 서버로 테스트 |
| Phase 2 완료 | 구현됨 | 완성 | 실제 연결 |

```typescript
// Phase 1: Mock WebSocket for development
const useMockWebSocket = process.env.NODE_ENV === 'development' && !process.env.MCP_URL;
```

**Phase 2 → Phase 3 전환:**

| 단계 | 배포 위치 | 사용자 경험 |
|------|----------|------------|
| 1 | npm (beta) | 얼리 어답터 테스트 |
| 2 | npm (stable) | 공식 릴리즈 |
| 3 | GitHub Pages | 웹 접근 가능 |

**Breaking Changes 처리:**
- Major 버전 변경 시 1개 이전 버전 호환성 유지
- 연결 시 버전 체크 후 경고 표시

**롤백 절차:**

```bash
# npm 패키지 롤백 (72시간 이내만 가능)
npm unpublish @ai-native-cad/mcp@x.y.z  # 문제 버전 제거

# 72시간 이후 또는 의존성 있는 경우: deprecate 사용 (권장)
npm deprecate @ai-native-cad/mcp@x.y.z "보안 이슈로 사용 중단. x.y.z+1로 업그레이드하세요."

# 이전 안정 버전을 latest로 재지정
npm dist-tag add @ai-native-cad/mcp@x.y.z-1 latest

# GitHub Pages 롤백
git revert HEAD  # 이전 커밋으로
git push origin gh-pages
```

**npm unpublish 제약사항:**
- 발행 후 72시간 이내에만 unpublish 가능
- 다른 패키지가 의존하면 unpublish 불가
- 운영 환경에서는 `npm deprecate`가 더 안전

**Feature Flag (MAMA/Epic 9):**
```typescript
// 미완성 기능 숨기기
const FEATURE_FLAGS = {
  MAMA_ENABLED: process.env.MAMA_ENABLED === 'true',
};

if (FEATURE_FLAGS.MAMA_ENABLED) {
  // MAMA 관련 UI/기능 활성화
}
```

## Architecture Validation

### Performance Validation Plan

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

// 벤치마크: 성능 측정만 (assertion 없음)
bench('WebSocket RTT', async () => {
  const start = performance.now();
  await sendAndWaitForResponse({ type: 'ping' });
  return performance.now() - start; // RTT 반환
});

// 별도 테스트에서 p95 검증
// test('WebSocket RTT p95 < 50ms', async () => { ... });
```

**기존 측정 근거:**
- 파일 폴링 500ms: 현재 cad-tools의 `setInterval` 기반 감시
- WebSocket 15-50ms: localhost 환경 기준, 네트워크 홉 없음

### Requirements Coverage

| 요구사항 | 아키텍처 커버리지 | 검증 |
|---------|-----------------|------|
| FR1-50 (CAD 엔진) | `cad-engine/` + `apps/cad-mcp/sandbox/` | ✅ 기존 구현 유지 |
| FR51-66 (MAMA) | `apps/cad-mcp/mama/` (Post-MVP) | ⏳ Epic 9 구현 예정 |
| NFR1-17 (성능) | WASM 직접 호출 | ✅ < 1ms |
| NFR 신규 (실시간) | WebSocket (p50 < 15ms) | ⏳ Phase 2 벤치마크 예정 |

### Technical Risk Assessment

| 위험 | 영향 | 완화 전략 | 상태 |
|------|------|----------|------|
| WebSocket 연결 불안정 | 중간 | 재연결 로직 + 온보딩 UI | 설계 완료 |
| npm 패키지 배포 | 낮음 | 표준 npm 배포 프로세스 | 경험 보유 |
| 브라우저 CORS | 낮음 | localhost 예외 | 해결됨 |
| MAMA 통합 복잡성 | 중간 | Post-MVP로 분리 | 범위 조정됨 |

**위험 완화 구현 상세:**

| 위험 | 구체적 구현 패턴 | 참조 |
|------|-----------------|------|
| WebSocket 연결 불안정 | Exponential backoff (1s→2s→4s→8s→16s), maxReconnectAttempts=5, setTimeout 기반 (재귀 X), 재연결 중 selection 큐잉 | [Reconnection Policy](#reconnection-policy) |
| 브라우저 CORS | localhost는 CORS 예외 (브라우저 기본 정책), 프로덕션에서도 `127.0.0.1` 바인딩으로 외부 접근 차단 | [Security Model](#security-model) |
| MAMA 통합 | `MAMA_ENABLED` feature flag로 미완성 기능 숨김, actionHints 확장 가능한 스키마, Epic 9 전용 opt-in | [Phase Compatibility](#phase-compatibility-rollback-strategy) |

### Pattern Consistency Check

| 패턴 | 문서 정의 | 일관성 |
|------|----------|--------|
| WebSocket 메시지 | `type + data + timestamp` | ✅ |
| MCP 도구 응답 | `success + data/error` | ✅ |
| 파일명 규칙 | kebab-case | ✅ 기존 패턴 유지 |
| 컴포넌트 네이밍 | PascalCase | ✅ |
| 엔티티 네이밍 | snake_case | ✅ |

### Implementation Readiness

**블로킹 이슈:** 없음

**다음 단계:**
1. Phase 1: 모노레포 전환 (`pnpm-workspace.yaml`)
2. Phase 1: `apps/viewer/` WebSocket hook 구현
3. Phase 2: `apps/cad-mcp/` stdio + WS 듀얼 서버
4. Phase 3: GitHub Pages 배포 파이프라인

### Validation Summary

| 항목 | 상태 |
|------|------|
| 요구사항 커버리지 | ✅ 100% (MVP 범위) |
| 기술 위험 | ✅ 관리 가능 |
| 패턴 일관성 | ✅ 검증됨 |
| 구현 준비도 | ✅ Ready |

**Overall Status: READY FOR IMPLEMENTATION ✅**

---

_작성: 2026-01-13 | BMAD Architecture Workflow_

