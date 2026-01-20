# ADR-0012: Persuader Pattern (설득 기반)

## Status

**Proposed**

## Date

2025-12-31

## Context

MAMA 도구가 Claude와 어떻게 상호작용할지 결정해야 한다. 명령 기반 vs 설득 기반.

## Decision

**도구는 명령자가 아니라 설득자**

Tool Description 스타일:
```
⚡ TRIGGERS - Call this when:
• User says: "기억해줘", "remember", "decided"
• Lesson learned: "깨달았어", "this worked/failed"

🔗 REQUIRED WORKFLOW:
1. Call 'search' FIRST to find related decisions
2. Check if same topic exists (yours will supersede it)

💡 TIP: 수정된 힌트는 다음 도구 호출부터 적용됩니다.
```

**CAD 도구에도 동일 패턴:**
```
⚡ WHEN TO USE:
   - 새로운 공간이 필요할 때

🔗 BEFORE CALLING:
   search({ query: "room dimensions" })로 기존 결정 확인

💡 TIP: 환기와 채광을 고려하면 창문 방향이 중요해요.
```

## Consequences

### Positive
- Claude의 자율적 판단 유도
- AX 원칙 준수 ("LLM의 추론을 막지 않는다")
- 유연한 워크플로우

### Negative
- Claude가 힌트를 무시할 수 있음
- 일관성 보장이 어려움

### Mitigation Strategies
- **모니터링**: Tool 사용 패턴 추적으로 설득 효과 측정
- **상향 조정**: 반복 무시되는 권장사항은 ADR-0010의 Level 2/3로 상향
- **피드백 루프**: 무시된 힌트 분석 → Tool Description 개선
- **중요 워크플로우 보호**: 데이터 손실 위험 등은 처음부터 Level 3 (Enforcement)

## Alternatives Considered

### Option A: 명령 기반 ("반드시 X를 호출하세요")
- **선택 안 한 이유:** Claude를 수동적 실행기로 만듦

## References

- [ADR-0010: Partnership Philosophy](0010-partnership-philosophy.md)
- [ax-design-guide.md](../ax-design-guide.md)
