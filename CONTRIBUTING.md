# Contributing Guide

> **협업 리더**: @parktube
> **Repository**: https://github.com/parktube/7-division

**현재 상태**: Epic 1~5 완료, Epic 6 진행 중

## Quick Start

```bash
# 1. 저장소 클론
git clone git@github.com:parktube/7-division.git
cd 7-division

# 2. 개발 환경 설정 (또는 npm run setup)
rustup target add wasm32-unknown-unknown
cargo install --git https://github.com/drager/wasm-pack.git --rev 24bdca457abad34e444912e6165eb71422a51046 --force

# 3. Root 패키지 설치 (husky pre-commit hook 활성화)
npm install

# 4. WASM 빌드 & 도구 설치
cd cad-engine && wasm-pack build --target nodejs --release && cd ..
cd cad-tools && npm install && cd ..

# 5. 뷰어 실행
cd viewer && node server.cjs  # http://localhost:8000

# 6. 현재 스프린트 상태 확인
cat docs/sprint-artifacts/sprint-status.yaml
```

### Root 스크립트

| 스크립트 | 설명 |
|---------|------|
| `npm run setup` | Rust + wasm-pack 환경 설정 |
| `npm run build:release` | WASM 릴리즈 빌드 |
| `npm run test` | Rust 단위 테스트 |
| `npm run test:tools` | TypeScript (cad-tools) 테스트 |
| `npm run test:all` | Rust + TypeScript 전체 테스트 |
| `npm run lint:rs` | Rust fmt + clippy 검사 |
| `npm run lint:ts` | TypeScript ESLint 검사 |

---

## CAD CLI 사용법

AI 에이전트와 개발자 모두 `cad-tools/cad-cli.ts`를 통해 CAD 도형을 조작합니다.

```bash
cd cad-tools
npx tsx cad-cli.ts <command> '<json_params>'
```

### 주요 명령어 요약

| 카테고리 | 명령어 | 설명 |
|---------|--------|------|
| **Primitives** | `draw_circle`, `draw_rect`, `draw_line`, `draw_arc` | 도형 생성 |
| **Style** | `set_fill`, `set_stroke` | 색상/선 스타일 |
| **Transform** | `translate`, `rotate`, `scale`, `set_pivot`, `delete` | 변환 (rotate는 라디안) |
| **Groups** | `create_group`, `ungroup`, `add_to_group`, `remove_from_group` | 그룹화 |
| **Query** | `list_entities`, `get_entity`, `get_scene_info`, `get_selection` | 조회 |
| **Export** | `export_json`, `export_svg`, `capture_viewport` | 출력/캡처 |
| **Session** | `reset`, `status` | 세션 관리 |

### 예시: 관절 캐릭터 생성

```bash
# 상체 도형 생성
npx tsx cad-cli.ts draw_circle '{"name":"head","x":0,"y":100,"radius":15}'
npx tsx cad-cli.ts draw_line '{"name":"spine","points":[0,85,0,50]}'
npx tsx cad-cli.ts draw_line '{"name":"upper_arm","points":[0,80,30,80]}'
npx tsx cad-cli.ts draw_line '{"name":"forearm","points":[30,80,50,80]}'

# 팔꿈치 피봇 설정
npx tsx cad-cli.ts set_pivot '{"name":"forearm","px":30,"py":80}'

# 팔꿈치 구부리기 (라디안: -0.785 ≈ -45°)
npx tsx cad-cli.ts rotate '{"name":"forearm","angle":-0.785}'

# 팔 전체 그룹화
npx tsx cad-cli.ts create_group '{"name":"arm_group","children":["upper_arm","forearm"]}'

# 어깨 피봇으로 팔 전체 회전
npx tsx cad-cli.ts set_pivot '{"name":"arm_group","px":0,"py":80}'
npx tsx cad-cli.ts rotate '{"name":"arm_group","angle":0.5}'  # ≈29°

# 뷰어 스크린샷 캡처 (Puppeteer)
npx tsx cad-cli.ts capture_viewport
```

자세한 명령어는 `CLAUDE.md` 또는 `AGENTS.md` 참조.

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

### Cargo.toml 설정

```toml
# cad-engine/Cargo.toml
[package]
name = "cad-engine"
version = "0.1.0"
edition = "2024"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2.92"
js-sys = "0.3"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# UUID 생성 (getrandom js feature 필수)
uuid = { version = "1.0", features = ["v4", "js"] }

# 또는 getrandom 직접 사용 시
# getrandom = { version = "0.2", features = ["js"] }

[dev-dependencies]
wasm-bindgen-test = "0.3"

[profile.release]
opt-level = "s"      # 크기 최적화
lto = true           # Link-Time Optimization
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

### Node.js에서 사용

```javascript
// CommonJS
const { Scene } = require('./cad-engine/pkg/cad_engine.js');

