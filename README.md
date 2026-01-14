# 7-division (도화지)

> **AI-Native CAD** - "AI가 만들고, AI가 사용한다"

AI가 도구를 조작하고, 인간은 의도를 전달하고 결과를 검증하는 새로운 CAD 패러다임.

## Project Status

**현재 단계**: MVP + 기하 엔진 통합 (Epic 1~8)

| Epic | 상태 | 설명 |
|------|------|------|
| Epic 1 | ✅ 완료 | 기초 도형 생성 (Line, Circle, Rect, Arc + Style) |
| Epic 2 | ✅ 완료 | 결과 확인 (JSON/SVG Export, Canvas 2D Viewer) |
| Epic 3 | ✅ 완료 | 도형 편집 (Transform, Delete, Tool Use Foundation) |
| Epic 4 | ✅ 완료 | 그룹화 및 피봇 (Group, Pivot, 계층적 변환) |
| Epic 5 | ✅ 완료 | Selection UI (클릭 선택, 하이라이트, AI 전달) |
| Epic 6 | ✅ 완료 | Electron 통합 (현재 Web 아키텍처로 전환) |
| Epic 7 | ✅ 완료 | Viewer UI 리디자인 (React + 스케치 모드 + Z-Order) |
| Epic 8 | ✅ 완료 | LLM DX 개선 (트랜잭션, 스케치 클리어, 자동 스케일) |
| Epic 9 | ✅ 완료 | 웹 아키텍처 전환 (GitHub Pages + npm MCP) |

### 주요 성과

- **WASM CAD 엔진**: Rust로 작성된 고성능 CAD 커널
- **Direct-First Architecture**: MCP 없이 Claude Code가 직접 WASM 호출 (< 1ms)
- **Manifold 기하 엔진**: Boolean 연산, 기하 분석 (offset, area, convexHull)
- **텍스트 렌더링**: opentype.js 기반 베지어 경로 변환 (한글/영문)
- **React 기반 Viewer**: 3-패널 레이아웃, 다크/라이트 테마, 리사이즈 가능
- **스케치 모드**: 펜/지우개 도구로 의도 표현, LLM과 협업
- **Z-Order 관리**: drawOrder API로 레이어 순서 제어
- **Dual Coordinate API**: local/world 좌표계 동시 지원
- **웹 아키텍처**: GitHub Pages + 로컬 MCP 서버
- **LLM DX 개선**: 트랜잭션 롤백, 스케치 자동 클리어

## Viewer 사용법

### 마우스 조작

| 동작 | 설명 |
|------|------|
| **휠 스크롤** | 커서 위치 기준 줌 인/아웃 |
| **Space + 드래그** | 캔버스 팬 (이동) |
| **클릭** | 엔티티 선택 |
| **Cmd/Ctrl + 클릭** | 다중 선택 |

### 키보드 단축키

| 키 | 설명 |
|----|------|
| **Escape** | 선택 해제 / 스케치 모드 종료 |
| **P** (스케치 모드) | 펜 도구 |
| **E** (스케치 모드) | 지우개 도구 |

### 툴바 기능

| 버튼 | 기능 |
|------|------|
| **테마 토글** | 다크/라이트 모드 전환 |
| **그리드** | 배경 그리드 표시/숨김 |
| **눈금자** | 상단/좌측 눈금자 표시/숨김 |
| **스케치** | 스케치 모드 진입 (펜으로 의도 표현) |

### 레이어 패널

- **눈 아이콘**: 엔티티 숨기기/보이기
- **자물쇠 아이콘**: 엔티티 잠금 (LLM 수정 시 경고)
- **그룹 화살표**: 하위 엔티티 펼치기/접기

### 스케치 모드

1. 툴바에서 스케치 버튼 클릭
2. **펜 (P)**: 빨간색 선으로 의도 표현
3. **지우개 (E)**: 스케치 지우기
4. **휴지통**: 모든 스케치 삭제
5. **Escape**: 스케치 모드 종료

스케치는 `sketch.json`에 저장되어 LLM이 읽을 수 있습니다.

## Quick Start

### 사용자 (npx로 바로 시작)

```bash
# 1. MCP 서버 시작
npx @ai-native-cad/mcp start

# 2. 웹 Viewer 열기
# → https://parktube.github.io/7-division/
```

> MCP 서버가 로컬에서 실행되면 웹 Viewer와 자동 연결됩니다.

