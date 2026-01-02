# Story 6.2: scene.json 파일 감시

Status: done

## Story

As a **개발자**,
I want **Electron Renderer가 scene.json을 폴링하여 상태를 갱신하도록**,
so that **Claude Code/cad-cli 결과를 앱에서 바로 확인할 수 있다**.

## Acceptance Criteria

1. **AC1: scene.json 접근**
   - Given: Electron 앱이 실행 중
   - When: Renderer가 scene.json을 요청
   - Then: `/scene.json`에서 JSON을 읽을 수 있다
   - And: dev 서버는 `viewer/scene.json`을 제공한다

2. **AC2: 폴링 갱신**
   - Given: `scene.json`이 변경됨
   - When: Renderer가 500ms 간격으로 폴링
   - Then: Canvas와 Scene Info가 갱신된다

3. **AC3: 오류 처리**
   - Given: `scene.json`이 없거나 깨짐
   - When: Renderer가 fetch 시도
   - Then: 앱이 크래시하지 않는다
   - And: "Waiting for scene.json..." 상태가 표시된다

4. **AC4: 파일 기반 인터페이스 유지**
   - Given: Claude Code가 `cad-cli.ts`를 실행
   - When: `viewer/scene.json`이 업데이트됨
   - Then: Electron Renderer는 동일한 파일 인터페이스로 동작한다

## Tasks / Subtasks

- [x] **Task 1: scene.json 제공** (AC: 1)
  - [x] 1.1: dev server `/scene.json` 라우트 추가
  - [x] 1.2: `viewer/scene.json`에서 파일 읽기

- [x] **Task 2: 폴링 갱신** (AC: 2, 3)
  - [x] 2.1: `renderer.js`에서 500ms 폴링 유지
  - [x] 2.2: 상태 텍스트/오버레이 갱신 유지

- [x] **Task 3: 테스트** (AC: 2, 4)
  - [x] 3.1: `cad-cli.ts export_json` 후 갱신 확인
  - [x] 3.2: `draw_circle` 후 렌더링 확인

## Dev Notes

### Architecture Compliance

- 파일 기반 폴링 유지 (IPC 없음)
- `cad-tools/cad-cli.ts` → `viewer/scene.json` → Electron Renderer
- Renderer는 `scene.json` 상대 경로를 그대로 사용

### Technical Requirements

1. **dev server middleware**:

   ```ts
   // cad-electron/electron.vite.config.ts
   server.middlewares.use('/scene.json', (_req, res) => {
     const data = readFileSync(viewerScenePath, 'utf-8');
     res.statusCode = 200;
     res.setHeader('Content-Type', 'application/json');
     res.end(data);
   });
   ```

2. **renderer polling**:

   ```js
   const SOURCE_FILE = 'scene.json';
   const POLL_INTERVAL_MS = 500;
   setInterval(fetchScene, POLL_INTERVAL_MS);
   ```

### File Structure Notes

- `viewer/scene.json` - CLI가 저장하는 단일 인터페이스
- `cad-electron/electron.vite.config.ts` - `/scene.json` 라우팅

### References

- [Source: docs/rfc/epic6-cad-renderer-package.md]
- [Source: docs/architecture.md#Electron 파일 폴링 유지]
- [Source: viewer/renderer.js]

## Dev Agent Record

### Context Reference

- docs/architecture.md (파일 폴링)
- docs/rfc/epic6-cad-renderer-package.md
- viewer/renderer.js

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- docs/qa/story-6-manual-qa-log.md

### Completion Notes List

- dev server에서 `viewer/scene.json`을 `/scene.json`으로 제공
- renderer.js 폴링 유지로 자동 갱신 확인

### File List
| File | Action | Description |
|------|--------|-------------|
| `cad-electron/electron.vite.config.ts` | Modified | `/scene.json` 미들웨어 추가 |
| `viewer/scene.json` | Used | CLI가 갱신하는 인터페이스 |
| `docs/qa/story-6-manual-qa-log.md` | Added | 수동 QA 기록 |
