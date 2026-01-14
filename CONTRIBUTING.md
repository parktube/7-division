# Contributing Guide

> **협업 리더**: @parktube
> **Repository**: https://github.com/parktube/7-division

**현재 상태**: Epic 1~9 완료 (MVP + 웹 아키텍처)

## Quick Start

### 사용자 (npx로 바로 시작)

```bash
# MCP 서버 시작
npx @ai-native-cad/mcp start

# 웹 Viewer 열기
# → https://parktube.github.io/7-division/
```

### 개발자 (로컬 개발 환경)

```bash
# 1. 저장소 클론
git clone git@github.com:parktube/7-division.git
cd 7-division

# 2. 개발 환경 설정 (또는 npm run setup)
rustup target add wasm32-unknown-unknown
cargo install --git https://github.com/drager/wasm-pack.git --rev 24bdca457abad34e444912e6165eb71422a51046 --force

# 3. 의존성 설치 (pnpm workspace)
pnpm install

# 4. WASM 빌드
pnpm run build:wasm:release

# 5. MCP 서버 + Viewer 개발 모드 (각각 별도 터미널)
pnpm --filter @ai-native-cad/mcp start
pnpm --filter @ai-native-cad/viewer dev
# → http://localhost:5173

# 6. 현재 스프린트 상태 확인
cat docs/sprint-artifacts/sprint-status.yaml
```

### Root 스크립트

| 스크립트 | 설명 |
|---------|------|
| `pnpm run setup` | Rust + wasm-pack 환경 설정 |
| `pnpm run build:wasm:release` | WASM 릴리즈 빌드 |
| `pnpm -r build` | 전체 패키지 빌드 |
| `pnpm run test` | Rust 단위 테스트 |
| `pnpm run test:mcp` | MCP 서버 테스트 |
| `pnpm run lint:rs` | Rust fmt + clippy 검사 |
| `pnpm run lint:ts` | TypeScript ESLint 검사 |

---

## CAD CLI 사용법 (run_cad_code)

AI 에이전트와 개발자 모두 `run_cad_code`를 통해 CAD 도형을 조작합니다.

```bash
cd apps/cad-mcp

# 기본 사용법
npx tsx cad-cli.ts run_cad_code <module> "<code>"

# 예시
run_cad_code main "drawCircle('c1', 0, 0, 50)"
run_cad_code main "+setFill('c1', [1, 0, 0, 1])"  # + prefix = 추가
```

### 주요 Sandbox 함수

| 카테고리 | 함수 | 설명 |
|---------|------|------|
| **Primitives** | `drawCircle`, `drawRect`, `drawLine`, `drawPolygon`, `drawArc`, `drawBezier` | 도형 생성 (중심 좌표 기준) |
| **Text** | `drawText`, `getTextMetrics` | 텍스트 렌더링 (opentype.js) |
| **Style** | `setFill`, `setStroke` | 색상/선 스타일 (RGBA 0~1) |
| **Transform** | `translate`, `rotate`, `scale`, `setPivot`, `duplicate`, `mirror` | 변환 (rotate는 라디안) |
| **Boolean** | `booleanUnion`, `booleanDifference`, `booleanIntersect` | Boolean 연산 (Manifold) |
| **Geometry** | `offsetPolygon`, `getArea`, `convexHull`, `decompose` | 기하 분석 (Manifold) |
| **Z-Order** | `drawOrder`, `getDrawOrder` | 레이어 순서 관리 |
| **Groups** | `createGroup`, `addToGroup` | 그룹화 |
| **Query** | `exists`, `getEntity`, `getWorldBounds`, `fitToViewport` | 조회 |
| **Delete** | `deleteEntity` | 삭제 |

### 예시: 간단한 집 그리기

