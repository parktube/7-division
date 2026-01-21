---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - docs/analysis/product-brief-r2-7f-division-2025-12-14.md
  - docs/ax-design-guide.md
  - docs/ai-native-cad-proposal.md
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 2
workflowType: 'prd'
lastStep: 2
project_name: 'AI-Native CAD'
user_name: 'Hoons'
date: '2025-12-14'
---

# Product Requirements Document - AI-Native CAD

**Author:** Hoons
**Date:** 2025-01-06
**Last Updated:** 2026-01-16
**Status:** Epic 1~10 완료, Epic 11 (MAMA Integration) 계획 중

---

## Executive Summary

AI-Native CAD는 "모르는 것도 괜찮아요. 함께 만들어가요" 패러다임의 CAD 도구이다.
AI는 자동 생성기가 아닌 협업적 창작 파트너로서, 질문하고 설명하고 함께 고민한다.
결과물뿐 아니라 사용자의 성장도 성공의 정의에 포함된다.

> **검증된 경험**: Claude Code와 비개발자가 6개월간 SpineLift를 개발한 경험.
> 코드를 모르지만 아키텍처를 설계하고, 기술 결정을 내리고, 제품을 만들었다.
> 이 경험을 CAD 영역으로 확장한다.

### What Makes This Special

1. **협업적 창작**: AI가 바로 만들지 않고, 질문하고 설명하며 함께 발전시킨다
2. **AX-UX 대칭**: AI에게 ActionHints, 인간에게 DesignHints - 둘 다 더 나은 결과로 유도
3. **도구 허들 제로**: 조작은 AI가, 의사결정은 인간이 - 학습 곡선 6개월 → 0분
4. **사용자 성장**: 결과물 + CAD 지식 습득 (대화하며 자연스럽게 배움)
5. **Web-First Architecture**: 웹 브라우저 + Local MCP, 설치 없이 즉시 시작

## Project Classification

**Technical Type:** Web App (브라우저 + Local MCP)
**Domain:** Design Tools / Creative
**Complexity:** High (새로운 패러다임)
**Project Context:** Epic 1~10 완료, MAMA Integration 계획 중

---

## Core Philosophy

### AX-UX 대칭 원칙

```
┌─────────────────────────────────────────────────────────────┐
│  AX (Agent eXperience)                                      │
│  "AI의 추론을 막지 않는다"                                    │
│                                                             │
│  ActionHints로 다음 방향 제시                                 │
│  → AI가 더 나은 도구 선택                                    │
└─────────────────────────────────────────────────────────────┘
                          ↕ 미러
┌─────────────────────────────────────────────────────────────┐
│  UX (User eXperience)                                       │
│  "인간의 상상력을 유도한다"                                    │
│                                                             │
│  DesignHints로 다음 방향 제시                                 │
│  → 인간이 더 나은 디자인                                      │
└─────────────────────────────────────────────────────────────┘
```

**핵심 통찰**: 인간도 CoT(Chain of Thought)를 한다. 좋은 질문이 좋은 사고를 유도한다.

### AI의 역할

| ❌ 하지 않는 것 | ✅ 하는 것 |
|---------------|----------|
| "알겠습니다" 하고 바로 생성 | 1-2개 질문 먼저 |
| 결과만 전달 | 왜 그렇게 하는지 설명 |
| 단일 결과물 | 선택지와 트레이드오프 제시 |
| 사용자를 구경꾼으로 | 사용자를 공동 창작자로 |

### DesignHints 구조

```typescript
interface DesignHints {
  next_questions: string[];    // "등받이 각도는 어떻게 할까요?"
  inspirations: string[];      // "에르곤 의자는 15도 기울기가 표준이에요"
  knowledge: string[];         // "좌석 깊이가 깊으면 허리 지지가 약해져요"
  options: {
    label: string;             // "A: 편안함 우선"
    tradeoff: string;          // "깊이 45cm, 제조 복잡도 중간"
  }[];
  constraints: string[];       // "이 각도면 3D 프린팅 시 서포트 필요"
}
```

