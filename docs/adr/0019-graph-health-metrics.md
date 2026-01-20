# ADR-0019: Graph Health Metrics

## Status

**Proposed**

## Date

2025-12-31

## Context

Reasoning Graph의 "건강" 상태를 정의해야 한다. 단순히 많은 결정이 아니라, 건강한 관계 (반론 포함)가 중요.

## Decision

**건강한 관계는 반론도 필요**

**건강 기준:**
```
builds_on:   60-80% (발전)
debates:     10-25% (반론)
synthesizes: 5-15%  (통합)
```

**근거:** 소프트웨어 개발의 코드 리뷰 연구에서 건강한 기술 토론은 10-30% 반론을 포함하는 것으로 알려져 있음 (하한 10%는 최소 비판적 검토, 상한 25%는 과도한 갈등 방지). 초기 설정이며 실제 사용 데이터로 조정 예정.

**Bias Warning 유형:**

| 유형 | 조건 | 측정 방법 | 권장 행동 |
|------|------|----------|----------|
| `echo_chamber` | debates < 10% | 최근 30일 결정 중 `debates:` 패턴 비율 | "다른 관점도 고려해보세요" |
| `stale_decision` | 90일 이상 미검증 | `created_at` 기준, outcome이 NULL인 결정 | "이 결정을 다시 검토해보세요" |
| `no_external_evidence` | 외부 증거 없음 | reasoning에 URL/테스트/벤치마크 언급 없음 | "외부 자료로 검증해보세요" |

**Dashboard:**
```
[Graph Health]
├── builds_on:   72% ✓
├── debates:     8%  ⚠️ (echo_chamber 위험)
└── synthesizes: 20% ✓
```

## Consequences

### Positive
- Echo Chamber 조기 감지
- 편향된 결정 패턴 인식
- 건강한 반론 문화 장려

### Negative
- 메트릭 계산 오버헤드
- 임계값 조정 필요

### Mitigation Strategies
- **캐싱**: 메트릭은 결정 저장 시에만 재계산 (조회 시 캐시 사용)
- **배치 처리**: SessionStart 시 한 번만 계산, 세션 중에는 캐시 사용
- **임계값 조정**: 초기 30일간 데이터 수집 후 임계값 재검토

## References

- [ADR-0013: Edge Types via Reasoning](0013-edge-types-reasoning.md)
- [ADR-0021: Anti-Echo Chamber](0021-anti-echo-chamber.md)
