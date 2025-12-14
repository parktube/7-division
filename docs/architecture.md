# Architecture Document - AI-Native CAD

**Author:** Hoons
**Date:** 2025-12-14

---

## Tech Stack

| Layer | Technology | Version | 용도 |
|-------|------------|---------|------|
| **CAD Engine** | Rust | 1.75+ | 코어 로직 |
| | wasm-bindgen | 0.2.x | WASM 바인딩 |
| | wasm-pack | 0.13.x | WASM 빌드 |
| | serde | 1.0.x | JSON 직렬화 |
| | uuid | 1.x | Entity ID 생성 |
| **Viewer** | TypeScript | 5.x | 타입 안전성 |
| | Three.js | r170+ | 2D/3D 렌더링 |
| | Vite | 7.x | 개발 서버/빌드 |
| | Vitest | 3.x | 테스트 프레임워크 |
| **Runtime** | Node.js | 20.19+ | WASM 실행 (Claude Code) |
| | Browser | ES2022+ | 뷰어 실행 |

### 버전 선택 근거

- **Vite 7.x**: SpineLift에서 검증됨, Vite 5는 보안 패치만 지원
- **Node.js 20.19+**: Vite 7 요구사항
- **wasm-pack 0.13.x**: rustwasm 조직 sunset 후 최신 안정 버전
- **Three.js r170+**: r160은 2024년 초 버전, IIFE 제거로 ESM 전용

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code CLI                       │
│                      (Node.js)                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│    ┌─────────────┐     ┌─────────────────────────┐     │
│    │   WASM      │────▶│   CAD Engine (Rust)     │     │
│    │   Loader    │     │   - Primitives          │     │
│    └─────────────┘     │   - Transforms          │     │
│                        │   - Serializer          │     │
│                        └───────────┬─────────────┘     │
│                                    │                    │
│                                    ▼                    │
│                        ┌─────────────────────────┐     │
│                        │   Output (File)         │     │
│                        │   - scene.json (필수)   │     │
│                        │   - output.svg (옵션)   │     │
│                        └───────────┬─────────────┘     │
└────────────────────────────────────┼────────────────────┘
                                     │ Vite HMR (~50ms)
                                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Browser Viewer                        │
│                     (Three.js)                          │
├─────────────────────────────────────────────────────────┤
│    ┌─────────────┐     ┌─────────────────────────┐     │
│    │   Renderer  │     │   Selection UI          │     │
│    │   (2D/3D)   │     │   (Phase 2)             │     │
│    └─────────────┘     └─────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## Core Components

> **Note**: 아래 디렉토리 구조는 목표 구조(planned)입니다. 현재 레포에는 아직 생성되지 않았습니다.

### 1. CAD Engine (Rust → WASM)

```
cad-engine/  (planned)
├── src/
│   ├── lib.rs           # WASM 엔트리포인트
│   ├── primitives/      # 기초 도형
│   │   ├── mod.rs
│   │   ├── line.rs
│   │   ├── circle.rs
│   │   ├── rect.rs
│   │   ├── arc.rs
│   │   └── polygon.rs
│   ├── transforms/      # 변환
│   │   ├── mod.rs
│   │   ├── translate.rs
│   │   ├── rotate.rs
│   │   └── scale.rs
│   ├── scene/           # 씬 관리
│   │   ├── mod.rs
│   │   ├── entity.rs
│   │   └── history.rs   # Undo/Redo
│   └── serializers/     # 출력 포맷
│       ├── mod.rs
│       ├── svg.rs
│       ├── json.rs
│       └── dxf.rs       # Phase 2
├── Cargo.toml
└── pkg/                 # WASM 빌드 결과
```

### 2. Browser Viewer

```
viewer/  (planned)
├── src/
│   ├── main.ts
│   ├── renderer/
│   │   ├── ThreeRenderer.ts
│   │   └── camera/
│   │       ├── Orthographic2D.ts
│   │       └── Perspective3D.ts
│   ├── loader/
│   │   └── SceneLoader.ts    # JSON → Three.js
│   └── selection/            # Phase 2
│       ├── SelectionManager.ts
│       └── SelectionEvent.ts
├── index.html
└── package.json
```

---

## Data Flow

### Phase 1: 말하기만

```
1. User → Claude Code: "사람 스켈레톤을 그려줘"
2. Claude Code → WASM: cad.create_circle({...})
3. WASM → File: scene.json (Three.js용)
4. File → Browser: Vite HMR (~50ms)
5. Browser → User: Three.js 렌더링
```

