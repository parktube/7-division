# Story 11.13: LLM Adapter Pattern

Status: ready-for-dev

## Story

As a **개발자**,
I want **LLMAdapter 인터페이스로 LLM을 교체할 수 있기를**,
So that **Claude 외 LLM도 사용할 수 있다** (FR79).

## Acceptance Criteria

### AC1: LLMAdapter 인터페이스 정의
**Given** LLMAdapter 인터페이스가 정의되었을 때
**When** 구현체를 만들면
**Then** chat, supportsStreaming, supportsToolCalling 메서드가 필수이다

### AC2: ClaudeAdapter 구현
**Given** ClaudeAdapter를 구현했을 때
**When** Claude API로 연결하면
**Then** chat, supportsToolCalling이 정상 동작한다
**And** `supportsStreaming(): true`를 반환한다
**And** 응답에 `adapter: 'claude'` 식별자가 포함된다

> **최소 성공 시나리오**: `glob()` 호출 → 파일 목록 반환 + tool calling 1회 성공 확인

### AC3: OllamaAdapter 구현
**Given** OllamaAdapter를 구현했을 때
**When** 로컬 Ollama 서버에 연결하면
**Then** 기본 CAD 명령(`glob`, `read`, `write`)이 수행된다
**And** 응답에 `adapter: 'ollama'` 식별자가 포함된다
**And** `supportsStreaming(): true`를 반환한다

> **최소 성공 시나리오**: `glob()` 호출 → 파일 목록 반환 확인

### AC4: OpenAIAdapter 구현 (선택)
**Given** OpenAIAdapter를 구현했을 때
**When** OpenAI API로 연결하면
**Then** 기본 CAD 명령(`glob`, `read`, `write`)이 수행된다
**And** 응답에 `adapter: 'openai'` 식별자가 포함된다
**And** `supportsStreaming(): true`를 반환한다

> **최소 성공 시나리오**: `glob()` 호출 → 파일 목록 반환 확인

### AC5: Adapter 런타임 교체
**Given** 런타임에 Adapter를 교체할 때
**When** `swapAdapter('ollama')` API를 호출하면
**Then** 재시작 없이 다른 LLM으로 전환 가능하다

**트리거 방법:**
- MCP 도구: `mcp__ai-native-cad__swap_adapter({ adapter: 'ollama' })`
- 또는 config.json 변경 후 SIGHUP 시그널

**검증 방법:**
1. 기존 Claude로 요청 → 응답 확인
2. `swapAdapter('ollama')` 호출
3. 새 요청 → Ollama 응답 확인 (응답의 `adapter` 필드로 구분)
4. 프로세스 재시작 없음 확인 (PID 동일)

## Tasks / Subtasks

- [ ] Task 1: LLMAdapter 인터페이스 (AC: #1)
  - [ ] 1.1 `apps/cad-mcp/src/llm/adapter.ts` 생성
  - [ ] 1.2 chat, supportsStreaming, supportsToolCalling 정의
  - [ ] 1.3 LLMResponse, Message 타입 정의

- [ ] Task 2: ClaudeAdapter (AC: #2)
  - [ ] 2.1 `apps/cad-mcp/src/llm/claude.ts` 생성
  - [ ] 2.2 @anthropic-ai/sdk 연동
  - [ ] 2.3 Tool calling 매핑

- [ ] Task 3: OllamaAdapter (AC: #3)
  - [ ] 3.1 `apps/cad-mcp/src/llm/ollama.ts` 생성
  - [ ] 3.2 ollama.chat() 연동
  - [ ] 3.3 Tool calling 호환성 처리

- [ ] Task 4: Adapter 선택 로직 (AC: #5)
  - [ ] 4.1 config.json에 llmAdapter 설정 추가
  - [ ] 4.2 AdapterFactory 구현
  - [ ] 4.3 런타임 교체 지원

> **참고**: AC4(OpenAIAdapter)는 선택 사항으로 이번 스프린트에서 구현하지 않습니다.

- [ ] Task 5: 테스트 작성

## Dev Notes

### Technical Requirements

**LLMAdapter 인터페이스:**
```typescript
interface LLMAdapter {
  chat(messages: Message[], tools?: ToolDef[]): Promise<LLMResponse>;
  supportsStreaming(): boolean;
  supportsToolCalling(): boolean;
}

interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  done: boolean;  // 현재 스토리 범위: 항상 true (비스트리밍)
                  // 향후 스트리밍 스토리에서 false→true 전환 검증 예정
}
```

**설정:**
```json
{
  "llmAdapter": "claude",
  "claudeApiKey": "sk-...",
  "ollamaModel": "qwen2.5-coder:7b",
  "ollamaBaseUrl": "http://localhost:11434",
  "openaiApiKey": "sk-..."
}
```

> **설정 설명**:
> - `llmAdapter`: 활성 어댑터 선택 (`"claude"` | `"ollama"` | `"openai"`)
> - 각 어댑터별 설정(API 키, 모델명 등)은 모두 유지 가능
> - `llmAdapter` 값에 해당하는 어댑터 설정만 실제 사용됨
> - 예: `"llmAdapter": "claude"`면 `ollamaModel`은 무시됨 (런타임 교체 시 사용 가능)

### References

- [Source: docs/architecture.md#4.7-llm-agnostic-architecture]
- [Source: docs/adr/0023-llm-agnostic-agent-architecture.md]
- [Source: docs/epics.md#story-11.4.1]

### Dependencies

- **선행**: Story 11.8 (CADOrchestrator) - Hook 통합

### File List

- `apps/cad-mcp/src/llm/adapter.ts` (신규)
- `apps/cad-mcp/src/llm/claude.ts` (신규)
- `apps/cad-mcp/src/llm/ollama.ts` (신규)
- `apps/cad-mcp/src/llm/factory.ts` (신규)
