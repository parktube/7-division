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

## Part 2: Web Architecture (Epic 9) ✅ 완료

**Status:** 완료 (2026-01-16)

### 핵심 결정

| 결정 | 선택 | ADR |
|------|------|-----|
| WASM 위치 | MCP 서버 (로컬) | ADR-007 |
| Electron | 제외 (웹 전용) | ADR-007 |
| 실시간 통신 | WebSocket | ADR-007 |
| 배포 | GitHub Pages | ADR-007 |

### 아키텍처

```
GitHub Pages (Viewer)  ←──WebSocket──→  Local MCP Server (WASM)
         ↑                                       ↓
    사용자 검증                              Claude Code
```

### 구현 완료

- pnpm workspace 모노레포 (`apps/viewer`, `apps/cad-mcp`, `packages/shared`)
- WebSocket 실시간 씬 동기화 (~50ms)
- MCP 서버 + WASM 실행 환경
- GitHub Pages 자동 배포

**상세**: [ADR-007](adr/007-web-architecture.md)

---

## Part 3: AX Improvement (Epic 10) ✅ 완료

**Status:** 완료 (2026-01-20)

### 핵심 결정

| 결정 | 선택 | ADR |
|------|------|-----|
| 도구 패턴 | Claude Code 패턴 정렬 | ADR-008 |
| Read-first | Description + 에러 반환 강제 | ADR-008 |
| 도구 분리 | cad_code → glob/read/edit/write/lsp/bash | ADR-008 |

### 도구 매핑

| Claude Code | MCP CAD | 역할 |
|-------------|---------|------|
| Glob | `glob` | 파일 목록 |
| Read | `read` | 파일 읽기 |
| Edit | `edit` | 부분 수정 → 자동 실행 |
| Write | `write` | 전체 작성 → 자동 실행 |
| LSP | `lsp` | 함수 탐색 (Progressive Disclosure) |
| Bash | `bash` | 씬 조회, 내보내기 |

### 구현 완료

- 6개 분리 도구 (`glob`, `read`, `edit`, `write`, `lsp`, `bash`)
- Read-first 패턴 강제 (읽지 않으면 에러)
- Progressive Disclosure (`lsp domains` → `describe` → `schema`)
- 자동 실행 후 결과 반환

**상세**: [ADR-008](adr/008-tool-pattern-alignment.md)

---

## Part 4: MAMA Integration (Epic 11) - 계획됨

> AI 파트너십 강화를 위한 Memory-Augmented Meta Agent 통합

### 4.1 Project Context Analysis

#### Requirements Overview

**Functional Requirements (PRD FR67~FR80):**

| Phase | FR | 요구사항 | ADR |
|-------|-----|---------|-----|
| Core | FR67 | 4 Core Tools MCP 통합 | ADR-0011 |
| Core | FR68 | 결정 저장 + Reasoning Graph | ADR-0013 |
| Core | FR69 | 단일 DB + topic prefix | ADR-0016 |
| Core | FR70 | Outcome Tracking | ADR-0011 |
| Hook | FR71 | SessionStart Hook | ADR-0017 |
| Hook | FR72 | Dynamic Hint Injection | ADR-0015 |
| Hook | FR73 | ActionHints (next_steps) | ADR-0014 |
| Hook | FR74 | LLM-Agnostic Hook Owner | ADR-0018 |
| Intelligence | FR75 | Configurable Context | ADR-0017 |
| Intelligence | FR76 | Adaptive Mentoring | ADR-0020 |
| Intelligence | FR77 | Graph Health Metrics | ADR-0019 |
| Intelligence | FR78 | Anti-Echo Chamber | ADR-0021 |
| Platform | FR79 | LLM Adapter Pattern | ADR-0023 |
| Platform | FR80 | Module Library Recommendation | ADR-0024 |

**Non-Functional Requirements:**
- 임베딩 생성: < 50ms (multilingual-e5)
- 검색 응답: < 100ms (1000개 결정 기준)
- Hook 실행: < 10ms (동기화 작업)

**Scale & Complexity:**
- Primary domain: AI/ML + Full-stack
- Complexity level: High (LLM 통합, 임베딩, Hook 시스템)
- Estimated architectural components: 4 (Core Tools, Hook System, DB, LLM Adapter)

#### Technical Constraints & Dependencies

1. **기존 MAMA 코드 재사용**: 검증된 패턴 활용, 재구현 최소화
2. **LLM 종속성 탈피**: Claude, OpenAI, Ollama 등 어떤 LLM에서도 동작
3. **MCP 서버 내부 통합**: 별도 플러그인 없이 `@ai-native-cad/mcp`에 포함
4. **로컬 우선**: 네트워크 없이 동작 (로컬 DB, 로컬 임베딩)

#### Cross-Cutting Concerns Identified