### 개발자 (로컬 개발 환경)

**Prerequisites:**

| 도구 | 필요 버전 | 설치 확인 |
|------|----------|----------|
| **Rust** | 1.85.0+ (stable) | `rustc --version` |
| **Node.js** | 22.x LTS | `node --version` |
| **pnpm** | 9.x+ | `pnpm --version` |
| **wasm-pack** | 0.13.1 | `wasm-pack --version` |

**Installation:**

```bash
# 1. Rust & WASM 타겟 설치
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# 2. wasm-pack 설치 (drager fork)
cargo install --git https://github.com/drager/wasm-pack.git --rev 24bdca457abad34e444912e6165eb71422a51046 --force

# 3. 프로젝트 클론 & 설치
git clone git@github.com:parktube/7-division.git
cd 7-division
pnpm install
```

**Build & Run:**

```bash
# WASM 빌드
pnpm run build:wasm:release

# 전체 빌드
pnpm -r build

# MCP 서버 + Viewer 개발 모드 (각각 별도 터미널)
pnpm --filter @ai-native-cad/mcp start
pnpm --filter @ai-native-cad/viewer dev
# → http://localhost:5173
```

## Development Environment

### Tech Stack

| 컴포넌트 | 기술 | 버전 |
|---------|------|------|
| CAD Engine | Rust | 1.85.0+ (2024 Edition) |
| WASM 빌드 | wasm-pack | 0.13.1 (drager fork) |
| WASM 바인딩 | wasm-bindgen | 0.2.92 |
| 런타임 | Node.js | 22.x LTS |
| Viewer | React | 19.x |
| 빌드 도구 | Vite | 7.x |
| 스타일링 | TailwindCSS | 4.x |
| 상태관리 | React Context | - |
| MCP Server | Node.js + WebSocket | - |
| 테스트 | Vitest | 3.x |

### Project Structure

```
7-division/
├── apps/
│   ├── viewer/             # React 웹 뷰어 (GitHub Pages)
│   │   └── src/
│   │       ├── components/ # Canvas, LayerPanel, InfoPanel 등
│   │       ├── contexts/   # UIContext, ViewportContext
│   │       ├── hooks/      # useWebSocket, useScene 등
│   │       └── types/      # TypeScript 타입 정의
│   └── cad-mcp/            # MCP 서버 (npm 패키지)
│       └── src/
│           ├── cli.ts      # CAD CLI 진입점
│           ├── ws-server.ts # WebSocket 서버
│           └── mcp-server.ts # MCP stdio 서버
├── packages/
│   └── shared/             # 공유 타입 (WebSocket 메시지 등)
├── cad-engine/             # Rust CAD 엔진 (WASM)
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       └── scene/          # Entity, Transform, Z-Order 등
├── docs/                   # 프로젝트 문서
│   ├── prd.md             # Product Requirements
│   ├── architecture.md    # 아키텍처 설계
│   └── epics.md           # 에픽 & 스토리 요약
└── pnpm-workspace.yaml    # 모노레포 설정
```

### Environment Check

```bash
echo "Rust: $(rustc --version 2>/dev/null || echo 'Not installed')"
echo "Node: $(node --version 2>/dev/null || echo 'Not installed')"
echo "wasm-pack: $(wasm-pack --version 2>/dev/null || echo 'Not installed')"
rustup target list --installed | grep wasm || echo "WASM target not installed"
```

### IDE Setup

**VS Code 권장 확장:**
- rust-analyzer
- Even Better TOML
- ESLint
- Tailwind CSS IntelliSense

## Architecture

### Web + Local MCP Architecture

```
GitHub Pages (Viewer)          Local MCP Server
       │                              │
       │ WebSocket (ws://127.0.0.1:3001)
       └──────────────────────────────┘
                     │
              scene/selection 동기화
                     │
               Claude Code CLI
                     │ WASM 직접 호출
               Rust CAD 엔진
```

- **브라우저 Viewer**: GitHub Pages에서 호스팅, WebSocket으로 MCP 서버와 통신
- **로컬 MCP 서버**: WASM 엔진 실행, scene/selection 데이터 제공
- **Claude Code**: MCP 서버를 통해 CAD 도구 사용
- **오프라인 우선**: 모든 연산은 로컬에서 실행 (< 1ms 지연)

### MVP Features