```bash
# 모듈 생성
run_cad_code house_lib "
class House {
  constructor(name, x, y) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.parts = [];
  }
  drawWall() {
    drawRect(this.name+'_wall', 0, 0, 40, 30);  // 로컬 좌표
    this.parts.push(this.name+'_wall');
  }
  drawRoof() {
    drawPolygon(this.name+'_roof', [-25, 30, 0, 50, 25, 30]);
    this.parts.push(this.name+'_roof');
  }
  build() {
    this.drawWall();
    this.drawRoof();
    createGroup(this.name, this.parts);
    translate(this.name, this.x, this.y);
    return this;
  }
}
"

# main에서 사용
run_cad_code main "
import 'house_lib';
new House('h1', 0, 0).build();
new House('h2', 100, 0).build();
"
```

### 탐색 명령어

```bash
run_cad_code                      # 프로젝트 구조
run_cad_code --status             # 프로젝트 요약
run_cad_code --info house_lib     # 모듈 상세
run_cad_code --search drawCircle  # 패턴 검색
run_cad_code --capture            # 뷰어 스크린샷
```

자세한 명령어는 `CLAUDE.md` 참조.

---

## Viewer 개발 가이드

### React + Vite 구조

```
apps/viewer/
├── src/
│   ├── components/
│   │   ├── Canvas/          # 메인 캔버스 + 스케치 오버레이
│   │   ├── LayerPanel/      # 엔티티 트리 뷰
│   │   ├── InfoPanel/       # 좌표/속성 정보
│   │   ├── TopBar/          # 툴바 (테마, 그리드, 눈금자, 스케치)
│   │   └── StatusBar/       # 상태 표시
│   ├── contexts/            # UIContext, ViewportContext
│   ├── hooks/               # useScene, useWebSocket, useTheme 등
│   └── types/               # TypeScript 타입 정의
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### 개발 서버 실행

```bash
# pnpm workspace 사용
pnpm --filter @ai-native-cad/viewer dev     # http://localhost:5173
pnpm --filter @ai-native-cad/viewer build   # 프로덕션 빌드 (dist/)
```

### 주요 컨텍스트

| Context | 역할 |
|---------|------|
| `UIContext` | 선택, 숨김, 잠금, 스케치 모드, 그리드/눈금자 상태 |
| `ViewportContext` | 줌, 팬, 오프셋 관리 |

### 데이터 연동

- **WebSocket**: MCP 서버(ws://127.0.0.1:3001)와 실시간 동기화
- **데이터 저장**: `~/.ai-native-cad/scene.json`
- **GitHub Pages**: https://parktube.github.io/7-division/

---

## Rust/WASM 빌드 가이드

### 환경 설정

```bash
# 1. Rust 설치 (처음인 경우)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# 2. WASM 타겟 추가
rustup target add wasm32-unknown-unknown

# 3. wasm-pack 설치 (drager fork v0.13.1)
cargo install --git https://github.com/drager/wasm-pack.git --rev 24bdca457abad34e444912e6165eb71422a51046 --force

# 4. 설치 확인
rustc --version        # 1.85.0+
wasm-pack --version    # 0.13.1
```

### 빌드 명령어

```bash
cd cad-engine

# 개발 빌드 (빠름, 디버그 정보 포함)
wasm-pack build --target nodejs --dev

# 릴리즈 빌드 (최적화, 배포용)
wasm-pack build --target nodejs --release

# 빌드 결과물
ls pkg/
# ├── cad_engine.js        # JS wrapper
# ├── cad_engine_bg.wasm   # WASM 바이너리
# ├── cad_engine.d.ts      # TypeScript 타입 정의
# └── package.json
```

---

## BMAD Workflow 개요

이 프로젝트는 **BMAD (BMM Agile Development)** 방법론을 사용합니다.

### BMAD란?

AI 에이전트(Claude Code)와 협업하기 위한 구조화된 개발 방법론입니다.

> **BMAD GitHub**: https://github.com/bmad-code-org/BMAD-METHOD

```
PRD (제품 요구사항)
    ↓
Architecture (기술 설계)
    ↓
Epics & Stories (작업 분해)
    ↓
Sprint Artifacts (상세 스토리 파일)
    ↓
