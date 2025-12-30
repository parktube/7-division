# Story 6.1: Electron 프로젝트 셋업

Status: backlog

## Story

As a **개발자**,
I want **Electron + Vite 프로젝트를 구성하도록**,
so that **WASM과 Viewer를 데스크톱 앱으로 빌드할 수 있다**.

## Acceptance Criteria

1. **AC1: 프로젝트 구조 생성**
   - Given: 빈 electron-app 디렉토리
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
   - And: 각각 별도의 진입점 파일이 존재한다

4. **AC4: TypeScript 지원**
   - Given: 프로젝트 구조
   - When: .ts 파일 작성
   - Then: TypeScript가 정상적으로 컴파일된다
   - And: 타입 체크가 수행된다

5. **AC5: 기본 창 표시**
   - Given: 앱 실행
   - When: 앱이 시작됨
   - Then: 기본 창이 표시된다
   - And: 창 크기, 제목이 적절히 설정되어 있다

6. **AC6: 개발자 도구**
   - Given: 개발 모드로 앱 실행
   - When: Ctrl+Shift+I (또는 Cmd+Option+I)
   - Then: Chrome DevTools가 열린다

7. **AC7: 프로덕션 빌드 설정**
   - Given: electron-builder 설정
   - When: `npm run build` 실행 (테스트용)
   - Then: 빌드 프로세스가 오류 없이 시작된다
   - Note: 실제 패키징은 Story 6-6에서

## Tasks / Subtasks

- [ ] **Task 1: 프로젝트 초기화** (AC: 1)
  - [ ] 1.1: `mkdir electron-app && cd electron-app`
  - [ ] 1.2: `npm init -y`
  - [ ] 1.3: Electron, Vite, TypeScript 의존성 설치
  - [ ] 1.4: electron-builder 설치

- [ ] **Task 2: Vite 설정** (AC: 2, 4)
  - [ ] 2.1: vite.config.ts 생성
  - [ ] 2.2: Renderer 빌드 설정
  - [ ] 2.3: 개발 서버 포트 설정

- [ ] **Task 3: TypeScript 설정** (AC: 4)
  - [ ] 3.1: tsconfig.json 생성 (main용)
  - [ ] 3.2: tsconfig.web.json 생성 (renderer용)
  - [ ] 3.3: 타입 정의 설치 (@types/node 등)

- [ ] **Task 4: Main 프로세스 설정** (AC: 3, 5, 6)
  - [ ] 4.1: src/main/index.ts 생성
  - [ ] 4.2: BrowserWindow 생성 로직
  - [ ] 4.3: 개발 모드 DevTools 자동 열기
  - [ ] 4.4: 창 크기, 제목 설정

- [ ] **Task 5: Renderer 프로세스 설정** (AC: 3)
  - [ ] 5.1: src/renderer/index.html 생성
  - [ ] 5.2: src/renderer/main.ts 진입점
  - [ ] 5.3: 기본 UI 스켈레톤

- [ ] **Task 6: npm scripts 설정** (AC: 2, 7)
  - [ ] 6.1: "dev": 개발 모드 (Vite + Electron 동시 실행)
  - [ ] 6.2: "build": Vite 빌드 + Electron 빌드
  - [ ] 6.3: "preview": 프로덕션 빌드 미리보기

- [ ] **Task 7: electron-builder 설정** (AC: 7)
  - [ ] 7.1: electron-builder.yml 또는 package.json build 섹션
  - [ ] 7.2: 앱 ID, 이름, 아이콘 설정
  - [ ] 7.3: 플랫폼별 빌드 타겟 설정

- [ ] **Task 8: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7)
  - [ ] 8.1: npm run dev 정상 실행 확인
  - [ ] 8.2: TypeScript 컴파일 확인
  - [ ] 8.3: HMR 동작 확인
  - [ ] 8.4: DevTools 열기 확인
  - [ ] 8.5: npm run build 오류 없음 확인

## Dev Notes

### Architecture Compliance

**파일 폴링 아키텍처 유지:**
- Electron Renderer = 웹 브라우저 (Chromium)
- 기존 viewer/ 코드의 fetch 폴링 그대로 사용
- IPC 전환 없음 (웹 서비스 확장성 유지)

**디렉토리 구조:**
```
electron-app/
├── package.json
├── electron-builder.yml
├── vite.config.ts
├── tsconfig.json
├── tsconfig.web.json
├── src/
│   ├── main/
│   │   └── index.ts        # Main 프로세스 진입점
│   │   # Note: preload.ts 불필요 (IPC 미사용, 파일 폴링 방식)
│   └── renderer/
│       ├── index.html
│       ├── main.ts
│       ├── App.vue/.tsx    # 또는 vanilla JS
│       └── styles.css
└── dist/                   # 빌드 출력
```

### Technical Requirements

1. **의존성 목록**:
   ```json
   {
     "devDependencies": {
       "electron": "^28.0.0",
       "electron-builder": "^24.0.0",
       "vite": "^5.0.0",
       "typescript": "^5.3.0",
       "@types/node": "^20.0.0",
       "vite-plugin-electron": "^0.15.0",
       "vite-plugin-electron-renderer": "^0.14.0"
     }
   }
   ```

2. **Main 프로세스 기본 코드**:
   ```typescript
   // src/main/index.ts
   import { app, BrowserWindow } from 'electron';
   import path from 'path';

   function createWindow() {
       const win = new BrowserWindow({
           width: 1400,
           height: 900,
           title: 'AI-Native CAD',
           webPreferences: {
               nodeIntegration: false,
               contextIsolation: true
               // preload 불필요 - 파일 폴링 방식으로 통신
           }
       });

       if (process.env.NODE_ENV === 'development') {
           win.loadURL('http://localhost:5173');
           win.webContents.openDevTools();
       } else {
           win.loadFile(path.join(__dirname, '../renderer/index.html'));
       }
   }

   app.whenReady().then(createWindow);

   app.on('window-all-closed', () => {
       if (process.platform !== 'darwin') app.quit();
   });
   ```

3. **Vite 설정**:
   ```typescript
   // vite.config.ts
   import { defineConfig } from 'vite';
   import electron from 'vite-plugin-electron';

   export default defineConfig({
       plugins: [
           electron({
               entry: 'src/main/index.ts',
           }),
       ],
       build: {
           outDir: 'dist/renderer',
       },
   });
   ```

4. **창 레이아웃 계획**:
   - 좌측: CAD Viewer (Canvas 2D)
   - 우측: 채팅 UI
   - 비율: 60:40 또는 70:30

### File Structure Notes

생성 대상 디렉토리:
- `electron-app/` - 새 Electron 앱 프로젝트

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

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