**도형 (Primitives)**
- `line`, `circle`, `rect`, `arc`, `polygon`, `bezier`
- Style: `stroke`, `fill` (RGBA)
- `drawText` - 텍스트를 베지어 경로로 변환 (opentype.js)

**변환 (Transforms)**
- `translate`, `rotate`, `scale`, `delete`
- `set_pivot` - 회전/스케일 중심점 설정
- Dual Coordinate: `{ space: 'world' | 'local' }`
- `duplicate`, `mirror` - 엔티티 복제/대칭 복제

**그룹화 (Groups)**
- `create_group`, `add_to_group`
- 계층적 변환 전파

**Boolean 연산 (Manifold)**
- `booleanUnion`, `booleanDifference`, `booleanIntersect`
- 지원 도형: Circle, Rect, Polygon, Arc

**기하 분석 (Manifold)**
- `offsetPolygon` - 폴리곤 확장/축소
- `getArea` - 면적 계산
- `convexHull` - 볼록 껍질 생성
- `decompose` - 분리된 컴포넌트 추출

**Z-Order**
- `drawOrder('entity', 'front' | 'back' | N | 'above:target')`
- 스코프별 자동 정규화

**출력 & 조회**
- `export_json`, `export_svg`
- `getEntity` - local/world 좌표 모두 반환
- `getDrawOrder` - 레이어 순서 조회
- `capture_viewport` - 뷰어 스크린샷
- `fitToViewport` - 자동 스케일 계산

**LLM DX 개선**
- 트랜잭션 패턴: 실행 실패 시 자동 롤백
- `--clear-sketch` 플래그: 스케치 자동 클리어
- 추가 모드에서 기존 변수 참조 가능

**도메인 구조** (describe <domain>으로 상세 확인)
```
📦 도형 생성
  primitives  - 기본 도형 (circle, rect, line, arc, polygon, bezier)
  text        - ⭐ 텍스트 렌더링 (drawText, getTextMetrics)

🔄 도형 조작
  transforms  - 변환 (translate, rotate, scale, pivot, duplicate, mirror)
  boolean     - ⭐ 합치기/빼기 (union, difference, intersect)
  geometry    - ⭐ 기하 분석 (offset, area, convexHull, decompose)

🎨 스타일 & 구조
  style       - 색상/z-order (fill, stroke, drawOrder)
  group       - 그룹화 (createGroup, addToGroup)

🔍 조회 & 내보내기
  query       - 씬 조회 (getEntity, exists, fitToViewport)
  export      - 내보내기 (capture, json, svg)
  session     - 세션 관리 (reset, --clear-sketch)
```

**뷰어**
- React 3-패널 레이아웃 (Layer Panel | Canvas | Info Panel)
- 다크/라이트 테마
- 스케치 모드 (펜/지우개)
- 휠 줌, Space+드래그 팬
- 그리드/눈금자 토글

## Documentation

| 문서 | 설명 |
|------|------|
| [CHANGELOG](CHANGELOG.md) | 버전별 변경사항 |
| [PRD](docs/prd.md) | 제품 요구사항 정의 |
| [Architecture](docs/architecture.md) | 기술 아키텍처 설계 |
| [Epics](docs/epics.md) | 에픽 & 스토리 요약 |
| [ADR-006](docs/adr/006-geometry-engine.md) | Manifold 기하 엔진 결정 |
| [AI-Native CAD 제안서](docs/ai-native-cad-proposal.md) | 프로젝트 비전 |
| [AX 설계 가이드](docs/ax-design-guide.md) | Agent eXperience 원칙 |

## Sprint Status

현재 스프린트 상태: `docs/sprint-artifacts/sprint-status.yaml`

| Epic | Stories | 상태 |
|------|---------|------|
| Epic 1 | 9 stories | ✅ done |
| Epic 2 | 3 stories | ✅ done |
| Epic 3 | 10 stories | ✅ done |
| Epic 4 | 6 stories | ✅ done |
| Epic 5 | 3 stories | ✅ done |
| Epic 6 | 6 stories | ✅ done |
| Epic 7 | 17 stories | ✅ done |
| Epic 8 | 4 stories | ✅ done |
| Epic 9 | 10 stories | ✅ done |

**총 68개 스토리 완료**

## Contributing

자세한 협업 가이드는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

- **BMAD 워크플로우 개요**
- **스토리 기반 개발 방법**
- **Git 컨벤션 & PR 규칙**

## License

MIT

---

*작성: 2025-12-17 | 최종 업데이트: 2026-01-14*