---

## Target Users

### 우리의 사용자는

| 페르소나 | 니즈 | 기존 솔루션 문제 |
|---------|------|-----------------|
| **커스텀 물건 원하는 사람** | "내 책상에 맞는 선반" | 쿠팡에 없음, CAD 어려움 |
| **세상에 없는 걸 만드는 사람** | 아이디어 → 도면 | 전문가 고용 비용 |
| **CAD 배우고 싶은 사람** | 지식 습득 | 학습 곡선 6개월+ |
| **제품 아이디어 있는 사람** | 프로토타입 직접 제작 | 도구 진입장벽 |
| **디자인 공유하고 싶은 사람** | 완성도 있는 도면 | 전문 도구 필요 |

### 우리의 사용자가 아닌 사람

- 쿠팡/아마존에서 살 수 있는 물건으로 충분한 사람
- "그냥 빨리 만들어줘"만 원하는 사람 (→ Zoo, Adam 추천)
- 이미 CAD 전문가인 사람 (→ 기존 도구가 더 효율적)

### 공통 특성

- **적극적**: 배우려는 의지가 있음
- **창작 욕구**: 자신만의 것을 원함
- **대화 의지**: AI와 협업할 준비가 됨

---

## Technical Architecture

### 목표 아키텍처

```
Claude Code ──stdio──▶ MCP Server ──WebSocket──▶ Viewer (Web)
                           │
                      WASM Engine
                      File System
```

- **CAD 엔진**: Rust → WASM (도형, 변환, Boolean, 텍스트)
- **MCP 서버**: Claude Code 연동 (stdio) + Viewer 연동 (WebSocket)
- **뷰어**: React 19 + GitHub Pages 호스팅
- **배포**: `npx @ai-native-cad/mcp start` + 웹 브라우저

### 핵심 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| 통신 | WebSocket | 파일 폴링 대비 30배 빠름 (~15ms) |
| 배포 | GitHub Pages + npm | 설치 없이 즉시 시작, 업데이트 간편 |
| 보안 | localhost-only | 로컬 개발 도구, 원격 접근 불필요 |

### 완료된 기반 (Epic 1~9)

- WASM 엔진, 도형 6종, Boolean 연산, 텍스트 렌더링
- React 뷰어 (3패널, 스케치 모드)
- MCP 도메인 도구 (cad_code, discovery, scene, export, module)
- Epic 10에서 Claude Code 패턴 일치 도구로 재설계 예정

상세: architecture.md 참조

---

## Success Criteria

### User Success

| 지표 | 목표 |
|------|------|
| 첫 결과물까지 시간 | < 5분 |
| 학습 시간 | 0분 (대화하면서 자연스럽게) |
| "원하는 결과" 도달률 | 측정 예정 |
| **사용자 CAD 지식 습득** | 대화 후 관련 용어 이해 |
| **처음 의도보다 나은 결과** | AI 제안으로 개선된 비율 |

**Aha! Moment**:

- Phase 1: "말했더니 진짜 그려졌다"
- Phase 2+: "AI 덕분에 더 좋은 디자인이 됐다"
- Ultimate: "나도 이제 CAD 개념을 알게 됐다"

### Business Success

- **MVP**: 기술 검증 + 도메인 확장 + 사용자 검증 (스켈레톤 → 포즈 변경 → Selection)
- **Post-MVP**: 시장 검증, 3D 확장

### Technical Success

- ✅ WASM 엔진 직접 실행 성공
- ✅ SVG 출력 정상 동작
- ✅ Claude Code에서 도구 호출 원활
- MCP + WebSocket 실시간 동기화 (진행 중)
- GitHub Pages 배포 성공 (진행 중)

---

## Functional Requirements

### 완료 (FR1~FR66) ✅

