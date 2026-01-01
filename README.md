# 7-division (도화지)

> **AI-Native CAD** - "AI가 만들고, AI가 사용한다"

AI가 도구를 조작하고, 인간은 의도를 전달하고 결과를 검증하는 새로운 CAD 패러다임.

## Project Status

**현재 단계**: MVP 구현 완료 (Epic 1~5 done, Epic 6 진행 중)

| Epic | 상태 | 설명 |
|------|------|------|
| Epic 1 | ✅ 완료 | 기초 도형 생성 (Line, Circle, Rect, Arc + Style) |
| Epic 2 | ✅ 완료 | 결과 확인 (JSON/SVG Export, Canvas 2D Viewer) |
| Epic 3 | ✅ 완료 | 도형 편집 (Transform, Delete, Tool Use Foundation) |
| Epic 4 | ✅ 완료 | 그룹화 및 피봇 (Group, Pivot, 계층적 변환) |
| Epic 5 | ✅ 완료 | Selection UI (클릭 선택, 하이라이트, AI 전달) |
| Epic 6 | 🚧 진행중 | Electron 통합 (앱 패키징) |

### 주요 성과

- **WASM CAD 엔진**: Rust로 작성된 고성능 CAD 커널
- **Direct-First Architecture**: MCP 없이 Claude Code가 직접 WASM 호출 (< 1ms)
- **실시간 뷰어**: Canvas 2D 기반 polling viewer + selection UI
- **Viewport 캡처**: Puppeteer로 Claude가 직접 뷰어 상태 확인 가능
- **계층적 그룹/피봇**: 복잡한 캐릭터 포즈 편집 지원

## Quick Start

### Prerequisites

| 도구 | 필요 버전 | 설치 확인 |
|------|----------|----------|
| **Rust** | 1.85.0+ (stable) | `rustc --version` |
| **Node.js** | 22.x LTS | `node --version` |
| **wasm-pack** | 0.13.1 | `wasm-pack --version` |

### Installation

```bash
# 1. Rust 설치 (없는 경우)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. WASM 타겟 추가
rustup target add wasm32-unknown-unknown

# 3. wasm-pack 설치 (drager fork v0.13.1)
cargo install --git https://github.com/drager/wasm-pack.git --rev 24bdca457abad34e444912e6165eb71422a51046 --force

# 4. 프로젝트 클론
git clone git@github.com:parktube/7-division.git
cd 7-division
```

### Build & Run

```bash
# 1. CAD Engine 빌드 (WASM)
cd cad-engine
wasm-pack build --target nodejs --release

# 2. TypeScript 도구 설치
cd ../cad-tools
npm install

# 3. Viewer 서버 실행 (selection 지원)
cd ../viewer
node server.cjs
# http://localhost:8000 접속

# 4. CAD CLI 사용
cd ../cad-tools
npx tsx cad-cli.ts draw_circle '{"name":"test","x":0,"y":0,"radius":50}'
npx tsx cad-cli.ts capture_viewport  # 뷰어 스크린샷 캡처
```

## Development Environment

### Tech Stack (Phase 1)

| 컴포넌트 | 기술 | 버전 |
|---------|------|------|
| CAD Engine | Rust | 1.85.0+ (2024 Edition) |
| WASM 빌드 | wasm-pack | 0.13.1 (drager fork) |
| WASM 바인딩 | wasm-bindgen | 0.2.92 |
| 런타임 | Node.js | 22.x LTS |
| 뷰어 | HTML Canvas 2D | - |
| 테스트 | Vitest | 3.x |

### Project Structure (Planned)

```
r2-7f-division/
├── docs/                    # 프로젝트 문서
│   ├── prd.md              # Product Requirements
│   ├── architecture.md     # 아키텍처 설계
│   ├── epics.md            # 에픽 & 스토리 요약
│   └── sprint-artifacts/   # 상세 스토리 파일
│       ├── sprint-status.yaml
│       ├── 1-1-wasm-project-init.md
│       └── ...
├── cad-engine/              # Rust CAD 엔진 (WASM)
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs
│   │   ├── scene/
│   │   ├── primitives/
│   │   ├── transforms/
│   │   └── serializers/
│   └── pkg/                 # WASM 빌드 결과
└── viewer/                  # 브라우저 뷰어
    ├── index.html
    ├── renderer.js
    └── scene.json           # WASM 출력
```

### Environment Check

설치 상태 확인:

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
- Error Lens

## Architecture

### Direct-First Architecture

```
Claude Code CLI (Node.js)
    ↓ WASM 직접 로드 & 실행
Rust CAD 엔진
    ↓ scene.json 출력
브라우저 뷰어 (Canvas 2D)
```

- **MCP 없이** WASM 직접 호출 (< 1ms 지연)
- 브라우저는 순수 **뷰어** 역할만 (검증 UI)
- **오프라인 우선** - 서버 의존 없음

### MVP Scope (Phase 1)

**도형 (Primitives)**
- `line`, `circle`, `rect`, `arc`
- Style: `stroke`, `fill` (RGBA)

**변환 (Transforms)**
- `translate`, `rotate`, `scale`, `delete`
- `set_pivot` - 회전/스케일 중심점 설정

**그룹화 (Groups)**
- `create_group`, `ungroup`
- `add_to_group`, `remove_from_group`
- 계층적 변환 전파

**출력 & 조회**
- `export_json`, `export_svg`
- `list_entities`, `get_entity`, `get_scene_info`
- `get_selection` - 뷰어에서 선택된 도형
- `capture_viewport` - 뷰어 스크린샷 캡처

**뷰어**
- Canvas 2D + 500ms polling
- 클릭 선택 + 바운딩박스 하이라이트
- 그룹 선택 지원

## Documentation

| 문서 | 설명 |
|------|------|
| [PRD](docs/prd.md) | 제품 요구사항 정의 |
| [Architecture](docs/architecture.md) | 기술 아키텍처 설계 |
| [Epics](docs/epics.md) | 에픽 & 스토리 요약 |
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
| Epic 6 | 6 stories | 📝 drafted |

**총 31개 스토리 완료, 6개 대기 중**

## Contributing

자세한 협업 가이드는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

- **BMAD 워크플로우 개요**
- **스토리 기반 개발 방법**
- **Git 컨벤션 & PR 규칙**
- **의존성 맵**

## License

TBD

---

*작성: 2025-12-17 | 최종 업데이트: 2025-12-31*
