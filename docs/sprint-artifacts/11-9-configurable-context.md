# Story 11.9: Configurable Context

Status: Done

## Story

As a **사용자**,
I want **컨텍스트 주입 수준을 설정할 수 있기를**,
So that **토큰 사용량을 조절할 수 있다** (FR75).

## Acceptance Criteria

### AC1: none 모드 설정
**Given** config.json에 `contextInjection: 'none'`이 설정되었을 때
**When** 세션이 시작되면
**Then** 자동 주입이 비활성화된다
**And** Claude가 직접 mama_search/mama_checkpoint를 호출해야 한다

### AC2: hint 모드 설정
**Given** config.json에 `contextInjection: 'hint'`가 설정되었을 때
**When** 세션이 시작되면
**Then** 한 줄 힌트만 주입된다 ("🔍 3 related decisions found")

### AC3: full 모드 설정
**Given** config.json에 `contextInjection: 'full'`이 설정되었을 때
**When** 세션이 시작되면
**Then** 전체 결정 내용이 주입된다

### AC4: 런타임 모드 변경
**Given** 세션이 진행 중일 때
**When** `set_context_mode` 도구로 모드를 변경하면
**Then** 다음 요청부터 새 모드가 적용된다

### AC5: 모드별 토큰 절약
**Given** none 모드와 full 모드를 비교할 때
**When** 동일한 컨텍스트를 처리하면
**Then** none 모드가 full 모드 대비 50% 이상 적은 토큰을 사용한다
> **측정 기준**: 동일한 5개 결정 + 1개 체크포인트 시나리오에서 주입되는 토큰 수 비교

## Tasks / Subtasks

- [x] Task 1: 설정 UI 안내 (AC: #1-3)
  - [x] 1.1 config.json 예시 문서화 (mama_configure 도구로 대체)
  - [x] 1.2 각 모드의 효과 설명 추가

- [x] Task 2: set_context_mode 도구 구현 (AC: #4)
  - [x] 2.1 mama_configure 도구에 통합 (별도 파일 대신)
  - [x] 2.2 런타임 설정 변경 로직
  - [x] 2.3 변경 확인 응답 반환

- [x] Task 3: 모드별 출력 최적화 (AC: #5)
  - [x] 3.1 none 모드: 빈 문자열
  - [x] 3.2 hint 모드: 한 줄 요약
  - [x] 3.3 full 모드: 상세 내용

- [x] Task 4: 테스트 작성
  - [x] 4.1 각 모드 설정 테스트
  - [x] 4.2 런타임 변경 테스트
  - [x] 4.3 토큰 사용량 비교 (session-init 테스트에서 검증)

## Dev Notes

### Technical Requirements

**설정 파일 (`~/.ai-native-cad/config.json`):**
```json
{
  "contextInjection": "hint",
  "maxDecisions": 5,
  "maxCheckpointAge": 7
}
```

> - `contextInjection`: `"none"` | `"hint"` | `"full"`
> - `maxDecisions`: full 모드 시 최대 결정 수
> - `maxCheckpointAge`: 체크포인트 최대 일수

**set_context_mode 도구:**
```typescript
interface SetContextModeInput {
  mode: 'none' | 'hint' | 'full';
}
```

### References

- [Source: docs/adr/0017-configurable-context.md]
- [Source: docs/epics.md#story-11.3.1]

### Dependencies

- **선행**: Story 11.5 (SessionStart Hook) - 컨텍스트 주입 기반

### Completion Notes List

- Implementation completed: 2026-01-21
- set_context_mode를 별도 도구 대신 mama_configure에 통합

### File List (Actual Implementation)

- `apps/cad-mcp/src/mama/config.ts` - MAMAConfig 타입 + 기본값 (contextInjection: none/hint/full)
- `apps/cad-mcp/src/mama/tools/handlers.ts` - handleMamaConfigure (contextInjection 설정 변경)
- `apps/cad-mcp/src/mama/tools/schema.ts` - mama_configure 스키마
- `apps/cad-mcp/src/mama/hooks/session-init.ts` - 모드별 출력 (executeSessionInit)
- `apps/cad-mcp/tests/mama.test.ts` - session init 모드별 테스트