// ESM (package.json에 "type": "module" 필요)
import { Scene } from './cad-engine/pkg/cad_engine.js';

// 사용
const scene = new Scene("test");
scene.add_circle(0, 0, 10);
console.log(scene.export_json());
```

### wasm-bindgen 패턴 가이드

#### ✅ 권장 패턴: 클래스 래퍼

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Scene {
    name: String,
    entities: Vec<Entity>,
}

#[wasm_bindgen]
impl Scene {
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str) -> Scene {
        Scene {
            name: name.to_string(),
            entities: Vec::new(),
        }
    }

    pub fn add_circle(&mut self, x: f64, y: f64, radius: f64) -> String {
        // ...
    }
}
```

#### ❌ 피해야 할 패턴

```rust
// Rust struct를 JS로 왕복시키는 패턴 - wasm-bindgen 제약 많음
pub fn create_scene(name: &str) -> Scene { ... }
pub fn add_circle(scene: &mut Scene, x: f64, y: f64, r: f64) { ... }
```

#### Float64Array 사용 (배열 인자)

```rust
use js_sys::Float64Array;

#[wasm_bindgen]
impl Scene {
    pub fn add_line(&mut self, points: Float64Array) -> String {
        let points_vec: Vec<f64> = points.to_vec();
        // [x1, y1, x2, y2, ...] 형태로 처리
    }
}
```

```javascript
// JS에서 호출
scene.add_line(new Float64Array([0, 0, 100, 100]));
```

### 흔한 문제 해결

| 문제 | 원인 | 해결 |
|------|------|------|
| `getrandom` 에러 | WASM에서 랜덤 생성 | `features = ["js"]` 추가 |
| `&[f64]` 컴파일 에러 | wasm-bindgen 제약 | `Float64Array` 사용 |
| `Cannot find module` | 빌드 안됨 | `wasm-pack build` 실행 |
| WASM 크기 너무 큼 | 최적화 안됨 | `--release` + `opt-level = "s"` |

### IDE 설정 (VS Code)

```json
// .vscode/settings.json
{
  "rust-analyzer.cargo.target": "wasm32-unknown-unknown",
  "rust-analyzer.check.command": "clippy",
  "rust-analyzer.check.extraArgs": [
    "--target", "wasm32-unknown-unknown"
  ]
}
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
    ├── 1-2-scene-class.md
    └── ...
```

### 스토리 파일 구조

각 스토리 파일은 다음 구조를 따릅니다:

```markdown
# Story X.Y: 제목

Status: ready-for-dev | in-progress | review | done

## Story
As a **역할**, I want **기능**, So that **가치**

## Acceptance Criteria
### AC1: 조건명
**Given** 초기 상태
**When** 액션
**Then** 결과

## Tasks / Subtasks
- [ ] Task 1: 작업명
  - [ ] 1.1: 세부 작업

## Dev Notes
구현 가이드, 코드 예시, 주의사항
```

---

## 개발 워크플로우

### 1. 작업할 스토리 선택

```bash
# sprint-status.yaml에서 ready-for-dev 상태인 스토리 확인
cat docs/sprint-artifacts/sprint-status.yaml | grep -A2 "ready-for-dev"
```

우선순위:
- **P0**: 필수 (먼저 완료)
- **P1**: 중요
- **P2**: 선택

### 2. 브랜치 생성

```bash
# 네이밍 규칙: feature/story-{에픽번호}-{스토리번호}-{설명}
git checkout -b feature/story-1-1-wasm-init
```

### 3. 스토리 상태 업데이트

작업 시작 시 `sprint-status.yaml` 수정:

```yaml
1-1-wasm-project-init:
  status: in-progress  # ready-for-dev → in-progress
```

### 4. 구현

스토리 파일의 **Tasks / Subtasks**를 따라 구현:

```markdown
## Tasks / Subtasks
- [x] Task 1: 완료됨
  - [x] 1.1: 완료됨
- [ ] Task 2: 진행중
```

### 5. PR 생성

```bash
git add .
git commit -m "feat: Initialize WASM project structure"
git push -u origin feature/story-1-1-wasm-init

# PR 생성
gh pr create --title "feat: Story 1.1 - WASM 프로젝트 초기화" \
  --body "## Story
- Closes Story 1.1

## Changes
- [변경 내용]

## Test
- [테스트 방법]"
```

### 6. 완료 후 상태 업데이트

PR 머지 후 `sprint-status.yaml` 수정:

```yaml
1-1-wasm-project-init:
  status: done  # in-progress → done
```

---

## Git 컨벤션

### 브랜치 네이밍

| 타입 | 패턴 | 예시 |
|------|------|------|
| 기능 | `feature/story-{번호}-{설명}` | `feature/story-1-1-wasm-init` |
| 버그 | `fix/{설명}` | `fix/wasm-build-error` |
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
- 머지 전 최소 1명 승인 필요

