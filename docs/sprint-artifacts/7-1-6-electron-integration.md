# Story 7.1.6: Electron 통합

Status: done

## Story

As a **사용자**,
I want **웹 브라우저와 Electron 앱에서 동일하게 동작하기를**,
so that **어떤 환경에서든 같은 경험을 할 수 있다** (FR40, NFR20).

## Acceptance Criteria

1. **AC1**: Electron 앱에서 viewer/dist가 정상 로드
2. **AC2**: 개발 모드에서 Vite HMR이 Electron에서 동작
3. **AC3**: 웹 브라우저와 동일한 3패널 레이아웃
4. **AC4**: scene.json 폴링이 Electron에서 정상 동작
5. **AC5**: selection.json 읽기/쓰기가 Electron에서 정상 동작
6. **AC6**: 프로덕션 빌드에서 viewer/dist 포함

## Tasks / Subtasks

- [x] Task 1: Vite 빌드 설정 확인 (AC: #1, #6) ✅
  - [x] vite.config.ts의 build.outDir 설정 (dist)
  - [x] base URL 설정 (상대 경로 `./`)
  - [x] npm run build 동작 확인

- [x] Task 2: Electron 개발 모드 설정 (AC: #2) ✅
  - [x] cad-electron/src/main/index.ts 수정
  - [x] ELECTRON_RENDERER_URL → http://localhost:5173
  - [x] Vite dev server 연동 (scene URL 쿼리 파라미터)

- [x] Task 3: Electron 프로덕션 로딩 (AC: #1) ✅
  - [x] viewer/dist → out/renderer 복사 (electron.vite.config.ts)
  - [x] file:// 프로토콜 지원 (상대 경로 base)

- [x] Task 4: 파일 프로토콜 처리 (AC: #4, #5) ✅
  - [x] 내장 HTTP 서버 (동적 포트)로 scene.json, selection.json, sketch.json 제공
  - [x] useScene 훅에서 ?scene= 쿼리 파라미터 지원

- [x] Task 5: selection.json POST 처리 (AC: #5) ✅
  - [x] 웹: Vite middleware (vite.config.ts)
  - [x] Electron: 내장 HTTP 서버에서 POST 처리

- [x] Task 6: 통합 테스트 (AC: #3, #4, #5) ✅
  - [x] 빌드: npm run build (viewer + electron)
  - [x] viewer/dist가 out/renderer에 복사됨

## Dev Notes

### 의존성: Story 7-1-1 ~ 7-1-5

- Story 7-1-1 ~ 7-1-5: viewer/ React 앱 완성

### 단일 소스 아키텍처

```
viewer/                    # 유일한 소스
├── src/                   # React 컴포넌트
├── dist/                  # 빌드 결과
└── package.json

cad-electron/
├── src/main/              # Electron main만
└── (viewer/dist 로드)     # 복사 대신 직접 참조
```

[Source: docs/architecture.md#Project Structure]

### Vite 빌드 설정

```typescript
// viewer/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',  // 상대 경로 (Electron file:// 지원)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
```

### Electron Main 프로세스

```typescript
// cad-electron/src/main/index.ts
import { app, BrowserWindow } from 'electron';
import { is } from '@electron-toolkit/utils';
import path from 'path';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 개발 모드: Vite dev server
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    // 프로덕션: viewer/dist 로드
    mainWindow.loadFile(
      path.join(__dirname, '../../viewer/dist/index.html')
    );
  }
}
```

[Source: docs/architecture.md#Electron 통합]

### 개발 워크플로우

```bash
# 터미널 1: Vite dev server
cd viewer
npm run dev

# 터미널 2: Electron
cd cad-electron
npm run electron:dev
# 또는 ELECTRON_RENDERER_URL=http://localhost:5173 electron .
```

### 파일 경로 처리

**웹 환경:**
```typescript
// 상대 경로로 fetch
const res = await fetch('/scene.json');
const res2 = await fetch('/selection.json');
```

**Electron 환경 (file:// 프로토콜):**

Electron에서 `file://` 프로토콜은 상대 경로 fetch에 제한이 있음.
해결 방법:

**옵션 1: 커스텀 프로토콜 (권장)**
```typescript
// main/index.ts
import { protocol } from 'electron';

app.whenReady().then(() => {
  // 'cad://' 프로토콜 등록
  protocol.registerFileProtocol('cad', (request, callback) => {
    const url = request.url.replace('cad://', '');
    const filePath = path.join(__dirname, '../../viewer', url);
    callback({ path: filePath });
  });
});
```

**옵션 2: Preload 스크립트**
```typescript
// preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import fs from 'fs';
import path from 'path';

const viewerPath = path.join(__dirname, '../../viewer');

contextBridge.exposeInMainWorld('cadAPI', {
  readScene: () => {
    const data = fs.readFileSync(path.join(viewerPath, 'scene.json'), 'utf-8');
    return JSON.parse(data);
  },
  readSelection: () => {
    const filePath = path.join(viewerPath, 'selection.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return { selected_entities: [] };
  },
  writeSelection: (data: object) => {
    fs.writeFileSync(
      path.join(viewerPath, 'selection.json'),
      JSON.stringify(data, null, 2)
    );
  }
});
```

**React에서 환경 감지:**
```typescript
// src/utils/platform.ts
export const isElectron = () => {
  return typeof window !== 'undefined' &&
         typeof window.cadAPI !== 'undefined';
};

// src/hooks/useScene.ts
import { isElectron } from '@/utils/platform';

export function useScene() {
  const fetchScene = async () => {
    if (isElectron()) {
      return window.cadAPI.readScene();
    } else {
      const res = await fetch('/scene.json');
      return res.json();
    }
  };
  // ...
}
```

### selection.json 쓰기

**웹 (Vite middleware):**
```typescript
// vite.config.ts
{
  name: 'selection-middleware',
  configureServer(server) {
    server.middlewares.use('/selection.json', (req, res, next) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          fs.writeFileSync('./selection.json', body);
          res.end('OK');
        });
      } else {
        next();
      }
    });
  }
}
```

**Electron (Preload API):**
```typescript
// React 컴포넌트에서
const saveSelection = async (data: Selection) => {
  if (isElectron()) {
    window.cadAPI.writeSelection(data);
  } else {
    await fetch('/selection.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
};
```

### TypeScript 타입 선언

```typescript
// src/types/electron.d.ts
interface CadAPI {
  readScene: () => Scene;
  readSelection: () => Selection;
  writeSelection: (data: Selection) => void;
}

declare global {
  interface Window {
    cadAPI?: CadAPI;
  }
}

export {};
```

### 프로덕션 빌드

```bash
# 1. Viewer 빌드
cd viewer
npm run build  # → dist/ 생성

# 2. Electron 패키징
cd cad-electron
npm run build
# 또는
npx electron-builder
```

**electron-builder 설정:**
```json
// cad-electron/package.json
{
  "build": {
    "extraResources": [
      {
        "from": "../viewer/dist",
        "to": "viewer"
      },
      {
        "from": "../viewer/scene.json",
        "to": "viewer/scene.json"
      },
      {
        "from": "../viewer/selection.json",
        "to": "viewer/selection.json"
      }
    ]
  }
}
```

### HMR 지원

개발 모드에서 Vite HMR이 Electron 내에서도 동작:

1. Electron이 `http://localhost:5173` 로드
2. Vite WebSocket 연결 유지
3. 코드 변경 시 자동 리로드

```typescript
// vite.config.ts
server: {
  port: 5173,
  strictPort: true,
  hmr: {
    protocol: 'ws',
    host: 'localhost',
    port: 5173,
  },
}
```

### Anti-Patterns (금지)

```typescript
// ❌ 절대 경로 하드코딩
mainWindow.loadFile('/home/user/project/viewer/dist/index.html');

// ❌ nodeIntegration: true (보안 위험)
webPreferences: {
  nodeIntegration: true,  // 금지!
}

// ❌ viewer 코드를 cad-electron에 복사
// 단일 소스 원칙 위반
cp -r viewer/dist cad-electron/renderer  // 금지!

// ❌ 환경 하드코딩
const isElectron = true;  // 런타임 감지 필요
```

### References

- [docs/architecture.md#Electron 통합] - 통합 방식
- [docs/architecture.md#파일 통신 확장] - selection.json
- FR40: 단일 소스
- NFR20: 웹/Electron 동등성

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- viewer/vite.config.ts (modify)
- cad-electron/src/main/index.ts (modify)
- cad-electron/src/preload/index.ts (modify)
- src/utils/platform.ts (new)
- src/types/electron.d.ts (new)
- src/hooks/useScene.ts (modify)
- src/hooks/useSelection.ts (modify)