### Phase 2: 가리키기 + 말하기

```
1. User → Browser: [클릭] 객체 선택
2. Browser → Claude Code: { id: "left_arm", bounds: {...} }
3. User → Claude Code: "이거 더 길게"
4. Claude Code → WASM: cad.scale("left_arm", 1.2)
5. WASM → File → Browser: 업데이트
```

---

## State Management

### Phase 1: 메모리 우선 + Export

```
┌─────────────────────────────────────────────────────────┐
│              Claude Code 세션 동안                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│    Scene 인스턴스 (WASM 메모리)                          │
│         │                                               │
│         ├─▶ add_circle(), translate() 등               │
│         │   (메모리에서 빠르게 처리)                     │
│         │                                               │
│         └─▶ export_json() 호출 시                       │
│             └─▶ scene.json 파일 저장                    │
│                 └─▶ Vite HMR → 브라우저 갱신            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**원칙**:
- **작업 중**: WASM 메모리에서 빠르게 처리
- **저장 시점**: `export_json()` 명시적 호출 (또는 자동 저장 with throttle)
- **세션 종료**: 메모리 소실 → 파일로 복원 가능

**장점**:
- 파일 I/O 최소화 → 속도 향상
- 중간 상태는 메모리에만 존재 → 깔끔
- Phase 1 scope에 적합한 단순함

### Phase 2+ 고려사항: 파일 분리 전략

> Phase 1 검증 후, 필요 시 아래 구조로 확장 가능

```
┌─────────────────────────────────────────────────────────┐
│              WASM CAD Engine (메모리)                    │
│                   Rust struct                           │
└───────┬─────────────────┬─────────────────┬─────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
   ┌─────────┐      ┌──────────┐      ┌─────────┐
   │ .cad    │      │ view.json│      │ .dxf    │
   │ (저장)  │      │ (LLM/뷰어)│      │ (export)│
   └─────────┘      └──────────┘      └─────────┘
   바이너리/효율     JSON/텍스트        업계 표준
   정밀도 보장       디버깅 용이        호환성
```

| 용도 | 포맷 | 특징 |
|------|------|------|
| **저장** | `.cad` (자체) 또는 바이너리 | 정밀도, 압축, 빠른 로드 |
| **LLM/뷰어** | `view.json` | 읽기 쉬움, 실시간 갱신용 |
| **Export** | DXF, SVG, STL | 외부 호환 |

**왜 분리하는가?**
- JSON은 CAD에 최적이 아님 (부동소수점 정밀도, 크기)
- LLM은 텍스트 기반 포맷이 유리
- 저장용과 뷰어용의 요구사항이 다름

---

## API Design

### WASM Exports (클래스 방식)

> **주의**: `create_scene() -> Scene` + `add_circle(scene: &mut Scene)` 같은 "Rust struct를 JS로 왕복" 패턴은
> wasm-bindgen에서 제약이 많습니다. 아래처럼 **클래스 래퍼 방식**으로 설계합니다.

```rust
// lib.rs
use wasm_bindgen::prelude::*;
use uuid::Uuid;

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
        let id = generate_id();  // UUID 대안 사용
        // ... entity 추가
        id
    }

    // Vec<f64> 대신 js_sys::Float64Array로 명확히
    pub fn add_line(&mut self, points: js_sys::Float64Array) -> String {
        let points_vec: Vec<f64> = points.to_vec();
        let id = generate_id();
        // ... entity 추가
        id
    }

    pub fn add_rect(&mut self, x: f64, y: f64, w: f64, h: f64) -> String {
        let id = generate_id();
        // ... entity 추가
        id
    }

    pub fn translate(&mut self, id: &str, dx: f64, dy: f64) { /* ... */ }
    pub fn rotate(&mut self, id: &str, angle: f64) { /* ... */ }
    pub fn scale(&mut self, id: &str, sx: f64, sy: f64) { /* ... */ }
    pub fn delete(&mut self, id: &str) { /* ... */ }

    pub fn export_json(&self) -> String { /* ... */ }
    pub fn export_svg(&self) -> String { /* ... */ }
}

