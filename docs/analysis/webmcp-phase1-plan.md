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

4. Tool schemas + behavior:
   - `viewer.get_status`:
     - returns connectionState, versionStatus, viewerVersion, isReadOnly
   - `viewer.get_scene_summary`:
     - returns entityCount and optionally a compact list of recent ids/types (limit to avoid large payload)
   - `viewer.get_selection`:
     - returns current selected ids
   - `viewer.select_entities`:
     - validates ids exist (when scene loaded)
     - supports `mode: replace|add`

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