1. **Hook 일관성**: Claude Code Hook 패턴을 내부화하여 모든 LLM에서 동일 동작
2. **파트너십 철학**: MAMA는 단순 메모리가 아닌 "경험 축적 시스템" (ADR-0010)
3. **설득 기반 접근**: 강제가 아닌 넛징으로 LLM 행동 유도 (ADR-0012)

### 4.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MAMA + CAD Architecture                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐                    ┌─────────────────────────────────┐ │
│  │   LLM           │                    │        CADOrchestrator          │ │
│  │   (Any)         │                    │        (Hook Owner)             │ │
│  │                 │                    │                                 │ │
│  │  Claude API     │                    │  ┌─────────────────────────┐   │ │
│  │  OpenAI API     │◄───────────────────│  │   Hook Registry         │   │ │
│  │  Ollama (Local) │    LLMAdapter      │  │   - onSessionInit       │   │ │
│  │  Claude Code    │                    │  │   - preToolList         │   │ │
│  └─────────────────┘                    │  │   - postExecute         │   │ │
│                                         │  └─────────────────────────┘   │ │
│                                         │              │                  │ │
│                                         │              ▼                  │ │
│                                         │  ┌─────────────────────────┐   │ │
│                                         │  │   MAMA Module           │   │ │
│                                         │  │   - save()              │   │ │
│                                         │  │   - search()            │   │ │
│                                         │  │   - update()            │   │ │
│                                         │  │   - load_checkpoint()   │   │ │
│                                         │  └─────────────────────────┘   │ │
│                                         └────────────────┬────────────────┘ │
│                                                          │                  │
│                                                          ▼                  │
│                                         ┌─────────────────────────────────┐ │
│                                         │        SQLite DB                │ │
│                                         │        (~/.ai-native-cad/data/) │ │
│                                         │                                 │ │
│                                         │  - decisions (+ embeddings)     │ │
│                                         │  - decision_edges               │ │
│                                         │  - sessions                     │ │
│                                         │  - hints                        │ │
│                                         └─────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**핵심 원칙**: CADOrchestrator가 Hook Owner로서 LLM과 독립적으로 Hook을 관리

### 4.3 MCP Tool Interface (LLM 호출 관점)

**LLM(Claude Code)이 MCP를 통해 호출하는 도구:**

```
┌────────────────────────────────────────────────────────────────────┐
│  Claude Code CLI                                                    │
│       │                                                             │
│       ▼ MCP Protocol (JSON-RPC)                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  @ai-native-cad/mcp (MCP Server)                            │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │                                                              │   │
│  │  CAD Tools (기존):                                           │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │ mcp__ai-native-cad__glob   │ 파일 목록               │   │   │
│  │  │ mcp__ai-native-cad__read   │ 파일 읽기               │   │   │
│  │  │ mcp__ai-native-cad__edit   │ 파일 수정 → 자동 실행   │   │   │
│  │  │ mcp__ai-native-cad__write  │ 파일 작성 → 자동 실행   │   │   │
│  │  │ mcp__ai-native-cad__lsp    │ 함수 탐색               │   │   │
│  │  │ mcp__ai-native-cad__bash   │ 명령 실행               │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                                                              │   │
│  │  MAMA Tools (신규 - Epic 11):                                │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │ mcp__ai-native-cad__mama_save       │ 결정/체크포인트 저장 │   │
│  │  │ mcp__ai-native-cad__mama_search     │ 시맨틱 검색      │   │   │
│  │  │ mcp__ai-native-cad__mama_update     │ 결정 결과 업데이트│   │   │
│  │  │ mcp__ai-native-cad__mama_checkpoint │ 체크포인트 로드  │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

#### 4.3.1 MAMA MCP Tool Definitions

**1. mama_save**
```typescript
// MCP Tool: mcp__ai-native-cad__mama_save
interface MamaSaveInput {
  type: 'decision' | 'checkpoint';

  // decision일 때
  topic?: string;           // 예: 'voxel:chicken_design'
  decision?: string;        // 결정 내용
  reasoning?: string;       // 근거 (builds_on: xxx 포함 가능)
  confidence?: number;      // 0.0~1.0

  // checkpoint일 때
  summary?: string;         // 세션 상태 요약
  next_steps?: string[];    // 다음 작업
  open_files?: string[];    // 열린 파일
}

// Output
interface MamaSaveOutput {
  success: boolean;
  id: string;               // 예: 'decision_abc123'
  message: string;
}
```

**2. mama_search**
```typescript
// MCP Tool: mcp__ai-native-cad__mama_search
interface MamaSearchInput {
  query?: string;           // 검색어 (없으면 최근 항목)
  type?: 'decision' | 'checkpoint' | 'all';
  limit?: number;           // 기본 10
}