// UUID 대안: getrandom 이슈 회피
fn generate_id() -> String {
    // 옵션 1: 카운터 기반 (단순)
    // 옵션 2: js_sys::Math::random() 기반
    // 옵션 3: uuid with js feature flag
    format!("entity_{}", js_sys::Math::random().to_bits())
}
```

### wasm-bindgen 주의사항

| 이슈 | 해결책 |
|------|--------|
| Rust struct JS 왕복 | 클래스 래퍼 (`#[wasm_bindgen] impl Scene`) |
| `&[f64]` 인자 | `js_sys::Float64Array` 사용 |
| `uuid::new_v4()` | `js_sys::Math::random()` 또는 `uuid` with `js` feature |
| getrandom 크레이트 | `Cargo.toml`에 `getrandom = { version = "0.2", features = ["js"] }` |

### Claude Code 호출 예시

```javascript
const { Scene } = await import('./cad_engine.js');

// 클래스 인스턴스 생성
const scene = new Scene("skeleton");

// 머리
const head = scene.add_circle(0, 100, 20);

// 몸통 - Float64Array 사용
const body = scene.add_line(new Float64Array([0, 80, 0, 20]));

// 팔
const leftArm = scene.add_line(new Float64Array([-30, 60, 0, 70]));
const rightArm = scene.add_line(new Float64Array([30, 60, 0, 70]));

// 다리
const leftLeg = scene.add_line(new Float64Array([-15, 0, 0, 20]));
const rightLeg = scene.add_line(new Float64Array([15, 0, 0, 20]));

// JSON 출력 (Three.js 렌더링용)
const json = scene.export_json();
fs.writeFileSync('scene.json', json);

// SVG 출력 (옵션)
const svg = scene.export_svg();
fs.writeFileSync('output.svg', svg);
```

---

## Type System (2D/3D 확장 대비)

```rust
// 제네릭 Point로 2D/3D 통합
pub struct Point<const N: usize> {
    coords: [f64; N],
}

pub type Point2D = Point<2>;
pub type Point3D = Point<3>;

// Geometry trait
pub trait Geometry<const N: usize> {
    fn bounds(&self) -> BoundingBox<N>;
    fn transform(&mut self, matrix: &Matrix<N>);
}

// Serializer trait
pub trait Serializer {
    fn serialize(&self, scene: &Scene) -> String;
}

impl Serializer for SvgSerializer { ... }
impl Serializer for DxfSerializer { ... }
impl Serializer for StlSerializer { ... }  // Phase 3 (필수)
// impl Serializer for StepSerializer { ... }  // Phase 3 (옵션, 추후)
```

---

## Viewer Architecture

### Three.js 기반 통합 렌더러

```typescript
class CADViewer {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private renderer: THREE.WebGLRenderer;

    // 2D 모드
    set2DMode() {
        this.camera = new THREE.OrthographicCamera(...);
        this.camera.position.z = 100;
        this.camera.lookAt(0, 0, 0);
    }

    // 3D 모드
    set3DMode() {
        this.camera = new THREE.PerspectiveCamera(...);
        this.controls = new OrbitControls(this.camera, ...);
    }

    // JSON → Three.js 변환
    loadScene(json: SceneJSON) {
        for (const entity of json.entities) {
            const mesh = this.createMesh(entity);
            this.scene.add(mesh);
        }
    }
}
```

### 실시간 갱신 (Vite HMR 권장)

> **핵심**: 사용자 체감 속도 = "명령 → 화면 변경" 시간.
> Polling 500ms는 "느리다"로 체감됨. Vite HMR로 ~50ms 달성.

```typescript
// viewer/src/main.ts
import sceneData from '../output/scene.json';
import { CADViewer } from './renderer/CADViewer';

const viewer = new CADViewer();
viewer.loadScene(sceneData);

// Vite HMR: 파일 변경 시 즉시 갱신 (~50ms)
if (import.meta.hot) {
    import.meta.hot.accept('../output/scene.json', (newModule) => {
        viewer.loadScene(newModule.default);
        console.log('[HMR] scene.json updated');
    });
}
```

### 왜 Vite HMR인가?

| 방식 | 체감 지연 | 구현 복잡도 |
|------|----------|------------|
| Polling 500ms | 0~500ms | 낮음 |
| Polling 100ms | 0~100ms | 낮음 (부하↑) |
| **Vite HMR** | **~50ms** | **낮음 (Vite 내장)** |
| Custom WebSocket | ~20ms | 높음 |

### 개발 워크플로우

```bash
# 1. Vite dev server 실행
cd viewer && npm run dev
# → http://localhost:5173 에서 뷰어 실행
# → scene.json 변경 시 자동 갱신

# 2. Claude Code에서 WASM 실행
# → scene.json 저장
# → Vite가 파일 변경 감지 → HMR → 브라우저 즉시 갱신
```

