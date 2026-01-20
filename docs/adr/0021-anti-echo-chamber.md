# ADR-0021: Anti-Echo Chamber 메커니즘

## Status

**Proposed**

## Date

2025-12-31

## Context

Claude가 사용자의 모든 결정에 무조건 동의하는 'Yes-Man'이 되면 안 된다. 파트너십은 단순 동의가 아니라 건강한 충돌.

## Decision

**3대 보호 메커니즘**

| 메커니즘 | Level | 트리거 | 행동 |
|---------|-------|-------|------|
| **강제 반론** | Level 2 | 중요 결정 저장 시 | 최소 1개 리스크/대안 제시 |
| **외부 증거 문턱값** | Level 2 | debates 링크 부족 | WebSearch로 팩트체크 후 반론 |
| **장기 기억 권위 해체** | Level 2 | 10회 이상 인용된 힌트 | "검증 필요" 태그 부착 |

**강제 반론 예시:**
```
사용자: "모든 방은 3m x 3m로 표준화하자"

Claude: "표준화의 장점을 이해합니다.
         🔍 리스크 검토:
         - 욕실/창고는 3x3이 비효율적
         - 거실은 3x3이 좁을 수 있음

         대안: 용도별 최소 크기 표준은 어떨까요?"
```

**외부 증거 워크플로우:**
```
decisions(debates < 10%)
    │
    ▼
Graph Health 경고
    │
    ▼
WebSearch로 외부 증거 수집
    │
    ▼
증거 기반 반론 제시
```

## Consequences

### Positive
- 비판적 사고 촉진
- 편향된 결정 방지
- 외부 관점 도입

### Negative
- 과도한 반론으로 협업 방해 가능
- 외부 검색 지연 시간

## References

- [ADR-0010: Partnership Philosophy](0010-partnership-philosophy.md)
- [ADR-0019: Graph Health Metrics](0019-graph-health-metrics.md)
