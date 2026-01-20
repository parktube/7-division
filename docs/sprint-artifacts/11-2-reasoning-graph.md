# Story 11.2: 결정 저장 + Reasoning Graph

Status: ready-for-dev

## Story

As a **LLM 에이전트**,
I want **결정 간의 관계를 그래프로 표현하기를**,
So that **지식의 진화를 추적할 수 있다** (FR68).

## Acceptance Criteria

### AC1: supersedes 관계 자동 생성
**Given** 같은 topic으로 새 결정을 저장할 때
**When** 이전 결정이 존재하면
**Then** 자동으로 `supersedes` 관계가 `decision_edges` 테이블에 생성된다
**And** 새 결정이 기존 결정을 대체함을 나타낸다

### AC2: builds_on 관계 파싱
**Given** reasoning에 `builds_on: decision_xxx`가 있을 때
**When** 결정이 저장되면
**Then** `builds_on` 관계가 파싱되어 `decision_edges`에 저장된다

### AC3: debates 관계 파싱
**Given** reasoning에 `debates: decision_xxx`가 있을 때
**When** 결정이 저장되면
**Then** `debates` 관계가 파싱되어 `decision_edges`에 저장된다

### AC4: synthesizes 관계 파싱 (다중)
**Given** reasoning에 `synthesizes: [id1, id2]`가 있을 때
**When** 결정이 저장되면
**Then** 여러 결정과의 `synthesizes` 관계가 각각 `decision_edges`에 저장된다

### AC5: 검색 결과에 관계 정보 포함
**Given** `mama_search` 도구를 호출할 때
**When** 결과에 관계가 있는 결정이 포함되면
**Then** 해당 결정의 `edges` 정보가 함께 반환된다 (supersedes_count, builds_on, debates 등)

### AC6: 잘못된 관계 패턴 처리
**Given** reasoning에 잘못된 형식의 관계 패턴이 있을 때
**When** 결정이 저장되면
**Then** 에러 없이 저장되고, 파싱되지 않은 패턴은 무시된다
**And** 경고 로그가 남는다

## Tasks / Subtasks

