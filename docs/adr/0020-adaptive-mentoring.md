# ADR-0020: 적응형 멘토링 시스템

## Status

**Proposed**

## Date

2025-12-31

## Context

사용자 숙련도에 따라 MAMA의 개입 수준을 조절해야 한다. "운전 20년차에게 '깜빡이 켜세요'는 모욕"

## Decision

**성장 단계별 MAMA 역할 변화**

| 단계 | 감지 조건 | MAMA 역할 | 예상 기간 |
|------|----------|----------|---------|
| **모방 (Mimic)** | AI 제안 수정률 낮음 | 지시자 (Director) | 0~2개월 |
| **비판 (Critique)** | Debates 관계 증가 | 스파링 파트너 | 2~4개월 |
| **주도 (Lead)** | EditHint 사용 증가 | 관찰자/조력자 | 4~6개월 |

**측정 지표:**
- **AI 제안 수정률**: Claude 제안을 사용자가 얼마나 수정하는가
- **EditHint 사용 빈도**: 사용자가 힌트를 직접 개선하는가
- **Debates 관계 생성 빈도**: 사용자가 기존 결정에 반론하는가

**단계별 행동:**
```
[모방 단계]
💡 "외벽은 200mm가 표준입니다. 이유: 구조 안전성"

[비판 단계]
💡 "외벽 200mm가 일반적이나, 고려할 대안들:
    - 150mm: 공간 효율
    - 250mm: 단열 강화"

[주도 단계]
(힌트 최소화, 사용자 요청 시에만 제공)
```

## Consequences

### Positive
- 숙련자에게 불필요한 간섭 감소
- 초보자에게 충분한 가이드 제공
- 자연스러운 학습 곡선

### Negative
- 성장 단계 판단 오류 가능
- 전환점 정의가 주관적

## References

- [ADR-0014: Progressive Workflow](0014-progressive-workflow.md)
- [ADR-0010: Partnership Philosophy](0010-partnership-philosophy.md)