| Epic | FR | 요약 |
|------|-----|------|
| 1~3 | FR1~FR20 | 도형, 스타일, 변환, Canvas 뷰어 |
| 4~5 | FR21~FR29 | 그룹화, 피봇, Selection UI |
| 7 | FR31~FR42 | 3패널, 트리뷰, 스케치 모드, 이중 좌표 |
| 8 | FR43~FR50 | Boolean 연산, 기하 분석, 텍스트 렌더링 |
| 9 | FR51~FR58 | 웹 아키텍처 (모노레포, WebSocket, GitHub Pages, npm) |
| 10 | FR59~FR66 | AX 개선 (Claude Code 패턴 MCP 도구: glob, read, edit, write, lsp, bash) |

상세: [epics.md](./epics.md), [ADR-007](./adr/007-web-architecture.md), [ADR-008](./adr/008-tool-pattern-alignment.md) 참조

### 계획 중: Epic 11 - MAMA Integration (FR67~FR87)

> AI 파트너십 강화를 위한 Memory-Augmented Meta Agent 통합

#### 핵심 철학 (ADR-0010)

**Claude는 자동화 도구가 아니라, 인간 설계자와 경험을 공유하며 함께 성장하는 설계 마스터(Master)**

| 잘못된 이해 | 올바른 이해 |
|------------|------------|
| MAMA = 메모리 시스템 | MAMA = **파트너십을 만드는 경험 축적 시스템** |
| 효율성이 목표 | **관계의 깊이**가 목표 |
| 매번 리셋 | 경험이 축적됨 |

#### Phase 11.1: Core (MVP)

| ID | 요구사항 | ADR | 수용 기준 |
|----|---------|-----|----------|
| FR67 | 4 Core Tools MCP 통합 | [ADR-0011](./adr/0011-mama-core-reuse.md) | save, search, update, load_checkpoint MCP 도구로 제공 |
| FR68 | 결정 저장 + Reasoning Graph | [ADR-0013](./adr/0013-edge-types-reasoning.md) | topic, decision, reasoning 저장. supersedes/builds_on/debates/synthesizes 관계 |
| FR69 | 단일 DB + topic prefix | [ADR-0016](./adr/0016-project-specific-db.md) | `voxel:*`, `furniture:*` 등 prefix로 도메인 구분 |
| FR70 | Outcome Tracking | [ADR-0011](./adr/0011-mama-core-reuse.md) | update 도구로 success/failed/partial 기록 |

#### Phase 11.2: Hook System (핵심)

| ID | 요구사항 | ADR | 수용 기준 |
|----|---------|-----|----------|
| FR71 | SessionStart Hook | [ADR-0017](./adr/0017-configurable-context.md) | 세션 시작 시 최근 결정 + 체크포인트 주입. none/hint/full 모드 |
| FR72 | Dynamic Hint Injection | [ADR-0015](./adr/0015-dynamic-hint-injection.md) | Tool Definition에 DB 힌트 자동 주입. edit_hint 도구 제공 |
| FR73 | ActionHints (next_steps) | [ADR-0014](./adr/0014-progressive-workflow.md) | 도구 실행 후 next_steps 반환. 다음 작업 제안 |
| FR74 | LLM-Agnostic Hook Owner | [ADR-0018](./adr/0018-llm-agnostic-hooks.md) | CADOrchestrator가 Hook 관리. LLMAdapter로 Claude/Ollama 교체 가능 |

#### Phase 11.3: Intelligence

| ID | 요구사항 | ADR | 수용 기준 |
|----|---------|-----|----------|
| FR75 | Configurable Context | [ADR-0017](./adr/0017-configurable-context.md) | none/hint/full 모드. 토큰 사용량 조절 |
| FR76 | Adaptive Mentoring | [ADR-0020](./adr/0020-adaptive-mentoring.md) | 숙련도별 힌트 수준 조절. 초보자 상세, 숙련자 간략 |
| FR77 | Graph Health Metrics | [ADR-0019](./adr/0019-graph-health-metrics.md) | debates >= 10% 유지. Stale Decision(90일) 감지 |
| FR78 | Anti-Echo Chamber | [ADR-0021](./adr/0021-anti-echo-chamber.md) | 반론 장려. "다른 관점에서..." 제안 |

