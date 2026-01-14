# Story 9.5: GitHub Pages 배포

Status: drafted

## Story

As a **사용자**,
I want **GitHub Pages에서 Viewer에 접근할 수 있기를**,
so that **앱 설치 없이 브라우저만으로 CAD를 사용할 수 있다** (FR55).

## Acceptance Criteria

1. **Given** apps/viewer가 빌드될 때
   **When** GitHub Actions가 실행되면
   **Then** 정적 파일이 GitHub Pages에 배포된다
   **And** https://parktube.github.io/7-division/ 에서 접근 가능하다

2. **Given** Viewer가 로드될 때
   **When** MCP 서버가 연결되지 않은 상태면
   **Then** 온보딩 UI가 표시된다 (Story 9.7 의존)

3. **Given** 새 커밋이 main 브랜치에 푸시될 때
   **When** CI가 통과하면
   **Then** 자동으로 재배포된다

4. **Given** 배포된 Viewer를 브라우저에서 열 때
   **When** 새로고침하면
   **Then** 캐시 무효화로 최신 버전이 로드된다

## Tasks / Subtasks

- [ ] Task 1: Vite 빌드 설정 (AC: #1)
  - [ ] 1.1 apps/viewer/vite.config.ts에 base path 설정 (/7-division/)
  - [ ] 1.2 빌드 출력 디렉토리 확인 (dist/)
  - [ ] 1.3 정적 자산 경로 확인 (WASM 파일 등)

- [ ] Task 2: GitHub Actions 워크플로우 생성 (AC: #1, #3)
  - [ ] 2.1 .github/workflows/deploy-viewer.yml 생성
  - [ ] 2.2 main 브랜치 push 트리거 설정
  - [ ] 2.3 pnpm setup step 추가
  - [ ] 2.4 빌드 step (pnpm --filter @ai-native-cad/viewer build)
  - [ ] 2.5 GitHub Pages 배포 step (actions/deploy-pages)

- [ ] Task 3: GitHub Pages 설정 (AC: #1)
  - [ ] 3.1 Repository Settings → Pages → Source 설정
  - [ ] 3.2 GitHub Actions 소스 선택
  - [ ] 3.3 배포 확인 (https://parktube.github.io/7-division/)

- [ ] Task 4: 캐시 무효화 전략 (AC: #4)
  - [ ] 4.1 Vite 빌드 파일명에 해시 포함 확인
  - [ ] 4.2 index.html 캐시 헤더 설정 (no-cache 또는 짧은 max-age)
  - [ ] 4.3 서비스 워커 캐시 전략 검토 (필요시)

- [ ] Task 5: WASM 파일 처리 (AC: #1)
  - [ ] 5.1 WASM 파일 빌드 출력 경로 확인
  - [ ] 5.2 GitHub Pages에 WASM MIME 타입 지원 확인
  - [ ] 5.3 WASM 로드 경로 수정 (상대 → base path 적용)

- [ ] Task 6: 배포 검증 (AC: #1~#4)
  - [ ] 6.1 수동 배포 테스트 (workflow_dispatch)
  - [ ] 6.2 배포된 URL 접근 확인
  - [ ] 6.3 WASM 로드 동작 확인
  - [ ] 6.4 MCP 미연결 시 온보딩 UI 확인 (Story 9.7 이후)

## Dev Notes

### Architecture Compliance

**Source:** [docs/architecture.md Part 2.5]

| 컴포넌트 | 배포 위치 | 방법 |
|---------|----------|------|
| Viewer | GitHub Pages | `gh-pages` 브랜치 자동 배포 |
| MCP | npm registry | `@ai-native-cad/mcp` 패키지 (Story 9.6) |

### Technical Requirements

**GitHub Actions 워크플로우:**

```yaml
# .github/workflows/deploy-viewer.yml
name: Deploy Viewer to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build Viewer
        run: pnpm --filter @ai-native-cad/viewer build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./apps/viewer/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**Vite 설정:**

```typescript
// apps/viewer/vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/7-division/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // 해시 포함 파일명
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
```

### File Structure

```
.github/workflows/
└── deploy-viewer.yml     # GitHub Pages 배포 워크플로우

apps/viewer/
├── vite.config.ts        # base path 설정
├── dist/                 # 빌드 출력 (gitignore)
└── public/
    └── cad_engine_bg.wasm  # WASM 파일 (있다면)
```

### Dependencies

- **선행 스토리**: Story 9.1 (모노레포 구조)
- **후행 스토리**: Story 9.7 (온보딩 UI - MCP 미연결 시)

### GitHub Pages 설정

1. Repository Settings → Pages
2. Source: GitHub Actions
3. Custom domain: (선택사항)

### WASM 고려사항

| 항목 | 설정 |
|------|------|
| MIME 타입 | application/wasm (GitHub Pages 기본 지원) |
| 파일 위치 | public/ 또는 빌드 시 복사 |
| 로드 경로 | base path 포함 (/7-division/cad_engine_bg.wasm) |

### Potential Risks

| 위험 | 완화 전략 |
|------|----------|
| WASM 로드 실패 | 빌드 시 경로 확인, CORS 불필요 (same-origin) |
| 캐시 문제 | 해시 파일명 + index.html no-cache |
| 빌드 실패 | CI에서 타입 체크, 테스트 통과 확인 |
| base path 누락 | vite.config.ts 설정 검증 |

### Testing Requirements

**로컬 테스트:**
```bash
cd apps/viewer
pnpm build
pnpm preview --base /7-division/
# → http://localhost:4173/7-division/
```

**배포 후 테스트:**
```bash
# URL 접근 확인
curl -I https://parktube.github.io/7-division/

# WASM 로드 확인 (브라우저 DevTools Network 탭)
```

### References

- [Source: docs/architecture.md#2.5] - Deployment Strategy
- [Source: docs/epics.md#Story-9.5] - Story 정의 및 AC
- [GitHub Pages Docs] - actions/deploy-pages 사용법

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