### Fallback: Polling (Vite 없이 테스트 시)

```typescript
// Vite 없이 단순 테스트할 때만 사용
setInterval(async () => {
    const response = await fetch(`scene.json?t=${Date.now()}`, {
        cache: 'no-store'
    });
    const scene = await response.json();
    viewer.loadScene(scene);
}, 100);  // 100ms로 축소
```

---

## Future Extensions

### Phase 2: Selection UI

> **역방향 통신 필요**: "브라우저 선택 → Claude Code" 방향은 파일 polling만으로 불가능합니다.
> Phase 2에서는 다음 중 하나가 필요합니다:
> - 로컬 서버 + WebSocket
> - 이벤트 파일 큐 (브라우저가 파일에 쓰고, Claude Code가 읽음)
> - Vite HMR WebSocket 활용

```typescript
interface SelectionEvent {
    id: string;
    type: "line" | "circle" | "rect" | ...;
    bounds: { x, y, width, height };
    screenPosition: { x, y };
}

// Raycasting으로 객체 선택
onClick(event) {
    const intersects = raycaster.intersectObjects(scene.children);
    if (intersects.length > 0) {
        const selected = intersects[0].object;
        emitSelectionEvent(selected);
    }
}
```

### Phase 3: Gateway + Chat UI

```
User (Browser)
    ↓ WebSocket
Gateway (Node.js)
    ↓ subprocess
Claude Code CLI
    ↓ WASM
CAD Engine
```

### Phase 3: MCP Wrapper

```typescript
// 기존 WASM 엔진을 MCP로 래핑
const server = new MCPServer({
    tools: [
        {
            name: "cad_create_circle",
            handler: (params) => wasm.add_circle(scene, ...params)
        },
        // ...
    ]
});
```

---

## Dependencies

| 컴포넌트 | 기술 | 버전 | 비고 |
|---------|------|------|------|
| CAD Engine | Rust | 1.75+ | MSRV |
| WASM Bindgen | wasm-bindgen | 0.2.x | 안정 (240M+ 다운로드) |
| Build | wasm-pack | 0.13.x | rustwasm sunset 후 최신 |
| Viewer | Three.js | r170+ | ESM 전용 (r160+) |
| Dev Server | Vite | 7.x | SpineLift 검증됨 |
| Test | Vitest | 3.x | Vite 호환 |
| E2E Test | Playwright | 1.55+ | Phase 2용 |
| Runtime | Node.js | 20.19+ | Vite 7 요구사항 |

---

## Security Considerations

### LLM 교체 가능성

보안/기밀 클라이언트를 위해 Claude Code 대신 로컬 LLM 사용 가능:

```
[기본]
User → Claude Code (Cloud) → WASM

[보안 클라이언트]
User → Ollama/llama.cpp (Local) → WASM
```

WASM 엔진은 동일, LLM 레이어만 교체.

---

## Development Setup

### Prerequisites

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# wasm-pack
cargo install wasm-pack

# Node.js (20+)
# https://nodejs.org/ 또는 nvm 사용
```

### Build Commands

```bash
# CAD Engine (WASM)
cd cad-engine
wasm-pack build --target nodejs    # Node.js용 (Claude Code)
wasm-pack build --target web       # 브라우저용 (옵션)

# Viewer
cd viewer
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드
```

### Development Workflow

```bash
# 1. WASM 빌드
cd cad-engine && wasm-pack build --target nodejs

# 2. 뷰어 실행
cd viewer && npm run dev

# 3. Claude Code에서 WASM 테스트
# Claude Code가 cad-engine/pkg/*.js를 직접 import
```

---

## Testing Strategy

### Unit Tests (Rust)

```bash
cd cad-engine
cargo test
```

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_circle() {
        let mut scene = create_scene("test");
        let id = add_circle(&mut scene, 0.0, 0.0, 10.0);
        assert!(!id.is_empty());
        assert_eq!(scene.entities.len(), 1);
    }

    #[test]
    fn test_translate() {
        let mut scene = create_scene("test");
        let id = add_circle(&mut scene, 0.0, 0.0, 10.0);
        translate(&mut scene, &id, 5.0, 5.0);
        // transform 검증
    }

    #[test]
    fn test_export_svg() {
        let mut scene = create_scene("test");
        add_circle(&mut scene, 0.0, 0.0, 10.0);
        let svg = export_svg(&scene);
        assert!(svg.contains("<circle"));
    }
}
```