// Output
interface MamaSearchOutput {
  results: Array<{
    id: string;
    topic: string;
    decision: string;
    similarity: number;     // 0.0~1.0
    created_at: string;
  }>;
}
```

**3. mama_update**
```typescript
// MCP Tool: mcp__ai-native-cad__mama_update
interface MamaUpdateInput {
  id: string;               // decision ID
  outcome: 'success' | 'failed' | 'partial';
  reason?: string;          // 결과 이유
}

// Output
interface MamaUpdateOutput {
  success: boolean;
  message: string;
}
```

**4. mama_checkpoint**
```typescript
// MCP Tool: mcp__ai-native-cad__mama_checkpoint
interface MamaCheckpointInput {}  // 파라미터 없음

// Output
interface MamaCheckpointOutput {
  found: boolean;
  checkpoint?: {
    summary: string;
    next_steps: string[];
    open_files: string[];
    created_at: string;
  };
}
```

#### 4.3.2 Hook System (내부 구현)

Hooks는 MCP 도구가 아니라 **CADOrchestrator의 내부 메커니즘**입니다:

| Hook | 트리거 시점 | 역할 | LLM 호출 여부 |
|------|------------|------|--------------|
| `onSessionInit` | MCP 서버 시작 | 컨텍스트 주입 | ❌ 자동 |
| `preToolList` | tools/list 요청 | 힌트 주입 | ❌ 자동 |
| `postExecute` | 도구 실행 후 | ActionHints 반환 | ❌ 자동 |

**흐름 예시:**
```
1. Claude Code 시작 → MCP 연결
2. [자동] onSessionInit Hook → 최근 결정/체크포인트 컨텍스트 주입
3. Claude Code: tools/list 요청
4. [자동] preToolList Hook → 도구 설명에 DB 힌트 추가
5. Claude Code: mama_save 호출 (MCP 도구)
6. [자동] postExecute Hook → ActionHints 반환
```

### 4.4 Core Architectural Decisions

#### 4.4.1 Partnership Philosophy (ADR-0010)

**결정**: Claude는 자동화 도구가 아니라, 인간 설계자와 함께 성장하는 **설계 마스터(Master)**

| 잘못된 이해 | 올바른 이해 |
|------------|------------|
| MAMA = 메모리 시스템 | MAMA = **파트너십을 만드는 경험 축적 시스템** |
| 효율성이 목표 | **관계의 깊이**가 목표 |
| 매번 리셋 | 경험이 축적됨 |

**상호작용 원칙 계층:**

| Level | 명칭 | 원칙 | 적용 상황 |
|-------|------|------|----------|
| 1 | 설득 (Persuasion) | Tool Description으로 넛징 | 워크플로우 제안 |
| 2 | 경고 (Warning) | 능동적 개입 | 에코챔버 위험, 90일 이상 된 결정 |
| 3 | 강제 (Enforcement) | Hook으로 강제 | 안전, 법 준수, 치명적 오류 |

#### 4.3.2 MAMA Core 4 Tools (ADR-0011)

**결정**: 도구 수 최소화 → Claude 추론 유연성 증가

```typescript
// 4개 핵심 도구
save(type, topic?, decision?, reasoning?, ...)  // Decision 또는 Checkpoint 저장
search(query?, type?, limit?)                    // 시맨틱 검색 또는 최근 항목
update(id, outcome, reason?)                     // 결과 추적
load_checkpoint()                                // 세션 복원
```

**Rationale:**
> "LLM can infer decision relationships from time-ordered search results. Fewer tools = more LLM flexibility."

#### 4.3.3 LLM-Agnostic Hook Abstraction (ADR-0018)

**결정**: 애플리케이션은 LLM을 모른다

```typescript
interface LLMAdapter {
  chat(messages: Message[]): Promise<Response>;
  getToolDefinitions(): ToolDefinition[];
  supportsStreaming(): boolean;
}

// 구현체
class ClaudeAdapter implements LLMAdapter { ... }
class OpenAIAdapter implements LLMAdapter { ... }
class OllamaAdapter implements LLMAdapter { ... }
```

**Rationale:**
- 보안/기밀 클라이언트에 로컬 LLM 제공 가능
- LLM 벤더 종속 탈피
- A/B 테스트 용이

#### 4.3.4 Single DB + Topic Prefix (ADR-0016)

**결정**: 프로젝트별 DB 분리 대신 단일 DB + Topic Prefix

```
~/.ai-native-cad/
├── data/
│   └── mama.db          # 단일 DB
└── domains/             # 도메인 지식 (읽기 전용)
    ├── voxel/
    ├── furniture/
    └── interior/
