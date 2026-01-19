# Story 10.9: discovery.ts 레거시 정리

Status: done

## Story

As a **개발자**,
I want **discovery.ts를 삭제하고 관련 레거시 코드를 정리하기를**,
so that **중복 코드 없이 깔끔한 코드베이스를 유지한다**.

## Background

Epic 10에서 MCP 도구를 Claude Code 패턴으로 재설계하면서:
- `discovery` MCP 도구 → `lsp` 도구로 대체됨 (Story 10-5)
- 그러나 `discovery.ts` 파일 자체는 삭제되지 않음 (Story 10-7 미완료)
- `discovery.ts`는 내부 유틸리티로 runtime.ts, tool-registry.ts에서 사용 중

## Acceptance Criteria

1. **AC1: discovery.ts 삭제**
   - Given: discovery.ts 파일이 존재할 때
   - When: 파일을 삭제하면
   - Then: 코드베이스에서 제거됨

2. **AC2: EXECUTOR_TOOLS 이동**
   - Given: discovery.ts의 EXECUTOR_TOOLS 상수
   - When: 필요한 곳으로 이동하면
   - Then: tool-registry.ts에서 직접 정의

3. **AC3: index.ts export 정리**
   - Given: index.ts에서 discovery 함수들 export
   - When: 불필요한 export 제거하면
   - Then: 레거시 API 제거됨

4. **AC4: 테스트 통과**
   - Given: 변경사항 적용 후
   - When: 전체 테스트 실행하면
   - Then: 모든 테스트 통과

## Tasks / Subtasks

- [x] **Task 1: discovery.ts 내용 분석**
  - [x] 1.1 사용처 확인 (runtime.ts, tool-registry.ts, index.ts)
  - [x] 1.2 EXECUTOR_TOOLS 이동 계획 수립

- [x] **Task 2: tool-registry.ts 수정**
  - [x] 2.1 EXECUTOR_TOOLS 상수를 tool-registry.ts로 이동
  - [x] 2.2 getToolsForDomains, getAllExecutorTools 함수 이동
  - [x] 2.3 discovery.ts import 제거

- [x] **Task 3: runtime.ts 수정**
  - [x] 3.1 getToolsForDomains import를 tool-registry.ts로 변경

- [x] **Task 4: index.ts 수정**
  - [x] 4.1 discovery.ts export 제거
  - [x] 4.2 필요한 함수만 tool-registry.ts에서 re-export (optional)

- [x] **Task 5: discovery.ts 삭제**
  - [x] 5.1 파일 삭제
  - [x] 5.2 관련 테스트 정리

- [x] **Task 6: 테스트 실행**
  - [x] 6.1 전체 테스트 통과 확인

## Dev Notes

### 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `discovery.ts` | 삭제 |
| `tool-registry.ts` | EXECUTOR_TOOLS 상수 추가 |
| `runtime.ts` | import 경로 변경 |
| `index.ts` | export 정리 |
| `tests/discovery.test.ts` | 삭제 또는 수정 |

### 유지되는 기능

- `runtime.ts`: runAgentLoop (직접 LLM 호출용)
- `tool-registry.ts`: executor 도구 관리
- `cad-agent.ts`, `run-agent.ts`: 독립 CLI 도구

### MCP vs Direct LLM

```
MCP 경로 (Epic 10 주요 경로):
  Claude Code → MCP Server → glob/read/edit/write/lsp/bash

Direct LLM 경로 (레거시, 유지):
  cad-agent.ts → runtime.ts → tool-registry.ts → executor
```

## Dev Agent Record

### Agent Model Used

claude-opus-4-5-20251101

### File List

- `apps/cad-mcp/src/discovery.ts` (삭제)
- `apps/cad-mcp/src/tool-registry.ts` (수정)
- `apps/cad-mcp/src/runtime.ts` (수정)
- `apps/cad-mcp/src/index.ts` (수정)
- `apps/cad-mcp/tests/discovery.test.ts` (삭제)
