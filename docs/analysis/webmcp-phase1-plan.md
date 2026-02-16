# WebMCP Integration Plan (Viewer) — Phase 1

Date: 2026-02-15

Branch: `feature/webmcp-phase1-viewer`

Related:
- ADR-009: `docs/adr/009-webmcp-integration.md`
- RFC: `docs/rfc/webmcp-integration.md`

## Goal (Phase 1)

Expose a small, safe set of Viewer tools to agentic browsers via Chrome WebMCP (early preview), without affecting existing Web + Local MCP architecture.

## Scope

- Viewer-only (`apps/viewer`)
- Imperative tool registration only (`navigator.modelContext.registerTool` / `provideContext`)
- Opt-in toggle (default OFF)
- Tools (initial):
  - `viewer.get_status`
  - `viewer.get_scene_summary`
  - `viewer.get_selection`
  - `viewer.select_entities` (UI-only, low risk)

## Tool Return Format (Phase 1)

All tools MUST return the same shape:

- Return value: `{ content: [{ type: "text", text: string }] }`
- `text` MUST be a JSON string (pretty-printed OK).

Rationale: early preview examples center on `content`, and additional structured fields are not guaranteed.

## Phase 1 Minimal Schemas (Normative)

- Tool inputs:
  - `viewer.get_status`: no input
  - `viewer.get_scene_summary`: no input

```ts
export type WebMcpExecuteResult = {
  content: Array<{ type: 'text'; text: string }>;
};

export type ToolOk<T> = { ok: true; data: T };
export type ToolErr = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};
export type ToolPayload<T> = ToolOk<T> | ToolErr;

export type ConnectionState = 'connected' | 'connecting' | 'disconnected';

export type ViewerGetStatusData = {
  connection_state: ConnectionState;
  viewer_version: string;
  version_status: unknown; // keep raw in Phase 1 to avoid coupling
  is_read_only: boolean;
};

export type ViewerGetSceneSummaryData = {
  entity_count: number;
  last_operation: string | null;
  sample_entities: Array<{ id: string; kind?: string; label?: string }>;
};
```

## Non-Goals (Phase 1)

- Headless WebMCP usage
- Replacing `apps/cad-mcp`
- Any destructive tool execution (file writes, bulk mutations, autosubmit workflows)
- Phase 3 WS command execution to Local MCP

## Design Constraints

- Must be safe when WebMCP API is absent (no-op; no crashes).
- Tool exposure must remain OFF by default, and require explicit user action.
- Tool input validation must be strict (Zod); failures return explicit errors.
- Keep WebMCP code isolated so early-preview API churn does not spread across Viewer code.

## Implementation Outline

1. Add WebMCP capability detection + types (no `lib.dom` dependency on WebMCP):
   - `apps/viewer/src/webmcp/model-context.ts`
   - Provide `hasWebMcp()` and `getModelContext()`.

2. Add opt-in UI + persistence:
   - Add a small toggle in `StatusBar` (or Settings if introduced first).
   - Persist to `localStorage` key `webmcp.enabled` (default `false`).

3. Register tools when (enabled && WebMCP present):
   - `apps/viewer/src/webmcp/register.ts`
   - Tools should read from existing Viewer state via hooks:
     - `useWebSocket()` for connection/version/readOnly
     - `useScene()` for scene summary
     - `useUIContext()` for selection read/write
   - Toggle OFF behavior:
     - If available, call `navigator.modelContext.clearContext()`
     - Always guard tool execution with an internal `enabled` flag so disabled state returns an explicit error

4. Tool schemas + behavior:
   - `viewer.get_status`:
     - input: none
     - returns `ToolPayload<ViewerGetStatusData>` in `content[0].text`
   - `viewer.get_scene_summary`:
     - input: none
     - returns `ToolPayload<ViewerGetSceneSummaryData>` in `content[0].text` (limit to avoid large payload)
   - `viewer.get_selection`:
     - returns `{ selected_ids }`
   - `viewer.select_entities`:
     - validates ids exist (when scene loaded)
     - supports `mode: replace|add`
     - returns `{ selected_ids, changed }`

## Tests

- Unit tests (Vitest, JSDOM):
  - No-op when `navigator.modelContext` is missing.
  - Registers tools when API exists and toggle enabled.
  - Zod validation produces explicit errors (bad input).
  - `viewer.select_entities` updates selection via `UIContext`.

## Manual Verification (Required)

- Chrome 146+ (early preview) with flag enabled:
  - `chrome://flags/#enable-webmcp-testing`
- Open Viewer, turn ON `WebMCP 도구 노출`, confirm:
  - tools are discoverable via inspector/extension
  - each tool executes and returns expected structured result
- Turn OFF toggle, confirm tools are removed / context cleared (or no longer discoverable).

## Deliverables

- Code changes in `apps/viewer` implementing Phase 1
- Tests covering registration and core tool behavior
- Minimal documentation update (if UI placement differs from RFC)
