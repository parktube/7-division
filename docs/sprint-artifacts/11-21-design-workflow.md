# Story 11.21: Design Workflow System

Status: Done

## Story

As a **CAD 사용자**,
I want **디자인 프로젝트를 단계별 워크플로우로 진행하기를**,
So that **AI와 대화하며 체계적으로 디자인을 배우고 결과물을 만들 수 있다** (FR92-FR96).

## Background

### 문제점

현재 시스템은 사용자가 "만들어줘"라고 하면 바로 작업을 시작한다.
제안서의 핵심 철학 **"만들고 싶은 것을 만들면서, 만드는 법을 배운다"**를 실현하려면
구조화된 워크플로우가 필요하다.

### 제안서 유즈케이스 (지은의 복층 인테리어)

```
Day 1  → Discovery:  "미니멀에도 종류가 있어요..." (스타일 탐색)
Day 3  → Planning:   "60-30-10 법칙 알려드릴게요" (디자인 원리)
Day 7  → Architecture: "동선이라는 개념을..." (공간 설계)
Day 14 → Creation:   실제 CAD 작업 + 학습 추적
```

### BMAD 워크플로우에서 영감

```
BMAD:  Analysis → Plan → Solutioning → Implementation
CAD:   Discovery → Planning → Architecture → Creation
```

## Acceptance Criteria

### AC1: 워크플로우 초기화 (mama_workflow_start)
**Given** 사용자가 새 디자인 프로젝트를 시작할 때
**When** "복층 인테리어를 만들고 싶어"라고 말하면
**Then** AI가 워크플로우 시작을 제안하고 프로젝트를 초기화한다

### AC2: 단계별 진행
**Given** 워크플로우가 진행 중일 때
**When** 현재 단계(예: Discovery)가 완료되면
**Then** 다음 단계로 전환을 제안하고 이전 단계 산출물을 저장한다

### AC3: DesignHints 자동 활성화
**Given** 특정 워크플로우 단계에 있을 때
**When** AI가 응답을 생성하면
**Then** 해당 단계에 맞는 DesignHints가 자동으로 포함된다

### AC4: 프로젝트 상태 저장/복원
**Given** 세션이 종료될 때
**When** 다음 세션을 시작하면
**Then** 이전 워크플로우 상태와 산출물이 복원된다

### AC5: 단계 건너뛰기/되돌아가기
**Given** 사용자가 특정 단계로 이동하고 싶을 때
**When** "바로 작업 시작할래" 또는 "스타일 다시 정하자"라고 말하면
**Then** 해당 단계로 이동하고 상태를 업데이트한다

### AC6: Built-in 워크플로우 템플릿 (Story 11.20 연계)
**Given** 패키지를 설치할 때
**When** npm install이 완료되면
**Then** `assets/workflows/`에 기본 워크플로우 템플릿이 포함된다

### AC7: 학습 추적 통합
**Given** 워크플로우 중 개념을 배울 때
**When** AI가 "60-30-10 법칙"을 설명하면
**Then** Learning Tracker에 자동으로 기록된다

## Workflow Phases

### Phase 1: Discovery (발견)

**목표**: 사용자의 비전과 취향 파악

**AI 행동**:
- 레퍼런스 이미지 요청
- 스타일 옵션 제시 (Japandi/Bauhaus/Muji 등)
- 용도/기능 질문

**산출물**: `design-brief.md`
```markdown
# Design Brief: {project_name}

## 비전
{사용자가 원하는 것}

## 스타일 방향
- 선택: Japandi
- 이유: 따뜻한 나무톤 + 미니멀

## 레퍼런스
- {이미지 설명 또는 링크}

## 기능 요구사항
- 복층 구조
- 거실 + 침실 + 계단
```

**DesignHints 활성화**:
- 스타일 옵션 (STYLE_OPTIONS)
- 생각 질문 (THINKING_QUESTIONS)

---

### Phase 2: Planning (계획)

**목표**: 디자인 원리와 구체적 방향 결정

**AI 행동**:
- 색상 이론 설명 (60-30-10)
- 재료/질감 옵션 제시
- 분위기 키워드 정의

