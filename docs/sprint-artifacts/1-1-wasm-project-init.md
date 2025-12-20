# Story 1.1: WASM 프로젝트 초기화 및 빌드 설정

Status: done

## Story

As a **AI 에이전트 (Claude Code)**,
I want **Rust CAD 엔진을 Node.js에서 직접 로드할 수 있도록 WASM 빌드 환경을 구축**,
So that **MCP 없이 직접 CAD 함수를 호출할 수 있다** (Direct-First Architecture).

## Acceptance Criteria

### AC1: WASM 빌드 성공
**Given** 빈 프로젝트 디렉토리
**When** `wasm-pack build --target nodejs` 명령 실행
**Then** `pkg/` 디렉토리에 WASM 파일과 JS wrapper가 생성된다
**And** Node.js에서 `require('./pkg/cad_engine')` 또는 ESM import가 성공한다

### AC2: WASM 모듈 로드 및 호출
**Given** WASM 모듈이 로드된 상태
**When** Node.js 스크립트에서 모듈을 사용
**Then** 메모리 초기화 및 기본 함수 호출이 가능하다
**And** 호출 지연 시간이 1ms 미만이다 (NFR2)

### AC3: 테스트 통과
**Given** WASM 빌드가 완료된 상태
**When** `cargo test` 실행
**Then** 모든 유닛 테스트가 통과한다

## Tasks / Subtasks