Implementation (구현)
```

### 핵심 문서 구조

```
docs/
├── prd.md                    # 제품 요구사항 정의
├── architecture.md           # 기술 아키텍처
├── epics.md                  # 에픽 & 스토리 요약
└── sprint-artifacts/         # 상세 스토리 파일들
    ├── sprint-status.yaml    # 스프린트 진행 상태
    ├── 1-1-wasm-project-init.md
    └── ...
```

---

## 개발 워크플로우

### 1. 작업할 스토리 선택

```bash
# sprint-status.yaml에서 ready-for-dev 상태인 스토리 확인
cat docs/sprint-artifacts/sprint-status.yaml | grep -A2 "ready-for-dev"
```

### 2. 브랜치 생성

```bash
# 네이밍 규칙: feature/story-{에픽번호}-{스토리번호}-{설명}
git checkout -b feature/story-8-1-new-feature
```

### 3. 구현 & PR

```bash
git add .
git commit -m "feat: Story 8.1 - 새 기능 구현"
git push -u origin feature/story-8-1-new-feature

# PR 생성
gh pr create --title "feat: Story 8.1 - 새 기능" --body "..."
```

---

## Git 컨벤션

### 브랜치 네이밍

| 타입 | 패턴 | 예시 |
|------|------|------|
| 기능 | `feature/story-{번호}-{설명}` | `feature/story-8-1-bezier` |
| 버그 | `fix/{설명}` | `fix/z-order-bug` |
| 문서 | `docs/{설명}` | `docs/api-guide` |

### 커밋 메시지

```
<type>: <subject>

# 타입
feat:     새 기능
fix:      버그 수정
docs:     문서 변경
refactor: 리팩토링
test:     테스트 추가
chore:    빌드/설정 변경
```

### PR 규칙

- 1 Story = 1 PR (가능한 경우)
- 리뷰어: @parktube
- 머지 전 CI 통과 필수

---

## 테스트 가이드

### Rust/WASM 테스트

```bash
cd cad-engine
cargo test                    # 모든 테스트
cargo test test_add_line      # 특정 테스트
cargo clippy -- -D warnings   # Lint
cargo fmt --check             # 포맷 검사
```

### TypeScript 테스트

```bash
# MCP 서버 테스트
pnpm --filter @ai-native-cad/mcp test

# 또는 직접 실행
cd apps/cad-mcp
pnpm test           # Vitest 실행
pnpm lint           # ESLint 검사
pnpm typecheck      # TypeScript 타입 검사
```

### Pre-commit Hook (자동)

Root에서 `pnpm install` 실행 시 husky가 자동 설정됩니다.

| 파일 타입 | 실행 명령어 |
|----------|------------|
| `cad-engine/**/*.rs` | `cargo fmt` |
| `apps/cad-mcp/src/**/*.ts` | `eslint --fix` |

---

## CI/CD 파이프라인

`.github/workflows/ci.yml` - main 브랜치 push/PR 시 자동 실행

```
[rust] → fmt, clippy, test, wasm-pack build
    ↓
[typescript] → lint, typecheck, test
    ↓
[integration] → WASM 통합 테스트
```

---

## Claude Code 사용 (선택)

```bash
# 설치
npm install -g @anthropic-ai/claude-code

# 유용한 슬래시 커맨드
/bmad:bmm:workflows:dev-story      # 스토리 구현
/bmad:bmm:workflows:code-review    # 코드 리뷰
/bmad:bmm:workflows:sprint-status  # 스프린트 상태
```

---

## 질문 & 이슈

- **기술 질문**: GitHub Issues 생성
- **프로젝트 방향**: @parktube (협업 리더)

---

## 참고 자료

| 문서 | 설명 |
|------|------|
| [PRD](docs/prd.md) | 제품 요구사항 |
| [Architecture](docs/architecture.md) | 기술 설계 |
| [Epics](docs/epics.md) | 전체 스토리 목록 |
| [AX Guide](docs/ax-design-guide.md) | AI 에이전트 설계 원칙 |

---

*최종 업데이트: 2026-01-14*
