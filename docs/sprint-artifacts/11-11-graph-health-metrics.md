# Story 11.11: Graph Health Metrics

Status: ready-for-dev

## Story

As a **개발자**,
I want **Reasoning Graph의 건강도를 측정하기를**,
So that **지식 품질을 모니터링할 수 있다** (FR77).

## Acceptance Criteria

### AC1: 기본 메트릭 계산
**Given** 결정 그래프가 있을 때
**When** 건강도를 측정하면
**Then** 다음 지표가 계산된다:
  - 총 결정 수
  - 관계 유형별 비율 (supersedes, builds_on, debates, synthesizes)
  - 고아 결정 비율 (관계 없는 결정)

### AC2: debates 비율 경고
**Given** debates 비율이 10% 미만일 때
**When** 건강도가 평가되면
**Then** "에코챔버 위험" 경고가 발생한다

### AC3: Stale Decision 감지
**Given** 90일 이상 된 결정이 있을 때
**When** 건강도를 측정하면
**Then** stale_decisions 목록에 포함된다

### AC4: 주기적 건강도 체크
**Given** 세션이 시작될 때
**When** onSessionInit Hook이 실행되면
**Then** 건강도가 자동으로 계산되고 경고가 주입된다

### AC5: 수동 건강도 조회
**Given** 사용자가 건강도를 확인하려 할 때
**When** `mama_health` 도구를 호출하면
**Then** 상세한 건강도 리포트가 반환된다

## Tasks / Subtasks

- [ ] Task 1: 건강도 계산 모듈 (AC: #1, #2, #3)
  - [ ] 1.1 `apps/cad-mcp/src/mama/health.ts` 생성
  - [ ] 1.2 관계 유형별 카운트 쿼리
  - [ ] 1.3 고아 결정 감지 쿼리
  - [ ] 1.4 Stale 결정 감지 (90일)

- [ ] Task 2: 경고 시스템 (AC: #2)
  - [ ] 2.1 debates < 10% 경고
  - [ ] 2.2 경고 메시지 포맷팅

- [ ] Task 3: onSessionInit 통합 (AC: #4)
  - [ ] 3.1 건강도 체크 호출
  - [ ] 3.2 경고 주입

- [ ] Task 4: mama_health 도구 (AC: #5)
  - [ ] 4.1 도구 구현
  - [ ] 4.2 상세 리포트 포맷

- [ ] Task 5: 테스트 작성

## Dev Notes

### Technical Requirements

**건강도 리포트:**
```typescript
interface GraphHealth {
  totalDecisions: number;
  edgeTypeCounts: {
    supersedes: number;
    builds_on: number;
    debates: number;
    synthesizes: number;
  };
  edgeTypeRatios: {
    debates: number;  // 0.0 ~ 1.0
  };
  orphanCount: number;
  staleDecisions: string[];  // 90일 이상
  warnings: string[];
}
```

**경고 조건:**
- debates < 10%: "⚠️ 에코챔버 위험: 반론 비율이 낮습니다"
- staleDecisions.length > 0: "⚠️ N개의 오래된 결정이 있습니다"

### References

- [Source: docs/adr/0019-graph-health-metrics.md]
- [Source: docs/epics.md#story-11.3.3]

### Dependencies

- **선행**: Story 11.2 (Reasoning Graph) - decision_edges 테이블

### File List

- `apps/cad-mcp/src/mama/health.ts` (신규)
- `apps/cad-mcp/src/mama/tools/mama-health.ts` (신규)
- `apps/cad-mcp/src/mama/hooks/session-init.ts` (수정)
