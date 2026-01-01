# Story 6.3: Canvas 2D Viewer 이식

Status: done

## Story

As a **개발자**,
I want **기존 viewer/를 Electron Renderer에 이식하도록**,
so that **CAD 결과를 앱 내에서 확인할 수 있다**.

## Acceptance Criteria

1. **AC1: viewer 재사용**
   - Given: `viewer/index.html`, `viewer/renderer.js`가 존재
   - When: Electron Renderer에서 로드
   - Then: 동일한 렌더링 UI가 표시된다
   - And: `renderer.js`는 빌드 시 자동 복사된다

2. **AC2: 도형 렌더링**
   - Given: scene.json에 Line, Circle, Rect, Arc가 존재
   - When: Canvas 렌더링
   - Then: 모든 도형이 올바르게 표시된다
   - And: stroke/fill 스타일이 적용된다

3. **AC3: 변환 렌더링**
   - Given: translate/rotate/scale 변환이 적용된 도형
   - When: Canvas 렌더링
   - Then: 변환이 올바르게 적용되어 표시된다

4. **AC4: Scene Info 패널**
   - Given: scene.json이 로드됨
   - When: Renderer가 갱신됨
   - Then: Bounds/Entities/Operation Log/Last Error가 표시된다

5. **AC5: Electron 레이아웃 표시**
   - Given: Electron 앱 실행
   - When: 창이 열림
   - Then: Viewer UI가 정상적으로 렌더링된다

## Tasks / Subtasks

- [x] **Task 1: viewer UI 복사** (AC: 1, 5)
  - [x] 1.1: `viewer/index.html` → `cad-electron/src/renderer/index.html`
  - [x] 1.2: `index.html`에서 `renderer.js` 로드 확인

- [x] **Task 2: renderer.js 복사 자동화** (AC: 1)
  - [x] 2.1: `rollup-plugin-copy`로 빌드 시작 시 복사
  - [x] 2.2: `viewer/renderer.js`를 단일 소스로 유지

- [x] **Task 3: 불필요한 렌더러 코드 제거** (AC: 1)
  - [x] 3.1: 기존 renderer 진입점 제거
  - [x] 3.2: preload/IPC 코드 제거

- [x] **Task 4: 테스트** (AC: 2, 3, 4, 5)
  - [x] 4.1: circle/rect/line/arc 렌더링 확인
  - [x] 4.2: style/transform 적용 확인
  - [x] 4.3: Scene Info 패널 갱신 확인

## Dev Notes

### Architecture Compliance

- viewer/renderer.js가 Source of Truth
- Electron Renderer는 `scene.json`을 폴링 (Story 6-2)
- IPC 없이 파일 기반 동작 유지

### Technical Requirements

1. **copy 설정**:

   ```ts
   // cad-electron/electron.vite.config.ts
   copy({
     targets: [{ src: viewerRendererPath, dest: resolve(__dirname, 'src/renderer') }],
     hook: 'buildStart',
     copySync: true
   });
   ```

2. **renderer 로드**:

   ```html
   <script src="renderer.js"></script>
   ```

### File Structure Notes

- `viewer/renderer.js` - 단일 원본
- `cad-electron/src/renderer/index.html` - viewer UI 복사본

### References

- [Source: docs/rfc/epic6-cad-renderer-package.md]
- [Source: viewer/index.html]
- [Source: viewer/renderer.js]

## Dev Agent Record

### Context Reference

- docs/rfc/epic6-cad-renderer-package.md
- viewer/index.html
- viewer/renderer.js

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- docs/qa/story-6-manual-qa-log.md

### Completion Notes List

- viewer UI를 Electron renderer로 복사해 동일한 레이아웃 유지
- renderer.js는 빌드 시 자동 복사로 단일 원본 유지
- 기존 renderer/preload/IPC 코드 제거

### File List
| File | Action | Description |
|------|--------|-------------|
| `cad-electron/src/renderer/index.html` | Modified | viewer/index.html 복사 |
| `cad-electron/electron.vite.config.ts` | Modified | renderer.js 복사 설정 |
| `cad-electron/src/renderer/renderer.js` | Copied | viewer/renderer.js 복사본 |
| `cad-electron/src/renderer/main.ts` | Deleted | 기존 진입점 제거 |
| `cad-electron/src/preload/index.ts` | Deleted | preload 제거 |
| `cad-electron/src/main/file-watcher.ts` | Deleted | IPC 기반 감시 제거 |
