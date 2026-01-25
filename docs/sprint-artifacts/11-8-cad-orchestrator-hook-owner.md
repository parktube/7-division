# Story 11.8: CADOrchestrator Hook Owner

Status: ready-for-dev

## Story

As a **개발자**,
I want **CADOrchestrator가 Hook을 관리하기를**,
So that **모든 LLM에서 동일하게 동작한다** (FR74).

## Acceptance Criteria

### AC1: Claude Code와 동일 동작
**Given** Claude Code로 CAD를 사용할 때
**When** Hook이 실행되면
**Then** 동일한 방식으로 컨텍스트가 주입된다

### AC2: LLM 독립적 동작 검증
**Given** 임의의 MCP 클라이언트(Ollama 등)로 CAD를 사용할 때
**When** Hook이 실행되면
**Then** Claude와 동일한 방식으로 컨텍스트가 주입된다
> **Note**: 실제 Ollama 통합은 Story 11.13에서 구현. 여기서는 LLM 독립성 검증에 집중.

### AC3: MCP 요청 라우팅
**Given** MCP 요청을 처리할 때
**When** `CADOrchestrator.handleMCPRequest()`가 호출되면
**Then** 요청 유형에 따라 적절한 Hook이 실행된다:
  - `initialize` → onSessionInit
  - `tools/list` → preToolList
  - `tools/call` → 실행 후 postExecute

### AC4: HookRegistry 통합
**Given** CADOrchestrator가 생성될 때
**When** MAMAModule이 초기화되면
**Then** HookRegistry가 자동으로 설정된다

### AC5: LLM 독립적 Hook 실행
**Given** 어떤 LLM이 연결되어도
**When** Hook이 실행되면
**Then** LLM 타입과 관계없이 동일한 결과가 반환된다

### AC6: 에러 격리
**Given** Hook 실행 중 에러가 발생할 때
**When** CADOrchestrator가 처리하면
**Then** 에러가 격리되고 기본 동작이 유지된다
**And** 에러 로그가 남는다

## Tasks / Subtasks

- [ ] Task 1: CADOrchestrator 클래스 구현 (AC: #3, #4)
  - [ ] 1.1 `apps/cad-mcp/src/orchestrator.ts` 생성
  - [ ] 1.2 MAMAModule 및 HookRegistry 통합
  - [ ] 1.3 handleMCPRequest 메서드 구현
  - [ ] 1.4 요청 유형별 Hook 라우팅

- [ ] Task 2: MCP 서버 리팩토링 (AC: #3)
  - [ ] 2.1 기존 핸들러를 CADOrchestrator로 위임
  - [ ] 2.2 initialize 핸들러 → onSessionInit
  - [ ] 2.3 tools/list 핸들러 → preToolList
  - [ ] 2.4 tools/call 핸들러 → 실행 + postExecute

- [ ] Task 3: LLM 독립성 검증 (AC: #1, #2, #5)
  - [ ] 3.1 Claude Code 테스트 시나리오 작성
  - [ ] 3.2 범용 MCP 클라이언트 테스트 시나리오 작성 (stub 클라이언트 또는 Ollama 모킹)
  - [ ] 3.3 동일 출력 검증 테스트

- [ ] Task 4: 에러 처리 (AC: #6)
  - [ ] 4.1 Hook 실행 try-catch 래핑
  - [ ] 4.2 에러 시 기본값 반환 로직
  - [ ] 4.3 에러 로깅

- [ ] Task 5: 테스트 작성
  - [ ] 5.1 initialize → onSessionInit 테스트
  - [ ] 5.2 tools/list → preToolList 테스트
  - [ ] 5.3 tools/call → postExecute 테스트
  - [ ] 5.4 에러 격리 테스트
  - [ ] 5.5 통합 테스트

## Dev Notes

### Architecture Compliance

- **CADOrchestrator**: Hook Owner로서 LLM과 독립적으로 Hook 관리 (ADR-0018)
- **LLM-Agnostic**: Claude, OpenAI, Ollama 등 어떤 LLM에서도 동작
- **단일 진입점**: 모든 MCP 요청이 CADOrchestrator를 통과

### Technical Requirements

**CADOrchestrator 클래스:**
```typescript
class CADOrchestrator {
  private hooks: HookRegistry;
  private mamaModule: MAMAModule;

  constructor(config: MAMAConfig) {
    this.mamaModule = new MAMAModule(config);
    this.hooks = {
      onSessionInit: () => this.mamaModule.initSession(),
      preToolList: (tools) => this.mamaModule.injectHints(tools),
      postExecute: (name, result) => this.mamaModule.generateActionHints(name, result),
    };
  }

  async handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'initialize': {
          const sessionContext = await this.hooks.onSessionInit();
          return { ...baseInitResponse, sessionContext };
        }

        case 'tools/list': {
          const tools = getBaseToolDefinitions();
          const enhanced = await this.hooks.preToolList(tools);
          return { tools: enhanced };
        }

        case 'tools/call': {
          const result = await executeToolCall(request);
          return await this.hooks.postExecute(request.params.name, result);
        }

        default:
          return handleOtherRequests(request);
      }
    } catch (error) {
      logger.error('Hook execution error:', error);
      return handleWithoutHooks(request);  // 기본 동작 유지
    }
  }
}
```

**MCP 서버 통합:**
```typescript
// apps/cad-mcp/src/server.ts
const orchestrator = new CADOrchestrator(config);

server.setRequestHandler(InitializeRequestSchema, async (request) => {
  return orchestrator.handleMCPRequest({ method: 'initialize', params: request });
});

server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  return orchestrator.handleMCPRequest({ method: 'tools/list', params: request });
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return orchestrator.handleMCPRequest({ method: 'tools/call', params: request });
});
```

### Project Structure Notes

**파일 구조:**
```
apps/cad-mcp/src/
├── orchestrator.ts            # CADOrchestrator (신규)
├── server.ts                  # MCP 서버 (수정 - 위임)
└── mama/
    ├── index.ts               # MAMAModule (수정)
    └── hooks/
        ├── registry.ts        # HookRegistry (수정)
        ├── session-init.ts
        ├── pre-tool-list.ts
        └── post-execute.ts
```

### References

- [Source: docs/architecture.md#4.2-architecture-overview] - CADOrchestrator
- [Source: docs/architecture.md#4.4.3-hook-registry-implementation] - Hook 통합
- [Source: docs/adr/0018-llm-agnostic-hooks.md] - LLM-Agnostic 결정
- [Source: docs/epics.md#story-11.2.4] - Story 상세

### Dependencies

- **선행**: Story 11.5 (SessionStart Hook) - onSessionInit
- **선행**: Story 11.6 (Dynamic Hint) - preToolList
- **선행**: Story 11.7 (ActionHints) - postExecute
- **후속**: Phase 11.3 (Intelligence) - 고급 기능

### Scope Clarification

**이 스토리에서 하는 것:**
- CADOrchestrator 클래스 구현
- 모든 Hook 통합
- MCP 서버 리팩토링
- 에러 격리

**이 스토리에서 하지 않는 것:**
- LLMAdapter 인터페이스 (Story 11.13)
- 실제 Ollama 통합 (Story 11.13)

### File List

- `apps/cad-mcp/src/orchestrator.ts` (신규)
- `apps/cad-mcp/src/server.ts` (수정)
- `apps/cad-mcp/src/mama/index.ts` (수정)
- `apps/cad-mcp/src/mama/hooks/registry.ts` (수정)
- `apps/cad-mcp/src/mama/__tests__/orchestrator.test.ts` (신규)
