# 7-division (도화지)

> **AI-Native CAD** - "AI가 만들고, AI가 사용한다"

AI가 도구를 조작하고, 인간은 의도를 전달하고 결과를 검증하는 새로운 CAD 패러다임.

## Project Status

**현재 단계**: Phase 1 구현 준비 완료

| 문서 | 상태 |
|------|------|
| [PRD](docs/prd.md) | ✅ 완료 |
| [Architecture](docs/architecture.md) | ✅ 완료 |
| [Epics & Stories](docs/epics.md) | ✅ 완료 |
| Sprint Stories | ✅ 14개 ready-for-dev |

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

# 3. wasm-pack 설치
cargo install wasm-pack

# 4. 프로젝트 클론
git clone git@github.com:parktube/7-division.git
cd 7-division
```

### Build & Run (Phase 1 완료 후)

```bash
# CAD Engine 빌드
cd cad-engine
wasm-pack build --target nodejs

# Viewer 실행 (정적 서버)
cd ../viewer
python -m http.server 8000
# http://localhost:8000 접속
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

### Phase 1 Scope

- 기초 도형: `line`, `circle`, `rect`
- 변환: `translate`, `rotate`, `scale`, `delete`
- 출력: `scene.json`, `SVG`
- 뷰어: Canvas 2D + 500ms polling

## Documentation

| 문서 | 설명 |
|------|------|
| [PRD](docs/prd.md) | 제품 요구사항 정의 |
| [Architecture](docs/architecture.md) | 기술 아키텍처 설계 |
| [Epics](docs/epics.md) | 에픽 & 스토리 요약 |
| [AI-Native CAD 제안서](docs/ai-native-cad-proposal.md) | 프로젝트 비전 |
| [AX 설계 가이드](docs/ax-design-guide.md) | Agent eXperience 원칙 |

## Sprint Status

현재 스프린트: **Phase 1 Implementation**

```
docs/sprint-artifacts/sprint-status.yaml
```

**Epic 1** - 기초 도형 생성 (5 stories) - `in-progress`
**Epic 2** - 결과 확인 (3 stories) - `backlog`
**Epic 3** - 도형 편집 (6 stories) - `backlog`

## Contributing

자세한 협업 가이드는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

- **BMAD 워크플로우 개요**
- **스토리 기반 개발 방법**
- **Git 컨벤션 & PR 규칙**
- **의존성 맵**

## License

TBD

---

*작성: 2025-12-17*