- [x] **Task 0: 환경 준비** (AC: #1, #2) ⚠️ 필수 선행
  - [x] 0.1: `rustup update` 실행 (Rust 1.85.0+ 필수, Edition 2024 지원)
  - [x] 0.2: `rustc --version` 으로 1.85.0 이상 확인 → **1.89.0**
  - [x] 0.3: `wasm-pack --version` 확인 (0.13.1) → **설치 완료**

- [x] **Task 1: 프로젝트 구조 생성** (AC: #1)
  - [x] 1.1: `cad-engine/` 디렉토리 생성
  - [x] 1.2: `cargo init --lib` 으로 Rust 라이브러리 프로젝트 초기화
  - [x] 1.3: Rust 2024 Edition 설정 확인 (`edition = "2024"`)

- [x] **Task 2: Cargo.toml 의존성 설정** (AC: #1, #2)
  - [x] 2.1: `wasm-bindgen = "0.2.92"` 추가 (버전 고정)
  - [x] 2.2: `serde = { version = "1.0", features = ["derive"] }` 추가
  - [x] 2.3: `serde_json = "1.0"` 추가
  - [x] 2.4: `uuid = { version = "1", features = ["v4", "js"] }` 추가 (getrandom 이슈 회피)
  - [x] 2.5: `js-sys = "0.3"` 추가 (js_sys::Math::random 대안용)
  - [x] 2.6: `[lib] crate-type = ["cdylib", "rlib"]` 설정

- [x] **Task 3: lib.rs 기본 구조 작성** (AC: #2)
  - [x] 3.1: `use wasm_bindgen::prelude::*;` 임포트
  - [x] 3.2: `#[wasm_bindgen(start)]` 또는 init 함수 작성
  - [x] 3.3: 테스트용 간단한 exported 함수 작성 (예: `greet() -> String`)

- [x] **Task 4: WASM 빌드 및 검증** (AC: #1, #2)
  - [x] 4.1: `wasm-pack build --target nodejs` 실행
  - [x] 4.2: `pkg/` 디렉토리 생성 확인
  - [x] 4.3: Node.js에서 import 테스트 스크립트 작성
  - [x] 4.4: 호출 지연 시간 측정 (--release 빌드) → **avg=0.006ms, max=0.035ms** (< 1ms 목표 달성)

- [x] **Task 5: 테스트 작성** (AC: #3)
  - [x] 5.1: Rust 유닛 테스트 작성 (`#[cfg(test)]`)
  - [x] 5.2: `cargo test` 통과 확인 → **2 passed**

## Dev Notes

### Architecture Patterns

#### Direct-First Architecture
> MCP 프로토콜 없이 WASM 직접 호출. Claude Code에서 Node.js를 통해 WASM 모듈을 직접 로드하고 실행.

```
Claude Code CLI (Node.js)
    ↓ WASM 직접 로드 & 실행
Rust CAD 엔진 (WASM)
    ↓ scene.json 출력
브라우저 뷰어 (Phase 2+)
```

#### wasm-bindgen 클래스 래퍼 패턴 (NFR11)
> **주의**: `create_scene() -> Scene` + `add_circle(scene: &mut Scene)` 같은 "Rust struct를 JS로 왕복" 패턴은 wasm-bindgen에서 제약이 많습니다.

```rust
// ❌ 피해야 할 패턴
pub fn create_scene(name: &str) -> Scene { ... }
pub fn add_circle(scene: &mut Scene, x: f64, y: f64, r: f64) { ... }

// ✅ 권장 패턴: 클래스 래퍼
#[wasm_bindgen]
pub struct Scene { ... }

#[wasm_bindgen]
impl Scene {
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str) -> Scene { ... }

    pub fn add_circle(&mut self, x: f64, y: f64, radius: f64) -> String { ... }
}
```

#### UUID 생성 (NFR13 - getrandom 이슈 회피)
```rust
// 옵션 1: uuid crate with js feature (권장)
use uuid::Uuid;
let id = Uuid::new_v4().to_string();

// 옵션 2: js_sys::Math::random() 기반
fn generate_id() -> String {
    format!("entity_{}", js_sys::Math::random().to_bits())
}
```

### Tech Stack (Phase 1 확정)

| 컴포넌트 | 기술 | 버전 |
|---------|------|------|
| **Rust** | stable | 1.85.0+ (2024 Edition) |
| **wasm-pack** | nickel fork (drager 계승) | 0.13.1 |
| **wasm-bindgen** | - | 0.2.92 (고정) |
| **Node.js** | LTS | 22.x |

> ⚠️ **중요**: Rust 1.85.0 이상 필요 (Edition 2024 지원). `rustup update` 먼저 실행할 것.
>
> **wasm-pack fork 참고**: nickel-wasm-pack은 drager fork를 계승하여 유지보수 중인 버전입니다.

### wasm-bindgen 주의사항

| 이슈 | 해결책 |
|------|--------|
| Rust struct JS 왕복 | 클래스 래퍼 (`#[wasm_bindgen] impl Scene`) |
| `&[f64]` 인자 | `js_sys::Float64Array` 사용 |
| `uuid::new_v4()` | `uuid` with `js` feature 또는 `js_sys::Math::random()` |
| getrandom 크레이트 | Cargo.toml에 `features = ["js"]` 필수 |

### 디렉토리 구조 (목표)

```
cad-engine/
├── src/
│   ├── lib.rs           # WASM 엔트리포인트 ← 이 스토리에서 생성
│   ├── primitives/      # Story 1.3-1.5
│   ├── transforms/      # Epic 3
│   ├── scene/           # Story 1.2
│   └── serializers/     # Epic 2, 3
├── Cargo.toml           # ← 이 스토리에서 생성
└── pkg/                 # WASM 빌드 결과 ← 이 스토리에서 생성
```

### Project Structure Notes

- 이 스토리는 `cad-engine/` 루트 디렉토리와 기본 설정만 생성
- `primitives/`, `scene/`, `serializers/` 모듈은 후속 스토리에서 추가
- pkg/ 디렉토리는 wasm-pack이 자동 생성

### 실제 Cargo.toml

```toml
[package]
name = "cad-engine"
version = "0.1.0"
edition = "2024"
description = "AI-Native CAD Engine - Rust WASM core"
repository = "https://github.com/parktube/7-division"
license = "MIT"

[lib]
crate-type = ["cdylib", "rlib"]

[features]
default = []
dev = ["console_error_panic_hook"]  # 디버그 빌드용
console_error_panic_hook = ["dep:console_error_panic_hook"]

[dependencies]
wasm-bindgen = "0.2.92"  # 버전 고정
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
uuid = { version = "1", features = ["v4", "js"] }
js-sys = "0.3"
console_error_panic_hook = { version = "0.1", optional = true }

[dev-dependencies]
wasm-bindgen-test = "0.3"
```

#### dev feature 사용법
```bash
# Release 빌드 (기본, panic hook 미포함)
wasm-pack build --target nodejs

# Dev 빌드 (panic hook 포함, 디버깅용)
wasm-pack build --target nodejs --dev -- --features dev
```

### 예상 lib.rs (최소 버전)

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        assert_eq!(greet("World"), "Hello, World!");
    }
}
```

### Node.js 테스트 스크립트 예시

```javascript
// test-wasm.mjs
import { greet } from './cad-engine/pkg/cad_engine.js';

const start = performance.now();
const result = greet("CAD");
const elapsed = performance.now() - start;

console.log(`Result: ${result}`);
console.log(`Elapsed: ${elapsed.toFixed(3)}ms`);

if (elapsed > 1) {
    console.warn("Warning: Call latency exceeds 1ms target");
}
```

## References

- [Source: docs/architecture.md#Tech Stack (Phase 1 확정)]
- [Source: docs/architecture.md#API Design - WASM Exports]
- [Source: docs/architecture.md#wasm-bindgen 주의사항]
- [Source: docs/prd.md#Technical Architecture - Direct-First Architecture]
- [Source: docs/epics.md#Story 1.1]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

**커밋 포함 파일:**
- cad-engine/Cargo.toml (신규)
- cad-engine/src/lib.rs (신규)
- cad-engine/.gitignore (신규)
- package.json (신규 - npm scripts)
- test-wasm.mjs (검증용)
- docs/sprint-artifacts/sprint-status.yaml (수정 - status: done)
- docs/architecture.md (수정 - wasm-pack/wasm-bindgen 버전 통일)
- docs/epics.md (수정 - wasm-pack/wasm-bindgen 버전 통일)

**빌드 산출물 (git 제외):**
- cad-engine/pkg/* → .gitignore에 의해 제외, `npm run build`로 생성

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2025-12-20

#### Review Round 1 - Issues Found & Fixed
| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| H1 | HIGH | Task 3.2 `#[wasm_bindgen(start)]` init 함수 누락 | ✅ Fixed |
| M1 | MEDIUM | File List 불완전 (2개 파일 누락) | ✅ Fixed |
| M2 | MEDIUM | package.json setup에 rustup update 누락 | ✅ Fixed |
| L1 | LOW | test-wasm.mjs 에러 핸들링 없음 | ✅ Fixed |
| L2 | LOW | Cargo.toml 메타데이터 누락 | ✅ Fixed |
| L3 | LOW | lib.rs 문서화 주석 없음 | ✅ Fixed |

#### Review Round 2 - Issues Found & Fixed
| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| H1 | HIGH | Git diff 비어있어 변경 근거 검증 불가 | ✅ N/A (이미 커밋됨) |
| M1 | MEDIUM | wasm-pack 버전 고정 안됨 (drager fork 0.13.1) | ✅ Fixed: `@0.13.1` 명시 |
| M2 | MEDIUM | NFR2 검증이 경고만 출력, 실패시키지 않음 | ✅ Fixed: `process.exit(1)` 추가 |
| M3 | MEDIUM | 통합 테스트에 assert 없음 | ✅ Fixed: assertEqual 함수 + 5개 테스트 케이스 |
| L1 | LOW | init 함수가 빈 함수 | ✅ Fixed: console_error_panic_hook 설정 |

#### Review Round 3 - Issues Found & Fixed
| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| H1 | HIGH | 변경 근거 검증 불가 | ✅ Fixed: 커밋 해시 기록 |
| M1 | MEDIUM | wasm-pack drager fork 미고정 | ✅ Fixed: git install로 변경 |
| M2 | MEDIUM | wasm-bindgen 버전 느슨함 | ✅ Fixed: `0.2.92` 고정 |
| M3 | MEDIUM | NFR2 평균만 검사 (max 미검사) | ✅ Fixed: max 검증 추가 |
| L1 | LOW | panic hook이 release에도 포함 | ✅ Fixed: dev feature로 분리 |

#### Review Round 4 - 문서/구현 일관성 수정
| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| H1 | HIGH | File List에 pkg/* 포함 (git 제외 대상) | ✅ Fixed: 빌드 산출물 분리 명시 |
| M1 | MEDIUM | File List 누락 (sprint-status.yaml) | ✅ Fixed |
| M2 | MEDIUM | 문서 wasm-bindgen "0.2" vs 구현 "0.2.92" 불일치 | ✅ Fixed |
| M3 | MEDIUM | Task 4.4 성능 수치 outdated | ✅ Fixed: avg/max 표기 |
| M4 | MEDIUM | drager vs nickel fork 혼동 | ✅ Fixed: 관계 명시 |
| L1 | LOW | dev feature 사용법 미문서화 | ✅ Fixed: 가이드 추가 |

#### Review Round 5 - Source-of-truth 문서 통일
| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| M1 | MEDIUM | architecture.md/epics.md drager fork 표기 | ✅ Fixed: nickel fork로 통일 |
| M2 | MEDIUM | setup에 --force 없음 | ✅ Fixed: --force 추가 |
| M3 | MEDIUM | 빌드 프로파일(release) 미명시 | ✅ Fixed: Task 4.4에 명시 |
| L1 | LOW | .coderabbit.yaml 스토리 범위 밖 | ✅ Fixed: 별도 커밋 분리 |

#### 테스트 검증 결과
```
✅ AC1: WASM 모듈 로드 성공
✅ AC2: 호출 지연 시간 avg=0.006ms, max=0.035ms < 1ms 목표 달성
✅ AC3-1~5: 모든 assert 통과 (유니코드, 빈 문자열, 긴 문자열 포함)
```

#### Review Follow-ups (AI)
- [ ] [AI-Review][LOW] WASM 브라우저 타겟 빌드 테스트 추가 검토
- [ ] [AI-Review][LOW] wasm-bindgen-test를 활용한 브라우저 테스트 추가 검토
