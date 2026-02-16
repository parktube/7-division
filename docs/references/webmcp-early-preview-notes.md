# WebMCP Early Preview Notes (Implementation-Facing Summary)

This document is a **non-verbatim** summary of the WebMCP early preview API, intended to be safe to commit.

If you have access to the original PDF, place it under `media/inbound/WebMCP_Early_Preview.pdf` for deeper reading.

## Requirements

- **Chrome**: Version 146.0.7672.0 or higher
- **Flag**: `chrome://flags/#enable-webmcp-testing` must be enabled
- **Browsing context required**: No headless support (browser tab/webview must be open)

## API Surface (Observed / Assumed)

WebMCP is exposed through a browser-only object:

- `navigator.modelContext`

### Imperative API (used by this project)

- `registerTool(spec)`
  - Registers a single tool without removing others.
  - Tool execution is handled via an async function (`execute`).
  - Spec shape:
    ```ts
    {
      name: string;
      description: string;
      inputSchema: JSONSchema;
      annotations?: { readOnlyHint?: string };
      execute: (input) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;
    }
    ```
- `unregisterTool(name: string)`
  - Removes a specific tool by name.
- `provideContext(contextSpec)`
  - Replaces the entire set of registered tools at once.
  - Useful for resetting functionality when application state changes.
- `clearContext()`
  - Removes all tools at once.

### Declarative API (not used in Phase 1)

HTML form annotations that automatically transform forms into WebMCP tools:

- `toolname` - Tool name attribute on `<form>`
- `tooldescription` - Tool description
- `toolautosubmit` - Auto-submit without user clicking Submit
- `toolparamtitle` - Maps to JSON schema property key
- `toolparamdescription` - Maps to property description

### Events

- `toolactivated` - Fires when an AI agent executes a tool (form fields pre-filled)
- `toolcancel` - Fires when agent cancels or user resets the form

Both events provide a `toolName` attribute for identification.

### CSS Pseudo-classes

- `:tool-form-active` - Applied to the tool's HTML `<form>` element when active
- `:tool-submit-active` - Applied to the form's submit button

Default Chrome styles:
```css
form:tool-form-active {
  outline: light-dark(blue, cyan) dashed 1px;
  outline-offset: -1px;
}
input:tool-submit-active {
  outline: light-dark(red, pink) dashed 1px;
  outline-offset: -1px;
}
```

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

## Tool Declaration Best Practices

### 1. Naming and Semantics
- Use specific verbs that describe exactly what happens.
- Example: Use `create-event` for immediate creation, but `start-event-creation-process` if the tool redirects to a UI form.
- Describe *what* the tool does and *when* to use it (positive instructions over negative limitations).

### 2. Schema Design and Input Handling
- Accept raw user input (avoid asking the agent to perform math or transformations).
- All parameters must have specific types (`string`, `number`, `enum`).
- Explain *why* behind options, not just the *what*.

### 3. Reliability and Error Recovery
- **Validate strictly in code, loosely in schema**: Schema constraints are helpful but not guaranteed.
- Return **descriptive errors** so the model can self-correct and retry.
- Tools should allow for reasonable repeated use (graceful failure for rate limits).
- **Return after UI has been updated**: Ensure the function returns *after* UI updates for consistency.

### 4. Tool Strategy and Philosophy
- **Atomic and composable**: Avoid similar tools with nuanced differences. Each tool = single function.
- **Trust the agent's flow control**: Avoid rigid instructions like "Don't call B after A".

## Limitations

- **Browsing context required**: No headless support. A browser tab or webview must be opened.
- **UI synchronization**: Web developers must ensure UI reflects current app state regardless of whether updates came from human interaction or tool calls.
- **Complexity overhead**: Complex site UIs may require refactoring to handle app and UI state with appropriate outputs.
- **Tool discoverability**: No built-in mechanism for client applications to discover which sites provide tools without visiting them.

## MCP vs WebMCP

| Aspect | MCP | WebMCP |
|--------|-----|--------|
| Location | Server-side protocol | Browser client-side |
| Deployment | Requires server | In existing web app |
| Purpose | Connect to server apps | Provide tools to in-browser AI agents |

## Resources

- **Live Demo**: https://googlechromelabs.github.io/webmcp-tools/demos/react-flightsearch/
- **GitHub**: https://github.com/nicolo-ribaudo/webmcp-polyfill (proposed standard tracking)
- **Dev Preview Group**: For questions and feedback
- **Bug Reports**: https://crbug.com/new?component=2021259

