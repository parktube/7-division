# Story 6.3: Canvas 2D Viewer 이식

Status: backlog

## Story

As a **개발자**,
I want **기존 viewer/를 Electron Renderer에 이식하도록**,
so that **CAD 결과를 앱 내에서 확인할 수 있다**.

## Acceptance Criteria

1. **AC1: 기존 viewer 코드 재사용**
   - Given: 기존 viewer/renderer.js 존재
   - When: Electron Renderer에 통합
   - Then: 동일한 렌더링 로직이 동작한다
   - And: 코드 수정 최소화

2. **AC2: 메모리 직접 렌더링**
   - Given: Electron 앱 실행 중
   - When: CAD 명령으로 Scene 상태 변경
   - Then: 메모리에서 직접 Canvas로 렌더링
   - And: 파일 폴링 불필요

3. **AC3: 모든 도형 렌더링**
   - Given: scene.json에 Line, Circle, Rect, Arc, Group이 존재
   - When: Canvas 렌더링
   - Then: 모든 도형이 올바르게 표시된다

4. **AC4: Transform 적용 렌더링**
   - Given: translate, rotate, scale, pivot이 적용된 도형
   - When: Canvas 렌더링
   - Then: 변환이 올바르게 적용되어 표시된다

5. **AC5: 그룹 계층 렌더링**
   - Given: 그룹과 자식들이 존재
   - When: Canvas 렌더링
   - Then: 계층적 변환이 올바르게 적용된다

6. **AC6: Selection 하이라이트 (Epic 5 연동)**
   - Given: selection.json에 선택 정보 존재
   - When: Canvas 렌더링
   - Then: 선택된 도형에 하이라이트가 표시된다

7. **AC7: 레이아웃 통합**
   - Given: Electron 창 레이아웃
   - When: 앱 실행
   - Then: Canvas Viewer가 창의 좌측 영역에 표시된다
   - And: 우측에 채팅 UI 공간이 확보된다

## Tasks / Subtasks

- [ ] **Task 1: viewer 코드 복사** (AC: 1)
  - [ ] 1.1: viewer/renderer.js → electron-app/src/renderer/cad-viewer.ts
  - [ ] 1.2: TypeScript로 변환 (또는 .js 유지)
  - [ ] 1.3: import/export 구문 정리

- [ ] **Task 2: 메모리 직접 렌더링** (AC: 2)
  - [ ] 2.1: WASM Scene 객체에서 직접 데이터 읽기
  - [ ] 2.2: CAD 명령 실행 후 즉시 렌더링
  - [ ] 2.3: 파일 I/O 불필요
  - [ ] 2.4: requestAnimationFrame으로 부드러운 렌더링

- [ ] **Task 3: 도형 렌더링 확인** (AC: 3, 4, 5)
  - [ ] 3.1: Line, Circle, Rect, Arc 렌더링 테스트
  - [ ] 3.2: Transform 적용 테스트
  - [ ] 3.3: 그룹 계층 렌더링 테스트
  - [ ] 3.4: Story 4-6에서 구현한 로직 그대로 사용

- [ ] **Task 4: Selection 연동** (AC: 6)
  - [ ] 4.1: selection.json 폴링 추가
  - [ ] 4.2: 하이라이트 렌더링 (Story 5-2 로직)
  - [ ] 4.3: 클릭 이벤트 핸들링 (Story 5-1 로직)

- [ ] **Task 5: 레이아웃 구성** (AC: 7)
  - [ ] 5.1: Flexbox 또는 Grid 레이아웃
  - [ ] 5.2: 좌측 60-70%: CAD Viewer
  - [ ] 5.3: 우측 30-40%: 채팅 UI 영역
  - [ ] 5.4: 반응형 리사이즈 고려

- [ ] **Task 6: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7)
  - [ ] 6.1: 앱 실행 후 Canvas 표시 확인
  - [ ] 6.2: scene.json 변경 시 자동 갱신 확인
  - [ ] 6.3: 모든 도형 타입 렌더링 확인
  - [ ] 6.4: 선택 하이라이트 확인
  - [ ] 6.5: 레이아웃 확인

## Dev Notes

### Architecture Compliance

**Client-Direct Architecture (메모리 직접 렌더링):**
- Electron Renderer = 웹 브라우저 (Chromium)
- WASM Scene 객체에서 직접 데이터 읽기
- 파일 폴링 불필요 → 즉각적인 렌더링
- 웹 버전과 코드 100% 동일

```
┌─ Electron Renderer (= 브라우저) ─────────────────────────┐
│                                                          │
│   CAD 명령 실행 (WASM)                                   │
│         ↓                                                │
│   Scene 상태 변경 (메모리)                               │
│         ↓                                                │
│   renderScene(scene.export_json())  // 메모리에서 직접   │
│         ↓                                                │
│   Canvas 렌더링                                          │
│                                                          │
│   ※ 파일 I/O 없음, 폴링 없음, 즉각 반영                 │
└──────────────────────────────────────────────────────────┘
```

### Technical Requirements

1. **메모리 직접 렌더링**:
   ```typescript
   // 파일 경로 불필요 - 메모리에서 직접
   import { getSceneData } from './cad-engine';

   function render() {
       const sceneJson = getSceneData();  // 메모리에서 직접
       const scene = JSON.parse(sceneJson);
       renderScene(scene);
   }

   // CAD 명령 실행 후 즉시 렌더링
   function executeCommand(cmd: string, params: object) {
       cadEngine.execute(cmd, params);
       render();  // 즉시 반영
   }
   ```

2. **레이아웃 CSS**:
   ```css
   .app-container {
       display: flex;
       height: 100vh;
   }
   .cad-viewer {
       flex: 7;  /* 70% */
       position: relative;
   }
   .chat-panel {
       flex: 3;  /* 30% */
       border-left: 1px solid #ccc;
   }
   ```

3. **Canvas 리사이즈 처리**:
   ```typescript
   function resizeCanvas() {
       const container = document.querySelector('.cad-viewer');
       canvas.width = container.clientWidth;
       canvas.height = container.clientHeight;
       render();  // 리렌더링
   }
   window.addEventListener('resize', resizeCanvas);
   ```

### File Structure Notes

복사/수정 대상:
- `viewer/renderer.js` → `electron-app/src/renderer/cad-viewer.ts`
- `viewer/index.html` 스타일 → `electron-app/src/renderer/styles.css`

새로 생성:
- `electron-app/src/renderer/App.ts` - 메인 앱 컴포넌트
- `electron-app/src/renderer/layout.css` - 레이아웃 스타일

### References

- [Source: docs/architecture.md#파일 폴링 아키텍처]
- [Source: docs/epics.md#Story 6.3: Canvas 2D Viewer 이식]
- [Source: viewer/renderer.js - 기존 렌더러]
- [Source: docs/sprint-artifacts/4-6-group-rendering.md - 그룹 렌더링]
- [Source: docs/sprint-artifacts/5-1-click-selection.md - 선택 로직]

## Dev Agent Record

### Context Reference

- docs/architecture.md (파일 폴링)
- viewer/renderer.js
- docs/sprint-artifacts/4-6-group-rendering.md
- docs/sprint-artifacts/5-1-click-selection.md

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