**산출물**: `style-prd.md`
```markdown
# Style PRD: {project_name}

## 색상 팔레트
- 60% 주색: #F5F0E8 (웜화이트)
- 30% 보조색: #C4A77D (라이트우드)
- 10% 강조색: #8B7355 (다크우드)

## 재료
- 바닥: 오크 원목
- 벽: 화이트 페인트
- 가구: 내추럴 우드

## 분위기 키워드
- 따뜻한, 미니멀, 자연적
```

**DesignHints 활성화**:
- 색상 원리 (PRINCIPLES.color)
- 재료 트레이드오프

**학습 추적**:
- `60-30-10 법칙` 개념 저장
- 이해 수준 추적

---

### Phase 3: Architecture (설계)

**목표**: 기술적 접근과 구성요소 분해

**AI 행동**:
- 공간 설계 원리 설명 (동선, 시선)
- 컴포넌트 목록 작성
- z-order 전략 결정

**산출물**: `design-architecture.md`
```markdown
# Design Architecture: {project_name}

## 렌더링 방식
- 이소메트릭 (30° 투영)

## 컴포넌트 구조
1. 공간 구조
   - floor, walls, ceiling
2. 가구 (거실)
   - sofa, coffee_table, tv_stand
3. 가구 (침실)
   - bed, nightstand
4. 계단/난간
   - stairs, railing

## z-order 전략
- 뒤→앞 순서: floor → walls → furniture → details

## 동선 계획
- 현관 → 거실 → 계단 → 침실
```

**DesignHints 활성화**:
- 공간 원리 (PRINCIPLES.layout)
- 동선 질문

**학습 추적**:
- `동선` 개념 저장
- `z-order` 개념 저장

---

### Phase 4: Creation (제작)

**목표**: 실제 CAD 작업 수행

**AI 행동**:
- 단계별 구현
- 개념 적용 시 인정 ("동선 고려하셨네요!")
- 트레이드오프 설명

**산출물**: CAD 파일 + 학습 기록

**학습 추적**:
- 독립 결정 감지
- 개념 적용 횟수 증가

---

## MCP Tool (신규 1개)

### mama_workflow

단일 도구, `command` 파라미터로 동작 구분 (lsp/bash 패턴)

```typescript
// Tool Schema
{
  name: 'mama_workflow',
  description: '디자인 워크플로우 관리. 프로젝트 생성/상태 조회/단계 전환.',
  parameters: {
    command: {
      type: 'string',
      description: "명령: 'start' | 'status' | 'next' | 'goto' | 'list' | 'artifact'"
    },
    // start용
    project_name: { type: 'string', description: 'start용: 프로젝트 이름' },
    description: { type: 'string', description: 'start용: 프로젝트 설명 (선택)' },
    // goto용
    phase: { type: 'string', description: "goto용: 이동할 단계 ('discovery' | 'planning' | 'architecture' | 'creation')" },
    // next/artifact용
    content: { type: 'string', description: 'next/artifact용: 산출물 내용' },
    // artifact용
    artifact_type: { type: 'string', description: "artifact용: 산출물 유형 ('design-brief' | 'style-prd' | 'design-architecture')" }
  },
  required: ['command']
}
```

### Commands

#### `start` - 새 프로젝트 시작
```typescript
mama_workflow({
  command: 'start',
  project_name: '복층 원룸',
  description: '미니멀한 Japandi 스타일'
})

// 반환
{
  project_id: 'proj_abc123',
  current_phase: 'discovery',
  phases: ['discovery', 'planning', 'architecture', 'creation'],
  design_hints: DesignHints,
  questions: ['레퍼런스 이미지가 있으신가요?', ...]
}
```

#### `status` - 현재 상태 조회
```typescript
mama_workflow({ command: 'status' })

// 반환
{
  project_id: 'proj_abc123',
  project_name: '복층 원룸',
  current_phase: 'planning',
  completed_phases: ['discovery'],
  progress: '2/4',
  artifacts: {
    'design-brief': { exists: true, updated_at: 1234567890 },
    'style-prd': { exists: false },
    'design-architecture': { exists: false }
  },
  learnings: [{ concept: 'Japandi', level: 2 }]
}
```