```

**Topic Prefix 규칙:**
- `voxel:chicken_design` - 복셀 아트 결정
- `furniture:chair_ergonomics` - 가구 설계 결정
- `interior:wall_thickness` - 인테리어 설계 결정

**Rationale:**
- 크로스 도메인 검색 용이 (가구 설계 시 인테리어 결정 참조)
- 현재 MAMA 코드 재사용
- 단일 DB 파일로 간단한 배포

### 4.4 Hook System Architecture (핵심)

Hook 시스템은 Claude Code의 Hook 패턴을 **CAD 내부에서 미러링**하여 모든 LLM에서 동일하게 동작합니다.

#### 4.4.1 Hook Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Hook System Flow                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [세션 시작]                                                                  │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │ 1. onSessionInit (SessionStart Hook)                        │            │
│  │    - load_checkpoint() 자동 호출                              │            │
│  │    - 마지막 체크포인트 로드                                     │            │
│  │    - 최근 결정 요약 (search type=decision limit=5)            │            │
│  │    - 프로젝트별 힌트 준비                                       │            │
│  │                                                               │            │
│  │    Output: context_injection (none/hint/full 모드별)          │            │
│  └─────────────────────────────────────────────────────────────┘            │
│       │                                                                      │
│       ▼                                                                      │
│  [도구 목록 요청 (tools/list)]                                               │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │ 2. preToolList (Dynamic Hint Injection Hook)                │            │
│  │    - DB에서 도구별 hints 조회                                  │            │
│  │    - 기본 description + 동적 힌트 조합                          │            │
│  │    - LLM에게 힌트가 포함된 도구 정의 전달                         │            │
│  │                                                               │            │
│  │    Example:                                                   │            │
│  │    "💡 외벽 두께 표준: 200mm (decision_xxx 기반)"              │            │
│  └─────────────────────────────────────────────────────────────┘            │
│       │                                                                      │
│       ▼                                                                      │
│  [LLM이 도구 호출 결정]                                                       │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │ 3. preExecute (Optional: Lock Guard)                        │            │
│  │    - 잠긴 엔티티 수정 시도 차단                                  │            │
│  │    - 동적 제약 조건 체크                                        │            │
│  │                                                               │            │
│  │    Note: Level 3 (Enforcement) 상황에서만 사용                  │            │
│  └─────────────────────────────────────────────────────────────┘            │
│       │                                                                      │
│       ▼                                                                      │
│  [도구 실행 (run_cad_code, edit, write 등)]                                  │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │ 4. postExecute (ActionHints Hook)                           │            │
│  │    - next_steps: 다음 작업 제안                                 │            │
│  │    - module_hints: 관련 모듈 추천                               │            │
│  │    - save_suggestion: 결정 저장 제안                            │            │
│  │                                                               │            │
│  │    Output: { success, data, actionHints: { next_steps, ... }} │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 4.4.2 Hook Implementation Details

**1. onSessionInit Hook (FR71)**

```typescript
interface SessionInitResult {
  checkpoint?: {
    summary: string;
    next_steps: string[];
    open_files: string[];
  };
  recentDecisions: Decision[];
  contextMode: 'none' | 'hint' | 'full';
}

async function onSessionInit(): Promise<SessionInitResult> {
  // 1. 마지막 체크포인트 로드
  const checkpoint = await mama.loadCheckpoint();

  // 2. 최근 결정 검색
  const decisions = await mama.search({ type: 'decision', limit: 5 });

  // 3. 사용자 설정에 따른 컨텍스트 모드
  const mode = config.contextInjection; // 'none' | 'hint' | 'full'

  return { checkpoint, recentDecisions: decisions, contextMode: mode };
}
```

**컨텍스트 주입 모드 (ADR-0017):**

| Mode | 동작 | 출력 예시 |
|------|------|----------|
| `none` | 주입 없음 | (없음) |
| `hint` | 한 줄 힌트 | "🔍 3 related decisions found" |
| `full` | 전체 내용 | 결정 전체 + reasoning 포함 |

**2. preToolList Hook (FR72) - Dynamic Hint Injection (ADR-0015)**

```typescript
async function preToolList(tools: ToolDefinition[]): Promise<ToolDefinition[]> {
  return Promise.all(tools.map(async (tool) => {
    // DB에서 해당 도구의 힌트 조회
    const hints = await mama.db.query(
      `SELECT hint_text FROM hints WHERE tool_name = ? ORDER BY priority DESC LIMIT 3`,
      [tool.name]
    );

    if (hints.length === 0) return tool;

    // 기본 description + 동적 힌트 조합
    const hintSection = hints.map(h => `💡 ${h.hint_text}`).join('\n');

    return {
      ...tool,
      description: `${tool.description}\n\n${hintSection}`
    };
  }));
}
```

**핵심 통찰 (ADR-0015):**
> Claude가 "이 힌트가 필요해"라고 알면 이미 알고 있는 것. 모르면 get_hints 호출도 안 함.
> 따라서 **Tool Definition 자체에 힌트를 자동 주입**해야 함.

**3. postExecute Hook (FR73) - ActionHints (ADR-0014)**

```typescript
interface CADToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  actionHints?: {
    next_steps?: {
      action: string;        // "add_door"
      description: string;   // "문 배치하기"
      relevance: string;     // "방이 생성되었으니 출입구 필요"
      optional: boolean;
    }[];
    module_hints?: string[];
    save_suggestion?: {
      topic: string;
      reason: string;
    };
  };
}

