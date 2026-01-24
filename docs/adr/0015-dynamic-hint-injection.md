# ADR-0015: 동적 힌트 주입 시스템

## Status

**Proposed**

## Date

2025-12-31

## Context

Claude가 언제 힌트를 받아야 하는지 결정해야 한다. 문제: Claude가 "이 힌트가 필요해"라고 알면 이미 알고 있는 것. 모르면 get_hints 호출도 안 함.

## Decision

**Tool Definition 자체에 힌트 자동 주입**

**3가지 힌트 주입 시점:**

| 시점 | 힌트 내용 | 예시 |
|------|----------|------|
| **도구 정의 시** | description에 동적 주입 | "💡 외벽 두께 표준: 200mm" |
| **도구 실행 후** | next_steps로 반환 | "💡 다음: add_door" |
| **힌트 부적절 시** | edit_hint 도구로 수정 | 사용자와 협의 후 수정 |

**흐름:**
```
도구 목록 요청 (tools/list)
    │
    ▼
시스템이 각 도구별로:
  1. DB에서 해당 도구의 hints 조회
  2. 기본 description + 동적 힌트 조합
  3. Claude에게 전달
```

**edit_hint 도구:**
유일한 힌트 관리 도구. 코드 수정 없이 힌트를 동적으로 개선.

## Consequences

### Positive
- Claude가 모르는 상태에서도 힌트 수신
- 사용자와 협의하여 힌트 개선 가능 (공동 학습)
- 코드 수정 없이 시스템 "성격" 조율

### Negative
- 도구 목록 생성 시 DB 조회 필요
- 힌트가 너무 많으면 혼란

## References

- [ADR-0012: Persuader Pattern](0012-persuader-pattern.md)
- [ADR-0014: Progressive Workflow](0014-progressive-workflow.md)
