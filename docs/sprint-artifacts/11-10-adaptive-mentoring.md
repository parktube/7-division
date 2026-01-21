# Story 11.10: Adaptive Mentoring

Status: ready-for-dev

## Story

As a **사용자**,
I want **내 수준에 맞는 힌트를 받기를**,
So that **점진적으로 학습할 수 있다** (FR76).

## Acceptance Criteria

### AC1: 초보자 모드 상세 힌트
**Given** 초보자 모드일 때
**When** ActionHints가 생성되면
**Then** 상세한 설명과 예시가 포함된다

### AC2: 숙련자 모드 간결 힌트
**Given** 숙련자 모드일 때
**When** ActionHints가 생성되면
**Then** 간결한 키워드만 포함된다

### AC3: 반복 패턴 학습
**Given** 사용자가 특정 패턴을 여러 번 사용했을 때
**When** 동일한 힌트가 반복되면
**Then** 힌트 우선순위가 낮아진다

### AC4: 사용자 수준 자동 감지
**Given** 사용 이력이 축적될 때
**When** 특정 작업을 빠르게 완료하면
**Then** 해당 영역의 숙련도가 자동으로 상승한다

### AC5: 수동 수준 설정
**Given** 사용자가 수준을 직접 설정하려 할 때
**When** `set_skill_level` 도구를 호출하면
**Then** 모든 영역의 힌트 수준이 변경된다

## Tasks / Subtasks

- [ ] Task 1: 사용자 프로필 저장 (AC: #3, #4)
  - [ ] 1.1 user_profile 테이블 추가 (skill_level, action_counts)
  - [ ] 1.2 작업 완료 시 카운트 증가
  - [ ] 1.3 숙련도 자동 계산 로직

- [ ] Task 2: 수준별 힌트 생성 (AC: #1, #2)
  - [ ] 2.1 초보자용 상세 템플릿
  - [ ] 2.2 숙련자용 간결 템플릿
  - [ ] 2.3 ActionHints 생성 시 수준 반영

- [ ] Task 3: set_skill_level 도구 (AC: #5)
  - [ ] 3.1 도구 구현
  - [ ] 3.2 'beginner' | 'intermediate' | 'expert' 수준

- [ ] Task 4: 테스트 작성

## Dev Notes

### Technical Requirements

**수준별 힌트 예시:**

| 수준 | next_steps 예시 |
|------|----------------|
| beginner | "add_door: 문 배치하기 - 방을 만들었으니 출입구가 필요합니다. create_door(x, y, width)로 문을 추가하세요." |
| expert | "add_door" |

**user_profile 테이블:**
```sql
CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY,
  global_skill_level TEXT DEFAULT 'intermediate',  -- 전체 기본 수준
  domain_skill_levels TEXT,  -- JSON: {"primitives": "expert", "groups": "beginner"}
  action_counts TEXT,        -- JSON: {"draw_rect": 45, "create_group": 12}
  updated_at INTEGER
);
```

**영역별 숙련도 자동 계산:**
- 영역 분류: primitives, transforms, groups, boolean, query
- 자동 승격 기준: 해당 영역 action_count >= 20 → intermediate, >= 50 → expert
- `domain_skill_levels`가 없으면 `global_skill_level` 사용

### References

- [Source: docs/adr/0020-adaptive-mentoring.md]
- [Source: docs/epics.md#story-11.3.2]

### Dependencies

- **선행**: Story 11.7 (ActionHints) - 힌트 생성 기반

### File List

- `apps/cad-mcp/src/mama/db.ts` (수정 - user_profile)
- `apps/cad-mcp/src/mama/mentoring.ts` (신규)
- `apps/cad-mcp/src/mama/tools/set-skill-level.ts` (신규)