async function postExecute(toolName: string, result: unknown): Promise<CADToolResult> {
  const actionHints = await generateActionHints(toolName, result);

  return {
    success: true,
    data: result,
    actionHints
  };
}
```

#### 4.4.3 Hook Registry Implementation

```typescript
// apps/cad-mcp/src/mama/hooks.ts
interface HookRegistry {
  onSessionInit: () => Promise<SessionInitResult>;
  preToolList: (tools: ToolDefinition[]) => Promise<ToolDefinition[]>;
  preExecute?: (toolName: string, args: unknown) => Promise<{ allow: boolean; reason?: string }>;
  postExecute: (toolName: string, result: unknown) => Promise<CADToolResult>;
}

class CADOrchestrator {
  private hooks: HookRegistry;
  private mamaModule: MAMAModule;

  constructor(config: MAMAConfig) {
    this.mamaModule = new MAMAModule(config);
    this.hooks = {
      onSessionInit: () => this.mamaModule.initSession(),
      preToolList: (tools) => this.mamaModule.injectHints(tools),
      postExecute: (name, result) => this.mamaModule.generateActionHints(name, result),
    };
  }

  async handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    // tools/list 요청 시 preToolList Hook 실행
    if (request.method === 'tools/list') {
      const tools = getBaseToolDefinitions();
      const enhancedTools = await this.hooks.preToolList(tools);
      return { tools: enhancedTools };
    }

    // 도구 실행 시 postExecute Hook 실행
    if (request.method === 'tools/call') {
      const result = await executeToolCall(request);
      return await this.hooks.postExecute(request.params.name, result);
    }

    return handleOtherRequests(request);
  }
}
```

### 4.5 Reasoning Graph (ADR-0013)

결정 간의 관계를 그래프로 표현하여 지식의 진화를 추적합니다.

#### 4.5.1 Edge Types

| Edge | 자동? | 의미 | 패턴 |
|------|-------|------|------|
| `supersedes` | ✅ (같은 topic) | 이전 결정 대체 | (자동) |
| `builds_on` | ❌ | 기존 결정 위에 구축 | `builds_on: decision_xxx` |
| `debates` | ❌ | 대안 제시 | `debates: decision_xxx` |
| `synthesizes` | ❌ | 여러 결정 종합 | `synthesizes: [id1, id2]` |

#### 4.5.2 Graph Visualization

```
Decision A (topic: cad:wall:standard)
    │
    ├─supersedes→ Decision A' (같은 topic, 최신 결정)
    │
    ├─builds_on→ Decision B (topic: cad:wall:implementation)
    │
    └─debates→ Decision C (topic: cad:wall:alternative)
                   │
                   └─synthesizes→ Decision D (최종 결론)
```

#### 4.5.3 Edge 표현 방식

**별도 API가 아닌 reasoning 필드에 패턴으로 표현:**

```typescript
save({
  type: "decision",
  topic: "cad:wall:thickness",
  decision: "외벽 200mm, 내벽 150mm 표준화",
  reasoning: `builds_on: decision_cad_wall_123_abc.
    이전 결정에서 150mm 단일 표준을 정했지만,
    외벽과 내벽 구분이 필요함을 발견.`,
});
```

**Rationale:**
- 추가 API 없이 관계 표현
- 자연어 reasoning에 맥락 포함
- Claude가 자연스럽게 패턴 학습

### 4.6 Data Architecture

#### 4.6.1 Database Schema

```sql
-- decisions: 설계 결정 저장 (MAMA Core)
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,           -- 'decision_cad_wall_abc123'
  topic TEXT NOT NULL,           -- 'voxel:chicken', 'furniture:chair' 등
  decision TEXT NOT NULL,        -- "rect는 center-based 좌표"
  reasoning TEXT,                -- 왜 이 결정을 했는지 (5-layer narrative)
  outcome TEXT,                  -- 'success', 'failed', 'partial', NULL(pending)
  confidence REAL DEFAULT 0.5,   -- 0.0 ~ 1.0
  embedding BLOB,                -- Float32Array (384-dim, multilingual-e5)
  created_at INTEGER NOT NULL,   -- Unix timestamp
  updated_at INTEGER
);

CREATE INDEX idx_decisions_topic ON decisions(topic);
CREATE INDEX idx_decisions_created ON decisions(created_at DESC);

-- decision_edges: 결정 관계 (Reasoning Graph)
CREATE TABLE decision_edges (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relationship TEXT NOT NULL,    -- 'supersedes', 'builds_on', 'debates', 'synthesizes'
  created_at INTEGER NOT NULL,
  PRIMARY KEY (from_id, to_id, relationship),
  FOREIGN KEY (from_id) REFERENCES decisions(id),
  FOREIGN KEY (to_id) REFERENCES decisions(id)
);

