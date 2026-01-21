# ADR-0025: Learning Track - 사용자 성장 추적 시스템

## Status

**Proposed**

## Date

2026-01-20

## Context

AI-Native CAD의 비전은 "만들고 싶은 것을 만들면서, 만드는 법을 배운다"이다.
현재 MAMA 시스템은 **결정(Decision)**을 저장하지만, **학습(Learning)**을 추적하지 않는다.

유저스토리 검토 결과 다음 gap이 발견됨:

| 영역 | 현재 | 필요 |
|------|------|------|
| 스키마 | decisions (결정만) | learnings 테이블 필요 |
| 성장 지표 | 수정률, debates 비율 | 독립 결정, 개념 적용 횟수 |
| AI 행동 | ActionHints만 | DesignHints (Human CoT 유도) |
| 언어 추적 | 없음 | terminology_evolution |

**핵심 질문**: "지은이가 30일 후 Japandi 스타일을 스스로 설명할 수 있을까?"

## Decision

### 1. Learning Progress Storage (FR81)

```sql
CREATE TABLE learnings (
  id TEXT PRIMARY KEY,
  concept TEXT NOT NULL,         -- '60-30-10 법칙', '동선', 'Japandi'
  domain TEXT,                   -- 'color_theory', 'spatial', 'style'
  understanding_level INTEGER,   -- 1: 소개됨, 2: 이해함, 3: 적용함, 4: 숙달
  first_introduced INTEGER,      -- timestamp
  last_applied INTEGER,          -- timestamp
  applied_count INTEGER DEFAULT 0,
  user_explanation TEXT,         -- 사용자가 이 개념을 설명한 기록
  created_at INTEGER
);
```

**Understanding Level 정의:**

| Level | 상태 | 감지 조건 |
|-------|------|----------|
| 1 | 소개됨 | AI가 개념 설명 |
| 2 | 이해함 | 사용자가 "아, 그래서..." 반응 |
| 3 | 적용함 | 사용자가 개념을 언급하며 결정 |
| 4 | 숙달 | 3번 이상 독립적 적용 |

### 2. User Growth Metrics (FR82)

```sql
CREATE TABLE growth_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_type TEXT NOT NULL,     -- 'independent_decision', 'concept_applied',
                                 -- 'tradeoff_predicted', 'terminology_used'
  related_learning_id TEXT,
  related_decision_id TEXT,
  context TEXT,
  created_at INTEGER
);
```

**성장 지표:**

| 지표 | 감지 조건 | 의미 |
|------|----------|------|
| independent_decision | AI 제안 없이 결정, 학습된 개념 언급 | 능동적 적용 |
| concept_applied | 학습된 개념을 직접 사용 | 지식 활용 |
| tradeoff_predicted | 장단점을 먼저 언급 | 비판적 사고 |
| terminology_used | 전문 용어 사용 | 언어 발전 |

### 3. DesignHints System (FR83)

**AX-UX 대칭 원칙:**
- ActionHints: AI의 다음 행동 유도 (AX)
- DesignHints: 인간의 다음 생각 유도 (UX)

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

### 4. Terminology Evolution (FR84)

```sql
CREATE TABLE terminology_evolution (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  before_term TEXT NOT NULL,     -- '미니멀하게'
  after_term TEXT NOT NULL,      -- 'Japandi 스타일로'
  learning_id TEXT,
  detected_at INTEGER
);
```

**자동 감지 로직:**
1. 같은 의미의 더 전문적인 용어 사용 감지
2. 학습된 개념의 용어로 대체 감지
3. 질문 품질 향상 감지 ("색감 어떻게?" → "60-30-10 비율은?")

## Consequences

### Positive
- 사용자 성장 여정을 정량적으로 추적 가능
- 멘토링 수준 자동 조절 (Adaptive Mentoring과 연동)
- "30일 후 이 사용자는 X를 알게 됨" 측정 가능
- 유저스토리의 "배움과 성장" 서사 지원

### Negative
- 스키마 복잡도 증가 (3개 테이블 추가)
- AI 행동 가이드라인 필요 (바로 만들지 않기)
- 성장 감지 로직의 오탐 가능

## Implementation

### Phase 11.4 Stories

| Story | FR | 핵심 구현 |
|-------|-----|----------|
| 11.4.1 | FR81 | learnings 테이블, understanding_level 업데이트 로직 |
| 11.4.2 | FR82 | growth_metrics 자동 기록, 성장 리포트 |
| 11.4.3 | FR83 | DesignHints 구조체, Human CoT 가이드라인 |
| 11.4.4 | FR84 | terminology_evolution 감지, 언어 변화 리포트 |

### Adaptive Mentoring 연동

```
성장 지표 기반 멘토링 수준 자동 조절:

[초보 단계] understanding_level 대부분 1-2
→ 상세 설명 + 모든 옵션 제시

[중급 단계] understanding_level 일부 3, independent_decision 증가
→ 간략 설명 + 핵심 옵션만

[숙련 단계] understanding_level 대부분 4, tradeoff_predicted 증가
→ 힌트 최소화, 요청 시에만
```

## References

- [ADR-0010: Partnership Philosophy](0010-partnership-philosophy.md)
- [ADR-0020: Adaptive Mentoring](0020-adaptive-mentoring.md)
- [User Story: 지은의 복층 인테리어](../ai-native-cad-proposal-v2.md#6-유즈케이스-지은의-복층-인테리어)
- MAMA Decision: `cad:human_cot_design_education`
- MAMA Decision: `partnership:user_growth_journey_mentorship`
