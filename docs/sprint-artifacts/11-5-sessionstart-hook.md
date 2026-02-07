# Story 11.5: SessionStart Hook (onSessionInit)

Status: ready-for-dev

## Story

As a **LLM 에이전트**,
I want **세션 시작 시 자동으로 컨텍스트가 로드되기를**,
So that **이전 작업을 이어서 할 수 있다** (FR71).

## Acceptance Criteria

### AC1: 세션 시작 시 Hook 실행
**Given** MCP 연결이 시작될 때
**When** `onSessionInit` Hook이 실행되면
**Then** 마지막 체크포인트가 자동 로드된다
**And** 최근 결정 5개가 요약되어 제공된다 (created_at DESC 정렬, 결과 없으면 빈 배열)

### AC2: Full 모드 컨텍스트 주입
**Given** `contextInjection` 설정이 `full`일 때
**When** 컨텍스트가 주입되면
**Then** 결정 전체 내용 + reasoning이 포함된다
**And** 체크포인트의 summary, next_steps, open_files가 모두 포함된다

### AC3: Hint 모드 컨텍스트 주입
**Given** `contextInjection` 설정이 `hint`일 때
**When** 컨텍스트가 주입되면
**Then** "🔍 3 related decisions found" 형태의 한 줄 힌트만 제공된다
**And** 상세 내용은 Claude가 `mama_search`로 직접 조회해야 한다

### AC4: None 모드
**Given** `contextInjection` 설정이 `none`일 때
**When** 세션이 시작되면
**Then** 자동 주입 없이 빈 컨텍스트가 반환된다
**And** Claude가 필요시 직접 `mama_search/mama_checkpoint`를 호출해야 한다

### AC5: 설정 파일 로드
**Given** `~/.ai-native-cad/config.json`이 존재할 때
**When** MCP 서버가 시작되면
**Then** `contextInjection` 설정이 로드된다
**And** 설정 파일이 없으면 기본값 `hint`가 사용된다

### AC6: MCP 초기화 메시지에 컨텍스트 포함
**Given** MCP 연결이 완료될 때
**When** `initialize` 응답을 보낼 때
**Then** `sessionContext` 필드에 Hook 결과가 포함된다

### AC7: 빈 데이터 처리
**Given** 체크포인트나 결정이 없을 때
**When** `onSessionInit` Hook이 실행되면
**Then** checkpoint=null, decisions=[]로 정상 응답한다
**And** 에러 없이 세션이 시작된다

## Tasks / Subtasks