#### `next` - 다음 단계로 전환
```typescript
mama_workflow({
  command: 'next',
  content: '# Design Brief\n...'  // 현재 단계 산출물 (선택)
})

// 반환
{
  previous_phase: 'discovery',
  current_phase: 'planning',
  artifact_saved: 'design-brief',
  design_hints: DesignHints,
  questions: ['60-30-10 법칙 알고 계신가요?', ...]
}
```

#### `goto` - 특정 단계로 이동
```typescript
mama_workflow({
  command: 'goto',
  phase: 'architecture'
})

// 반환
{
  previous_phase: 'planning',
  current_phase: 'architecture',
  skipped_phases: [],
  design_hints: DesignHints,
  questions: [...]
}
```

#### `list` - 모든 프로젝트 목록
```typescript
mama_workflow({ command: 'list' })

// 반환
{
  projects: [
    { id: 'proj_abc', name: '복층 원룸', phase: 'planning', updated_at: ... },
    { id: 'proj_xyz', name: '카페 인테리어', phase: 'discovery', updated_at: ... }
  ],
  active_project: 'proj_abc'
}
```

#### `artifact` - 산출물 저장/조회
```typescript
// 저장
mama_workflow({
  command: 'artifact',
  artifact_type: 'style-prd',
  content: '# Style PRD\n...'
})

// 조회 (content 없이)
mama_workflow({
  command: 'artifact',
  artifact_type: 'design-brief'
})

// 반환
{
  artifact_type: 'design-brief',
  content: '# Design Brief\n...',
  created_at: 1234567890
}
```

---

## DB Schema 확장

```sql
-- projects: 워크플로우 프로젝트
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  current_phase TEXT DEFAULT 'discovery',
  created_at INTEGER,
  updated_at INTEGER
);

-- project_artifacts: 프로젝트 산출물
CREATE TABLE project_artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  artifact_type TEXT NOT NULL,  -- 'design-brief', 'style-prd', 'design-architecture'
  content TEXT,
  created_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- project_phases: 단계 완료 기록
CREATE TABLE project_phases (
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  completed_at INTEGER,
  learnings_count INTEGER DEFAULT 0,
  decisions_count INTEGER DEFAULT 0,
  PRIMARY KEY (project_id, phase),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

---

## Built-in Assets (Story 11.20 연계)

```
assets/workflows/
├── templates/
│   ├── design-brief.md        # Discovery 산출물 템플릿
│   ├── style-prd.md           # Planning 산출물 템플릿
│   └── design-architecture.md # Architecture 산출물 템플릿
├── steps/
│   ├── discovery.yaml         # Discovery 단계 정의
│   ├── planning.yaml          # Planning 단계 정의
│   ├── architecture.yaml      # Architecture 단계 정의
│   └── creation.yaml          # Creation 단계 정의
└── hints/
    ├── discovery-hints.json   # Discovery용 DesignHints
    ├── planning-hints.json    # Planning용 DesignHints
    └── architecture-hints.json # Architecture용 DesignHints
```

---

## 사용 예시

### 시나리오: 새 프로젝트 시작

```
User: "미니멀한 복층 원룸 인테리어를 만들고 싶어"

AI: "새 디자인 프로젝트를 시작하시네요! 🎨

    저와 함께 단계별로 진행해볼까요?

    📋 워크플로우:
    1. Discovery - 비전과 스타일 탐색
    2. Planning - 색상/재료 결정
    3. Architecture - 구조와 동선 설계
    4. Creation - 실제 제작

    [A] 처음부터 차근차근 (권장)
    [B] 바로 작업 시작
    [C] 특정 단계부터 시작"

User: "A"

AI: (mama_workflow_start 호출)
    "프로젝트 '복층 원룸'을 시작합니다!

    📍 Phase 1: Discovery

    먼저 몇 가지 여쭤볼게요:

    1. 레퍼런스 이미지가 있으신가요?
       (Pinterest, 인테리어 잡지 등)

    2. '미니멀'하면 떠오르는 이미지는 어떤 건가요?
       - 따뜻한 나무톤? (Japandi)
       - 차갑고 기하학적? (Bauhaus)
       - 거의 아무것도 없는? (Muji)

    3. 이 공간에서 주로 뭘 하실 건가요?"
```

### 시나리오: 세션 재개

```
[다음 날 새 세션]

