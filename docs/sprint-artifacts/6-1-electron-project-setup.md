# Story 6.1: Electron 프로젝트 셋업

Status: done

## Story

As a **개발자**,
I want **Electron + Vite 프로젝트를 구성하도록**,
so that **WASM과 Viewer를 데스크톱 앱으로 빌드할 수 있다**.

## Acceptance Criteria

1. **AC1: 프로젝트 구조 생성**
   - Given: `cad-electron/` 디렉토리
   - When: 프로젝트 초기화
   - Then: Electron + Vite 기반 프로젝트 구조가 생성된다
   - And: package.json, tsconfig.json 등 설정 파일이 존재한다

2. **AC2: 개발 모드 실행**
   - Given: 프로젝트 셋업 완료
   - When: `npm run dev` 실행
   - Then: Electron 창이 열린다
   - And: Vite HMR(Hot Module Replacement)이 동작한다

3. **AC3: Main/Renderer 프로세스 분리**
   - Given: Electron 앱 구조
   - When: 코드 검토
   - Then: main 프로세스 (Node.js)와 renderer 프로세스 (Chromium)가 분리되어 있다
   - And: `src/main/index.ts`, `src/renderer/index.html`이 각각 진입점으로 존재한다

4. **AC4: TypeScript 지원**
   - Given: 프로젝트 구조
   - When: .ts 파일 작성
   - Then: TypeScript가 정상적으로 컴파일된다
   - And: 타입 체크가 수행된다

5. **AC5: 기본 창 표시**
   - Given: 앱 실행
   - When: 앱이 시작됨
   - Then: 기본 창이 표시된다
   - And: 창 크기가 설정되어 있다 (1200x800)

6. **AC6: 개발자 도구**
   - Given: 개발 모드로 앱 실행
   - When: Ctrl+Shift+I (또는 Cmd+Option+I)
   - Then: Chrome DevTools가 열린다

7. **AC7: 프로덕션 빌드 설정**
   - Given: electron-builder 설정
   - When: `npm run build` 실행 (테스트용)
   - Then: 빌드 프로세스가 오류 없이 시작된다
   - Note: 실제 패키징은 Story 6-4에서

## Tasks / Subtasks

- [x] **Task 1: 프로젝트 초기화** (AC: 1)
  - [x] 1.1: `cad-electron/` 디렉토리 구성
  - [x] 1.2: `package.json`/`tsconfig.json` 기본 세팅
  - [x] 1.3: Electron, electron-vite, TypeScript 의존성 설치
  - [x] 1.4: electron-builder 설정 추가

- [x] **Task 2: electron-vite 설정** (AC: 2, 4)
  - [x] 2.1: `electron.vite.config.ts` 구성
  - [x] 2.2: Renderer 빌드 입력 경로 지정
  - [x] 2.3: 개발 서버 host/port 고정

- [x] **Task 3: TypeScript 설정** (AC: 4)
  - [x] 3.1: `tsconfig.json` 생성 (main)
  - [x] 3.2: `tsconfig.node.json` 추가
  - [x] 3.3: 타입 정의 설치 (@types/node)

- [x] **Task 4: Main 프로세스 설정** (AC: 3, 5, 6)
  - [x] 4.1: `src/main/index.ts` 생성
  - [x] 4.2: BrowserWindow 생성 로직
  - [x] 4.3: 개발/프로덕션 로드 분기
  - [x] 4.4: 창 크기 설정 (1200x800)

- [x] **Task 5: Renderer 프로세스 진입점** (AC: 3)
  - [x] 5.1: `src/renderer/index.html` 진입점 구성
  - [x] 5.2: `renderer.js` 로드 스크립트 연결

- [x] **Task 6: npm scripts 설정** (AC: 2, 7)
  - [x] 6.1: dev/build/preview 스크립트 구성
  - [x] 6.2: `ELECTRON_RUN_AS_NODE` 초기화 래퍼 추가

- [x] **Task 7: electron-builder 설정** (AC: 7)
  - [x] 7.1: `electron-builder.yml` 추가
  - [x] 7.2: package.json에 package 스크립트 등록