---

## 의존성 & 병렬 작업 가이드

### 의존성 맵 (상세)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Phase 1 의존성 맵                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [1-1] WASM Init ─────────────────────────────────────────────────────  │
│         │                                                                │
│         ▼                                                                │
│  [1-2] Scene Class ─────────────────────────────────────────────────    │
│         │                                                                │
│         ├──────────┬──────────┬──────────┬──────────────────            │
│         │          │          │          │                               │
│         ▼          ▼          ▼          ▼                               │
│  [1-3] Line   [1-4] Circle [1-5] Rect  [2-1] JSON Export                │
│         │                                     │                          │
│         ├──────────┬──────────┬──────────     │                          │
│         │          │          │          │    │                          │
│         ▼          ▼          ▼          ▼    ▼                          │
│  [3-1] Trans  [3-2] Rot  [3-3] Scale [3-4] Del  [2-2] Viewer            │
│         │          │          │          │         │                     │
│         └──────────┴──────────┴──────────┘         │                     │
│                         │                          │                     │
│                         │                          ▼                     │
│                         │                    [2-3] Rendering             │
│                         │                          │                     │
│                         └────────────────────┬─────┘                     │
│                                              │                           │
│                                              ▼                           │
│                                       [3-5] Transform Rendering          │
│                                              │                           │
│                                              ▼                           │
│                                       [3-6] SVG Export                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 병렬 작업 가능 그룹

| 웨이브 | 스토리 | 병렬 작업자 | 선행 조건 |
|--------|--------|-------------|----------|
| **Wave 1** | 1-1 | 1명 | 없음 |
| **Wave 2** | 1-2 | 1명 | 1-1 완료 |
| **Wave 3** | 1-3, 1-4, 1-5, 2-1 | **4명 병렬** | 1-2 완료 |
| **Wave 4** | 3-1, 3-2, 3-3, 3-4, 2-2 | **5명 병렬** | Wave 3 일부 |
| **Wave 5** | 2-3 | 1명 | 2-1, 2-2 완료 |
| **Wave 6** | 3-5 | 1명 | 2-3, 3-1+ 완료 |
| **Wave 7** | 3-6 | 1명 | 2-3 완료 |

### 협업 시나리오

#### 2인 협업 (권장)
```
개발자 A (Rust/WASM)     개발자 B (Viewer/JS)
─────────────────────    ─────────────────────
1-1 WASM Init
1-2 Scene Class
1-3 Line
1-4 Circle               2-2 Canvas Viewer (mock JSON으로 시작)
1-5 Rect
2-1 JSON Export          2-3 Rendering
3-1~3-4 Transform        3-5 Transform Rendering
3-6 SVG Export
```

#### 3인 협업
```
개발자 A (Core)    개발자 B (Primitives)    개발자 C (Viewer)
────────────────   ─────────────────────    ─────────────────
1-1 WASM Init
1-2 Scene Class
                   1-3, 1-4, 1-5 병렬       2-2 Canvas Viewer
2-1 JSON Export                            2-3 Rendering
3-1, 3-2           3-3, 3-4                3-5 Transform Rendering
3-6 SVG Export
```

---

## 테스트 가이드

### Rust/WASM 테스트

#### 1. 단위 테스트 (cargo test)

```bash
cd cad-engine

# 모든 테스트 실행
cargo test

# 특정 테스트만
cargo test test_add_line

# 출력 표시
cargo test -- --nocapture
```

#### 2. WASM 테스트 (wasm-pack test)

```bash
# Node.js 환경 테스트
wasm-pack test --node

# 브라우저 테스트 (headless)
wasm-pack test --headless --chrome
```

#### 3. Lint 검사

```bash
# clippy (경고를 에러로)
cargo clippy --target wasm32-unknown-unknown -- -D warnings

# 포맷 검사
cargo fmt --check
```

### TypeScript 테스트 (cad-tools)

```bash
cd cad-tools
npm run test        # Vitest 실행
npm run test:watch  # watch 모드
npm run lint        # ESLint 검사
npm run typecheck   # TypeScript 타입 검사
```

#### 테스트 예시

```typescript
// src/__tests__/executor.test.ts
import { describe, it, expect } from 'vitest';
import { CADExecutor } from '../executor.js';

describe('CADExecutor', () => {
  it('should create a circle', () => {
    const executor = new CADExecutor();
    const result = executor.exec('draw_circle', {
      name: 'test',
      x: 0,
      y: 0,
      radius: 10,
    });
    expect(result.success).toBe(true);
  });
});
```

### 통합 테스트 체크리스트