#### Phase 11.4: Learning Track (신규)

> "만들고 싶은 것을 만들면서, 만드는 법을 배운다" - 사용자 성장 추적 시스템

| ID | 요구사항 | ADR | 수용 기준 |
|----|---------|-----|----------|
| FR81 | Learning Progress Storage | ADR-0025 | 배운 개념 저장 (60-30-10, 동선 등). type='learning' 지원 |
| FR82 | User Growth Metrics | ADR-0025 | 독립 결정 횟수, 개념 적용 횟수, 질문 품질 추적 |
| FR83 | DesignHints System | ADR-0025 | Human CoT 유도. 바로 만들지 않고 옵션 제시 |
| FR84 | Terminology Evolution | ADR-0025 | 사용자 언어 변화 추적 ("미니멀" → "Japandi") |

**Learning Track 핵심 철학:**

| AI 행동 | 잘못된 예 | 올바른 예 |
|---------|----------|----------|
| 스타일 질문 | "알겠습니다, 미니멀로 만들게요" | "미니멀에도 Japandi/Bauhaus/Muji가 있어요. 어떤 스타일인가요?" |
| 색상 결정 | "따뜻한 색으로 할게요" | "60-30-10 법칙을 알려드릴게요. 이 비율로 하면 넓어 보이면서 따뜻해요" |
| 배치 결정 | "여기에 소파 놓을게요" | "동선이란 개념이 있어요. 계단 앞을 막지 않는 배치가 좋아요" |

**Human CoT 유도 원칙:**
1. 바로 만들지 않고, 1-2개 옵션 제시
2. "왜" 그런지 원리 설명
3. 선택하게 하고, 선택 이유 기록
4. 다음에 적용했는지 추적

#### Phase 11.5: Platform

| ID | 요구사항 | ADR | 수용 기준 |
|----|---------|-----|----------|
| FR85 | MCP 내부 통합 | - | npm install 시 MAMA 포함. 별도 설정 불필요 |
| FR86 | 도메인 폴더 구조 | - | domains/ 폴더에 voxel/, furniture/, interior/ 기본 제공 |
| FR87 | LLM Adapter Pattern | ADR-0023 | Claude, OpenAI, Ollama 교체 가능 |

#### Hook 시스템 상세 (ADR-0015 + ADR-0018)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SessionStart Hook (onSessionInit)                        │
│    - 마지막 체크포인트 로드                                    │
│    - 최근 결정 요약 (contextInjection 모드에 따라)              │
│    - 프로젝트별 힌트 준비                                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Tool Definition Hook (preToolList)                       │
│    - 각 도구 description에 동적 힌트 주입                      │
│    - DB에서 해당 도구의 hints 조회                            │
│    - "💡 외벽 두께 표준: 200mm" 형식                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. [CAD 도구 실행]                                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. ActionHints Hook (postExecute)                           │
│    - next_steps: 다음 작업 제안                               │
│    - module_hints: 관련 모듈 추천                             │
│    - save_suggestion: 결정 저장 제안                          │
└─────────────────────────────────────────────────────────────┘
```

#### 데이터 스키마

```sql
-- decisions: 설계 결정 저장 (ADR-0011)
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,           -- 'voxel:chicken', 'furniture:chair' 등
  decision TEXT NOT NULL,
  reasoning TEXT,
  outcome TEXT,                  -- 'success', 'failed', 'partial'
  confidence REAL DEFAULT 0.5,
  created_at INTEGER
);

-- decision_edges: 결정 관계 (ADR-0013)
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

