# ADR-0013: Edge Types via Reasoning Field

## Status

**Proposed**

## Date

2025-12-31

## Context

Decision 간의 관계(edge)를 어떻게 표현할지 결정해야 한다. 별도 API vs reasoning 필드 패턴.

## Decision

**별도 API가 아닌 reasoning 필드에 패턴으로**

| Edge | 자동? | 패턴 |
|------|-------|------|
| `supersedes` | ✅ (같은 topic) | (자동) |
| `builds_on` | ❌ | `builds_on: decision_xxx` |
| `debates` | ❌ | `debates: decision_xxx` |
| `synthesizes` | ❌ | `synthesizes: [id1, id2]` |

> **참고**: `decision_xxx`는 플레이스홀더입니다. 실제 사용 시 `decision_abc123` 또는 `decision_topic_abc123` 형식의 실제 ID를 사용합니다.

**예시:**
```typescript
save({
  type: "decision",
  topic: "cad:wall:thickness",
  decision: "외벽 200mm, 내벽 150mm 표준화",
  reasoning: `builds_on: decision_cad_wall_123_abc.
    이전 결정에서 150mm 단일 표준을 정했지만,
    외벽과 내벽 구분이 필요함을 발견.`,
});
```

## Consequences

### Positive
- 추가 API 없이 관계 표현
- 자연어 reasoning에 맥락 포함
- Claude가 자연스럽게 패턴 학습

### Negative
- 패턴 파싱 필요
- 잘못된 형식 가능성

## References

- [ADR-0019: Graph Health Metrics](0019-graph-health-metrics.md)