#### Story 1-1 완료 조건
```bash
# 1. WASM 빌드 성공
wasm-pack build --target nodejs

# 2. Node.js에서 import 성공
node -e "const wasm = require('./pkg/cad_engine.js'); console.log(wasm);"

# 3. 기본 함수 호출 성공
node -e "const {Scene} = require('./pkg/cad_engine.js'); const s = new Scene('test'); console.log(s);"
```

#### 관절 캐릭터 통합 테스트 (CLI 권장)
```bash
# cad-tools 디렉토리에서 실행
cd cad-tools

# 1. 새 씬 시작
npx tsx cad-cli.ts reset

# 2. 스켈레톤 생성
npx tsx cad-cli.ts draw_circle '{"name":"head","x":0,"y":100,"radius":15}'
npx tsx cad-cli.ts draw_line '{"name":"spine","points":[0,85,0,50]}'
npx tsx cad-cli.ts draw_line '{"name":"upper_arm","points":[0,80,30,80]}'
npx tsx cad-cli.ts draw_line '{"name":"forearm","points":[30,80,50,80]}'

# 3. 관절 설정 (피봇)
npx tsx cad-cli.ts set_pivot '{"name":"forearm","px":30,"py":80}'

# 4. 포즈 적용
npx tsx cad-cli.ts rotate '{"name":"forearm","angle":-0.785}'

# 5. 그룹화
npx tsx cad-cli.ts create_group '{"name":"arm","children":["upper_arm","forearm"]}'

# 6. 뷰어에서 확인
npx tsx cad-cli.ts capture_viewport
# → viewer/capture.png 확인
```

### PR 전 체크리스트

```markdown
## PR Checklist

### Pre-commit (자동)
- [ ] `npm install` 실행 완료 (husky 활성화)
- [ ] 커밋 시 lint-staged 통과 (자동 실행)

### Rust (cad-engine)
- [ ] `cargo fmt --check` 통과
- [ ] `cargo clippy -- -D warnings` 경고 없음
- [ ] `cargo test` 모든 테스트 통과
- [ ] `wasm-pack build --target nodejs --release` 성공

### TypeScript (cad-tools)
- [ ] `npm run lint` 통과
- [ ] `npm run typecheck` 통과
- [ ] `npm run test` 모든 테스트 통과

### 통합
- [ ] 뷰어에서 수동 테스트 완료 (`node viewer/server.cjs`)
- [ ] sprint-status.yaml 상태 업데이트됨
- [ ] 스토리 파일의 Tasks 체크됨
```

### Pre-commit Hook (자동 실행)

Root에서 `npm install` 실행 시 husky가 자동 설정됩니다.

**커밋 시 자동 실행되는 검사:**

| 파일 타입 | 검사 내용 |
|----------|----------|
| `cad-engine/**/*.rs` | `cargo fmt` (자동 포맷) |
| `cad-tools/src/**/*.ts` | `eslint --fix` (자동 수정) |

```bash
# .husky/pre-commit 내용
npx lint-staged
```

수동 실행:
```bash
npm run lint:rs   # Rust: fmt --check + clippy
npm run lint:ts   # TypeScript: eslint
```

### CI/CD 파이프라인

`.github/workflows/ci.yml` - main/develop 브랜치 push/PR 시 자동 실행

```
┌─────────────────────────────────────────────────────────┐
│                     CI Pipeline                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [rust] ──────────────────────────────────────────────  │
│    │  cargo fmt --check                                  │
│    │  cargo clippy -D warnings                          │
│    │  cargo test                                        │
│    │  wasm-pack build --release                         │
│    │  → WASM artifact 업로드                             │
│    ▼                                                    │
│  [typescript] ◀── WASM artifact 다운로드                 │
│    │  npm ci (cad-tools)                                │
│    │  npm run lint                                      │
│    │  npm run typecheck                                 │
│    │  npm run build                                     │
│    │  npm run test                                      │
│    ▼                                                    │
│  [integration] ◀── WASM artifact 다운로드                │
│       node test-wasm.mjs                                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**PR 머지 조건**: 모든 job 통과 필수

---

## Claude Code 사용 (선택)

BMAD 워크플로우는 Claude Code와 함께 사용하면 더 효과적입니다.

### 설치

```bash
npm install -g @anthropic-ai/claude-code
```

### 유용한 슬래시 커맨드

| 명령 | 설명 |
|------|------|
| `/bmad:bmm:workflows:dev-story` | 스토리 구현 워크플로우 |
| `/bmad:bmm:workflows:code-review` | 코드 리뷰 |
| `/bmad:bmm:workflows:sprint-status` | 스프린트 상태 확인 |

### 예시: 스토리 구현

```bash
claude
> /bmad:bmm:workflows:dev-story
# 프롬프트에 따라 스토리 번호 입력
```

---

## 질문 & 이슈

- **기술 질문**: GitHub Issues 생성
- **워크플로우 질문**: @hoons (BMAD 설정 담당)
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

*최종 업데이트: 2025-12-31*
