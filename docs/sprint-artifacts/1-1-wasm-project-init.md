# Story 1.1: WASM 프로젝트 초기화 및 빌드 설정

Status: ready-for-dev

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

- [ ] **Task 1: 프로젝트 구조 생성** (AC: #1)
  - [ ] 1.1: `cad-engine/` 디렉토리 생성
  - [ ] 1.2: `cargo init --lib` 으로 Rust 라이브러리 프로젝트 초기화
  - [ ] 1.3: Rust 2024 Edition 설정 확인 (`edition = "2024"`)

- [ ] **Task 2: Cargo.toml 의존성 설정** (AC: #1, #2)
  - [ ] 2.1: `wasm-bindgen = "0.2.92"` 추가
  - [ ] 2.2: `serde = { version = "1.0", features = ["derive"] }` 추가
  - [ ] 2.3: `serde_json = "1.0"` 추가
  - [ ] 2.4: `uuid = { version = "1", features = ["v4", "js"] }` 추가 (getrandom 이슈 회피)
  - [ ] 2.5: `js-sys = "0.3"` 추가 (js_sys::Math::random 대안용)
  - [ ] 2.6: `[lib] crate-type = ["cdylib", "rlib"]` 설정

- [ ] **Task 3: lib.rs 기본 구조 작성** (AC: #2)
  - [ ] 3.1: `use wasm_bindgen::prelude::*;` 임포트
  - [ ] 3.2: `#[wasm_bindgen(start)]` 또는 init 함수 작성
  - [ ] 3.3: 테스트용 간단한 exported 함수 작성 (예: `greet() -> String`)

- [ ] **Task 4: WASM 빌드 및 검증** (AC: #1, #2)
  - [ ] 4.1: `wasm-pack build --target nodejs` 실행
  - [ ] 4.2: `pkg/` 디렉토리 생성 확인
  - [ ] 4.3: Node.js에서 import 테스트 스크립트 작성
  - [ ] 4.4: 호출 지연 시간 측정 (< 1ms 목표)

- [ ] **Task 5: 테스트 작성** (AC: #3)
  - [ ] 5.1: Rust 유닛 테스트 작성 (`#[cfg(test)]`)
  - [ ] 5.2: `cargo test` 통과 확인

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
| **wasm-pack** | drager fork | 0.13.1 |
| **wasm-bindgen** | - | 0.2.92 |
| **Node.js** | LTS | 22.x |

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

### 예상 Cargo.toml

```toml
[package]
name = "cad-engine"
version = "0.1.0"
edition = "2024"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2.92"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
uuid = { version = "1", features = ["v4", "js"] }
js-sys = "0.3"

[dev-dependencies]
wasm-bindgen-test = "0.3"
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

- cad-engine/Cargo.toml (신규)
- cad-engine/src/lib.rs (신규)
- cad-engine/pkg/* (빌드 결과)
- test-wasm.mjs (검증용, 선택적)