### Integration Tests (WASM + Node.js)

```javascript
// tests/wasm.test.js
import { describe, it, expect } from 'vitest';
import * as cad from '../cad-engine/pkg/cad_engine.js';

describe('CAD Engine WASM', () => {
    it('creates scene and adds circle', () => {
        const scene = cad.create_scene('test');
        const id = cad.add_circle(scene, 0, 0, 10);
        expect(id).toBeTruthy();
    });

    it('exports valid SVG', () => {
        const scene = cad.create_scene('test');
        cad.add_circle(scene, 0, 0, 10);
        const svg = cad.export_svg(scene);
        expect(svg).toContain('<svg');
        expect(svg).toContain('<circle');
    });
});
```

### E2E Tests (Phase 2)

```typescript
// Playwright로 뷰어 + Selection UI 테스트
test('select and scale entity', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-entity-id="circle_1"]');
    // Selection event 검증
});
```

---

## Architecture Comparison: SpineLift vs AI-Native CAD

### 아키텍처 비교

| 항목 | SpineLift | AI-Native CAD |
|------|-----------|---------------|
| **WASM 언어** | C++ (Emscripten) | Rust (wasm-bindgen) |
| **WASM 실행 위치** | Browser | Node.js |
| **통신 방식** | MCP → WebSocket → Browser | 직접 호출 |
| **브라우저** | 필수 (실행환경) | 선택 (뷰어만) |
| **지연** | ~100ms/호출 | <1ms/호출 |
| **복잡도** | 4계층 | 1계층 |

### 실행 경로 비교

**SpineLift (4계층)**
```
Claude → MCP Server → WebSocket → Browser → WASM (C++)
        ~~~~~~~~~~~   ~~~~~~~~~~   ~~~~~~~   ~~~~~~~~
           50ms         20ms        20ms       <1ms
```

**AI-Native CAD (1계층)**
```
Claude Code → WASM (Rust/Node.js) → File → Browser (뷰어)
             ~~~~~~~~~~~~~~~~~~~~
                    <1ms
```

### Tech Stack 비교

| 항목 | SpineLift | AI-Native CAD |
|------|-----------|---------------|
| **빌드 도구** | Emscripten + CMake | wasm-pack + Cargo |
| **프론트엔드** | React 18 + Zustand | Vanilla TypeScript |
| **렌더러** | WebGL (커스텀) | Three.js |
| **Vite** | 7.1.10 | 7.x |
| **TypeScript** | 5.9.3 | 5.x |
| **테스트** | Vitest 3.2.4 + Playwright | Vitest + Playwright |
| **상태관리** | Zustand + IndexedDB | 파일 기반 (JSON) |

### 프론트엔드 구조 비교

**SpineLift** (복잡한 애플리케이션)
```
frontend/src/
├── components/        # React UI 컴포넌트
├── contexts/          # React Context (상태)
├── hooks/             # Custom Hooks
├── services/          # 비즈니스 로직
├── stores/            # Zustand 스토어
├── wasm/              # WASM 브릿지
└── rendering/         # WebGL 렌더링
```

**AI-Native CAD** (단순한 뷰어)
```
viewer/src/
├── main.ts            # 엔트리포인트
├── renderer/          # Three.js 렌더러
│   └── camera/        # 2D/3D 카메라
├── loader/            # JSON → Three.js
└── selection/         # Phase 2 Selection UI
```

### 왜 다르게 설계했나?

| SpineLift 문제점 | AI-Native CAD 해결책 |
|-----------------|---------------------|
| MCP 4계층 복잡성 | Direct-First (1계층) |
| 브라우저 필수 의존성 | Node.js에서 WASM 직접 실행 |
| 실시간 양방향 통신 필요 | 파일 기반 단방향 (Vite HMR) |
| 복잡한 상태 관리 | 파일이 곧 상태 (JSON) |
| WebSocket 연결 관리 | 연결 관리 불필요 |

### 교훈

1. **MCP는 우회로**: 브라우저에 있는 것에 접근하기 위한 것. WASM이 Node.js에서 직접 돌면 불필요.
2. **Direct-First**: 직접 실행 가능하면 직접 실행. 래퍼는 나중에 필요할 때.
3. **AX 철학**: AI가 도구를 직접 조작, 인간은 검증만. 브라우저는 "검증 UI"로만 역할.
4. **단순함 우선**: React/Zustand 없이도 CAD 뷰어는 충분히 구현 가능.
