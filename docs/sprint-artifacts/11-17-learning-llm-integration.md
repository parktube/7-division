# Story 11.17: Learning LLM Integration

## Overview

**Epic**: 11 - MAMA Integration
**Status**: Done
**Priority**: High

Learning Track 기능(11.13-11.16)이 존재하지만, LLM이 적극적으로 활용할 수 있는 연결고리가 누락되어 있음.
이 스토리는 Learning 기능과 LLM 간의 인터랙션을 완성함.

## Problem Statement

현재 Learning 기능의 한계:

| 기능 | MCP 도구 | 자동 트리거 | LLM 가이드 |
|------|---------|------------|-----------|
| `saveLearning` | ✅ mama_save type='learning' | ❌ 없음 | ❌ 없음 |
| `markUnderstood` | ❌ 미노출 | ❌ 없음 | ❌ 없음 |
| `recordApplication` | ❌ 미노출 | ❌ 없음 | ❌ 없음 |

**핵심 문제**: LLM이 언제 Learning을 저장/업데이트해야 하는지 모름

## Functional Requirements

### FR85: Learning 도구 타입 확장

`mama_save` 도구의 `type` 파라미터 확장:

```typescript
type: 'decision' | 'checkpoint' | 'learning' | 'understood' | 'applied'
```

| Type | 용도 | 트리거 조건 |
|------|------|------------|
| `learning` | 새 개념 소개 | AI가 사용자에게 새 개념을 설명할 때 |
| `understood` | 이해 표현 | 사용자가 "아 이해됐어", "알겠어" 등 표현 시 |
| `applied` | 개념 적용 | 사용자가 배운 개념을 언급하며 사용할 때 |

### FR86: LLM 가이드 컨텍스트 주입

**1. SessionStart 가이드 (full mode)**

```
📚 **학습 현황** (5개 개념):
   • 60-30-10 rule: 숙달 (14번 적용)
   • Japandi: 적용함 (3번 적용)

💡 **Learning 활용 가이드**:
   • 새 개념 설명 후 → mama_save(type='learning', concept='개념명')
   • 사용자 "이해됐어" → mama_save(type='understood', concept='개념명')
   • 사용자가 개념 적용 시 → mama_save(type='applied', concept='개념명')
```

**2. Tool Description 업데이트**

```
mama_save:
  type='learning': AI가 사용자에게 새 개념을 설명할 때 호출
  type='understood': 사용자가 이해를 표현할 때 호출 (예: "아 이해됐어")
  type='applied': 사용자가 배운 개념을 실제로 사용할 때 호출
```

### FR87: 학습 개념 자동 감지 (선택적)

SessionStart에 주입된 학습 개념을 사용자가 언급하면 감지:

```
학습 현황: ["60-30-10 rule", "Japandi", "focal point"]

사용자: "focal point를 거실 벽난로로 잡고 싶어"
        ↓
시스템: "사용자가 'focal point' 개념을 적용하고 있습니다."
        → LLM에게 recordApplication 권장
```

## Acceptance Criteria

### AC1: type='understood' 지원
- [x] mama_save(type='understood', concept='X') 호출 시 해당 개념의 level이 2로 업데이트됨
- [x] 존재하지 않는 개념은 에러 반환

### AC2: type='applied' 지원
- [x] mama_save(type='applied', concept='X') 호출 시 applied_count 증가
- [x] 3회 이상 적용 시 level=4(숙달)로 자동 업그레이드
- [x] 존재하지 않는 개념은 에러 반환

### AC3: SessionStart Learning 가이드
- [x] full mode에서 학습 현황과 함께 활용 가이드 표시
- [x] 가이드에 트리거 조건 명시

### AC4: Tool Description 업데이트
- [x] mama_save 도구 설명에 learning/understood/applied 트리거 조건 명시
- [x] 예시 포함

### AC5: (선택) 자동 감지 힌트
- [x] 사용자가 학습된 개념을 언급하면 시스템이 감지
- [x] LLM에게 applied 기록 권장 힌트 제공

## Technical Design

### 1. handlers.ts 수정

```typescript
// mama_save handler 확장
case 'understood':
  if (!args.concept) throw new Error('concept is required for type=understood')
  markUnderstood(args.concept, args.user_explanation)
  return { success: true, message: `Concept '${args.concept}' marked as understood` }

case 'applied':
  if (!args.concept) throw new Error('concept is required for type=applied')
  const newCount = recordApplication(args.concept)
  return { success: true, message: `Concept '${args.concept}' applied (count: ${newCount})` }
```

### 2. session-init.ts 수정

```typescript
function formatFullContext(...) {
  // ... existing code ...

  // Learning guide section
  if (learningHints.length > 0) {
    lines.push('')
    lines.push('💡 **Learning 활용 가이드**:')
    lines.push('   • 새 개념 설명 후 → mama_save(type="learning", concept="개념명")')
    lines.push('   • 사용자 "이해됐어" → mama_save(type="understood", concept="개념명")')
    lines.push('   • 사용자가 개념 적용 시 → mama_save(type="applied", concept="개념명")')
  }
}
```

### 3. schema.ts 수정

```typescript
MAMA_TOOLS.mama_save.description = `
🤝 Save a decision, checkpoint, or learning to MAMA's reasoning graph.

**type='learning'**: AI가 사용자에게 새 개념을 설명할 때 호출
**type='understood'**: 사용자가 이해를 표현할 때 호출 (예: "아 이해됐어", "알겠어")
**type='applied'**: 사용자가 배운 개념을 실제로 사용할 때 호출

⚡ TRIGGERS:
• 새 개념 설명 → type='learning'
• 사용자 "이해됐어" → type='understood'
• 사용자가 개념 적용 → type='applied'
• 아키텍처 결정 → type='decision'
• 세션 종료 → type='checkpoint'
`
```

## Dependencies

- Story 11.13: Learning Progress Storage (완료)
- Story 11.14: User Growth Metrics (완료)

## Estimation

- 구현: 1-2시간
- 테스트: 30분

## Files to Modify

1. `apps/cad-mcp/src/mama/tools/handlers.ts` - type='understood', 'applied' 처리
2. `apps/cad-mcp/src/mama/tools/schema.ts` - 도구 설명 업데이트
3. `apps/cad-mcp/src/mama/hooks/session-init.ts` - Learning 가이드 추가

## Test Plan

1. `mama_save(type='understood', concept='X')` 호출 → level 확인
2. `mama_save(type='applied', concept='X')` 3회 호출 → level=4 확인
3. 새 세션 시작 → Learning 가이드 표시 확인
4. 도구 설명에 트리거 조건 포함 확인

## Completion Notes

- Implementation completed: 2026-01-21
- All ACs verified against actual implementation

### File List (Actual Implementation)

- `apps/cad-mcp/src/mama/tools/handlers.ts` (수정 - type='understood', 'applied' 처리, lines 188-252)
- `apps/cad-mcp/src/mama/tools/schema.ts` (수정 - 도구 설명에 트리거 조건 추가, lines 41-42)
- `apps/cad-mcp/src/mama/hooks/session-init.ts` (수정 - Learning 가이드 섹션 추가, lines 200-207)
- `apps/cad-mcp/src/mama/learning-tracker.ts` (기존 - markUnderstood, recordApplication 함수)
- `apps/cad-mcp/src/mama/growth-tracker.ts` (기존 - concept_applied 메트릭 추적)
