# Story 11.14: Module Library Recommendation

Status: Done

## Story

As a **LLM 에이전트**,
I want **MAMA 임베딩으로 모듈을 추천받기를**,
So that **적절한 모듈을 빠르게 찾을 수 있다** (FR80).

## Acceptance Criteria

### AC1: 시맨틱 모듈 검색
**Given** 사용자가 "마을을 만들고 싶어"라고 말할 때
**When** 모듈 추천이 실행되면
**Then** house_lib(0.87), tree_lib(0.72) 순으로 추천된다

### AC2: 모듈 메타데이터 임베딩
**Given** 모듈 메타데이터(JSDoc)가 있을 때
**When** 모듈이 저장되면
**Then** description이 임베딩되어 검색 가능해진다

### AC3: 사용 빈도 반영
**Given** 모듈을 사용할 때
**When** 사용 횟수가 기록되면
**Then** usage_frequency가 추천 점수에 반영된다 (30% 가중치)

### AC4: 추천 점수 계산
**Given** 모듈 추천 시
**When** 점수를 계산하면
**Then** Score = (semantic × 0.6) + (usage × 0.3) + (recency × 0.1)

### AC5: recommend_modules 도구
**Given** 추천이 필요할 때
**When** `recommend_modules` 도구를 호출하면
**Then** 쿼리에 맞는 모듈 목록이 점수순으로 반환된다

## Tasks / Subtasks

- [ ] Task 1: modules 테이블 구현 (AC: #2)
  - [ ] 1.1 DB 스키마 추가 (name, description, embedding, usage_count)
  - [ ] 1.2 모듈 등록 로직

- [ ] Task 2: 임베딩 생성 (AC: #2)
  - [ ] 2.1 JSDoc 파싱
  - [ ] 2.2 description 임베딩 (multilingual-e5)

- [ ] Task 3: 추천 알고리즘 (AC: #1, #3, #4)
  - [ ] 3.1 시맨틱 유사도 계산
  - [ ] 3.2 사용 빈도 정규화
  - [ ] 3.3 최종 점수 계산

- [ ] Task 4: recommend_modules 도구 (AC: #5)
  - [ ] 4.1 도구 구현
  - [ ] 4.2 결과 포맷팅

- [ ] Task 5: 테스트 작성

## Dev Notes

### Technical Requirements

**추천 알고리즘:**
```
Score = (semantic_similarity × 0.6) + (usage_frequency × 0.3) + (recency × 0.1)
```

**modules 테이블:**
```sql
CREATE TABLE modules (
  name TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  tags TEXT,              -- JSON array
  embedding BLOB,         -- Float32Array
  usage_count INTEGER DEFAULT 0,
  last_used_at INTEGER,
  created_at INTEGER
);
```

**2-Layer 추천 시스템:**
```
[Layer 1] 임베딩 검색 (30ms) - 후보 필터링
  MAMA: "마을" → house(0.87), tree(0.72), cat(0.23)

[Layer 2] LLM 추천 (선택적) - 최종 결정
  Claude: "마을에는 house와 tree가 필수입니다."
```

### References

- [Source: docs/architecture.md#4.8-module-library-recommendation]
- [Source: docs/adr/0024-module-library-recommendation.md]
- [Source: docs/epics.md#story-11.4.2]

### Dependencies

- **선행**: Phase 11.1 Core - 임베딩 인프라

### File List

- `apps/cad-mcp/src/mama/db.ts` (수정 - modules 테이블)
- `apps/cad-mcp/src/mama/module-recommender.ts` (신규)
- `apps/cad-mcp/src/mama/tools/recommend-modules.ts` (신규)