-- hints: 도구별 동적 힌트 (ADR-0015)
CREATE TABLE hints (
  id INTEGER PRIMARY KEY,
  tool_name TEXT NOT NULL,       -- 'draw_rect', 'create_group' 등
  hint_text TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  tags TEXT,                     -- JSON: ["wall", "room", "extend"]
  source TEXT                    -- 'user', 'system', 'learned'
);

-- learnings: 배운 개념 저장 (FR81, ADR-0025)
CREATE TABLE learnings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  concept TEXT NOT NULL,         -- '60-30-10 법칙', '동선', 'Japandi'
  domain TEXT,                   -- 'color_theory', 'spatial', 'style'
  understanding_level INTEGER,   -- 1: 소개됨, 2: 이해함, 3: 적용함, 4: 숙달
  first_introduced INTEGER,      -- Unix timestamp (seconds)
  last_applied INTEGER,          -- Unix timestamp (seconds)
  applied_count INTEGER DEFAULT 0,
  user_explanation TEXT,         -- 사용자가 이 개념을 설명한 기록
  created_at INTEGER             -- Unix timestamp (seconds)
);

CREATE INDEX idx_learnings_user ON learnings(user_id);
CREATE UNIQUE INDEX idx_learnings_user_concept ON learnings(user_id, concept);

-- growth_metrics: 성장 지표 (FR82, ADR-0025)
CREATE TABLE growth_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,     -- 'independent_decision', 'concept_applied',
                                 -- 'tradeoff_predicted', 'terminology_used'
  related_learning_id TEXT,      -- learnings 테이블 참조
  related_decision_id TEXT,      -- decisions 테이블 참조
  context TEXT,                  -- 어떤 상황에서 발생했는지
  created_at INTEGER,            -- Unix timestamp (seconds)
  FOREIGN KEY (related_learning_id) REFERENCES learnings(id),
  FOREIGN KEY (related_decision_id) REFERENCES decisions(id)
);

CREATE INDEX idx_growth_metrics_user ON growth_metrics(user_id);

-- terminology_evolution: 용어 변화 추적 (FR84)
CREATE TABLE terminology_evolution (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  before_term TEXT NOT NULL,     -- '미니멀하게'
  after_term TEXT NOT NULL,      -- 'Japandi 스타일로'
  learning_id TEXT,              -- 관련 학습
  detected_at INTEGER,           -- Unix timestamp (seconds)
  FOREIGN KEY (learning_id) REFERENCES learnings(id)
);

