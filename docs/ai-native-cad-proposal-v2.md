# AI-Native CAD: 제안서 v2

> **"만들고 싶은 것을 만들면서, 만드는 법을 배운다"**
> — Top-Down Learning with AI Guide

**팀:** Hoons & Claude
**상태:** Epic 1-10 완료, Epic 11 (MAMA Integration) 준비 완료

---

## 목차

1. [왜 MAMA인가?](#1-왜-mama인가)
2. [프로젝트 비전](#2-프로젝트-비전)
3. [철학적 기반](#3-철학적-기반)
4. [지금까지 완료한 것](#4-지금까지-완료한-것)
5. [Epic 11: MAMA Integration](#5-epic-11-mama-integration)
6. [유즈케이스: 민수의 첫 복셀아트](#6-유즈케이스-민수의-첫-복셀아트)
7. [로드맵과 산출물](#7-로드맵과-산출물)
8. [리스크와 협업](#8-리스크와-협업)

---

## 1. 왜 MAMA인가?

### Epic 1-10에서 증명한 것

```
✅ AI가 기초 도형으로 복잡한 형상을 만들 수 있다
✅ 도메인 지식은 도구가 아닌 AI가 가져야 한다
✅ 비개발자도 AI와 함께 CAD 엔진을 만들 수 있다
✅ WASM 기반 브라우저 CAD는 실용적이다
✅ Claude Code 패턴(glob/read/edit/write/lsp/bash)이 MCP 도구로 효과적이다
✅ WebSocket 실시간 동기화가 빠르고 안정적이다 (RTT < 15ms)
```

### Epic 1-10에서 관찰한 현상

```
[관찰 1] 세션이 끊기면 모든 맥락이 사라진다
[관찰 2] "저번에 닭 색깔 뭐로 했더라?"를 매번 물어야 한다
[관찰 3] AI가 똑같은 실수를 반복한다
[관찰 4] 프로젝트마다 쌓인 노하우가 휘발된다
```

**실제 에피소드 (SpineLift 개발 중)**:

```
[Day 1]
"API 응답은 snake_case로 하자"
→ 결정함, 코드 작성함

[Day 30 - 새 세션]
"이 API 응답 포맷은...?"
→ 컨텍스트 없음, 다시 논의해야 함
→ 일관성 없이 camelCase로 작성됨
→ 나중에 발견하고 전체 수정
```

이건 **불편함이 아니라 본질적 병목**이다.

### Epic 11의 답: MAMA (Memory-Augmented Meta Agent)

| 문제 | 해결책 | MAMA의 역할 |
|------|--------|-------------|
| 세션 끊기면 맥락 소실 | 결정을 자동 저장, 다음 세션에 로드 | **의도의 표준화**: 세션 간 지능 연결 |
| 같은 실수 반복 | 이전 실패 패턴을 힌트로 주입 | **지능형 가드레일**: 전문가 품질 보증 |
| 노하우 휘발 | 프로젝트별 지식 DB 축적 | **IP Portability**: 인간의 숙련도 자산화 |

**Epic 11의 핵심 비전**:
단순히 "그려주는 AI"를 넘어, **사용자의 설계 의도를 기억하여 세션을 넘나드는 '지능형 파트너십'**을 구축한다.

---

## 2. 프로젝트 비전

### 관찰: 왜 사람들이 CAD를 포기하는가

집을 리모델링하고 싶다. 가구를 설계하고 싶다.
3D 프린터로 뭔가 만들고 싶다.

모두 CAD가 필요하다. 하지만 복잡해서 포기한다.

도구가 어려운 게 아니라, **진입 과정이 없는 것**이 문제다.

### 기존 도구와 무엇이 다른가

| 영역 | 기존 도구 | AI-Native CAD |
|------|-----------|---------------|
| 도구 조작 | 인간이 마우스/키보드 | AI가 코드로 조작 |
| 학습 곡선 | 6개월+ | 0분 (대화하며 배움) |
| 맥락 유지 | 세션마다 리셋 | MAMA가 기억 |
| 진입점 | 메뉴/단축키 학습 | 자연어 대화 |

### 누구를 위한 것인가

**타겟**: CAD 못하지만 만들고 싶은 것이 있는 사람
**비타겟**: "빨리 만들어줘"만 원하는 사람, 이미 CAD 전문가

---

## 3. 철학적 기반

### 철학 1: 도구의 사용자가 바뀌었다

```
AutoCAD 1982: 인간이 마우스로 조작
AutoCAD 2025: 여전히 인간이 마우스로 조작

AI-Native CAD: AI가 API로 조작
               인간은 의도 전달 + 검증
```

### 철학 2: 파트너십 (ADR-0010)

**Claude는 자동화 도구가 아니라, 인간과 함께 경험을 축적하며 성장하는 설계 마스터**

| 잘못된 이해 | 올바른 이해 |
|------------|------------|
| MAMA = 메모리 시스템 | MAMA = **파트너십을 만드는 경험 축적 시스템** |
| 효율성이 목표 | **관계의 깊이**가 목표 |
| 매번 리셋 | 경험이 축적됨 |

### 철학 3: AX-UX 대칭

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

---

## 4. 지금까지 완료한 것

### 완료된 Epic (1-10)

| Epic | 내용 | 상태 |
|------|------|------|
| Epic 1-3 | WASM 엔진, 도형 6종, 스타일/변환, Canvas 뷰어 | ✅ 완료 |
| Epic 4-5 | 그룹화, 피봇, Selection UI | ✅ 완료 |
| Epic 6 | Electron 앱 (현재 제거됨) | ✅ 완료 |
| Epic 7 | React 뷰어, 3패널, 스케치 모드 | ✅ 완료 |
| Epic 8 | Manifold Boolean, 텍스트 렌더링 | ✅ 완료 |
| Epic 9 | **웹 아키텍처** (모노레포, WebSocket, GitHub Pages, npm) | ✅ 완료 |
| Epic 10 | **AX 개선** (Claude Code 패턴 MCP 도구: glob/read/edit/write/lsp/bash) | ✅ 완료 |

### 현재 아키텍처

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

### 기술 스택

```
apps/
├── viewer/         # React 19 + TypeScript + Vite
│                   # TailwindCSS 4.x + Lucide React
└── cad-mcp/        # MCP Server (stdio + WebSocket)
                    # WASM CAD Engine
                    # Manifold Boolean
                    # opentype.js 텍스트

packages/
└── shared/         # Zod 스키마 (공유 타입)
```

---

## 5. Epic 11: MAMA Integration

### 핵심 목표

Claude가 자동화 도구가 아닌 **설계 마스터**로서, 인간과 함께 경험을 축적하며 성장하는 파트너가 된다.

### 4개 Phase, 14개 Story

| Phase | 핵심 기능 | FR | Stories |
|-------|----------|-----|---------|
| **11.1 Core** | 4 Core Tools, Reasoning Graph, 단일 DB | FR67-70 | 4개 |
| **11.2 Hook System** | SessionStart, Dynamic Hint, ActionHints, LLM-Agnostic | FR71-74 | 4개 |
| **11.3 Intelligence** | Context 모드, Adaptive Mentoring, Graph Health, Anti-Echo | FR75-78 | 4개 |
| **11.4 Platform** | LLM Adapter, Module Recommendation | FR79-80 | 2개 |

### Phase 11.1: Core (MVP)

**MAMA MCP 도구 (LLM 호출용):**

| 도구 | MCP 이름 | 역할 |
|------|---------|------|
| mama_save | `mcp__ai-native-cad__mama_save` | 결정/체크포인트 저장 |
| mama_search | `mcp__ai-native-cad__mama_search` | 시맨틱 검색 |
| mama_update | `mcp__ai-native-cad__mama_update` | 결정 결과 업데이트 |
| mama_checkpoint | `mcp__ai-native-cad__mama_checkpoint` | 체크포인트 로드 |

**Reasoning Graph (ADR-0013):**

```
[Reasoning Graph]
Decision #12: "닭 색깔 = 노란색"
    ↓ supersedes
Decision #5: "닭 색깔 = 흰색" (폐기됨)
    ↓ builds_on
Decision #3: "Crossy Road 스타일 채택"
```

- `supersedes`: 같은 topic, 새 결정이 이전을 대체
- `builds_on`: 이전 결정 위에 발전
- `debates`: 다른 관점에서 반론
- `synthesizes`: 여러 결정을 종합

### Phase 11.2: Hook System (핵심)

```
Hook Flow:
[세션 시작] → onSessionInit → [도구 목록 요청] → preToolList → [도구 실행] → postExecute
                 │                    │                              │
                 ▼                    ▼                              ▼
           체크포인트 로드      Tool Definition에         next_steps,
           최근 결정 요약       DB 힌트 주입              module_hints 반환
```

**Dynamic Hint Injection (ADR-0015):**

```
힌트 없이 (매번 물어야 함):
LLM: "닭을 그리겠습니다. 색깔은?"
인간: "노란색"
--- [30일 후, 새 세션] ---
LLM: "닭을 그리겠습니다. 색깔은?"

힌트 있음 (기억이 도움):
[도구 호출 시 자동 주입]
💡 이 프로젝트의 닭 색상은 노란색입니다 (Decision #12)

LLM: "기존 스타일(노란색)을 적용할까요?"
```

### Phase 11.3: Intelligence

| 기능 | 설명 |
|------|------|
| **Configurable Context** | none/hint/full 모드 (ADR-0017) |
| **Adaptive Mentoring** | 숙련도별 힌트 수준 조절 (ADR-0020) |
| **Graph Health Metrics** | debates >= 10% 유지 (ADR-0019) |
| **Anti-Echo Chamber** | 반론 장려, "다른 관점에서..." 제안 (ADR-0021) |

### Phase 11.4: Platform

| 기능 | 설명 |
|------|------|
| **LLM Adapter Pattern** | Claude, OpenAI, Ollama 교체 가능 (ADR-0023) |
| **Module Recommendation** | MAMA 임베딩으로 모듈 추천 (ADR-0024) |

### 데이터 스키마

```sql
-- decisions: 설계 결정 저장
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,           -- 'voxel:chicken:color' 등
  decision TEXT NOT NULL,
  reasoning TEXT,
  outcome TEXT,                  -- 'success', 'failed', 'partial'
  confidence REAL DEFAULT 0.5,
  created_at INTEGER
);

-- decision_edges: 결정 관계
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
```

---

## 6. 유즈케이스: 민수의 첫 복셀아트

CAD 경험이 없는 민수가 Crossy Road 스타일 닭을 만드는 여정.

### Day 1: 시작

```
민수: "Crossy Road 스타일로 닭을 만들고 싶어"

AI: "Crossy Road 스타일이요! 복셀 아트의 특징을 먼저 정리해볼게요.
     - 블록 단위 (정육면체 조합)
     - 로우폴리 느낌
     - 밝고 단순한 색상

     닭의 기본 구조부터 시작할까요?"

민수: "응"

AI: (mama_save 호출)
    topic: "voxel:chicken:style"
    decision: "Crossy Road 스타일 복셀아트"
```

### Day 3: 색상 결정

```
민수: "닭 색깔은 노란색으로 하자"

AI: "노란색 닭이요! 🐔
     몸통은 밝은 노란색, 부리는 주황색이 잘 어울려요.

     💡 Crossy Road 원작도 비슷한 조합이에요."

AI: (mama_save 호출)
    topic: "voxel:chicken:color"
    decision: "몸통=노란색, 부리=주황색"
    reasoning: "Crossy Road 원작 참고, 사용자 선호"
```

### Day 14: 세션 재개 ⭐ MAMA 효과

```
[2주 후 새 세션]

AI: (onSessionInit - 자동 로드)
    "안녕하세요! Crossy Road 스타일 닭 프로젝트네요.

     📍 지금까지:
     - 스타일: Crossy Road 복셀아트 ✅
     - 색상: 노란색 몸통, 주황색 부리 ✅
     - 기본 형태: 완성 ✅

     다음은 뭘 할까요? 날개? 다리?"

민수: "날개 추가해줘"

AI: (preToolList - 힌트 주입)
    💡 기존 스타일: 노란색 복셀, Crossy Road

    "기존 색상 팔레트를 유지할게요.
     날개는 몸통보다 살짝 어두운 노란색으로 할까요?"
```

**이것이 MAMA의 핵심 가치**: 2주 후에도 맥락이 유지된다.

### Day 30: AI의 반론 (Anti-Echo Chamber)

```
민수: "닭 머리를 3배로 키우고 싶어"

AI: "🤔 머리를 3배로요?

     Crossy Road 스타일은 비율이 중요한데,
     3배면 캐릭터 느낌이 많이 달라질 수 있어요.

     - 1.5배: 귀여운 느낌 강조
     - 2배: 캐리커처 느낌
     - 3배: 완전 다른 캐릭터

     그래도 3배로 하시겠어요?"

AI: (mama_save 호출)
    topic: "voxel:chicken:head_size"
    decision: "1.5배 선택"
    reasoning: "debates: 3배 고려했으나 스타일 일관성 위해 1.5배"
```

### 30일 후: 축적된 것들

```
[민수의 MAMA]

📊 Reasoning Graph:
├── voxel:chicken:style = "Crossy Road"
├── voxel:chicken:color = "노란색/주황색"
│   └── builds_on: style 결정
├── voxel:chicken:head_size = "1.5배"
│   └── debates: 3배 고려 후 변경
└── ...

📈 성장 지표:
├── 질문 빈도: 5회/세션 → 2회/세션
├── 자체 결정: 30% → 70%
└── 용어 이해: "복셀", "z-order" 자연스럽게 사용
```

---

## 7. 로드맵과 산출물

### Epic 11 Stories (14개)

#### Phase 11.1: Core (FR67-70)

| Story | 제목 | FR |
|-------|------|-----|
| 11-1 | MAMA Core 4 Tools MCP 통합 | FR67 |
| 11-2 | 결정 저장 + Reasoning Graph | FR68 |
| 11-3 | 단일 DB + topic prefix 구조 | FR69 |
| 11-4 | Outcome Tracking | FR70 |

**품질 게이트**: mama_save/search/update/checkpoint MCP 도구 동작, DB 스키마 완성

#### Phase 11.2: Hook System (FR71-74) ⭐ 핵심

| Story | 제목 | FR |
|-------|------|-----|
| 11-5 | SessionStart Hook (onSessionInit) | FR71 |
| 11-6 | Dynamic Hint Injection (preToolList) | FR72 |
| 11-7 | ActionHints (postExecute) | FR73 |
| 11-8 | CADOrchestrator Hook Owner | FR74 |

**품질 게이트**: Hook System 동작, 모든 LLM에서 동일하게 작동

#### Phase 11.3: Intelligence (FR75-78)

| Story | 제목 | FR |
|-------|------|-----|
| 11-9 | Configurable Context | FR75 |
| 11-10 | Adaptive Mentoring | FR76 |
| 11-11 | Graph Health Metrics | FR77 |
| 11-12 | Anti-Echo Chamber | FR78 |

**품질 게이트**: none/hint/full 모드 동작, 90일 이상 결정 경고

#### Phase 11.4: Platform (FR79-80)

| Story | 제목 | FR |
|-------|------|-----|
| 11-13 | LLM Adapter Pattern | FR79 |
| 11-14 | Module Library Recommendation | FR80 |

**품질 게이트**: Claude/OpenAI/Ollama 어댑터 동작, 모듈 추천 검증

### 성공 기준

| 지표 | 목표 |
|------|------|
| **파트너십 형성** | 30일 후 "이 AI는 나를 안다" 체감 |
| **세션 연속성** | 이전 결정을 자동으로 기억 |
| **건강한 관계** | debates >= 10%, 외부 증거 포함 |
| **검색 응답** | < 100ms (로컬 DB) |
| **Hook 실행** | < 10ms (동기화 작업) |

### NFR (Non-Functional Requirements)

| ID | 요구사항 | 목표 |
|----|---------|------|
| NFR27 | MAMA 검색 응답 | < 100ms |
| NFR28 | 컨텍스트 주입 | SessionStart 시 자동 로드 |
| NFR29 | LLM-Agnostic | Claude, OpenAI, Ollama 교체 가능 |
| NFR30 | MCP 패키지 크기 | < 50MB |
| NFR31 | 로컬 LLM 지연 | < 200ms |

---

## 8. 리스크와 협업

### 알려진 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| **LLM 비용/Latency** | 중간 | 로컬 LLM (Ollama) 옵션, LLM-Agnostic 설계 |
| **시맨틱 검색 정확도** | 중간 | FTS5 키워드 검색 병행 |
| **Echo Chamber** | 중간 | debates >= 10% 유지, Anti-Echo 경고 |
| **컨텍스트 과부하** | 낮음 | Configurable Context (none/hint/full) |

### 알아가야 할 것들

- **사용자 채택**: AI-Native CAD 패러다임의 실제 수요
- **멘토링 효과**: "AI와 대화하며 CAD를 배운다"는 접근의 효과
- **기억의 적정 수준**: 너무 많이 기억하면 부담, 너무 적으면 무의미

### 핵심 질문

> **"AI가 맥락을 기억하면 협업이 어떻게 달라지는가?"**

이 질문에 답하기 위해 Epic 11을 제안한다.

답이 "크게 달라진다"면: AI 협업의 새로운 패러다임.
답이 "별로 안 달라진다"면: 진짜 병목은 다른 곳에 있다.

**둘 다 가치 있는 결과다.** 함께 검증하자.

---

*Epic 1-10 완료: 2026-01-20*
*Epic 11 Ready for Dev: 2026-01-20*
*이 문서는 제안서입니다. 논의와 수정을 환영합니다.*