AI: (onSessionInit)
    "안녕하세요! '복층 원룸' 프로젝트 이어서 할까요?

    📍 현재 상태:
    - Phase: Planning (2/4)
    - 완료: Discovery ✅
    - 다음: 색상과 재료 결정

    💡 지난 시간에 배운 것:
    - Japandi 스타일 선택
    - '따뜻하면서 미니멀' 키워드

    이어서 진행할까요?"
```

---

## Tasks / Subtasks

- [x] Task 1: DB 스키마 확장 (AC: #4)
  - [x] 1.1 projects 테이블 추가
  - [x] 1.2 project_artifacts 테이블 추가
  - [x] 1.3 project_phases 테이블 추가
  - [x] 1.4 마이그레이션 스크립트 (009-projects.sql)

- [x] Task 2: mama_workflow MCP 도구 구현 (AC: #1, #2, #5)
  - [x] 2.1 mama_workflow 도구 스키마 정의
  - [x] 2.2 command: 'start' 구현
  - [x] 2.3 command: 'status' 구현
  - [x] 2.4 command: 'next' 구현
  - [x] 2.5 command: 'goto' 구현
  - [x] 2.6 command: 'list' 구현
  - [x] 2.7 command: 'artifact' 구현

- [x] Task 3: DesignHints 통합 (AC: #3)
  - [x] 3.1 단계별 DesignHints 로더 (getPhaseDesignHints)
  - [x] 3.2 워크플로우 상태에 따른 자동 주입
  - [x] 3.3 DesignHints JSON 파일 생성 (assets/workflows/hints/)

- [x] Task 4: Built-in 워크플로우 템플릿 (AC: #6)
  - [x] 4.1 assets/workflows/ 디렉토리 구조
  - [x] 4.2 템플릿 파일 작성 (templates/*.md)
  - [x] 4.3 단계 정의 YAML 작성 (steps/*.yaml)

- [x] Task 5: Session Init 연동 (AC: #4)
  - [x] 5.1 활성 프로젝트 로드 로직 (getWorkflowStatusForSession)
  - [x] 5.2 워크플로우 상태 요약 포맷
  - [x] 5.3 session-init.ts 수정

- [x] Task 6: Learning Tracker 연동 (AC: #7)
  - [x] 6.1 단계별 개념 매핑 (PHASE_DESIGN_HINTS.next_concepts)
  - [x] 6.2 자동 학습 기록 트리거 (mama_save type='learning')
  - [x] 6.3 성장 지표 집계 (completeProjectPhase stats)

- [x] Task 7: 테스트 작성
  - [x] 7.1 워크플로우 상태 전환 테스트
  - [x] 7.2 산출물 저장/복원 테스트
  - [x] 7.3 DesignHints 활성화 테스트
  - 테스트 파일: tests/workflow.test.ts (23 tests)

---

## Dependencies

- **선행**: Story 11.15 (DesignHints System) - 이미 완료
- **선행**: Story 11.20 (Built-in Assets) - assets 구조 공유
- **연관**: Story 11.13 (Learning Progress) - 학습 추적 통합

## References

- [Source: docs/ai-native-cad-proposal-v2.md#유즈케이스-지은의-복층-인테리어]
- [Source: .bmad/bmm/workflows/ - BMAD 워크플로우 구조]
- [Source: apps/cad-mcp/src/mama/design-hints.ts - 기존 DesignHints]

## File List

- `apps/cad-mcp/src/mama/db.ts` (수정 - 스키마 확장)
- `apps/cad-mcp/src/mama/workflow.ts` (신규 - 워크플로우 로직)
- `apps/cad-mcp/src/mama/tools/handlers.ts` (수정 - handleMamaWorkflow 추가)
- `apps/cad-mcp/src/mama/tools/schema.ts` (수정 - mama_workflow 도구 추가)
- `apps/cad-mcp/src/mama/hooks/session-init.ts` (수정 - 활성 프로젝트 로드)
- `apps/cad-mcp/src/schema.ts` (수정 - MAMA_TOOLS에 mama_workflow 추가)
- `apps/cad-mcp/assets/workflows/templates/*.md` (신규)
- `apps/cad-mcp/assets/workflows/steps/*.yaml` (신규)
- `apps/cad-mcp/assets/workflows/hints/*.json` (신규)
