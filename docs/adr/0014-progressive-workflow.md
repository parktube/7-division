# ADR-0014: Progressive Workflow (next_steps)

## Status

**Proposed**

## Date

2025-12-31

## Context

CAD 도구 실행 후 다음 단계를 어떻게 제안할지 결정해야 한다.

## Decision

**CAD 도구 결과에 next_steps 포함**

```typescript
interface CADToolResult {
  success: boolean;
  data: any;
  next_steps?: {
    action: string;        // "add_door"
    description: string;   // "문 배치하기"
    relevance: string;     // "방이 생성되었으니 출입구 필요"
    optional: boolean;
  }[];
}
```

**MAMA와의 통합:**
```
CAD 도구 실행 후 → next_steps 반환
          ↓
Claude가 판단 → 중요한 패턴 발견 시
          ↓
save() 호출 → MAMA에 결정 저장
```

## Consequences

### Positive
- 멘토 역할 수행 (다음 단계 제안)
- 초보자 가이드, 숙련자는 무시 가능
- 적응형 멘토링 기반

### Negative
- 도구 응답 복잡도 증가
- next_steps 품질 유지 필요

## References

- [ADR-0020: Adaptive Mentoring](0020-adaptive-mentoring.md)
