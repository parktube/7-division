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

### 계획 중: Epic 11 - MAMA Integration (FR67~FR79)

> AI 파트너십 강화를 위한 Memory-Augmented Meta Agent 통합

#### 왜 MAMA가 필요한가?

**현재 AI 도구의 한계:**

```
[월요일] "외벽은 200mm, 내벽은 100mm로 해줘" → AI: 완료!
[수요일] "벽 하나 더 그려줘" → AI: 벽 두께를 알려주세요.
         → 나: (또 설명해야 하나...)

[3개월 후]
- 내가 선호하는 작업 방식? 모름
- 자주 쓰는 모듈? 모름
- 프로젝트 맥락? 매번 새로움
```

**MAMA 도입 후:**

```
[수요일] "벽 하나 더 그려줘"
→ AI: 외벽 200mm로 그릴까요, 내벽 100mm로 그릴까요?
       (지난 월요일에 정한 기준입니다)

[3개월 후]
- "평소처럼 wall_extend 모듈 쓸까요?"
- "이 프로젝트에서는 항상 동쪽부터 시작하셨죠"
- "비슷한 작업할 때 OOO 방식이 잘 됐었어요"
```

> **MAMA = AI에게 장기 기억을 주어 진정한 설계 파트너로 만드는 시스템**

#### Functional Requirements 상세

| ID | 요구사항 | 설명 | 수용 기준 |
|----|---------|------|----------|
| FR67 | 세션 컨텍스트 자동 로드 | 세션 시작 시 이전 작업 상태, 결정을 자동으로 제공 | SessionStart 시 최근 5개 결정 + 마지막 체크포인트 자동 주입 |
| FR68 | Claude 주도 결정 저장 | 중요 설계 결정 저장 (topic, decision, reasoning) | LLM이 save 호출 시 topic으로 분류, reasoning 필수 |
| FR69 | Reasoning Graph | 결정 관계 추적 (supersedes, builds_on, debates, synthesizes) | 같은 topic 결정 시 자동 supersede, 관계 명시적 지정 가능 |
| FR70 | Outcome Tracking | 결정의 성공/실패 기록 (success, failed, partial) | update 도구로 결과 기록, 실패 시 reasoning 필수 |
| FR71 | LLM-Agnostic 설계 | Claude 외 LLM (Ollama, OpenAI) 교체 가능 | LLMAdapter 인터페이스로 분리, Ollama PoC 검증 완료 |
| FR72 | 로컬 LLM 하이브리드 | exaone 2.4B로 번역 + 검색 랭킹 | 현재 MAMA 수준, ActionHints 생성은 메인 LLM |
| FR73 | 4 Core Tools | save, search, update, load_checkpoint | 현재 MAMA 도구 그대로 재사용 |
| FR74 | 컨텍스트 주입 레벨 | none, hint, full 설정 가능 | config.yaml에서 설정, 기본값 hint |
| FR75 | Bias Warning | Echo Chamber, Stale Decision(90일) 감지 | debates < 10% 시 경고, 90일 이상 결정 stale 표시 |
| FR76 | 모듈 추천 | MAMA 임베딩으로 모듈 의미 검색 | "의자 만들어줘" → chair 모듈 추천 |
| FR77 | MCP 내부 통합 | MAMA를 MCP 서버 내부에 통합 배포 | npm install 시 MAMA 포함, 별도 설정 불필요 |
| FR78 | ActionHints System | 메인 LLM이 생성, MAMA가 저장/검색 | 도구 실행 후 next_steps, module_hints 반환 |
| FR79 | 도메인 폴더 구조 | domains/ 폴더에 워크플로우, 규칙, 함수 가이드 | voxel/, furniture/, interior/ 기본 제공 |

#### 데이터 스키마

```sql
-- decisions: 설계 결정 저장
decisions (id, topic, decision, reasoning, outcome, confidence, created_at)

-- decision_edges: 결정 관계 (Reasoning Graph)
decision_edges (from_id, to_id, relationship)  -- supersedes, builds_on, debates, synthesizes

-- sessions: 세션/체크포인트
sessions (id, summary, next_steps, open_files, created_at)

-- hints: 도구별 힌트
hints (id, tool_name, hint_text, priority, tags, source)
```

#### 의존성

- **better-sqlite3**: 로컬 DB (MCP 패키지에 포함)
- **현재 MAMA 코드**: Core 4 Tools 재사용
- **exaone 2.4B**: 번역 + 검색 랭킹 (선택적)

상세 설계: [ADR-0011](./adr/0011-mama-core-reuse.md), [ADR-0018](./adr/0018-llm-agnostic-hooks.md), [ADR-0023](./adr/0023-llm-agnostic-agent-architecture.md)

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

**핵심 원칙**: Claude는 자동화 도구가 아닌 **설계 마스터**로서, 인간과 함께 경험을 축적하며 성장하는 파트너

| 기능 | 설명 |
|------|------|
| 세션 연속성 | 이전 작업 상태, 결정을 자동으로 로드 |
| 결정 저장 | Claude 주도 설계 결정 저장 (topic, decision, reasoning) |
| Reasoning Graph | 결정 관계 추적 (supersedes, builds_on, debates) |
| LLM-Agnostic | Claude 외 다른 LLM (Ollama, OpenAI) 교체 가능 |
| 로컬 LLM 하이브리드 | exaone 2.4B로 번역 + 검색 랭킹 (현재 MAMA 수준) |

**성공 기준:**
- 30일 후 맥락 기억, "이 AI는 나를 안다" 체감
- 작은 LLM + MAMA = 큰 LLM의 효과 검증

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

#### Epic 11.1: Core (MVP)
- [ ] MAMA Core 4 Tools MCP 통합 (save, search, update, load_checkpoint)
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