- [ ] Task 1: decision_edges 테이블 추가 (AC: #1-4)
  - [ ] 1.1 `apps/cad-mcp/src/mama/db.ts` 수정 - decision_edges 테이블 생성
  - [ ] 1.2 인덱스 추가 (from_id, to_id)
  - [ ] 1.3 외래키 제약 조건 설정

- [ ] Task 2: 관계 파싱 모듈 구현 (AC: #2-4, #6)
  - [ ] 2.1 `apps/cad-mcp/src/mama/reasoning-parser.ts` 생성
  - [ ] 2.2 `builds_on: decision_xxx` 패턴 파싱
  - [ ] 2.3 `debates: decision_xxx` 패턴 파싱
  - [ ] 2.4 `synthesizes: [id1, id2]` 패턴 파싱
  - [ ] 2.5 잘못된 패턴 무시 + 경고 로깅

- [ ] Task 3: supersedes 자동 관계 구현 (AC: #1)
  - [ ] 3.1 `mama_save` 로직 수정 - 같은 topic 결정 조회
  - [ ] 3.2 이전 결정 존재 시 supersedes edge 자동 생성
  - [ ] 3.3 시간순 체인 유지 (A supersedes B supersedes C)

- [ ] Task 4: mama_save 도구 확장 (AC: #1-4)
  - [ ] 4.1 save 후 reasoning 필드 파싱 호출
  - [ ] 4.2 파싱된 관계들 decision_edges에 저장
  - [ ] 4.3 트랜잭션으로 원자성 보장

- [ ] Task 5: mama_search 결과 확장 (AC: #5)
  - [ ] 5.1 검색 결과에 edges 정보 추가
  - [ ] 5.2 supersedes_count, builds_on[], debates[] 필드 추가
  - [ ] 5.3 MamaSearchOutput 스키마 업데이트

- [ ] Task 6: 테스트 작성
  - [ ] 6.1 supersedes 자동 관계 테스트
  - [ ] 6.2 builds_on 파싱 테스트
  - [ ] 6.3 debates 파싱 테스트
  - [ ] 6.4 synthesizes 다중 관계 테스트
  - [ ] 6.5 잘못된 패턴 무시 테스트
  - [ ] 6.6 검색 결과 edges 포함 테스트

## Dev Notes

### Architecture Compliance

- **Reasoning Graph**: 결정 간 관계를 그래프로 표현 (ADR-0013)
- **Edge Types**: supersedes(자동), builds_on, debates, synthesizes (수동)
- **패턴 기반**: 별도 API 대신 reasoning 필드에 패턴으로 표현

### Technical Requirements

**Edge Types (ADR-0013):**

| Edge | 자동? | 의미 | 패턴 |
|------|-------|------|------|
| `supersedes` | ✅ (같은 topic) | 이전 결정 대체 | (자동) |
| `builds_on` | ❌ | 기존 결정 위에 구축 | `builds_on: decision_xxx` |
| `debates` | ❌ | 대안 제시 | `debates: decision_xxx` |
| `synthesizes` | ❌ | 여러 결정 종합 | `synthesizes: [id1, id2]` |

**reasoning 패턴 예시:**
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

**DB Schema 추가 (architecture.md 4.6.1):**

```sql
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

CREATE INDEX idx_edges_from ON decision_edges(from_id);
CREATE INDEX idx_edges_to ON decision_edges(to_id);
```

**확장된 Search Output:**
```typescript
interface MamaSearchOutput {
  results: Array<{
    id: string;
    topic: string;
    decision: string;
    similarity: number;
    created_at: string;
    // 추가: edges 정보
    edges?: {
      supersedes_count: number;    // 이 결정이 대체한 결정 수
      superseded_by?: string;      // 이 결정을 대체한 최신 결정 ID
      builds_on: string[];         // 이 결정이 참조한 결정들
      debates: string[];           // 이 결정이 반론한 결정들
      synthesizes: string[];       // 이 결정이 종합한 결정들
    };
  }>;
}
```

### Parsing Logic

**정규식 패턴:**
```typescript
// builds_on: decision_xxx 또는 builds_on: decision_xxx_abc123
const BUILDS_ON_PATTERN = /builds_on:\s*(decision_[\w]+)/gi;

// debates: decision_xxx
const DEBATES_PATTERN = /debates:\s*(decision_[\w]+)/gi;

// synthesizes: [id1, id2] 또는 synthesizes: [id1, id2, id3]
const SYNTHESIZES_PATTERN = /synthesizes:\s*\[([\w,\s_]+)\]/gi;
```

### Project Structure Notes

**파일 구조:**
```
apps/cad-mcp/src/mama/
├── reasoning-parser.ts    # 관계 패턴 파싱 (신규)
├── tools/
│   ├── save.ts            # supersedes + 파싱 통합 (수정)
│   └── search.ts          # edges 정보 추가 (수정)
└── db.ts                  # decision_edges 테이블 (수정)

packages/shared/src/schemas/
└── mama.ts                # MamaSearchOutput 확장 (수정)
```

### Testing Standards

- 테스트 위치: `apps/cad-mcp/src/mama/__tests__/`
- reasoning-parser 단위 테스트 필수
- 통합 테스트: save → edges 생성 → search 결과 확인

### References

- [Source: docs/architecture.md#4.5-reasoning-graph] - Reasoning Graph 아키텍처
- [Source: docs/adr/0013-edge-types-reasoning.md] - Edge Types 결정
- [Source: docs/epics.md#story-11.1.2] - Story 상세

### Dependencies

- **선행**: Story 11.1 (MAMA Core 4 Tools) - decisions 테이블, mama_save/search 도구
- **후속**: Story 11.3.3 (Graph Health Metrics) - edges 데이터 기반 건강도 측정

### Scope Clarification

**이 스토리에서 하는 것:**
- decision_edges 테이블 추가
- reasoning 필드 패턴 파싱 (builds_on, debates, synthesizes)
- supersedes 자동 관계 생성
- 검색 결과에 edges 정보 포함

**이 스토리에서 하지 않는 것:**
- Graph Health Metrics 계산 (Story 11.3.3)
- Anti-Echo Chamber 경고 (Story 11.3.4)
- 그래프 시각화 UI

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

- Story created: 2026-01-20
- Dependencies: Story 11.1 (MAMA Core 4 Tools)

### File List

- `apps/cad-mcp/src/mama/reasoning-parser.ts` (신규)
- `apps/cad-mcp/src/mama/db.ts` (수정 - decision_edges 테이블)
- `apps/cad-mcp/src/mama/tools/save.ts` (수정 - 관계 파싱 통합)
- `apps/cad-mcp/src/mama/tools/search.ts` (수정 - edges 정보 추가)
- `packages/shared/src/schemas/mama.ts` (수정 - MamaSearchOutput 확장)
- `apps/cad-mcp/src/mama/__tests__/reasoning-parser.test.ts` (신규)