-- sessions: 세션/체크포인트
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- 'checkpoint_xxx'
  summary TEXT NOT NULL,         -- 4-section format
  next_steps TEXT,               -- JSON array
  open_files TEXT,               -- JSON array
  created_at INTEGER NOT NULL
);

-- hints: 도구별 동적 힌트
CREATE TABLE hints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,       -- 'edit', 'write', 'run_cad_code'
  hint_text TEXT NOT NULL,       -- "rect의 x,y는 CENTER 좌표입니다"
  priority INTEGER DEFAULT 5,    -- 1(낮음) ~ 10(높음)
  tags TEXT,                     -- JSON: ["rect", "coordinate", "center"]
  source TEXT DEFAULT 'system',  -- 'user', 'system', 'learned'
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_hints_tool ON hints(tool_name);
```

#### 4.6.2 5-Layer Narrative for Reasoning

reasoning 필드는 다음 5가지 층위를 포함해야 합니다:

1. **Context** - 어떤 문제/상황
2. **Evidence** - 무엇이 이것이 작동한다는 것을 증명하는가 (테스트, 벤치마크, 이전 경험)
3. **Alternatives** - 어떤 다른 옵션이 고려되었고 왜 기각되었는가
4. **Risks** - 알려진 한계 또는 실패 모드
5. **Rationale** - 이 선택에 대한 최종 추론

#### 4.6.3 Topic Prefix Convention

```
{domain}:{entity}:{aspect}

예시:
- voxel:chicken:color_palette    (복셀 닭의 색상 팔레트)
- voxel:isometric:z_order        (이소메트릭 z-order 규칙)
- furniture:chair:dimensions     (의자 치수)
- interior:wall:thickness        (벽 두께 표준)
```

### 4.7 LLM-Agnostic Architecture (ADR-0023)

#### 4.7.1 Adapter Pattern

```typescript
// apps/cad-mcp/src/llm/adapter.ts
interface LLMAdapter {
  chat(messages: Message[], tools?: ToolDef[]): Promise<LLMResponse>;
  supportsStreaming(): boolean;
  supportsToolCalling(): boolean;
}

interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  done: boolean;
}

// Claude Adapter
class ClaudeAdapter implements LLMAdapter {
  async chat(messages: Message[], tools?: ToolDef[]): Promise<LLMResponse> {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      messages,
      tools: tools?.map(toClaudeTool),
    });
    return mapClaudeResponse(response);
  }

  supportsStreaming() { return true; }
  supportsToolCalling() { return true; }
}

// Ollama Adapter (로컬 LLM)
class OllamaAdapter implements LLMAdapter {
  async chat(messages: Message[], tools?: ToolDef[]): Promise<LLMResponse> {
    const response = await ollama.chat({
      model: this.modelName, // 'exaone3.5:2.4b', 'llama3.1:8b'
      messages,
      tools: tools?.map(toOllamaTool),
    });
    return mapOllamaResponse(response);
  }

  supportsStreaming() { return true; }
  supportsToolCalling() { return this.modelName.includes('llama'); }
}
```

#### 4.7.2 Agent Loop Structure

```typescript
// apps/cad-mcp/src/llm/agent-loop.ts
async function runAgentLoop(
  adapter: LLMAdapter,
  prompt: string,
  tools: ToolDef[]
): Promise<string> {
  let messages: Message[] = [{ role: 'user', content: prompt }];

  while (true) {
    // 1. LLM 호출
    const response = await adapter.chat(messages, tools);

    // 2. 완료 확인
    if (response.done || !response.toolCalls?.length) {
      return response.content;
    }

    // 3. 도구 실행
    for (const call of response.toolCalls) {
      const tool = tools.find(t => t.name === call.name);
      if (!tool) continue;

      const result = await tool.execute(call.input);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }

    // 4. LLM에게 결과 전달
    messages.push({ role: 'assistant', content: response.content });
  }
}
```

#### 4.7.3 LLM 역할 분담

| 역할 | 메인 LLM (Claude/Ollama) | 로컬 LLM (exaone 2.4B) |
|------|-------------------------|------------------------|
| 사용자 대화 | ✅ | ❌ |
| 복잡한 추론 | ✅ | ❌ |
| **ActionHints 생성** | ✅ | ❌ |
| **임베딩 생성** | ❌ | ✅ (multilingual-e5) |
| **검색 결과 랭킹** | ❌ | ✅ |
| 최종 코드 결정 | ✅ | ❌ |

**핵심**: 로컬 LLM은 추론 불가 → 임베딩 + 랭킹만 담당

#### 4.7.4 PoC 검증 결과 (ADR-0023)

| 모델 | 크기 | 응답시간 | 코드 품질 |
|------|------|----------|----------|
| **exaone3.5:2.4b** | 1.6GB | **8.7s** | ⭐⭐⭐ 상세 |
| llama3.1:8b | 4.9GB | 19.1s | ⭐⭐ 기본 |
| qwen2.5-coder:7b | 4.7GB | ~11s | ⭐⭐⭐ 코딩 특화 |

**권장**: `qwen2.5-coder:7b` - 코딩 특화 + 8GB VRAM 적합

### 4.8 Module Library & Recommendation (ADR-0024)

#### 4.8.1 모듈 메타데이터

```javascript
/**
 * @module house_lib
 * @description 집, 건물을 생성하는 모듈. 벽, 지붕, 문, 창문 포함.
 * @tags building, architecture, village
 * @example new House('h1', 0, 0).build()
 */
