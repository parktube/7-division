# Story 11.4: Outcome Tracking

Status: ready-for-dev

## Story

As a **LLM 에이전트**,
I want **결정의 성공/실패를 추적하기를**,
So that **실패한 접근법을 피할 수 있다** (FR70).

## Acceptance Criteria

### AC1: 성공 기록
**Given** 결정이 저장된 후 실제 작업을 수행했을 때
**When** 성공적으로 동작하면
**Then** `mama_update(id, 'success', 'reason')`으로 기록한다
**And** outcome 필드가 'success'로 업데이트된다

### AC2: 실패 기록
**Given** 결정이 저장된 후 문제가 발생했을 때
**When** 실패했으면
**Then** `mama_update(id, 'failed', 'reason')`으로 기록한다
**And** outcome 필드가 'failed'로, outcome_reason이 저장된다

### AC3: 부분 성공 기록
**Given** 결정이 부분적으로만 성공했을 때
**When** `mama_update(id, 'partial', 'reason')`을 호출하면
**Then** outcome 필드가 'partial'로 업데이트된다

### AC4: 검색 시 실패 결정 경고
**Given** `mama_search` 도구를 호출할 때
**When** 이전에 실패한 결정이 검색 결과에 포함되면
**Then** `⚠️ outcome: failed` 표시와 함께 반환된다
**And** 실패 이유(outcome_reason)도 함께 표시된다

### AC5: Outcome 기반 필터링
**Given** `mama_search` 도구를 호출할 때
**When** `outcome_filter='success'`를 전달하면
**Then** 성공한 결정만 검색 결과에 포함된다

### AC6: Pending 결정 조회
**Given** `mama_search` 도구를 호출할 때
**When** `outcome_filter='pending'`을 전달하면
**Then** outcome이 NULL인 (아직 검증되지 않은) 결정만 반환된다

## Tasks / Subtasks

- [ ] Task 1: DB 스키마 확장 (AC: #1-3)
  - [ ] 1.1 decisions 테이블에 `outcome_reason TEXT` 컬럼 추가
  - [ ] 1.2 `updated_at` 컬럼 업데이트 로직 추가

- [ ] Task 2: mama_update 도구 강화 (AC: #1-3)
  - [ ] 2.1 outcome_reason 저장 로직 추가
  - [ ] 2.2 업데이트 시 updated_at 갱신
  - [ ] 2.3 존재하지 않는 ID 에러 처리

- [ ] Task 3: 검색 결과 outcome 표시 (AC: #4)
  - [ ] 3.1 검색 결과에 outcome, outcome_reason 필드 포함
  - [ ] 3.2 failed 결정에 `⚠️` 경고 표시 로직
  - [ ] 3.3 MamaSearchOutput 스키마 업데이트

- [ ] Task 4: Outcome 필터링 (AC: #5, #6)
  - [ ] 4.1 MamaSearchInput에 `outcome_filter?: 'success' | 'failed' | 'partial' | 'pending'` 추가
  - [ ] 4.2 SQL WHERE 절에 outcome 조건 추가
  - [ ] 4.3 'pending'은 `outcome IS NULL` 조건으로 처리

- [ ] Task 5: 테스트 작성
  - [ ] 5.1 success 업데이트 테스트
  - [ ] 5.2 failed + reason 업데이트 테스트
  - [ ] 5.3 partial 업데이트 테스트
  - [ ] 5.4 검색 결과 outcome 표시 테스트
  - [ ] 5.5 outcome 필터링 테스트
  - [ ] 5.6 pending 필터 테스트

## Dev Notes

### Architecture Compliance

- **Outcome Tracking**: 결정의 실제 결과를 추적 (ADR-0011)
- **실패 학습**: 실패한 접근법을 명시적으로 기록하여 반복 방지
- **검색 시 경고**: 실패한 결정 참조 시 주의 환기

### Technical Requirements

**Outcome 상태:**

| Outcome | 의미 | 저장 시점 |
|---------|------|----------|
| `NULL` (pending) | 아직 검증 안 됨 | 초기 저장 시 |
| `success` | 결정이 성공적으로 작동 | 검증 후 |
| `failed` | 결정이 실패함 | 문제 발견 시 |
| `partial` | 부분적으로만 성공 | 일부 성공 시 |

**확장된 Update Input:**
```typescript
interface MamaUpdateInput {
  id: string;
  outcome: 'success' | 'failed' | 'partial';
  reason?: string;  // 실패/부분 성공 이유
}
```

**확장된 Search Input:**
```typescript
interface MamaSearchInput {
  // ... 기존 필드
  outcome_filter?: 'success' | 'failed' | 'partial' | 'pending';
}
```

**확장된 Search Output:**
```typescript
interface SearchResult {
  id: string;
  topic: string;
  decision: string;
  similarity: number;
  created_at: string;
  // 추가
  outcome?: 'success' | 'failed' | 'partial' | null;
  outcome_reason?: string;
  outcome_warning?: string;  // "⚠️ 이전에 실패한 결정입니다"
}
```

**DB 스키마 업데이트:**
```sql
-- decisions 테이블 확장
ALTER TABLE decisions ADD COLUMN outcome_reason TEXT;

-- 인덱스 추가 (outcome 필터링용)
CREATE INDEX idx_decisions_outcome ON decisions(outcome);
```

### Project Structure Notes

**파일 구조:**
```
apps/cad-mcp/src/mama/
├── tools/
│   ├── update.ts          # outcome_reason 추가 (수정)
│   └── search.ts          # outcome 표시, 필터링 (수정)
└── db.ts                  # outcome_reason 컬럼 (수정)

packages/shared/src/schemas/
└── mama.ts                # Input/Output 확장 (수정)
```

### Testing Standards

- outcome 상태별 CRUD 테스트
- 필터링 조합 테스트 (domain + outcome 등)
- 경고 메시지 포맷 테스트

### References

- [Source: docs/architecture.md#4.6-data-architecture] - DB 스키마
- [Source: docs/adr/0011-mama-core-reuse.md] - Outcome Tracking
- [Source: docs/epics.md#story-11.1.4] - Story 상세

### Dependencies

- **선행**: Story 11.1 (MAMA Core 4 Tools) - mama_update 도구 기본 구현

### Scope Clarification

**이 스토리에서 하는 것:**
- outcome_reason 저장
- 검색 결과에 outcome 경고 표시
- outcome 기반 필터링
- pending (미검증) 결정 조회

**이 스토리에서 하지 않는 것:**
- 자동 outcome 감지 (사용자/LLM이 명시적으로 호출)
- outcome 기반 추천 점수 조정 (Phase 3 - Intelligence)

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

- Story created: 2026-01-20
- Phase 11.1 Core의 마지막 스토리

### File List

- `apps/cad-mcp/src/mama/db.ts` (수정 - outcome_reason)
- `apps/cad-mcp/src/mama/tools/update.ts` (수정)
- `apps/cad-mcp/src/mama/tools/search.ts` (수정)
- `packages/shared/src/schemas/mama.ts` (수정)
- `apps/cad-mcp/src/mama/__tests__/outcome-tracking.test.ts` (신규)