CREATE INDEX idx_terminology_user ON terminology_evolution(user_id);
```

#### 관련 ADR 목록

| ADR | 제목 | Phase |
|-----|------|-------|
| [0010](./adr/0010-partnership-philosophy.md) | Partnership Philosophy | 철학 |
| [0011](./adr/0011-mama-core-reuse.md) | MAMA Core 4 Tools | 11.1 |
| [0013](./adr/0013-edge-types-reasoning.md) | Edge Types (Reasoning Graph) | 11.1 |
| [0014](./adr/0014-progressive-workflow.md) | Progressive Workflow (next_steps) | 11.2 |
| [0015](./adr/0015-dynamic-hint-injection.md) | Dynamic Hint Injection | 11.2 |
| [0016](./adr/0016-project-specific-db.md) | 단일 DB + Topic Prefix | 11.1 |
| [0017](./adr/0017-configurable-context.md) | Configurable Context | 11.2 |
| [0018](./adr/0018-llm-agnostic-hooks.md) | LLM-Agnostic Hooks | 11.2 |
| [0019](./adr/0019-graph-health-metrics.md) | Graph Health Metrics | 11.3 |
| [0020](./adr/0020-adaptive-mentoring.md) | Adaptive Mentoring | 11.3 |
| [0021](./adr/0021-anti-echo-chamber.md) | Anti-Echo Chamber | 11.3 |
| [0023](./adr/0023-llm-agnostic-agent-architecture.md) | LLM-Agnostic Agent Architecture | 11.2 |
| [0024](./adr/0024-module-library-recommendation.md) | Module Recommendation | 11.3 |

## Non-Functional Requirements

### 완료 (NFR1~NFR26) ✅

| 범위 | 요약 |
|------|------|
| NFR1~NFR20 | 성능, 오프라인 동작, 패널 리사이즈 60fps |
| NFR21~NFR23 | 웹 아키텍처 (WebSocket RTT < 15ms, 온보딩 < 1분) |
| NFR24~NFR26 | AX 개선 (Read-first > 95%, 모듈 재사용 > 90%) |

### 계획 중: Epic 11 - MAMA (NFR27~NFR31)

| ID | 요구사항 | 목표 |
|----|---------|------|
| NFR27 | MAMA 검색 응답 | < 100ms (로컬 DB) |
| NFR28 | 컨텍스트 주입 | SessionStart 시 자동 로드 |
| NFR29 | LLM-Agnostic | Claude, OpenAI, Ollama 교체 가능 |
| NFR30 | MCP 패키지 크기 | < 50MB (MAMA + 도메인 지식 포함) |
| NFR31 | 로컬 LLM 지연 | exaone 번역/검색 < 200ms |

---

## Product Scope

### 완료 (Epic 1~10) ✅

| Epic | 산출물 |
|------|--------|
| 1~3 | WASM 엔진, 도형 6종, Canvas 뷰어 |
| 4~5 | 그룹/피봇, Selection UI |
| 7 | React 뷰어, 3패널, 스케치 모드 |
| 8 | Manifold Boolean, 텍스트 렌더링 |
| 9 | 웹 아키텍처 (모노레포, WebSocket, GitHub Pages) |
| 10 | AX 개선 (Claude Code 패턴 MCP 도구) |

### 계획 중: Epic 11 - MAMA Integration

> AI 파트너십 강화를 위한 Memory-Augmented Meta Agent 통합

| Phase | 핵심 기능 | FR | Stories |
|-------|----------|-----|---------|
| **11.1 Core** | 4 Core Tools, Reasoning Graph, 단일 DB | FR67~FR70 | 4개 |
| **11.2 Hook System** | SessionStart, Dynamic Hint, ActionHints, LLM-Agnostic | FR71~FR74 | 4개 |
| **11.3 Intelligence** | Graph Health, Anti-Echo, Adaptive Mentoring, Module Rec | FR75~FR78 | 4개 |
| **11.4 Learning Track** | Learning Progress, Growth Metrics, DesignHints, Terminology | FR81~FR84 | 4개 |
| **11.5 Platform** | MCP 통합, 도메인 폴더, LLM Adapter | FR85~FR87 | 3개 |

**성공 기준:**
- 30일 후 맥락 기억, "이 AI는 나를 안다" 체감
- debates >= 10% 유지 (Anti-Echo Chamber)
- 검색 응답 < 100ms
- 독립 결정 비율 30% → 70% 성장 (Learning Track)

### Post-MVP

| 항목 | 설명 |
|------|------|
| SVG/DXF Import | 외부 파일 → JS 코드 변환 |
| 3D 확장 | STEP/STL, wgpu |
| 채팅 UI | 별도 웹 인터페이스 |


---

## Deployment Strategy

### 웹 배포

| 컴포넌트 | 위치 | 방법 |
|---------|------|------|
| Viewer | GitHub Pages | 자동 배포 (gh-pages) |
| MCP | npm registry | `npx @ai-native-cad/mcp start` |

### 사용자 시작 흐름

```
1. 웹 브라우저에서 Viewer 접속
2. "MCP 연결 필요" 가이드 확인
3. npx @ai-native-cad/mcp start (터미널)
4. 자동 연결 → 사용 시작
```

- **AI 연결**: Claude Code 사용 (API 키 관리 위임)
- **오프라인**: CAD 기능은 API 없이 동작

---

## User Journey

```
"스켈레톤 그려줘" → Claude Code → WASM → scene.json → Viewer
[Layer Panel에서 왼팔 선택] + "더 길게" → selection.json → Claude Code → 수정
[스케치 모드에서 삼각형 그리기] + "이 모양으로" → capture_viewport → Vision 해석 → 생성
```

**원칙**: Layer Panel에서 선택, Canvas에서 스케치, 조작은 AI가 수행

---

## Risks

| 리스크 | 완화 |
|--------|------|
| AI 의도 오해석 | 반복 수정, 피드백 루프 |
| React 전환 시 렌더링 버그 | 기존 로직 정확 포팅 + 비교 테스트 |
| Transform 로직 복잡도 | 단위 테스트 작성 |
| LLM 일관성 저하 | 설명 고정, 힌트만 동적 |
| 인지 과부하 | Progressive Disclosure (none/hint/full) |
| 수요 불확실 | PoC에 사용자 인터뷰 병행 |
| Echo Chamber | debates ≥ 10% 유지 |

---

## Innovation & Novel Patterns

### 핵심 혁신: AX-First MAMA

> **MAMA의 사용자는 LLM이다.** 인간이 아닌 AI의 경험(Agent eXperience)을 최적화한다.

**AX 설계 원칙:**

| 원칙 | 적용 |
|------|------|
| 설명 고정 + 힌트 동적 | 함수 설명은 고정, 프로젝트 맥락만 힌트로 주입 |
| Progressive Disclosure | MAMA가 LLM에게 정보를 점진적으로 제공 |
| LLM이 UX를 이끈다 | MAMA → LLM → 인간 순서의 정보 흐름 |

### 코드 기반 도구 확장

**이전 접근 (도구 추가):**
```
❌ 도구 100개 나열 → LLM 혼란
```

**현재 접근 (코드 + LSP):**
```
✅ run_cad_code 샌드박스에서 함수 조합/생성
✅ LSP로 새 함수 시그니처 노출
✅ MAMA가 함수별 힌트 동적 주입
```

**함수 노출 구조:**
```
lsp({ operation: 'domains' })                         → 도메인 목록
lsp({ operation: 'describe', domain: 'primitives' }) → 함수 시그니처
lsp({ operation: 'schema', name: 'drawCircle' })     → 상세 + 💡 동적 힌트
```

### Top-Down Learning with AI Guide

```
전통 CAD (Bottom-Up):   선 → 면 → 3D → ... 6개월 후 의자
우리 접근 (Top-Down):   "의자 만들자" → 필요한 것 그때그때 학습

