# ADR-0010: Partnership Philosophy (핵심 철학)

## Status

**Proposed**

## Date

2025-12-31

## Context

MAMA Integration의 근본적인 설계 철학을 정의해야 한다. MAMA가 단순한 메모리 시스템인지, 아니면 더 깊은 역할을 하는지 명확히 해야 한다.

## Decision

**Claude는 자동화 도구가 아니라, 인간 설계자와 경험을 공유하며 함께 성장하는 설계 마스터(Master)이다.**

### 핵심 원칙

1. **상호 학습**: 사용자는 Claude로부터 배우고, Claude는 사용자의 설계 스타일을 학습
2. **비판적 파트너십 (Anti-Echo Chamber)**: 건강한 반론을 제기할 수 있는 비판적 거울
3. **맥락의 연속성**: 세션이 끊겨도 장기 기억으로 맥락 유지

### MAMA 재정의

| 잘못된 이해 | 올바른 이해 |
|------------|------------|
| MAMA = 메모리 시스템 | MAMA = **파트너십을 만드는 경험 축적 시스템** |
| 효율성이 목표 | **관계의 깊이**가 목표 |
| 매번 리셋 | 경험이 축적됨 |

### 두 층위의 파트너십

```
Layer 2: Claude ↔ MAMA  ← 더 근본적
  "Claude가 MAMA를 신뢰하고 능동적으로 사용하는가"
                    ↓
              경험이 축적됨
                    ↓
Layer 1: 인간 ↔ Claude
  "Claude가 나를 이해하는가"
```

### 상호작용 원칙 계층

| Level | 명칭 | 원칙 | 적용 상황 |
|-------|------|------|----------|
| **1** | 설득 (Persuasion) | Tool Description으로 넛징 | 워크플로우 제안 |
| **2** | 경고 (Warning) | 능동적 개입 | 에코챔버 위험, 90일 이상 된 결정 |
| **3** | 강제 (Enforcement) | Hook으로 강제 | 안전, 법 준수, 치명적 오류 |

## Consequences

### Positive
- 장기적 파트너십 형성 가능
- 사용자 성장 지원 (6개월 로드맵)
- 프로젝트 맥락의 연속성 확보

### Negative
- 구현 복잡도 증가
- 측정하기 어려운 성공 기준 (관계의 깊이)

### Neutral
- 모든 MAMA 기능 설계의 기반이 됨

## Alternatives Considered

### Option A: 단순 메모리 시스템
- 저장/검색만 지원
- 장점: 구현 단순
- 단점: 파트너십 형성 불가
- **선택 안 한 이유:** MAMA의 본질적 가치 상실

### Option B: 완전 자동화
- 모든 결정을 자동 저장/적용
- 장점: 사용자 개입 최소화
- 단점: Claude의 추론 억제, 에코챔버 위험
- **선택 안 한 이유:** AX 원칙 위배 ("LLM의 추론을 막지 않는다")

## References

- [mama-integration-prd.md](../mama-integration-prd.md) - 상세 요구사항
- [architecture.md](../architecture.md) - ADR 요약
- [ADR-0021: Anti-Echo Chamber](0021-anti-echo-chamber.md) - 관련 결정
