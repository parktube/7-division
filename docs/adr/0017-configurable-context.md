# ADR-0017: Configurable Context Injection

## Status

**Proposed**

## Date

2025-12-31

## Context

MAMA가 세션 시작 시 관련 결정을 Claude에게 주입하는 방식을 결정해야 한다. 항상 전체 컨텍스트 vs 모드별 선택.

## Decision

**3가지 모드로 설정 가능하게**

| Mode | 동작 |
|------|------|
| `none` | 주입 없음, Claude가 직접 search() 호출 |
| `hint` | "🔍 3 related decisions found" 한 줄만 |
| `full` | 관련 결정 전체 내용 주입 |

**설정:**
```typescript
interface MAMAConfig {
  contextInjection: "none" | "hint" | "full";
}
```

## Consequences

### Positive
- 사용자 선호에 따라 토큰 사용량 조절 가능
- 숙련자는 `none`, 초보자는 `full` 선택
- Claude의 자율성 수준 조절 가능

### Negative
- 설정 복잡도 증가
- 모드별 테스트 필요

## References

- [ADR-0010: Partnership Philosophy](0010-partnership-philosophy.md)
- [ADR-0015: Dynamic Hint Injection](0015-dynamic-hint-injection.md)