- [x] **Task 8: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] 8.1: `npm run dev`로 창 표시 확인
  - [x] 8.2: TypeScript 빌드 확인
  - [x] 8.3: DevTools 수동 열기 확인
  - [x] 8.4: `npm run build` 실행 확인

## Dev Notes

### Architecture Compliance

**파일 폴링 아키텍처 유지:**

- Electron Renderer = 웹 브라우저 (Chromium)
- 기존 viewer/ 코드의 fetch 폴링 그대로 사용
- IPC 전환 없음 (웹 서비스 확장성 유지)

**디렉토리 구조:**

```
cad-electron/
├── package.json
├── electron-builder.yml
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── src/
│   ├── main/
│   │   └── index.ts        # Main 프로세스 진입점
│   │   # Note: preload.ts 불필요 (IPC 미사용, 파일 폴링 방식)
│   └── renderer/
│       └── index.html       # Renderer 진입점
└── out/                     # 빌드 출력
```

### Technical Requirements

1. **의존성 목록**:

   ```json
   {
     "devDependencies": {
       "electron": "^33.0.0",
       "electron-builder": "^25.0.0",
       "electron-vite": "^2.3.0",
       "rollup-plugin-copy": "^3.5.0",
       "vite": "^5.4.0",
       "typescript": "^5.3.0",
       "@types/node": "^20.10.0"
     }
   }
   ```

2. **Main 프로세스 기본 코드**:

   ```typescript
   // src/main/index.ts
   import { app, BrowserWindow } from 'electron';
   import { join } from 'path';

   function createWindow() {
       const win = new BrowserWindow({
           width: 1200,
           height: 800,
           webPreferences: {
               nodeIntegration: false,
               contextIsolation: true,
               sandbox: true
           }
       });

       if (process.env.ELECTRON_RENDERER_URL) {
           win.loadURL(process.env.ELECTRON_RENDERER_URL);
       } else {
           win.loadFile(join(__dirname, '../renderer/index.html'));
       }
   }

   app.whenReady().then(createWindow);
   ```

3. **electron-vite 설정**:

   ```typescript
   // electron.vite.config.ts
   import { defineConfig } from 'electron-vite';
   import { resolve } from 'path';

   export default defineConfig({
       main: {
           build: {
               rollupOptions: {
                   input: { index: resolve(__dirname, 'src/main/index.ts') }
               }
           }
       },
       renderer: {
           server: { host: '127.0.0.1', port: 5173, strictPort: true }
       }
   });
   ```

4. **창 레이아웃 계획**:
   - 현재: CADViewer 단일 레이아웃
   - 채팅 UI는 Claude Code로 대체 (Story 6-5 범위)

### File Structure Notes

생성 대상 디렉토리:

- `cad-electron/` - Electron 앱 프로젝트

참고 파일:

- `viewer/` - 기존 Canvas 2D Viewer (Story 6-3에서 이식)

### References

- [Source: docs/architecture.md#Electron 파일 폴링 유지]
- [Source: docs/epics.md#Story 6.1: Electron 프로젝트 셋업]
- [Electron Forge/Vite 템플릿](https://www.electronforge.io/)

## Dev Agent Record

### Context Reference

- docs/architecture.md (MVP Technical Risks - Electron)
- docs/epics.md (Epic 6, Story 6.1)

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- docs/qa/story-6-manual-qa-log.md

### Completion Notes List

- electron-vite 기반 프로젝트 구조 확정
- dev/build/preview 스크립트에 실행 래퍼 추가 (ELECTRON_RUN_AS_NODE 초기화)
- main/renderer 분리 유지, preload 제거

### File List
| File | Action | Description |
|------|--------|-------------|
| `cad-electron/package.json` | Modified | dev/build/preview 스크립트 및 의존성 정리 |
| `cad-electron/scripts/run-electron-vite.cjs` | Added | Electron 실행 래퍼 |
| `cad-electron/src/main/index.ts` | Modified | 창 생성 및 로드 분기 |
| `cad-electron/electron.vite.config.ts` | Modified | dev server host/port 고정 |
| `cad-electron/tsconfig.json` | Present | TypeScript 설정 |
| `cad-electron/tsconfig.node.json` | Present | Node 타깃 TS 설정 |
