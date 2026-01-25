# ADR-0018: LLM-Agnostic Hook Abstraction

## Status

**Proposed**

## Date

2025-12-31

## Context

LLM 교체 가능성을 위해 애플리케이션이 특정 LLM에 종속되지 않아야 한다. Claude 외에 Ollama, OpenAI 등 지원 필요.

## Decision

**애플리케이션은 LLM을 모른다**

**MCP-First 제약:**
- LLMAdapter는 MCP 서버 내부에서만 동작
- 브라우저/클라이언트와 직접 통신하지 않음
- 모든 LLM 통신은 MCP 서버를 통해 수행

```
┌─────────────────────────────────────────────┐
│         CADOrchestrator                     │
│         (LLM-Agnostic Hook Owner)           │
├─────────────────────────────────────────────┤
│                    │                         │
│                    ▼                         │
│              LLMAdapter ← Interface          │
│                    │                         │
│       ┌──────┬─────┴─────┬───────┐          │
│       ▼      ▼           ▼       ▼          │
│    Claude  Ollama     OpenAI   ...          │
│    Adapter Adapter    Adapter               │
└─────────────────────────────────────────────┘
```

**Interface:**
```typescript
interface LLMAdapter {
  chat(messages: Message[]): Promise<Response>;
  getToolDefinitions(): ToolDefinition[];
  supportsStreaming(): boolean;
}
```

## Consequences

### Positive
- 보안/기밀 클라이언트에 로컬 LLM 제공 가능
- LLM 벤더 종속 탈피
- A/B 테스트 용이

### Negative
- 추상화 레이어 복잡도 증가
- LLM별 특성 활용 제한

## References

- [ADR-0001: Direct-First Architecture](0001-direct-first-architecture.md)
