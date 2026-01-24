# ADR-0011: MAMA Core 4 Tools 재사용

## Status

**Proposed**

## Date

2025-12-31

## Context

CAD 프로젝트에 MAMA 기능을 통합해야 한다. MAMA를 재구현할지, 기존 검증된 도구를 재사용할지 결정해야 한다.

## Decision

**MAMA Core 4 Tools 그대로 사용**

```typescript
save(type, topic?, decision?, reasoning?, ...)  // Decision 또는 Checkpoint 저장
search(query?, type?, limit?)                    // 시맨틱 검색 또는 최근 항목
update(id, outcome, reason?)                     // 결과 추적
load_checkpoint()                                // 세션 복원
```

**왜 4개 도구인가:**
> "LLM can infer decision relationships from time-ordered search results. Fewer tools = more LLM flexibility."

## Consequences

### Positive
- 검증된 패턴 재사용 (MAMA v1.5.0)
- 도구 수 최소화 → Claude 추론 유연성 증가
- 구현 시간 단축

### Negative
- MAMA 의존성 발생

## Alternatives Considered

### Option A: 전체 재구현
- **선택 안 한 이유:** 검증된 것을 다시 만들 필요 없음

### Option B: 확장된 도구 세트 (10개+)
- **선택 안 한 이유:** 도구가 많으면 Claude 추론 복잡도 증가

## References

- [ADR-0010: Partnership Philosophy](0010-partnership-philosophy.md)
- [MAMA v1.5.0](https://github.com/jungjaehoon-lifegamez/MAMA)
