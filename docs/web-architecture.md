---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
inputDocuments:
  - docs/prd.md
  - docs/epics.md
  - docs/epic-9-proposal.md
  - docs/ux-design-specification.md
workflowType: 'architecture'
lastStep: 6
project_name: 'r2-7f-division'
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

| 컴포넌트 | 기술 | 용도 |
|---------|------|------|
| WebSocket Server | ws (Node.js) | MCP → Viewer 실시간 푸시 |
| WebSocket Client | native WebSocket | Viewer → MCP 연결 |
| MCP SDK | @modelcontextprotocol/sdk | Claude Code stdio 연동 |
| 모노레포 | pnpm workspace | 패키지 관리, 의존성 공유 |

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

**Deferred Decisions (Post-MVP):**
- isomorphic-git 내장 버전관리

### Communication Architecture

**결정: WebSocket**

| 항목 | 값 |
|------|-----|
| 프로토콜 | WebSocket |
| 포트 | 3000 (로컬) |
| 지연시간 | ~15ms |
| 양방향 | O |

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

**버전 동기화:**
- Viewer가 MCP 버전 체크
- 불일치 시 업데이트 안내 표시

### Future Extension: isomorphic-git

**상태: Post-MVP**

LLM이 직접 버전관리를 "이해하고" 수행하는 시스템:

```javascript
// 샌드박스 바인딩 (향후 추가)
snapshot(message)    // 현재 상태 저장
getHistory()         // 이력 조회
restore(version)     // 복원
diff(v1, v2)        // 비교
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

**Rationale:**
- 타입 안전성 보장
- 기존 scene.json 구조와 일관성
- 디버깅 용이 (timestamp)

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
| **Viewer** | WebSocket 연결 실패 | Onboarding UI 표시 |
| **Viewer** | 메시지 파싱 실패 | console.error + 무시 |
| **MCP** | WASM 실행 에러 | ToolResult.error 반환 |
| **MCP** | WebSocket 연결 끊김 | 로그 + 재연결 대기 |

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
ws.send({ type: 'scene_update', data: { scene: {...} }, timestamp: Date.now() })

// ❌ 잘못: success 없는 도구 응답
return { entities: [...] }

// ✅ 올바름: success 필드 포함
return { success: true, data: { entities: [...] } }
```

## Project Structure & Boundaries

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
│           │   └── handlers.ts
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

## Architecture Validation

### Requirements Coverage

| 요구사항 | 아키텍처 커버리지 | 검증 |
|---------|-----------------|------|
| FR1-50 (CAD 엔진) | `cad-engine/` + `apps/cad-mcp/sandbox/` | ✅ 기존 구현 유지 |
| FR51-66 (MAMA) | `apps/cad-mcp/mama/` (Post-MVP) | ⏳ Epic 9 구현 예정 |
| NFR1-17 (성능) | WASM 직접 호출 | ✅ < 1ms |
| NFR 신규 (실시간) | WebSocket (~15ms) | ✅ 파일 폴링 대비 30x 개선 |

### Technical Risk Assessment

| 위험 | 영향 | 완화 전략 | 상태 |
|------|------|----------|------|
| WebSocket 연결 불안정 | 중간 | 재연결 로직 + 온보딩 UI | 설계 완료 |
| npm 패키지 배포 | 낮음 | 표준 npm 배포 프로세스 | 경험 보유 |
| 브라우저 CORS | 낮음 | localhost 예외 | 해결됨 |
| MAMA 통합 복잡성 | 중간 | Post-MVP로 분리 | 범위 조정됨 |

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