LLM이 가이드, MAMA가 맥락 기억, 인간이 의사결정
```

### CAD Domain Workflows (BMAD 확장)

| BMAD | CAD MAMA |
|------|----------|
| PM Agent | 가구 Guide, PCB Guide |
| create-prd workflow | furniture-chair workflow |
| PRD.md | 의자 설계 + 제조 파일 + 사용자 성장 |

### 플랫폼 확장성

> DRP(Design Reasoning Protocol)가 성공하면 **모든 '의도 기반 창작 도구'**에 적용 가능

```
📐 CAD/제조 (현재 Focus)
✏️ 전문 집필/기획
💼 비즈니스 분석
⚡ 회로 설계 (PCB)
```

### Validation Approach

| 검증 항목 | 방법 | 목표 |
|----------|------|------|
| 타겟 사용자 존재? | 메이커 커뮤니티 인터뷰 | 5명 이상 |
| AI 기억의 효과? | A/B 비교 | 반복 질문 50% 감소 |
| LLM 행동 변화? | 힌트 유/무 비교 | 효율성 측정 |

---

## Developer Tool Specific Requirements

### 아키텍처 개요

| 구성요소 | 역할 |
|---------|------|
| MCP 서버 | CAD MAMA + CAD 엔진 통합 배포 |
| 메인 LLM | 설계 추론, 코드 생성, ActionHints 생성 |
| 로컬 LLM | 번역, 검색 결과 랭킹 (현재 MAMA 수준) |
| Index DB | 워크플로우/함수/규칙 임베딩 검색 |

### 저장 구조: 단일 DB + 도메인 폴더

**현재 MAMA 구조 유지 (Party Mode 결론)**

```
.cad/
├── mama.db              # 단일 DB (현재 MAMA 구조)
│   ├── decisions        # topic prefix로 도메인 구분
│   ├── checkpoints      # furniture:*, voxel:*, etc.
│   └── embeddings
└── domains/             # 도메인 지식 (폴더, 읽기 전용)
    ├── voxel/
    │   ├── DOMAIN.md
    │   ├── workflows/
    │   ├── rules/
    │   └── functions/
    ├── furniture/
    └── ...
