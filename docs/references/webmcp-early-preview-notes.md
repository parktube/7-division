# WebMCP Early Preview Notes (Implementation-Facing Summary)

This document is a **non-verbatim** summary of the WebMCP early preview API, intended to be safe to commit.

If you have access to the original PDF, place it under `media/inbound/WebMCP_Early_Preview.pdf` for deeper reading.

## API Surface (Observed / Assumed)

WebMCP is exposed through a browser-only object:

- `navigator.modelContext`

Key methods used by this project:

- `registerTool(spec)`
  - Registers a tool implementation and metadata.
  - Tool execution is handled via an async function (commonly `execute`).
- `provideContext(contextSpec)`
  - Provides the model with the current context and the set of tools that should be discoverable/available.
  - Treat this as the "active tool set" gate (useful for opt-in toggles).
- `clearContext()` (if available in the runtime)
  - Clears the currently provided context and tool set.

The exact shape and availability can change in early preview. Always guard with capability checks.

## Tool Result Shape (Project Standard)

For Phase 1, we standardize on a conservative result format:

- Tool returns an object with `content` array.
- Use `content[0].type = "text"` and put JSON as a string in `content[0].text`.

Example:

```ts
return {
  content: [
    {
      type: 'text',
      text: JSON.stringify({ ok: true, data }, null, 2),
    },
  ],
}
```

Reasoning:

- Early preview examples are `content`-centric.
- Support for additional structured fields is not guaranteed, so we avoid relying on them in Phase 1.

## Safety Requirements (Project Policy)

- Default OFF (opt-in required).
- No crashes if API is missing.
- Strict input validation (Zod) for any tool that accepts arguments.
- When disabled, tool calls must return explicit errors (do not silently succeed).