- [ ] Task 1: 설정 파일 관리 (AC: #5)
  - [ ] 1.1 `apps/cad-mcp/src/mama/config.ts` 확장
  - [ ] 1.2 `~/.ai-native-cad/config.json` 로드 로직
  - [ ] 1.3 `contextInjection` 타입 정의 (`none` | `hint` | `full`)
  - [ ] 1.4 기본값 설정 (`hint`)

- [ ] Task 2: HookRegistry 구현 (AC: #1)
  - [ ] 2.1 `apps/cad-mcp/src/mama/hooks/registry.ts` 생성
  - [ ] 2.2 HookRegistry 인터페이스 정의
  - [ ] 2.3 `onSessionInit` Hook 등록 구조

- [ ] Task 3: onSessionInit Hook 구현 (AC: #1-4)
  - [ ] 3.1 `apps/cad-mcp/src/mama/hooks/session-init.ts` 생성
  - [ ] 3.2 마지막 체크포인트 로드 (`mama_checkpoint` 호출)
  - [ ] 3.3 최근 결정 5개 검색 (`mama_search` 호출)
  - [ ] 3.4 `full` 모드 출력 포맷팅
  - [ ] 3.5 `hint` 모드 출력 포맷팅
  - [ ] 3.6 `none` 모드 빈 응답

- [ ] Task 4: MCP 서버 통합 (AC: #6)
  - [ ] 4.1 `apps/cad-mcp/src/server.ts` 수정
  - [ ] 4.2 MCP `initialize` 핸들러에서 Hook 호출
  - [ ] 4.3 `sessionContext` 필드 응답에 추가

- [ ] Task 5: 테스트 작성
  - [ ] 5.1 설정 파일 로드 테스트 (존재/미존재)
  - [ ] 5.2 full 모드 출력 테스트
  - [ ] 5.3 hint 모드 출력 테스트
  - [ ] 5.4 none 모드 출력 테스트
  - [ ] 5.5 체크포인트 없을 때 테스트
  - [ ] 5.6 MCP initialize 응답 테스트

## Dev Notes

### Architecture Compliance

- **Hook System**: CADOrchestrator 내부 메커니즘 (ADR-0018)
- **Configurable Context**: none/hint/full 모드 (ADR-0017)
- **세션 연속성**: 이전 작업 컨텍스트 자동 로드

### Technical Requirements

**설정 파일 (`~/.ai-native-cad/config.json`, ADR-0017):**
```json
{
  "contextInjection": "hint"
}
```

> `contextInjection`: `"none"` | `"hint"` | `"full"`

**HookRegistry 인터페이스:**
```typescript
interface HookRegistry {
  onSessionInit: () => Promise<SessionInitResult>;
  // preToolList, postExecute는 다음 스토리에서 추가
}

interface SessionInitResult {
  checkpoint: {
    summary: string;
    next_steps: string[];
    open_files: string[];
    created_at: string;
  } | null;  // 체크포인트가 없으면 null
  recentDecisions: Decision[];
  contextMode: 'none' | 'hint' | 'full';
  formattedContext: string;  // LLM에게 전달할 최종 문자열
}
```

**출력 포맷:**

**Full 모드:**
```
📍 **Last Checkpoint** (2h ago):
   Summary: Epic 11 MAMA Integration 작업 중...
   Next: 1. mama_save 도구 구현 2. 테스트 작성
   Files: apps/cad-mcp/src/mama/tools/save.ts

🧠 **Recent Decisions** (5):
   1. ⏳ cad:mama_db_architecture: 단일 DB + topic prefix 채택...
   2. ✅ cad:tool_pattern: Claude Code 패턴 정렬...
   ...
```

**Hint 모드:**
```
🔍 1 checkpoint found, 5 related decisions available
💡 Use mama_checkpoint() and mama_search() for details
```

**None 모드:**
```
(빈 문자열)
```

**MCP Initialize 응답:**
```typescript
interface InitializeResult {
  protocolVersion: string;
  capabilities: {...};
  serverInfo: {...};
  // 추가
  sessionContext?: string;  // formattedContext
}
```

### Project Structure Notes

**파일 구조:**
```
apps/cad-mcp/src/mama/
├── config.ts              # contextInjection 설정 (수정)
├── hooks/
│   ├── registry.ts        # HookRegistry 클래스 (신규)
│   └── session-init.ts    # onSessionInit 구현 (신규)
└── index.ts               # MAMAModule에 hooks 통합 (수정)

apps/cad-mcp/src/
└── server.ts              # MCP initialize 핸들러 (수정)
```

### Testing Standards

- 모드별 출력 포맷 스냅샷 테스트
- 설정 파일 유무에 따른 기본값 테스트
- 체크포인트/결정 없을 때 graceful 처리

### References

- [Source: docs/architecture.md#4.4-hook-system-architecture] - Hook Flow
- [Source: docs/architecture.md#4.4.2-hook-implementation-details] - onSessionInit 상세
- [Source: docs/adr/0017-configurable-context.md] - 3가지 모드
- [Source: docs/adr/0018-llm-agnostic-hooks.md] - Hook Owner
- [Source: docs/epics.md#story-11.2.1] - Story 상세

### Dependencies

- **선행**: Story 11.1 (MAMA Core 4 Tools) - mama_search, mama_checkpoint
- **후속**: Story 11.6 (Dynamic Hint Injection) - preToolList Hook

### Scope Clarification

**이 스토리에서 하는 것:**
- HookRegistry 기본 구조
- onSessionInit Hook 구현
- 3가지 contextInjection 모드
- 설정 파일 로드
- MCP initialize 응답에 컨텍스트 포함

**이 스토리에서 하지 않는 것:**
- preToolList Hook (Story 11.6)
- postExecute Hook (Story 11.7)
- CADOrchestrator 전체 구현 (Story 11.8)

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

- Story created: 2026-01-20
- Phase 11.2 Hook System 첫 번째 스토리

### File List

- `apps/cad-mcp/src/mama/config.ts` (수정)
- `apps/cad-mcp/src/mama/hooks/registry.ts` (신규)
- `apps/cad-mcp/src/mama/hooks/session-init.ts` (신규)
- `apps/cad-mcp/src/mama/index.ts` (수정)
- `apps/cad-mcp/src/server.ts` (수정)
- `apps/cad-mcp/src/mama/__tests__/session-init.test.ts` (신규)