```

**장점:**
- 크로스 도메인 검색 가능
- 현재 MAMA 코드 재사용
- 구조 단순, 배포 용이

### 도메인 지식 구조

| 폴더 | 내용 |
|------|------|
| `DOMAIN.md` | 도메인 개요, 기본 힌트 |
| `workflows/` | PRD→완성 워크플로우 (BMAD 스타일) |
| `rules/` | 도메인 규칙 (z-order, 좌표계 등) |
| `functions/` | 함수 가이드, 예시 |

### 설치 및 배포

- npm: `npx @ai-native-cad/mcp start`
- 도메인 폴더: MCP 패키지에 포함
- DB: 첫 실행 시 자동 생성

### LLM 역할 분담

| LLM | 역할 | 비고 |
|-----|------|------|
| 메인 LLM (Claude/Ollama) | 설계 추론, ActionHints 생성 | 교체 가능 |
| 로컬 LLM (exaone 2.4B) | 번역, 검색 랭킹 | 현재 MAMA 수준 |

---

## Definition of Done

### 완료 (Epic 1~10) ✅

- ✅ WASM 엔진, 도형 6종, 그룹/피봇
- ✅ React 뷰어, 3패널, 스케치 모드
- ✅ Boolean 연산, 텍스트 렌더링
- ✅ 웹 아키텍처 (모노레포, WebSocket, GitHub Pages)
- ✅ AX 개선 (Claude Code 패턴 MCP 도구: glob, read, edit, write, lsp, bash)

### 계획: Epic 11 - MAMA Integration (Scoping)

**배포 아키텍처**: MCP 서버 내부 통합 (별도 플러그인 X)

**MAMA MCP 도구 (LLM 호출용):**
| 도구 | MCP 이름 | 역할 |
|------|---------|------|
| save | `mcp__ai-native-cad__mama_save` | 결정/체크포인트 저장 |
| search | `mcp__ai-native-cad__mama_search` | 시맨틱 검색 |
| update | `mcp__ai-native-cad__mama_update` | 결정 결과 업데이트 |
| checkpoint | `mcp__ai-native-cad__mama_checkpoint` | 체크포인트 로드 |

#### Epic 11.1: Core (MVP)
- [ ] MAMA Core 4 Tools MCP 통합 (mama_save, mama_search, mama_update, mama_checkpoint)
- [ ] 세션 컨텍스트 자동 로드 (SessionStart 훅)
- [ ] Reasoning Graph 기본 구현
- [ ] 단일 DB + topic prefix 구조

#### Epic 11.2: Intelligence
- [ ] ActionHints System (메인 LLM이 생성, MAMA가 저장/검색)
- [ ] Query Language (엔티티 탐색)
- [ ] 로컬 LLM 통합 (번역 + 검색 랭킹, 현재 MAMA 수준)

#### Epic 11.3: Platform
- [ ] 도메인 폴더 구조 (voxel, furniture, interior)
- [ ] 워크플로우 템플릿 (BMAD 스타일)
- [ ] LLM-Agnostic 아키텍처 (Ollama PoC)

---
