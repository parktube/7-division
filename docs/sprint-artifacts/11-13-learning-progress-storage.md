# Story 11.13: Learning Progress Storage

Status: ready-for-dev

## Story

As a **LLM 에이전트**,
I want **사용자가 배운 개념을 저장하기를**,
So that **성장 여정을 추적할 수 있다** (FR81).

## Acceptance Criteria

### AC1: 새 개념 소개 시 저장
**Given** 사용자에게 새로운 개념(60-30-10 법칙)을 소개할 때
**When** AI가 개념을 설명하면
**Then** learnings 테이블에 concept='60-30-10', understanding_level=1로 저장된다

### AC2: 이해 표현 시 레벨 업그레이드
**Given** 개념이 소개된 후
**When** 사용자가 이해를 표현하면 ("아, 그래서 넓어 보이는 거구나")
**Then** understanding_level이 2로 업데이트된다

### AC3: 개념 적용 시 레벨 업그레이드
**Given** 사용자가 배운 개념을 직접 적용할 때
**When** "우드톤 30% 정도로 할게요"라고 말하면
**Then** applied_count가 증가하고 understanding_level이 3으로 업데이트된다

### AC4: 숙달 레벨 자동 승격
**Given** 사용자가 개념을 3번 이상 독립적으로 적용했을 때
**When** applied_count >= 3이면
**Then** understanding_level이 4(숙달)로 자동 승격된다

### AC5: 세션 시작 시 학습 힌트 주입
**Given** 다음 세션에서 같은 개념이 관련될 때
**When** 색상 관련 작업을 시작하면
**Then** "💡 지은님은 60-30-10 법칙을 알고 계세요 (2번 적용)"가 주입된다

## Tasks / Subtasks

- [ ] Task 1: learnings 테이블 생성 (AC: #1)
  - [ ] 1.1 스키마 정의 (concept, domain, understanding_level, applied_count)
  - [ ] 1.2 SQLite 마이그레이션
  - [ ] 1.3 TypeScript 타입 정의

- [ ] Task 2: mama_save 확장 - type='learning' (AC: #1)
  - [ ] 2.1 save 도구에 type='learning' 옵션 추가
  - [ ] 2.2 concept, domain 필드 처리
  - [ ] 2.3 understanding_level 기본값 1

- [ ] Task 3: understanding_level 업데이트 로직 (AC: #2, #3, #4)
  - [ ] 3.1 이해 표현 감지 패턴 (아, 그래서, 그렇구나 등)
  - [ ] 3.2 개념 적용 감지 로직
  - [ ] 3.3 applied_count 증가 및 레벨 자동 승격

- [ ] Task 4: SessionStart 학습 힌트 주입 (AC: #5)
  - [ ] 4.1 관련 learnings 검색
  - [ ] 4.2 힌트 포맷 생성
  - [ ] 4.3 onSessionInit Hook에 통합

- [ ] Task 5: 테스트 작성
  - [ ] 5.1 learnings CRUD 테스트
  - [ ] 5.2 understanding_level 업그레이드 테스트
  - [ ] 5.3 세션 힌트 주입 테스트

## Dev Notes

### Technical Requirements

**Understanding Level 정의:**

| Level | 상태 | 감지 조건 |
|-------|------|----------|
| 1 | 소개됨 | AI가 개념 설명 |
| 2 | 이해함 | 사용자가 "아, 그래서..." 반응 |
| 3 | 적용함 | 사용자가 개념을 언급하며 결정 |
| 4 | 숙달 | 3번 이상 독립적 적용 |

**learnings 테이블:**
```sql
CREATE TABLE learnings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,         -- 사용자 식별자 (다중 사용자 지원)
  concept TEXT NOT NULL,         -- '60-30-10 법칙', '동선', 'Japandi'
  domain TEXT,                   -- 'color_theory', 'spatial', 'style'
  understanding_level INTEGER DEFAULT 1 CHECK(understanding_level BETWEEN 1 AND 4),
  first_introduced INTEGER,      -- Unix timestamp (seconds)
  last_applied INTEGER,          -- Unix timestamp (seconds)
  applied_count INTEGER DEFAULT 0,
  user_explanation TEXT,         -- 사용자가 개념을 설명한 기록
  created_at INTEGER             -- Unix timestamp (seconds)
);

-- 타임스탬프 컬럼은 모두 Unix epoch seconds (Date.now() / 1000)

-- 빈번한 검색 최적화를 위한 인덱스
CREATE INDEX idx_learnings_user ON learnings(user_id);
CREATE INDEX idx_learnings_concept ON learnings(concept);
CREATE INDEX idx_learnings_domain ON learnings(domain);
-- 사용자별 개념 유일성 (동일 사용자가 같은 개념 중복 학습 방지)
CREATE UNIQUE INDEX idx_learnings_user_concept ON learnings(user_id, concept);
```

**mama_save 확장 예시:**
```typescript
// type='learning' 저장 (mama_save 도구 확장)
mama_save({
  type: 'learning',
  // user_id: 세션에서 자동 추출 (MCP 요청의 클라이언트 ID 또는 설정값)
  concept: '60-30-10 법칙',
  domain: 'color_theory',
  // 아래 필드는 자동 생성됨:
  // - id: 'learning_' + nanoid()
  // - user_id: 세션 컨텍스트에서 자동 주입
  // - understanding_level: 스키마 DEFAULT 1 (CHECK 1~4 범위 강제)
  // - first_introduced: Date.now()
  // - applied_count: 0
  // - created_at: Date.now()
})

// understanding_level 업데이트는 별도 내부 로직 (mama_update 아님)
// → 사용자 메시지 분석 후 자동 업데이트
```

**참고:** 기존 `mama_save`는 `type: 'decision' | 'checkpoint'`만 지원하며, `type: 'learning'` 추가 시 내부적으로 learnings 테이블에 저장됨.

### References

- [Source: docs/adr/0025-learning-track.md]
- [Source: docs/epics.md#story-11.4.1]

### Dependencies

- **선행**: Story 11.1 (MAMA Core 4 Tools) - save 도구 기반
- **선행**: Story 11.5 (SessionStart Hook) - 힌트 주입 기반

### File List

- `apps/cad-mcp/src/mama/db.ts` (수정 - learnings 테이블)
- `apps/cad-mcp/src/mama/schema.ts` (수정 - Learning 타입)
- `apps/cad-mcp/src/mama/tools/save.ts` (수정 - type='learning')
- `apps/cad-mcp/src/mama/learning-tracker.ts` (신규)
- `apps/cad-mcp/src/mama/hooks/session-start.ts` (수정 - 학습 힌트)