class House {
  // ...
}
```

#### 4.8.2 추천 알고리즘

```
Score = (semantic_similarity × 0.6) + (usage_frequency × 0.3) + (recency × 0.1)
```

| 요소 | 가중치 | 설명 |
|------|--------|------|
| semantic_similarity | 0.6 | 쿼리와 description 임베딩 유사도 |
| usage_frequency | 0.3 | 사용 횟수 정규화 |
| recency | 0.1 | 최근 사용일 기준 |

#### 4.8.3 2-Layer 추천 시스템

```
[Layer 1] 임베딩 검색 (30ms) - 후보 필터링
  MAMA: "마을" → house(0.87), tree(0.72), cat(0.23)
                    │
                    ▼
[Layer 2] LLM 추천 (선택적) - 최종 결정
  Claude: "마을에는 house와 tree가 필수입니다.
           먼저 House로 기본 구조를 만들고,
           Tree로 자연 요소를 추가하세요."
```

### 4.9 Deployment Architecture

**결정**: MCP 서버 내부 통합 (별도 플러그인 X)

```
apps/cad-mcp/
├── src/
│   ├── server.ts           # MCP + WebSocket 서버
│   ├── mama/               # MAMA 모듈 (통합)
│   │   ├── index.ts        # MAMAModule 클래스
│   │   ├── db.ts           # SQLite 연결
│   │   ├── tools.ts        # 4 Core Tools
│   │   ├── hooks.ts        # Hook Registry
│   │   ├── search.ts       # 시맨틱 검색
│   │   └── embeddings.ts   # 임베딩 생성
│   ├── llm/
│   │   ├── adapter.ts      # LLMAdapter 인터페이스
│   │   ├── claude.ts       # Claude Adapter
│   │   └── ollama.ts       # Ollama Adapter
│   └── ...
└── package.json            # @ai-native-cad/mcp
```

**저장 구조:**

```
~/.ai-native-cad/
├── data/
│   └── mama.db             # 단일 DB (decisions, edges, sessions, hints)
├── domains/                # 도메인 지식 (읽기 전용)
│   ├── voxel/
│   │   ├── DOMAIN.md
│   │   ├── workflows/
│   │   ├── rules/
│   │   └── functions/
│   ├── furniture/
│   └── interior/
└── config.json             # MAMA 설정 (contextInjection 등)
```

**장점**:
- `npm install` 시 MAMA 포함
- 별도 설정 불필요
- 단일 패키지로 배포

### 4.10 Implementation Phases

| Phase | 범위 | 산출물 | FR |
|-------|------|--------|-----|
| **Phase 1: Core** | DB + 4 Tools | mama.db, save/search/update/load | FR67-70 |
| **Phase 2: Hook** | Hook System | onSessionInit, preToolList, postExecute | FR71-74 |
| **Phase 3: Intelligence** | 컨텍스트 + 멘토링 | Configurable Context, Adaptive Mentoring | FR75-78 |
| **Phase 4: Platform** | LLM Adapter + 모듈 추천 | LLMAdapter, Module Library | FR79-80 |

#### Phase 1: Core (FR67-70)

- [ ] SQLite DB 스키마 구현 (`decisions`, `decision_edges`, `sessions`, `hints`)
- [ ] `save()` 도구 구현 (Decision + Checkpoint)
- [ ] `search()` 도구 구현 (시맨틱 + 최근 항목)
- [ ] `update()` 도구 구현 (outcome tracking)
- [ ] `load_checkpoint()` 도구 구현
- [ ] Topic Prefix 규칙 적용
- [ ] Reasoning Graph edge 파싱

#### Phase 2: Hook (FR71-74)

- [ ] `onSessionInit` Hook 구현
- [ ] `preToolList` Hook 구현 (Dynamic Hint Injection)
- [ ] `postExecute` Hook 구현 (ActionHints)
- [ ] HookRegistry 클래스 구현
- [ ] CADOrchestrator 통합
- [ ] Configurable Context 모드 (none/hint/full)

#### Phase 3: Intelligence (FR75-78)

- [ ] Adaptive Mentoring 구현 (ADR-0020)
- [ ] Graph Health Metrics 구현 (ADR-0019)
- [ ] Anti-Echo Chamber 경고 구현 (ADR-0021)
- [ ] 90일 이상 된 결정 경고

#### Phase 4: Platform (FR79-80)

- [ ] LLMAdapter 인터페이스 정의
- [ ] ClaudeAdapter 구현
- [ ] OllamaAdapter 구현
- [ ] 모듈 메타데이터 파싱 (JSDoc)
- [ ] 모듈 추천 API 구현

### 4.11 Architecture Validation

#### Performance Validation Plan

| 메트릭 | 목표 | 측정 방법 |
|--------|------|----------|
| 임베딩 생성 | < 50ms | multilingual-e5 로컬 실행 |
| 검색 응답 | < 100ms | 1000개 결정, cosine similarity |
| Hook 실행 | < 10ms | preToolList, postExecute |
| DB 쿼리 | < 5ms | SQLite indexed query |

#### Requirements Coverage

| 요구사항 | 아키텍처 커버리지 | 검증 |
|---------|-----------------|------|
| FR67-70 (Core) | MAMA Module (4 Tools) | Phase 1 |
| FR71-74 (Hook) | Hook Registry | Phase 2 |
| FR75-78 (Intelligence) | Configurable Context, Mentoring | Phase 3 |
| FR79-80 (Platform) | LLMAdapter, Module Library | Phase 4 |

#### Technical Risk Assessment

| 위험 | 영향 | 완화 전략 |
|------|------|----------|
| 임베딩 모델 크기 | 중간 | multilingual-e5-small (118MB) 사용 |
| 로컬 LLM 성능 | 낮음 | PoC 검증 완료 (exaone 2.4B) |
| Hook 복잡도 | 중간 | Claude Code 패턴 미러링으로 검증된 설계 |

#### Pattern Consistency Check

| 패턴 | 문서 정의 | 일관성 |
|------|----------|--------|
| 4 Core Tools | save, search, update, load_checkpoint | ✅ ADR-0011 |
| Hook 시스템 | onSessionInit, preToolList, postExecute | ✅ ADR-0015, ADR-0018 |
| Reasoning Graph | supersedes, builds_on, debates, synthesizes | ✅ ADR-0013 |
| Topic Prefix | {domain}:{entity}:{aspect} | ✅ ADR-0016 |

### 4.12 ADR Reference Table

| ADR | 제목 | 핵심 결정 |
|-----|------|----------|
| [ADR-0010](./adr/0010-partnership-philosophy.md) | Partnership Philosophy | MAMA = 파트너십을 만드는 경험 축적 시스템 |
| [ADR-0011](./adr/0011-mama-core-reuse.md) | MAMA Core 4 Tools | save, search, update, load_checkpoint |
| [ADR-0012](./adr/0012-persuader-pattern.md) | Persuader Pattern | 강제가 아닌 넛징으로 LLM 행동 유도 |
| [ADR-0013](./adr/0013-edge-types-reasoning.md) | Edge Types | reasoning 필드에 관계 패턴 표현 |
| [ADR-0014](./adr/0014-progressive-workflow.md) | Progressive Workflow | next_steps로 다음 작업 제안 |
| [ADR-0015](./adr/0015-dynamic-hint-injection.md) | Dynamic Hint Injection | Tool Definition에 DB 힌트 자동 주입 |
| [ADR-0016](./adr/0016-project-specific-db.md) | Single DB + Topic Prefix | 단일 DB, topic prefix로 도메인 구분 |
| [ADR-0017](./adr/0017-configurable-context.md) | Configurable Context | none/hint/full 모드 |
| [ADR-0018](./adr/0018-llm-agnostic-hooks.md) | LLM-Agnostic Hooks | CADOrchestrator가 Hook Owner |
| [ADR-0019](./adr/0019-graph-health-metrics.md) | Graph Health Metrics | 그래프 건강도 측정 |
| [ADR-0020](./adr/0020-adaptive-mentoring.md) | Adaptive Mentoring | 사용자 수준별 힌트 조절 |
| [ADR-0021](./adr/0021-anti-echo-chamber.md) | Anti-Echo Chamber | 에코챔버 방지 경고 |
| [ADR-0022](./adr/0022-meta-tooling.md) | run_cad_code | JS 실행으로 도구 조합 |
| [ADR-0023](./adr/0023-llm-agnostic-agent-architecture.md) | LLM-Agnostic Agent | LLMAdapter 패턴 |
| [ADR-0024](./adr/0024-module-library-recommendation.md) | Module Library | 시맨틱 모듈 추천 |

---

## Related Documents

- [PRD](./prd.md) - 제품 요구사항
- [Epics](./epics.md) - 에픽 목록
- [ADR-007](./adr/007-web-architecture.md) - 웹 아키텍처 결정
- [ADR-008](./adr/008-tool-pattern-alignment.md) - MCP 도구 패턴 정렬

---

_Architecture Document - AI-Native CAD | BMAD Architecture Workflow_
