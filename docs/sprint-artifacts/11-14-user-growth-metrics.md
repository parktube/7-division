# Story 11.14: User Growth Metrics

Status: Done

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
**Given** 성장 리포트 생성 트리거가 발생할 때
**When** 체크포인트 저장 시 또는 첫 활동 후 30일 경과 시
**Then** 독립 결정 비율, 개념 적용 횟수가 요약된다
> **트리거 조건**: (1) 체크포인트 저장 시 자동 포함, (2) 첫 활동일로부터 30일 경과 시 알림

### AC5: Adaptive Mentoring 연동
**Given** 성장 지표가 일정 수준에 도달했을 때
**When** independent_decision 비율이 70% 이상이면
**Then** 힌트 수준이 자동으로 '숙련자'로 조절된다

### AC6: 전문 용어 사용 기록
**Given** 사용자가 전문 용어를 사용할 때
**When** "브러시 스트로크의 가중치를 줄일게"라고 말하면
**Then** growth_metrics에 type='terminology_used' 기록
> **Note**: Story 11.16 (Terminology Evolution)과 연동하여 용어 변화 추적에도 활용됨

## Tasks / Subtasks

- [x] Task 1: growth_metrics 테이블 생성 (AC: #1, #2, #3)
  - [x] 1.1 스키마 정의 (user_id, metric_type, related_learning_id, related_decision_id, context, created_at)
  - [x] 1.2 SQLite 마이그레이션 (006-growth-metrics.sql)
  - [x] 1.3 TypeScript 타입 정의 (GrowthMetricRow, GrowthMetricType)

- [x] Task 2: 독립 결정 감지 (AC: #1)
  - [x] 2.1 recordIndependentDecision() 함수
  - [x] 2.2 findRelatedLearning() 함수로 학습된 개념 매칭
  - [x] 2.3 growth_metrics 자동 기록

- [x] Task 3: 트레이드오프 예측 감지 (AC: #3)
  - [x] 3.1 recordTradeoffPredicted() 함수
  - [x] 3.2 패턴 감지는 호출자 책임 (API 제공)
  - [x] 3.3 growth_metrics 자동 기록

- [x] Task 4: 성장 리포트 생성 (AC: #4)
  - [x] 4.1 getGrowthSummary() - 기간별 지표 집계
  - [x] 4.2 formatGrowthReport() - 리포트 포맷팅
  - [x] 4.3 shouldTrigger30DayReport() - 30일 트리거 체크
  - [x] 4.4 mama_growth_report 도구 추가

- [x] Task 5: Adaptive Mentoring 연동 (AC: #5)
  - [x] 5.1 calculateIndependentRatio() - 독립 결정 비율 계산
  - [x] 5.2 checkSkillLevelUpgrade() - 자동 숙련자 승격 (70% 기준)
  - [x] 5.3 recordGrowth() 호출 시 자동 체크

- [x] Task 6: 전문 용어 사용 감지 (AC: #6)
  - [x] 6.1 recordTerminologyUsed() 함수
  - [x] 6.2 growth_metrics에 type='terminology_used' 기록
  - [x] 6.3 Story 11.16과 연동 (getGrowthSummary에서 terminologyEvolutions 통합)

- [x] Task 7: 테스트 작성 (8개 테스트 추가)
  - [x] 7.1 각 metric_type 기록 테스트 (4개)
  - [x] 7.2 성장 리포트 생성 테스트
  - [x] 7.3 mama_growth_report 도구 테스트
  - [x] 7.4 countGrowthMetricsByType 테스트

## Dev Notes

### Technical Requirements

**growth_metrics 테이블:**
```sql
CREATE TABLE growth_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,         -- 사용자 식별자 (다중 사용자 지원)
  metric_type TEXT NOT NULL,     -- 'independent_decision', 'concept_applied',
                                 -- 'tradeoff_predicted', 'terminology_used'
  related_learning_id TEXT,
  related_decision_id TEXT,
  context TEXT,                  -- 어떤 상황에서 발생했는지
  created_at INTEGER,            -- Unix timestamp (seconds)
  FOREIGN KEY (related_learning_id) REFERENCES learnings(id),
  FOREIGN KEY (related_decision_id) REFERENCES decisions(id)
);

-- 사용자별 성장 지표 조회 최적화
CREATE INDEX idx_growth_metrics_user ON growth_metrics(user_id);
CREATE INDEX idx_growth_metrics_type ON growth_metrics(metric_type);
-- 사용자별 지표 유형 조회 최적화 (복합 인덱스)
CREATE INDEX idx_growth_metrics_user_type ON growth_metrics(user_id, metric_type);
```

**성장 지표 정의:**

| 지표 | 감지 조건 | 의미 | FK 사용 |
|------|----------|------|---------|
| independent_decision | AI 제안 없이 결정 + 학습된 개념 언급 | 능동적 적용 | `related_learning_id` |
| concept_applied | 학습된 개념을 직접 사용 | 지식 활용 | `related_learning_id` |
| tradeoff_predicted | 장단점을 먼저 언급 | 비판적 사고 | `related_decision_id` |
| terminology_used | 전문 용어 사용 | 언어 발전 | `related_learning_id` (용어 → 학습 개념 매핑) |

**성장 리포트 예시:**
```
📈 30일간의 성장:
├── 독립 결정 비율: 32% → 71%
├── 개념 적용 횟수: 15회
├── 트레이드오프 예측: 8회
└── 새로 배운 개념: 5개
```

**진행률 계산 방식:**
- **비교 기준**: 전체 기간을 전반부/후반부로 나누어 비교 (예: 30일 기준 → 0~15일 vs 16~30일)
- **계산 예시**: "독립 결정 비율: 32% → 71%"
  - 32% = 전반부(0~15일)의 독립 결정 비율
  - 71% = 후반부(16~30일)의 독립 결정 비율
- **쿼리 예시**:
  ```sql
  -- 전반부 독립 결정 비율
  SELECT COUNT(*) * 100.0 / total FROM growth_metrics
  WHERE created_at BETWEEN start AND midpoint AND metric_type = 'independent_decision';
  -- 후반부 독립 결정 비율
  SELECT COUNT(*) * 100.0 / total FROM growth_metrics
  WHERE created_at BETWEEN midpoint AND end AND metric_type = 'independent_decision';
  ```
- **데이터 부족 시 (< 14일)**: 진행률(before → after) 표시 생략, 절대값만 표시
  - 예: "독립 결정 비율: 45%" (비교 없이 현재 값만)

### References

- [Source: docs/adr/0025-learning-track.md]
- [Source: docs/epics.md#story-11.4.2]

### Dependencies

- **선행**: Story 11.13 (Learning Progress Storage) - learnings 테이블 참조
- **선행**: Story 11.10 (Adaptive Mentoring) - 연동
- **병행/후행**: Story 11.16 (Terminology Evolution) - terminology_evolution 테이블 및 도메인 용어 사전 참조

### Completion Notes List

- Implementation completed: 2026-01-21
- Task 6.3 deferred: Story 11.16과 연동은 11.16 구현 후 연결

### File List (Actual Implementation)

- `apps/cad-mcp/src/mama/migrations/006-growth-metrics.sql` - growth_metrics 테이블 DDL
- `apps/cad-mcp/src/mama/db.ts` (수정 - GrowthMetricRow 타입, CRUD 함수)
- `apps/cad-mcp/src/mama/growth-tracker.ts` (신규 - recordGrowth, getGrowthSummary, formatGrowthReport)
- `apps/cad-mcp/src/mama/tools/schema.ts` (수정 - mama_growth_report 도구 스키마)
- `apps/cad-mcp/src/mama/tools/handlers.ts` (수정 - handleMamaGrowthReport)
- `apps/cad-mcp/src/mama/tools/index.ts` (수정 - export 추가)
- `apps/cad-mcp/src/mama/index.ts` (수정 - growth-tracker 모듈 export)
- `apps/cad-mcp/src/mcp-server.ts` (수정 - mama_growth_report 도구 등록)
- `apps/cad-mcp/tests/mama.test.ts` (수정 - User Growth Metrics 테스트 8개)

### Review Follow-ups (AI)

- (이슈 없음 - 모든 AC 및 Tasks 검증 완료, Task 6.3 연동 확인됨)
