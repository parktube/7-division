# Story 11.14: User Growth Metrics

Status: ready-for-dev

## Story

As a **시스템**,
I want **사용자의 성장 지표를 자동 추적하기를**,
So that **멘토링 수준을 조절할 수 있다** (FR82).

## Acceptance Criteria

### AC1: 독립 결정 기록
**Given** 사용자가 AI 제안 없이 결정을 내릴 때
**When** "침대는 계단에서 안 보이는 곳에 놓을게 (동선 때문에)"라고 말하면
**Then** growth_metrics에 type='independent_decision', related_learning_id=동선 기록
- **매핑 기준**: 사용자 메시지에서 learnings 테이블의 concept과 일치하는 키워드 검색
- **예시**: "동선"이 learnings에 있으면 해당 learning.id를 related_learning_id로 연결

### AC2: 개념 적용 기록
**Given** 사용자가 배운 개념을 적용할 때
**When** "60-30-10 비율 맞춰서 색 배치할게"라고 말하면
**Then** growth_metrics에 type='concept_applied' 기록

### AC3: 트레이드오프 예측 기록
**Given** 사용자가 트레이드오프를 먼저 언급할 때
**When** "나무 난간으로 바꾸면 개방감이 줄어들겠지?"라고 말하면
**Then** growth_metrics에 type='tradeoff_predicted' 기록

### AC4: 성장 리포트 생성
**Given** 30일 후 성장 리포트를 생성할 때
**When** 체크포인트를 저장하면
**Then** 독립 결정 비율, 개념 적용 횟수가 요약된다

### AC5: Adaptive Mentoring 연동
**Given** 성장 지표가 일정 수준에 도달했을 때
**When** independent_decision 비율이 70% 이상이면
**Then** 힌트 수준이 자동으로 '숙련자'로 조절된다

## Tasks / Subtasks

- [ ] Task 1: growth_metrics 테이블 생성 (AC: #1, #2, #3)
  - [ ] 1.1 스키마 정의 (metric_type, related_learning_id, context)
  - [ ] 1.2 SQLite 마이그레이션
  - [ ] 1.3 TypeScript 타입 정의

- [ ] Task 2: 독립 결정 감지 (AC: #1)
  - [ ] 2.1 사용자 메시지에서 학습된 개념 언급 감지
  - [ ] 2.2 AI 제안 없이 결정했는지 판단
  - [ ] 2.3 growth_metrics 자동 기록

- [ ] Task 3: 트레이드오프 예측 감지 (AC: #3)
  - [ ] 3.1 "~하면 ~될 것 같은데" 패턴 감지
  - [ ] 3.2 장단점 언급 패턴 감지
  - [ ] 3.3 growth_metrics 자동 기록

- [ ] Task 4: 성장 리포트 생성 (AC: #4)
  - [ ] 4.1 기간별 지표 집계 쿼리
    - **기간 파라미터**: `period_days` (기본값: 30)
    - **기준 시점**: `growth_metrics.created_at` 타임스탬프
    - **계산 방식**: `WHERE created_at > (now - period_days * 24h)`
  - [ ] 4.2 리포트 포맷 (독립 결정 비율, 개념 적용 횟수 등)
  - [ ] 4.3 체크포인트 저장 시 자동 포함
  - [ ] 4.4 30일 트리거: 사용자 첫 활동일(min(created_at))로부터 30일 경과 시 리포트 자동 생성 알림

- [ ] Task 5: Adaptive Mentoring 연동 (AC: #5)
  - [ ] 5.1 성장 기반 숙련도 계산
  - [ ] 5.2 Story 11.10과 연동
  - [ ] 5.3 힌트 수준 자동 조절

- [ ] Task 6: 테스트 작성
  - [ ] 6.1 각 metric_type 감지 테스트
  - [ ] 6.2 성장 리포트 생성 테스트
  - [ ] 6.3 Adaptive Mentoring 연동 테스트

## Dev Notes

### Technical Requirements

**growth_metrics 테이블:**
```sql
CREATE TABLE growth_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_type TEXT NOT NULL,     -- 'independent_decision', 'concept_applied',
                                 -- 'tradeoff_predicted', 'terminology_used'
  related_learning_id TEXT,
  related_decision_id TEXT,
  context TEXT,                  -- 어떤 상황에서 발생했는지
  created_at INTEGER,
  FOREIGN KEY (related_learning_id) REFERENCES learnings(id),
  FOREIGN KEY (related_decision_id) REFERENCES decisions(id)
);
```

**성장 지표 정의:**

| 지표 | 감지 조건 | 의미 |
|------|----------|------|
| independent_decision | AI 제안 없이 결정 + 학습된 개념 언급 | 능동적 적용 |
| concept_applied | 학습된 개념을 직접 사용 | 지식 활용 |
| tradeoff_predicted | 장단점을 먼저 언급 | 비판적 사고 |
| terminology_used | 전문 용어 사용 | 언어 발전 |

**성장 리포트 예시:**
```
📈 30일간의 성장:
├── 독립 결정 비율: 32% → 71%
├── 개념 적용 횟수: 15회
├── 트레이드오프 예측: 8회
└── 새로 배운 개념: 5개
```

### References

- [Source: docs/adr/0025-learning-track.md]
- [Source: docs/epics.md#story-11.4.2]

### Dependencies

- **선행**: Story 11.13 (Learning Progress Storage) - learnings 테이블 참조
- **선행**: Story 11.10 (Adaptive Mentoring) - 연동

### File List

- `apps/cad-mcp/src/mama/db.ts` (수정 - growth_metrics 테이블)
- `apps/cad-mcp/src/mama/schema.ts` (수정 - GrowthMetric 타입)
- `apps/cad-mcp/src/mama/growth-tracker.ts` (신규)
- `apps/cad-mcp/src/mama/growth-report.ts` (신규)
- `apps/cad-mcp/src/mama/mentoring.ts` (수정 - 연동)
