# Repository Guidelines

## Project Structure & Module Organization

- `docs/`: source-of-truth for Phase 1 scope and planning.
  - `docs/prd.md`, `docs/architecture.md`, `docs/epics.md`
  - `docs/sprint-artifacts/`: per-story specs and `sprint-status.yaml`
- Implementation folders are **planned** (may not exist yet):
  - `cad-engine/`: Rust → WASM CAD engine (`src/scene`, `src/primitives`, `src/transforms`, `src/serializers`)
  - `viewer/`: static Canvas 2D viewer (`index.html`, `renderer.js`, reads `scene.json`)

## Build, Test, and Development Commands

- Check current work queue: `cat docs/sprint-artifacts/sprint-status.yaml`
- CAD engine (once `cad-engine/` exists):
  - Build WASM: `cd cad-engine && wasm-pack build --target nodejs --dev`
  - Release build: `cd cad-engine && wasm-pack build --target nodejs --release`
  - Run Rust tests: `cd cad-engine && cargo test`
- Viewer (once `viewer/` exists):
  - Serve locally: `cd viewer && python -m http.server 8000` (open `http://localhost:8000`)

## Coding Style & Naming Conventions

- Rust: run `cargo fmt` and prefer `cargo clippy` before PRs; keep modules `snake_case`.
- JS/HTML (viewer): keep it dependency-light (Phase 1), prefer clear function names like `renderLine`, `renderCircle`.
- Story files: keep `docs/sprint-artifacts/<epic>-<story>-<slug>.md` and update status consistently in `docs/sprint-artifacts/sprint-status.yaml`.

## Testing Guidelines

- Prefer small, deterministic unit tests in Rust (`cargo test`).
- If adding JS tests later, align with repo direction (Vitest mentioned in docs) and document how to run them.

## Commit & Pull Request Guidelines

- Commit messages in this repo are short, imperative, and may be bilingual (English/Korean). Keep them specific (e.g., `Update Viewer Architecture: Canvas 2D`).
- PRs should:
  - Link the story (e.g., `docs/sprint-artifacts/1-2-scene-class.md`) and update `docs/sprint-artifacts/sprint-status.yaml`.
  - Describe behavior changes and include screenshots for viewer changes.

## Architecture Notes (Phase 1)

- Follow “Direct-First”: Node.js loads WASM directly; viewer only verifies output via `scene.json`.
- Prefer a `wasm-bindgen` class wrapper (`Scene`) and use `Float64Array` for polyline inputs.
