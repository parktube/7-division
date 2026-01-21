# Story 11.15: DesignHints System

Status: Done

## Story

As a **LLM 에이전트**,
I want **DesignHints로 Human CoT를 유도하기를**,
So that **사용자가 스스로 생각하며 배운다** (FR83).

## Acceptance Criteria

### AC1: 스타일 선택 시 옵션 제시
**Given** 사용자가 "미니멀하게 해줘"라고 말할 때
**When** AI가 응답하면
**Then** 바로 만들지 않고 스타일 옵션을 제시한다:
  - "Japandi: 따뜻한 나무톤, 자연 소재"
  - "Bauhaus: 기하학적, 기능 중심"
  - "Muji: 극도로 절제된, 무채색"

### AC2: 선택 이유 기록
**Given** 사용자가 선택을 하면
**When** 선택 이유를 설명하면 ("Japandi가 내 취향이었구나")
**Then** 학습 기록에 "사용자가 자신의 취향에 이름을 붙임"으로 저장된다

### AC3: DesignHints 필드 반환
**Given** DesignHints 템플릿이 정의되어 있을 때
**When** 도구 실행 결과가 반환되면
**Then** design_hints 필드가 포함된다:
  - next_concepts: 다음에 배울 개념
  - questions: 사용자 생각을 유도하는 질문
  - options: 선택지와 트레이드오프

### AC4: 원리 설명 포함
**Given** 색상 관련 결정을 할 때
**When** AI가 응답하면
**Then** "60-30-10 법칙"같은 원리를 설명하고 적용을 제안한다

### AC5: AI 행동 가이드라인 적용
**Given** Claude Code가 CAD 작업을 수행할 때
**When** System Prompt에 Human CoT 가이드라인이 있으면
**Then** 바로 만들지 않고, 왜 그런지 설명하고, 선택하게 한다

## Tasks / Subtasks

- [x] Task 1: DesignHints 타입 정의 (AC: #3)
  - [x] 1.1 DesignHints 인터페이스 정의
  - [x] 1.2 next_concepts, questions, options 필드
  - [x] 1.3 ActionHints와 구분 (types/action-hints.ts에 통합)

- [x] Task 2: DesignHints 생성 로직 (AC: #1, #4)
  - [x] 2.1 스타일 관련 질문 감지 (detectDomain)
  - [x] 2.2 색상 관련 질문 감지 (DOMAIN_KEYWORDS)
  - [x] 2.3 도메인별 DesignHints 템플릿 (PRINCIPLES, STYLE_OPTIONS, THINKING_QUESTIONS)

- [x] Task 3: 도구 결과에 DesignHints 포함 (AC: #3)
  - [x] 3.1 generateDesignHints() - 컨텍스트 기반 힌트 생성
  - [x] 3.2 ActionHints.designHints 필드 추가
  - [x] 3.3 formatDesignHints() - 결과 포맷팅

- [x] Task 4: 선택 이유 학습 기록 (AC: #2)
  - [x] 4.1 recordStyleChoice() - 선택 감지 및 기록
  - [x] 4.2 learning-tracker와 연동 (saveLearning, recordApplication)
  - [x] 4.3 growth-tracker와 연동 (recordIndependentDecision)

- [x] Task 5: AI 행동 가이드라인 (AC: #5)
  - [x] 5.1 Human CoT 유도 원칙 (PRINCIPLES 상수)
  - [x] 5.2 ThinkingQuestion 패턴 (도메인별 질문)
  - [x] 5.3 DesignOption 트레이드오프 (pros/cons)

- [x] Task 6: 테스트 작성 (9개 테스트)
  - [x] 6.1 도메인 감지 테스트 (detectDomain)
  - [x] 6.2 DesignHints 생성 테스트 (generateDesignHints)
  - [x] 6.3 스타일 옵션 테스트 (minimal/modern)
  - [x] 6.4 포맷팅 테스트 (formatDesignHints)
  - [x] 6.5 선택 기록 테스트 (recordStyleChoice)

## Dev Notes

### Technical Requirements

**DesignHints 인터페이스:**
```typescript
interface DesignHints {
  // 다음에 배울 개념
  next_concepts: {
    concept: string;
    relevance: string;  // 왜 지금 배워야 하는지
  }[];

  // 사용자 생각을 유도하는 질문
  questions: {
    question: string;
    purpose: string;    // Human CoT 유도 목적
  }[];

  // 선택지와 트레이드오프
  options: {
    label: string;
    pros: string[];
    cons: string[];
  }[];
}
```

**Human CoT 유도 원칙:**

| 원칙 | 잘못된 예 | 올바른 예 |
|------|----------|----------|
| 바로 만들지 않음 | "미니멀로 만들게요" | "미니멀에도 종류가 있어요. 어떤 게 끌리세요?" |
| 왜 그런지 설명 | "노란색으로 할게요" | "60-30-10 법칙에서 30%가 포인트색이에요" |
| 선택하게 함 | "여기에 놓을게요" | "A: 창가 (자연광) vs B: 안쪽 (프라이버시)" |

**AX-UX 대칭:**
```
ActionHints (AX): AI의 다음 행동 유도
    "방을 만들었으니 → 문 추가 고려"

DesignHints (UX): 인간의 다음 생각 유도
    "미니멀에도 종류가 있어요..."
```

### References

- [Source: docs/adr/0025-learning-track.md]
- [Source: docs/epics.md#story-11.4.3]
- [Source: docs/prd.md#ax-ux-대칭-원칙]

### Dependencies

- **선행**: Story 11.7 (ActionHints) - postExecute Hook 기반
- **선행**: Story 11.13 (Learning Progress) - 학습 기록 연동
- **선행**: Story 11.14 (User Growth Metrics) - 성장 추적 연동

### Completion Notes

- Implementation completed: 2026-01-21
- DesignHints를 별도 타입 파일 대신 design-hints.ts에 직접 정의 (모듈 응집도)
- ActionHints와 통합을 위해 types/action-hints.ts에도 DesignHints 타입 추가
- 템플릿 디렉토리 대신 상수(PRINCIPLES, STYLE_OPTIONS 등)로 간결하게 구현

### File List (Actual Implementation)

- `apps/cad-mcp/src/mama/design-hints.ts` (신규 - 핵심 모듈)
- `apps/cad-mcp/src/mama/types/action-hints.ts` (수정 - DesignHints 타입 추가)
- `apps/cad-mcp/src/mama/index.ts` (수정 - design-hints export 추가)
- `apps/cad-mcp/tests/mama.test.ts` (수정 - DesignHints 테스트 9개)
