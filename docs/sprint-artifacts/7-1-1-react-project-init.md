# Story 7.1.1: React 프로젝트 초기화

Status: done

## Story

As a **개발자**,
I want **viewer/ 디렉토리에 React + TypeScript + Vite 프로젝트가 셋업되기를**,
so that **Epic 7 구현을 위한 기반이 마련된다**.

## Acceptance Criteria

1. **AC1**: viewer/에서 `npm run dev` 실행 시 localhost:5173에서 React 앱 렌더링
2. **AC2**: TailwindCSS가 적용된 기본 스타일 확인 가능
3. **AC3**: `npm run typecheck` 통과 (TypeScript 에러 없음)
4. **AC4**: 기존 파일 (scene.json, selection.json, .cad-modules/) 그대로 유지
5. **AC5**: 레거시 파일 (index.html, renderer.js) → legacy/ 폴더로 백업

## Tasks / Subtasks

- [x] Task 1: 레거시 파일 백업 (AC: #5)
  - [x] viewer/legacy/ 디렉토리 생성
  - [x] index.html, renderer.js → legacy/로 이동
  - [x] server.cjs, test-query.html → legacy/로 이동

- [x] Task 2: package.json 생성 (AC: #1)
  - [x] npm init -y 실행
  - [x] 의존성 추가: react, react-dom
  - [x] devDependencies 추가: vite, @vitejs/plugin-react, typescript, @types/react, @types/react-dom
  - [x] scripts 설정: dev, build, typecheck, preview

- [x] Task 3: Vite 설정 (AC: #1)
  - [x] vite.config.ts 생성
  - [x] @vitejs/plugin-react 플러그인 추가
  - [x] base URL, build output 설정

- [x] Task 4: TypeScript 설정 (AC: #3)
  - [x] tsconfig.json 생성 (strict mode)
  - [x] tsconfig.node.json 생성
  - [x] path alias 설정 (@/ → src/)

- [x] Task 5: TailwindCSS 4.x 설정 (AC: #2)
  - [x] tailwindcss, @tailwindcss/vite 설치
  - [x] vite.config.ts에 tailwindcss() 플러그인 추가
  - [x] src/styles/globals.css에 @import "tailwindcss" 추가

- [x] Task 6: React 앱 기본 구조 (AC: #1)
  - [x] index.html 생성 (React 진입점)
  - [x] src/main.tsx 생성 (ReactDOM.createRoot)
  - [x] src/App.tsx 생성 (기본 레이아웃 플레이스홀더)

- [x] Task 7: 동작 검증 (AC: #1, #2, #3)
  - [x] npm install 실행
  - [x] npm run dev로 localhost:5173 확인
  - [x] TailwindCSS 유틸리티 클래스 동작 확인
  - [x] npm run typecheck 통과 확인

## Dev Notes

### 기존 viewer/ 상태

현재 viewer/ 디렉토리에 존재하는 파일:
```
viewer/
├── .cad-modules/     # 유지 (cad-tools 모듈)
├── .cad-state.json   # 유지
├── capture.png       # 유지 (runtime 생성)
├── index.html        # → legacy/로 이동
├── renderer.js       # → legacy/로 이동 (포팅 참고용)
├── scene.code.js     # 유지 (runtime 생성)
├── scene.json        # 유지 (WASM 출력)
├── scene.svg         # 유지 (runtime 생성)
├── selection.json    # 유지 (선택 상태)
├── server.cjs        # → legacy/로 이동
└── test-query.html   # → legacy/로 이동
```

### 기술 스택 버전 (필수 준수)

| 기술 | 버전 | 비고 |
|------|------|------|
| React | 19.2+ | [React Versions](https://react.dev/versions) |
| TypeScript | 5.7+ | strict mode |
| Vite | 7.3+ | Node 20.19+ 필요 |
| TailwindCSS | 4.x | @tailwindcss/vite 플러그인 사용 |

[Source: docs/architecture.md#Tech Stack]

### TailwindCSS 4.x 설치 방식 (중요!)

TailwindCSS 4.x는 설치 방식이 v3와 다름:

```bash
# 설치
npm install tailwindcss @tailwindcss/vite

# vite.config.ts
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(), tailwindcss()]
})

# globals.css (기존 directives 대신)
@import "tailwindcss";
```

**주의**: tailwind.config.js, postcss.config.js 불필요 (CSS-first 설정)

### Project Structure Notes

최종 디렉토리 구조:
```
viewer/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── index.html           # React 진입점 (새로 생성)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   └── styles/
│       └── globals.css
├── legacy/              # 백업 (삭제 예정)
│   ├── index.html
│   ├── renderer.js
│   ├── server.cjs
│   └── test-query.html
├── .cad-modules/        # 기존 유지
├── scene.json           # 기존 유지
├── selection.json       # 기존 유지
└── ...
```

[Source: docs/architecture.md#Project Structure]

### package.json 설정

```json
{
  "name": "viewer",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^4.4.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^7.3.0"
  }
}
```

### vite.config.ts 설정

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
```

### tsconfig.json 설정

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

### 기본 App.tsx 구조

```tsx
// src/App.tsx
export default function App() {
  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">AI-Native CAD</h1>
        <p className="text-gray-400">Epic 7: Viewer UI 리디자인</p>
        <p className="text-sm text-gray-500 mt-2">React + TypeScript + Vite + TailwindCSS 4.x</p>
      </div>
    </div>
  )
}
```

### Anti-Patterns (금지)

```typescript
// ❌ TailwindCSS 3.x 스타일 설정 사용 금지
// tailwind.config.js, postcss.config.js 생성하지 말 것

// ❌ 기존 3.x directives 사용 금지
// @tailwind base;
// @tailwind components;
// @tailwind utilities;

// ❌ CRA(create-react-app) 사용 금지

// ❌ 레거시 파일 삭제 금지 (백업 필수)
```

### References

- [docs/architecture.md#Tech Stack] - 버전 정보
- [docs/architecture.md#Project Structure] - 디렉토리 구조
- [docs/architecture.md#초기화 명령어] - npm 명령어
- [TailwindCSS v4 Vite Plugin](https://tailwindcss.com/blog/tailwindcss-v4) - 설치 가이드
- [Vite + React + TypeScript Setup 2025](https://medium.com/@osamajavaid/setting-up-react-19-with-tailwind-css-v4-using-vite-in-just-two-steps-3748f55b06fd)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- viewer/package.json (new)
- viewer/vite.config.ts (new)
- viewer/tsconfig.json (new)
- viewer/tsconfig.node.json (new)
- viewer/index.html (new)
- viewer/src/main.tsx (new)
- viewer/src/App.tsx (new)
- viewer/src/styles/globals.css (new)
- viewer/legacy/ (backup directory)
