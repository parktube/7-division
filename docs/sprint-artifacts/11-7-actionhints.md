# Story 11.7: ActionHints (postExecute)

Status: ready-for-dev

## Story

As a **LLM 에이전트**,
I want **도구 실행 후 다음 작업 제안을 받기를**,
So that **워크플로우가 자연스럽게 진행된다** (FR73).

## Acceptance Criteria

### AC1: 도구 실행 후 ActionHints 반환
**Given** `edit`/`write` 도구 실행이 완료될 때
**When** `postExecute` Hook이 실행되면
**Then** actionHints가 결과에 포함된다:
  - `nextSteps`: 다음 작업 제안
  - `moduleHints`: 관련 모듈 추천
  - `saveSuggestion`: 결정 저장 제안

### AC2: 컨텍스트 기반 nextSteps
**Given** 방(room)을 생성한 후
**When** 결과가 반환되면
**Then** nextSteps에 "add_door: 문 배치하기 (방이 생성되었으니 출입구 필요)" 포함

### AC3: saveSuggestion 제안
**Given** 중요한 패턴이 발견되었을 때
**When** 결과가 반환되면
**Then** saveSuggestion에 저장 제안이 포함된다

### AC4: moduleHints 추천
**Given** 특정 도메인 작업 중일 때
**When** 관련 모듈이 존재하면
**Then** moduleHints에 추천 모듈이 포함된다

### AC5: optional 플래그
**Given** nextSteps가 반환될 때
**When** 필수가 아닌 제안이면
**Then** `optional: true` 플래그가 포함된다

### AC6: 빈 ActionHints 처리
**Given** 제안할 내용이 없을 때
**When** 결과가 반환되면
**Then** actionHints 필드가 생략되거나 빈 객체로 반환된다

## Tasks / Subtasks

- [ ] Task 1: CADToolResult 인터페이스 정의 (AC: #1)
  - [ ] 1.1 `packages/shared/src/schemas/tool-result.ts` 생성
  - [ ] 1.2 CADToolResult, ActionHints 타입 정의
  - [ ] 1.3 NextStep, ModuleHint, SaveSuggestion 타입 정의

- [ ] Task 2: postExecute Hook 구현 (AC: #1-6)
  - [ ] 2.1 `apps/cad-mcp/src/mama/hooks/post-execute.ts` 생성
  - [ ] 2.2 도구 실행 결과 분석 로직
  - [ ] 2.3 nextSteps 생성 로직
  - [ ] 2.4 moduleHints 생성 로직 (MAMA 검색 기반)
  - [ ] 2.5 saveSuggestion 생성 로직
  - [ ] 2.6 HookRegistry에 postExecute 등록

- [ ] Task 3: 컨텍스트 분석기 구현 (AC: #2)
  - [ ] 3.1 `apps/cad-mcp/src/mama/context-analyzer.ts` 생성
  - [ ] 3.2 코드 실행 결과에서 엔티티 타입 추출
  - [ ] 3.3 도메인별 다음 작업 규칙 정의
  - [ ] 3.4 room → door/window 등 패턴 매핑

- [ ] Task 4: 도구 실행 래퍼 수정 (AC: #1)
  - [ ] 4.1 도구 실행 후 postExecute Hook 호출
  - [ ] 4.2 결과에 actionHints 병합
  - [ ] 4.3 빈 actionHints 처리

- [ ] Task 5: 테스트 작성
  - [ ] 5.1 nextSteps 생성 테스트
  - [ ] 5.2 moduleHints 추천 테스트
  - [ ] 5.3 saveSuggestion 테스트
  - [ ] 5.4 optional 플래그 테스트
  - [ ] 5.5 빈 ActionHints 테스트

## Dev Notes

### Architecture Compliance

- **ActionHints**: 도구 실행 후 다음 작업 제안 (ADR-0014)
- **postExecute Hook**: 모든 도구 실행 완료 후 자동 실행
- **멘토 역할**: 초보자 가이드, 숙련자는 무시 가능

### Technical Requirements

**CADToolResult 인터페이스 (ADR-0014):**
```typescript
interface CADToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  actionHints?: {
    nextSteps?: NextStep[];      // camelCase로 통일
    moduleHints?: string[];
    saveSuggestion?: SaveSuggestion;
  };
}

interface NextStep {
  action: string;        // "add_door"
  description: string;   // "문 배치하기"
  relevance: string;     // "방이 생성되었으니 출입구 필요"
  optional: boolean;
}

interface SaveSuggestion {
  topic: string;         // "voxel:room:layout"
  reason: string;        // "새로운 방 레이아웃 패턴 발견"
}
```

**postExecute Hook:**
```typescript
async function postExecute(
  toolName: string,
  result: unknown,
  context: ExecutionContext
): Promise<CADToolResult> {
  const actionHints = await generateActionHints(toolName, result, context);

  return {
    success: true,
    data: result,
    actionHints: Object.keys(actionHints).length > 0 ? actionHints : undefined
  };
}
```

**도메인별 nextSteps 규칙 예시:**
```typescript
const NEXT_STEP_RULES = {
  'room': [
    { action: 'add_door', description: '문 배치하기', relevance: '출입구 필요', optional: false },
    { action: 'add_window', description: '창문 배치하기', relevance: '채광 필요', optional: true },
  ],
  'wall': [
    { action: 'extend_wall', description: '벽 연장하기', relevance: '방 형성', optional: false },
  ],
  'group': [
    { action: 'set_pivot', description: '피봇 설정하기', relevance: '회전 중심', optional: true },
  ],
};
```

### Project Structure Notes

**파일 구조:**
```
apps/cad-mcp/src/mama/
├── hooks/
│   ├── registry.ts            # postExecute 등록 (수정)
│   └── post-execute.ts        # postExecute Hook (신규)
├── context-analyzer.ts        # 컨텍스트 분석 (신규)
└── rules/
    └── next-steps.ts          # 도메인별 규칙 (신규)

packages/shared/src/schemas/
└── tool-result.ts             # CADToolResult 타입 (신규)
```

### References

- [Source: docs/architecture.md#4.4.2] - postExecute Hook
- [Source: docs/adr/0014-progressive-workflow.md] - ActionHints 결정
- [Source: docs/epics.md#story-11.2.3] - Story 상세

### Dependencies

- **선행**: Story 11.5 (SessionStart Hook) - HookRegistry
- **선행**: Story 11.6 (Dynamic Hint) - preToolList 패턴
- **후속**: Story 11.8 (CADOrchestrator) - Hook 통합

### File List

- `packages/shared/src/schemas/tool-result.ts` (신규)
- `apps/cad-mcp/src/mama/hooks/post-execute.ts` (신규)
- `apps/cad-mcp/src/mama/hooks/registry.ts` (수정)
- `apps/cad-mcp/src/mama/context-analyzer.ts` (신규)
- `apps/cad-mcp/src/mama/rules/next-steps.ts` (신규)
