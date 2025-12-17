# Architecture Document - AI-Native CAD

**Author:** Hoons
**Date:** 2025-12-17 (Updated)

---

## Tech Stack (Phase 1 확정)

> **최종 업데이트: 2025-12-17** - Phase 1 기준 기술 스택 확정
> Phase 2 이후 마이그레이션은 별도 검토

### Phase 1 Tech Stack Summary

| 컴포넌트 | 기술 | 버전 | 비고 |
|---------|------|------|------|
| **CAD Engine** | Rust | 1.85.0+ (stable) | WASM 빌드 |
| **WASM 빌드** | wasm-pack | 0.13.1 | drager fork |
| **WASM 바인딩** | wasm-bindgen | 0.2.92 | 안정 버전 |
| **런타임** | Node.js | 22.x LTS | Maintenance LTS |
| **뷰어** | HTML Canvas 2D | - | 가장 단순 |
| **빌드 도구** | 없음 (정적 서버) | - | Phase 1 단순화 |
| **테스트** | Vitest | 3.x | 또는 Jest |

---

### CAD Engine

#### Rust 버전

| 옵션 | 버전 | 장점 | 단점 |
|------|------|------|------|
| ~~A~~ | ~~1.85.0~~ | Rust 2024 Edition 첫 버전, 안정성 | 최신 기능 일부 없음 |
| **B ✓** | **1.85.0+ (stable)** | Rust 2024 Edition, 안정성 | - |

> **결정**: 1.85.0 이상 stable 사용 (2024 Edition 기준)
> 참고: [Rust Releases](https://releases.rs/)

#### WASM 빌드 도구

> ⚠️ **배경**: rustwasm 조직이 **2025년 7월 sunset**됨.
> 단, **wasm-bindgen은 [새 조직](https://github.com/wasm-bindgen/wasm-bindgen)으로 이전되어 활발히 유지보수 중** (2025-12-08 업데이트).
> wasm-pack은 [drager](https://github.com/drager/wasm-pack)가 fork하여 유지보수 중.

| 옵션 | 도구 | 장점 | 단점 |
|------|------|------|------|
| **A ✓** | **wasm-pack 0.13.1** ([drager fork](https://github.com/drager/wasm-pack)) | 기존 방식, 문서 풍부, 원클릭 빌드 | 장기 유지보수 불확실 |
| B | 직접 빌드 (cargo + wasm-bindgen CLI + wasm-opt) | 의존성 최소화, 투명함 | 수동 설정 필요, 빌드 스크립트 작성 |
| ~~C~~ | ~~Trunk~~ | ~~자동 도구 관리~~ | Node.js 타겟에 부적합 |

> **결정**: 옵션 A (wasm-pack) - 빠른 시작
> **장기 고려**: 옵션 B (직접 빌드) - wasm-pack 이슈 발생 시 전환
> 참고: [Life after wasm-pack](https://nickb.dev/blog/life-after-wasm-pack-an-opinionated-deconstruction/)

#### wasm-bindgen 버전

| 옵션 | 버전 | 장점 | 단점 |
|------|------|------|------|
| **A ✓** | **0.2.92** | 안정, 240M+ 다운로드 검증 | - |
| B | 0.2.99+ | 최신 버그 수정 | 새 버전이라 이슈 가능성 |

> **결정**: 0.2.92 - 안정성 우선

#### 기타 Rust 크레이트

| 크레이트 | 권장 버전 | 비고 |
|----------|----------|------|
| serde | 1.0.x | 사실상 표준, 최신 사용 |
| uuid | 1.x | `js` feature 필요 (getrandom 이슈 회피) |

---

### Viewer / Runtime

#### Node.js 버전

> ⚠️ **Node.js 18은 2025년 4월 EOL**. 신규 프로젝트에서 사용 금지.

| 옵션 | 버전 | 장점 | 단점 |
|------|------|------|------|
| A | 20.19.x (Maintenance LTS) | Vite 7 최소 요구사항 충족 | 2027년 4월까지만 지원 |
| **B ✓** | **22.x (Maintenance LTS)** | Vite 7/8 호환, 더 긴 지원 | - |
| C | 24.x (Active LTS) | 현재 Active LTS | 일부 패키지 호환성 이슈 가능 |

> **결정**: 22.x LTS - 안정성과 지원 기간 균형
> 참고: [Node.js Releases](https://nodejs.org/en/about/previous-releases)

#### Phase 1 뷰어: HTML Canvas 2D

> Phase 1에서는 별도 라이브러리 없이 브라우저 내장 Canvas 2D API 사용

| 옵션 | 기술 | 장점 | 단점 |
|------|------|------|------|
| **✓** | **HTML Canvas 2D** | 가장 단순, 의존성 없음, 100% 호환 | 3D 미지원 |

> **결정**: Canvas 2D - Phase 1 단순화

#### Phase 2+ 뷰어: Three.js (참고)

| 옵션 | 버전 | 장점 | 단점 |
|------|------|------|------|
| A | r175 | 안정성 검증됨 | 몇 달 전 버전 |
| B | r182 | **현재 최신** (2025-12-11 릴리즈) | 최신이라 이슈 가능성 |

> Phase 2 착수 시 결정 (Phase 1에서는 불필요)
> 참고: [Three.js Releases](https://github.com/mrdoob/three.js/releases)

#### 빌드 도구 (Vite)

> **Vite 8 Beta** (2025-12-03): Rolldown 기반, 빌드 속도 대폭 개선 (46s→6s 사례)

| 옵션 | 버전 | 장점 | 단점 |
|------|------|------|------|
| **A ✓** | **사용 안 함** | 단순함, 정적 서버로 충분 | HMR 불가 |
| B | 7.2.x | 현재 stable | Phase 1에서는 과잉 |
| C | 8.x Beta | Rolldown 기반 | Beta 상태 |

> **결정**: Phase 1에서는 Vite 미사용 - 정적 HTML + polling으로 충분
> Phase 2+에서 Vite 7.x 도입 검토
> 참고: [Vite Releases](https://vite.dev/releases)

#### TypeScript 버전

| 옵션 | 버전 | 장점 | 단점 |
|------|------|------|------|
| A | 5.5.x | 안정, 널리 사용 | 최신 기능 없음 |
| **B ✓** | **5.7.x** | 최신, 타입 추론 개선 | - |

> **결정**: 5.7.x - 최신 기능 활용 (Phase 1 뷰어는 JS로 단순 구현)

#### 테스트 프레임워크

| 옵션 | 도구 | 장점 | 단점 |
|------|------|------|------|
| **A ✓** | **Vitest 3.x** | 빠름, 현대적 | - |
| B | Jest 29.x | 널리 사용 | 설정 복잡 |

> **결정**: Vitest 3.x - Vite 없이도 사용 가능, 빠른 실행

---

### 버전 선택 의존성

> 일부 버전은 다른 선택에 따라 결정됨

```
뷰어 갱신 전략 선택
    │
    ├─▶ Polling 선택 시
    │       └─▶ Vite 선택적
    │       └─▶ Node.js 20+ (18은 EOL)
    │       └─▶ 테스트: Jest도 가능
    │
    └─▶ HMR 선택 시
            └─▶ Vite 7+ 필수
            └─▶ Node.js 20.19+ 또는 22.12+
            └─▶ 테스트: Vitest 권장
```

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
                                     │ Polling
                                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Browser Viewer                        │
│          (Phase 1: Canvas 2D / Phase 2+: Three.js)      │
├─────────────────────────────────────────────────────────┤
│    ┌─────────────┐     ┌─────────────────────────┐     │
│    │   Renderer  │     │   Selection UI          │     │
│    │   (2D)      │     │   (Phase 3)             │     │
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
│       └── dxf.rs       # Phase 3
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
│   └── selection/            # Phase 3
│       ├── SelectionManager.ts
│       └── SelectionEvent.ts
├── scene.json                # WASM 출력 파일 (여기에 저장)
├── index.html
└── package.json
```

### 3. Output 경로 전략 (미결정)

> Phase 1 구현 시 선택 필요.

#### 옵션 A: viewer 내부 저장 (단순함 우선)

```
프로젝트 루트/
├── cad-engine/
│   └── pkg/              # WASM 빌드 결과
└── viewer/
    └── scene.json        # WASM 출력 (뷰어가 바로 접근)
```

**장점**: Polling으로 바로 접근, 별도 설정 불필요
**단점**: 출력물과 뷰어 코드가 같은 폴더에 섞임

#### 옵션 B: 별도 output 폴더

```
프로젝트 루트/
├── cad-engine/
├── output/
│   └── scene.json        # WASM 출력
└── viewer/
```

**장점**: 관심사 분리 명확
**단점**: Vite 사용 시 `server.fs.allow` 설정 필요, 경로 관리 복잡

---

## Data Flow

### Phase 1: 말하기만 (최소 검증)

```
1. User → Claude Code: "사람 스켈레톤을 그려줘"
2. Claude Code → WASM: cad.add_circle(), cad.add_line() 등
3. WASM → File: scene.json (Three.js용)
4. File → Browser: Polling (500ms)
5. Browser → User: Three.js 렌더링
```

### Phase 2: 도메인 확장 (여전히 말하기만)

```
1. User → Claude Code: "팔을 구부린 포즈로 바꿔줘"
2. Claude Code: 그룹화된 엔티티 인식, 관절 기준 계산
3. Claude Code → WASM: cad.rotate(), cad.translate() 조합
4. WASM → File: scene.json 업데이트
5. Claude Code: ActionHints 반환 → "다리도 구부릴까요?"
```

### Phase 3: 가리키기 + 말하기

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
│                 └─▶ Polling → 브라우저 갱신             │
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
impl Serializer for StlSerializer { ... }  // Phase 4 (필수)
// impl Serializer for StepSerializer { ... }  // Phase 4 (옵션, 추후)
```

---

## Viewer Architecture

### 렌더링 기술 선택 (Phase별 점진적 도입)

> **리서치 기반 (2025-12-16)**: Phase별 점진적 복잡도 증가 전략
>
> **Phase 1: HTML Canvas 2D (JS)** - 개념 검증에 집중, 구현 부담 최소화
> **Phase 2: Three.js** - 3D 준비, 마이그레이션 비용 감수
> **Phase 3+: wgpu 검토** - 성능 필요 시 도입

#### Phase별 렌더러 전략

| Phase | 렌더러 | 이유 | 트레이드오프 |
|-------|--------|------|-------------|
| **Phase 1** | HTML Canvas 2D | 가장 단순, 빠른 검증 | 3D 미지원 |
| **Phase 2** | Three.js | 3D 준비, 성숙한 생태계 | JSON 변환 오버헤드 |
| **Phase 3+** | wgpu (검토) | 성능 최적화 필요 시 | 구현 비용 높음 |

#### Phase 1: HTML Canvas 2D (권장)

```
┌──────────────┐    JSON     ┌──────────────┐
│ CAD Engine   │ ──────────▶ │  Canvas 2D   │
│ (Rust/WASM)  │   파일 I/O   │  (JS)        │
└──────────────┘             └──────────────┘
     ✓ 가장 단순, 구현 1일
     ✓ 브라우저 100% 호환
     ✓ 디버깅 용이
     ✗ 3D 미지원 (Phase 1에서는 불필요)
```

**구현 예시 (Phase 1)**:
```javascript
// viewer/src/renderer.js
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function render(scene) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const entity of scene.entities) {
    switch (entity.type) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(entity.geometry.center[0], entity.geometry.center[1],
                entity.geometry.radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(entity.geometry.points[0][0], entity.geometry.points[0][1]);
        for (const p of entity.geometry.points.slice(1)) {
          ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
        break;
      case 'rect':
        ctx.strokeRect(entity.geometry.origin[0], entity.geometry.origin[1],
                       entity.geometry.width, entity.geometry.height);
        break;
    }
  }
}
```

#### Phase 2+: Three.js

```
┌──────────────┐    JSON     ┌──────────────┐
│ CAD Engine   │ ──────────▶ │  Three.js    │
│ (Rust/WASM)  │   파일 I/O   │  (JS)        │
└──────────────┘             └──────────────┘
     ✓ 3D 준비 완료
     ✓ 풍부한 생태계
     ⚠️ 두 개의 런타임
```

#### Phase 3+: wgpu (옵션)

성능 병목이 발생하거나 대규모 모델 처리가 필요할 때 검토:

```
┌─────────────────────────────────────────┐
│      CAD Engine + Renderer              │
│           (Rust/WASM)                   │
│                                         │
│   Geometry ──▶ GPU Buffer ──▶ Render    │
└─────────────────────────────────────────┘
     ✓ 단일 런타임, 직접 GPU 접근
     ✓ 최고 성능
     ✗ 구현 비용 높음
```

#### Three.js vs wgpu 비교 (참고)

| 항목 | Three.js | wgpu |
|------|----------|------|
| **언어** | JavaScript | Rust |
| **렌더링** | WebGL/WebGPU | WebGPU (WebGL2 fallback) |
| **CAD 엔진 통합** | ❌ JSON 중간 레이어 | ✓ 단일 WASM |
| **2D 지원** | ✓ OrthographicCamera | ✓ 직접 구현 |
| **3D 지원** | ✓ PerspectiveCamera | ✓ 직접 구현 |
| **번들 크기** | ~1MB (JS) | ~500KB (WASM) |
| **구현 난이도** | 낮음 | 높음 |
| **생태계 성숙도** | 높음 | 중간 (활발히 발전 중) |

#### wgpu 구현 가능성

**참조 가능한 오픈소스**:

| 프로젝트 | 용도 | 링크 |
|----------|------|------|
| **Learn Wgpu** | 단계별 튜토리얼 | [sotrh.github.io/learn-wgpu](https://sotrh.github.io/learn-wgpu/) |
| **wgpu/examples** | 공식 예제 | [github.com/gfx-rs/wgpu](https://github.com/gfx-rs/wgpu/tree/trunk/examples) |
| **lyon** | Path tessellation (Bezier) | [github.com/nical/lyon](https://github.com/nical/lyon) |
| **FemtoVG** | Canvas 2D 스타일 API | [github.com/femtovg/femtovg](https://github.com/femtovg/femtovg) |
| **wgpu-rust-renderer** | 3D + WASM 예제 | [github.com/takahirox](https://github.com/takahirox/wgpu-rust-renderer) |

#### Rust 그래픽 알고리즘 라이브러리

> **리서치 기반 (2025-12-16)**: CAD에 필요한 핵심 알고리즘 라이브러리 현황

**사용 가능한 라이브러리 (상업용 허용)**:

| 라이브러리 | 용도 | 라이선스 | 안정성 | 최근 활동 |
|-----------|------|----------|--------|-----------|
| **wgpu** | GPU 렌더링 | MIT/Apache-2.0 | ⚠️ 활발 (breaking changes) | 2025-01 (v24.0) |
| **lyon** | Path tessellation | MIT/Apache-2.0 | ✅ 안정 | 2025-01 커밋 |
| **glyphon** | Text rendering (wgpu용) | MIT/Apache-2.0/Zlib | ✅ 안정 | 활발 |
| **femtovg** | 2D Canvas API | MIT/Apache-2.0 | ✅ 안정 | 활발 |
| **cdt** | Delaunay triangulation | MIT/Apache-2.0 | ✅ 안정 | 성숙 |
| **boostvoronoi** | Voronoi diagram | BSL-1.0 | ✅ 안정 | 성숙 |
| **geo-booleanop** | Boolean operations | MIT/Apache-2.0 | ✅ 안정 | 성숙 |

> **모든 라이브러리가 상업적 사용 가능** (MIT, Apache-2.0, BSL-1.0 모두 허용적 라이선스)

**Phase별 필요 라이브러리**:

| Phase | 필요 기능 | 라이브러리 | 충족 여부 |
|-------|----------|-----------|-----------|
| **1-2** | Path tessellation | lyon | ✅ |
| **1-2** | Text rendering | glyphon | ✅ |
| **1-2** | 2D vector drawing | femtovg | ✅ |
| **3** | Triangulation | cdt | ✅ |
| **3** | Boolean ops | geo-booleanop | ✅ |
| **4+** | 3D Boolean | - | ❌ 직접 구현 필요 |
| **4+** | NURBS/Spline | - | ⚠️ 제한적 |

**C++ CGAL 대비 부족한 영역** (Phase 4+ 해당):
- 3D Boolean operations
- NURBS/B-Spline 곡면
- 고급 Mesh processing
- Convex Hull 3D

→ Phase 4+에서 필요 시 직접 구현 또는 FFI 바인딩 검토

#### wgpu 생태계 안정성 (리스크)

> **출처**: [The state of realtime graphics in Rust (Feb 2025)](https://valerioviperino.me/the-state-of-realtime-graphics-in-rust-feb-2025/)

**현황**:
- wgpu v22가 첫 "v1" 릴리스 (2024-07)
- v24.0.1 (2025-01) 현재도 "moving fast and breaking things" 단계
- 다수 프레임워크 (ggez, nannou, comfy) 유지보수 중단 또는 지연

**완화 전략**:
1. **버전 고정**: `wgpu = "=24.0"` 으로 특정 버전 고정
2. **추상화 레이어**: CADRenderer trait로 wgpu 직접 의존성 격리
3. **의존성 최소화**: wgpu 핵심 기능만 사용, 고수준 래퍼 피함
4. **Fallback 유지**: Three.js 옵션 보존

```toml
# Cargo.toml 예시 - 버전 고정
[dependencies]
wgpu = "=24.0"      # 정확한 버전 고정
lyon = "1.0"        # 안정적, 메이저 버전 고정
glyphon = "0.9"     # 안정적
```

**2D Primitives 구현 난이도**:

| 도형 | 구현 방식 | 복잡도 |
|------|----------|--------|
| Line | `LineList` topology | 낮음 |
| Rect | 2 triangles | 낮음 |
| Circle | sin/cos 정점 또는 SDF shader | 중간 |
| Arc | 각도 기반 정점 생성 | 중간 |
| Bezier | lyon tessellation | 중간 (라이브러리 활용) |

#### Phase별 권장 (점진적 도입)

| Phase | 렌더러 | 이유 |
|-------|--------|------|
| **Phase 1** | HTML Canvas 2D | 가장 단순, 빠른 개념 검증 |
| **Phase 2** | Three.js | 3D 준비, 마이그레이션 비용 감수 |
| **Phase 3** | Three.js (또는 wgpu 검토) | 성능 필요 시 wgpu 도입 |
| **Phase 4+** | wgpu (필요 시) | 대규모 모델, 성능 최적화 |

#### 마이그레이션 비용 허용

Phase 1 → Phase 2 마이그레이션:
- Canvas 2D → Three.js로 렌더러 교체
- scene.json 포맷은 동일 유지
- CAD 엔진 변경 없음

> **의도적 선택**: Phase 1에서 빠르게 검증하고, Phase 2에서 마이그레이션 비용을 감수하는 것이
> 처음부터 wgpu를 구현하는 것보다 전체 일정에 유리

#### wgpu 도입 시점 (Phase 3+)

wgpu를 검토해야 하는 신호:
- Three.js에서 렌더링 병목 발생
- 대규모 모델 (수만 개 도형) 처리 필요
- CAD 엔진과 렌더러 간 JSON 변환 오버헤드 문제

→ Phase 3 이후 성능 프로파일링 결과에 따라 결정

#### 기타 옵션 (참고)

| 옵션 | 특징 | 적합성 |
|------|------|--------|
| **Bevy** | wgpu 기반 게임 엔진 | ❌ 오버헤드, 3.5MB+ |
| **CanvasKit** | Figma 사용, 2D 최적화 | ❌ 3D 미지원 |
| **rend3** | wgpu 기반 3D | ⚠️ 유지보수 모드 |

---

### wgpu 기반 통합 렌더러 (Phase 3+ 옵션)

> **참고**: Phase 3 이후 성능 요구사항에 따라 검토. Phase 1-2에서는 사용하지 않음.

```rust
// renderer/src/lib.rs
pub struct CADRenderer {
    device: wgpu::Device,
    queue: wgpu::Queue,
    pipeline_2d: wgpu::RenderPipeline,
    pipeline_3d: wgpu::RenderPipeline,
    camera: Camera,
}

impl CADRenderer {
    // 2D 모드
    pub fn set_2d_mode(&mut self) {
        self.camera = Camera::orthographic(/* ... */);
    }

    // 3D 모드
    pub fn set_3d_mode(&mut self) {
        self.camera = Camera::perspective(/* ... */);
    }

    // Scene 직접 렌더링 (JSON 변환 없음)
    pub fn render(&mut self, scene: &Scene) {
        // GPU 버퍼에 직접 기하 데이터 전송
        for entity in &scene.entities {
            self.draw_entity(entity);
        }
    }
}
```

### 뷰어 갱신 전략

> Phase 1-2: JSON 파일 polling 방식
> Phase 3+: wgpu 통합 시 직접 렌더링 가능

#### Phase 1-2: JSON + Polling (기본)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Code 세션                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Claude Code가 CAD Engine 함수 호출                          │
│     scene.add_circle(0, 0, 10);                                 │
│                                                                 │
│  2. WASM이 scene.json 파일 출력                                  │
│                                                                 │
│  3. 브라우저가 polling으로 갱신 (500ms 간격)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```javascript
// Phase 1: Canvas 2D
setInterval(async () => {
    const scene = await fetch('scene.json').then(r => r.json());
    renderCanvas2D(scene);  // ctx.arc(), ctx.lineTo() 등
}, 500);

// Phase 2+: Three.js
setInterval(async () => {
    const scene = await fetch('scene.json').then(r => r.json());
    renderThreeJS(scene);
}, 500);
```

#### Phase 3+: wgpu 통합 (옵션)

성능 요구사항에 따라 직접 렌더링으로 전환:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Claude Code가 CAD Engine 함수 호출                          │
│  2. Rust 엔진이 Scene 상태 업데이트 + 렌더링                     │
│  3. wgpu가 Canvas에 즉시 반영 (파일 I/O 없음, ~1ms)             │
└─────────────────────────────────────────────────────────────────┘
```

### 개발 워크플로우

```bash
# wgpu 렌더러 (권장)
cd cad-engine
wasm-pack build --target web --release
# 브라우저에서 직접 테스트

# Three.js fallback
cd viewer && npm run dev
```

---

## Future Extensions

### Phase 2: 도메인 확장 (그룹화, ActionHints)

> Phase 1 도구에 그룹화, 레이어, ActionHints 추가.
> 여전히 "말하기만" 인터페이스 유지.

**추가 API**:
```typescript
// 그룹화
cad.create_group(name: string, entity_ids: string[]) -> string
cad.ungroup(group_id: string)

// 레이어
cad.create_layer(name: string) -> string
cad.set_layer(entity_id: string, layer_id: string)

// ActionHints (응답에 포함)
interface ActionHints {
    recommended: { action: string, reason: string }[];
    warnings?: string[];
}
```

### Phase 3: Selection UI

> **역방향 통신 필요**: "브라우저 선택 → Claude Code" 방향은 파일 polling만으로 불가능합니다.
> Phase 3에서는 다음 중 하나가 필요합니다:
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

### Phase 4: Gateway + Chat UI

```
User (Browser)
    ↓ WebSocket
Gateway (Node.js)
    ↓ subprocess
Claude Code CLI
    ↓ WASM
CAD Engine
```

### Phase 4: MCP Wrapper

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

> 상세 버전 옵션은 **[Tech Stack (미결정)](#tech-stack-미결정)** 섹션 참조.
> Phase 1 착수 전 팀 합의로 버전 확정 필요.

| 컴포넌트 | 기술 | 비고 |
|---------|------|------|
| CAD Engine | Rust + wasm-bindgen + wasm-pack | WASM 빌드 |
| Viewer | Three.js + TypeScript | 2D/3D 렌더링 |
| Dev Server | Vite (선택적) | Polling 시 불필요 |
| Test | Vitest 또는 Jest | 선택에 따라 |
| E2E Test | Playwright | Phase 3용 |
| Runtime | Node.js 18+ 또는 20+ | Vite 선택에 따라 |

---

## Deployment Strategy

> **리서치 기반 (2025-12-16)**: Cursor, Jan AI, LM Studio, Figma 등 실제 사례 분석

### 데스크톱 프레임워크 선택: Electron

> **결정: Electron 사용** - WebGL/Three.js 기반 CAD 앱에서 Tauri는 치명적 리스크

#### 왜 Electron인가?

| 항목 | Electron | Tauri | 비고 |
|------|----------|-------|------|
| **WebGL 성능** | Chromium (최고) | WebKit (4.5배 느림) | **결정적 차이** |
| **WebGL2** | 완전 지원 | 일부 미작동 보고 | Three.js 필수 |
| **120Hz** | 네이티브 | 60Hz 고정 | UX 차이 |
| **앱 크기** | ~100MB | ~10MB | 트레이드오프 허용 |
| **메모리** | 100-300MB | 30-40MB | 트레이드오프 허용 |
| **성숙도** | VS Code, Figma, Slack | Jan AI (LLM 앱) | 그래픽 앱 검증됨 |

> 참고: [Tauri vs Electron 2025](https://codeology.co.nz/articles/tauri-vs-electron-2025-desktop-development.html)

#### Tauri WebGL 치명적 문제 (우리 프로젝트에 부적합)

> **경고**: WebGL/Three.js 앱에서 Tauri 사용 금지

| 문제 | 상세 | 출처 |
|------|------|------|
| **WebGL2 미작동** | WKWebView에서 WebGL2 사용 불가 | [GitHub #2866](https://github.com/tauri-apps/tauri/issues/2866) |
| **Safari 4.5배 느림** | Chrome 7초 vs Safari 32초 | [Apple Developer](https://developer.apple.com/forums/thread/696821) |
| **60fps→jittery** | FPS 표시 정상인데 화면 끊김 | [Babylon.js Forum](https://forum.babylonjs.com/t/performance-between-safari-and-wkwebview-tauri/60811) |
| **Metal 백엔드 문제** | Apple WebGL→Metal 변환 구조적 이슈 | 근본 해결 어려움 |

**Tauri가 적합한 앱**: LLM 채팅 (Jan AI), 텍스트 에디터 - WebGL 없는 앱
**Tauri가 부적합한 앱**: CAD, 게임, 3D 뷰어 - **우리 프로젝트**

### 권장 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                   AI-Native CAD (권장 구조)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Electron App (~100MB)                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │  Chromium   │  │  Node.js    │  │ WASM CAD Engine │  │   │
│  │  │  (Three.js) │  │  (IPC/파일) │  │ (기하학 연산)   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    LLM 연결 (선택)                       │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │   │
│  │  │ 로컬 LLM  │  │ 사용자 API │  │ 서비스 API (옵션) │   │   │
│  │  │ (Ollama)  │  │ 키 입력    │  │                   │   │   │
│  │  └───────────┘  └───────────┘  └───────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 참고 사례

#### Figma (Electron + WebGL)
- **프레임워크**: Electron + BrowserView
- **렌더링**: WebGL 기반 캔버스
- **특징**: 웹/데스크톱 동일 코드베이스
- [Figma BrowserView](https://www.figma.com/blog/introducing-browserview-for-electron/)

#### Jan AI (Tauri - 참고만)
- **프레임워크**: Tauri (Rust + WebView)
- **특징**: LLM 채팅 앱 (WebGL 없음)
- **교훈**: WebGL 없는 앱에서만 Tauri 유효
- [GitHub - Jan AI](https://github.com/janhq/jan)

#### Cursor (피해야 할 패턴)
- **문제점**: 서버 의존적 - 모든 요청이 Cursor 서버 경유
- **오프라인**: 불가능
- [Cursor 아키텍처 분석](https://www.tensorzero.com/blog/reverse-engineering-cursors-llm-client/)

### LLM 연결 옵션

| 옵션 | 방식 | 장점 | 단점 |
|------|------|------|------|
| A | 로컬 LLM (Ollama 등) | 완전 오프라인, 보안, 무료 | 하드웨어 필요, 성능 제한 |
| B | 사용자 API 키 입력 | 단순, 비용 사용자 부담 | 키 관리 책임 사용자 |
| C | 서비스 API 제공 | UX 간편, 모델 선택 가능 | 서비스 운영 비용 발생 |

> **핵심 원칙**: Cursor와 달리 **서버 의존성 없이** 옵션 A, B가 완전히 동작해야 함

### 초기 전략 (Phase 1-2)

1. **Electron 로컬 앱**: WebGL 성능 보장, Figma 검증 패턴
2. **오프라인 우선**: 로컬 LLM (옵션 A) 완전 지원
3. **클라우드 선택적**: 사용자 API 키 (옵션 B) 지원
4. **수요 검증 후**: 서비스 API (옵션 C), 웹 버전 고려

### 장기 확장성

- **Figma/Slack 모델**: 데스크톱 + 웹 동시 제공 가능
- **엔터프라이즈**: 옵션 A (로컬 LLM)로 완전 폐쇄망 지원
- **SaaS**: 옵션 C 확장으로 구독 모델 가능

### WASM 크로스 플랫폼 현황

> **리서치 기반 (2025-12-16)**: 브라우저 호환성 및 rustwasm 생태계 상황

#### 브라우저 호환성

| 브라우저 | WASM 지원 | 비고 |
|----------|----------|------|
| Chrome | 57+ (2017~) | 완전 지원 |
| Firefox | 52+ (2017~) | 완전 지원 |
| Safari | 11+ (2017~) | 완전 지원, WasmGC 미지원 |
| Edge | 16+ (2017~) | 완전 지원 (Chromium 기반) |
| IE | 미지원 | 전 버전 미지원 |

> 전체 호환성 점수: 92/100, 83% 웹 사용자 접근 가능
> 참고: [Can I Use - WASM](https://caniuse.com/wasm)

#### 주요 제한사항

| 제한 | 영향 | 우리 프로젝트 영향 |
|------|------|-------------------|
| **DOM 직접 조작 불가** | JS 경유 필수 | Three.js가 처리 → 영향 없음 |
| **WasmGC 미지원** (Safari) | GC 언어 컴파일 제한 | Rust는 GC 없음 → 영향 없음 |
| **WASM Threads** | Cross-Origin Isolation 필요 | 아래 상세 참조 |
| **4GB 메모리 제한** | WASM 32비트 한계 | 아래 상세 참조 |
| **iOS Chrome** | WebKit 사용 (Safari와 동일) | 모바일 Phase 4+ → 추후 검토 |

### WASM 성능 및 메모리 관리

> **중요**: CAD 프로젝트가 커질수록 CPU/메모리 컨트롤이 핵심 과제

#### WASM Threads (멀티스레딩)

**브라우저 지원 현황**:

| 브라우저 | 지원 버전 | 상태 |
|----------|----------|------|
| Chrome | 74+ (2019~) | 완전 지원 |
| Firefox | 79+ (2020~) | 완전 지원 |
| Safari | 14.1+ (2021~) | 완전 지원 |
| Edge | 79+ (Chromium) | 완전 지원 |

> 참고: [Can I Use - WASM Threads](https://caniuse.com/wasm-threads)

**필수 요구사항 - Cross-Origin Isolation**:

```
WASM Threads = SharedArrayBuffer 사용
SharedArrayBuffer = Spectre 취약점 때문에 기본 비활성화

활성화 조건 (서버 헤더):
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Electron에서**: Chromium 번들이므로 헤더 설정으로 WASM Threads 완전 지원

> 참고: [MDN - SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)

#### SharedArrayBuffer: 언제 정말 필요한가?

> 리서치 기반: 실제 사용 사례 분석

**SharedArrayBuffer 없이도 되는 경우** (Web Workers로 충분):

```
┌─────────────────────────────────────────────────────────────────┐
│  작업이 독립적 = SharedArrayBuffer 불필요                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  예: 각 픽셀/도형을 독립적으로 계산                              │
│                                                                 │
│  Main Thread                                                    │
│      │                                                          │
│      ├── postMessage(도형1~100) ──▶ Worker 1 ──▶ 결과 반환      │
│      ├── postMessage(도형101~200) ──▶ Worker 2 ──▶ 결과 반환    │
│      └── postMessage(도형201~300) ──▶ Worker 3 ──▶ 결과 반환    │
│                                                                 │
│  → 데이터 복사 발생하지만, 독립 작업이면 충분히 빠름              │
│  → COOP/COEP 헤더 불필요                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> 참고: [Tweag - Wasm Threads and Messages](https://www.tweag.io/blog/2022-11-24-wasm-threads-and-messages/)

**SharedArrayBuffer가 정말 필요한 경우**:

| 상황 | 왜 필요한가 | 예시 |
|------|------------|------|
| **동기적 스레드 통신** | 락/배리어로 조율 필요 | 물리 시뮬레이션 |
| **같은 메모리 공유** | 복사 없이 직접 접근 | 대용량 메시 편집 |
| **대용량 데이터** | 복사 비용이 연산 비용 초과 | 수백만 vertex |
| **Emscripten pthread** | C++ 멀티스레드 코드 포팅 | 기존 CAD 엔진 |

> 참고: [Emscripten Wasm Workers](https://emscripten.org/docs/api_reference/wasm_workers.html)

**우리 프로젝트 분석**:

```
┌─────────────────────────────────────────────────────────────────┐
│                  Phase별 SharedArrayBuffer 필요성                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: 불필요 ✓                                              │
│  - line, circle, rect 수십~수백 개                              │
│  - 단일 스레드로 <1ms 처리                                       │
│                                                                 │
│  Phase 2: 불필요 ✓                                              │
│  - 그룹화, 레이어 추가                                          │
│  - 여전히 단일 스레드로 충분                                     │
│                                                                 │
│  Phase 3: 선택적 (SIMD 우선)                                    │
│  - 복잡한 3D 도형                                               │
│  - SIMD로 4배 향상 먼저 시도                                     │
│  - 그래도 부족하면 Web Workers (독립 작업)                       │
│                                                                 │
│  Phase 4+: 필요할 수 있음                                       │
│  - 수백만 vertex 메시                                           │
│  - 동시 편집 (같은 메모리 접근)                                  │
│  - 이 시점에 COOP/COEP 헤더 설정                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**결론**: Phase 1-3은 SharedArrayBuffer 없이 개발 가능. Phase 4+에서 필요 시 도입.

> 참고: [web.dev - WASM Threads](https://web.dev/articles/wasm-threads)

**성능 향상 벤치마크** (TensorFlow WASM):

| 최적화 | 성능 향상 |
|--------|----------|
| SIMD만 | 1.7~4.5배 |
| SIMD + 멀티스레딩 | 추가 1.8~2.9배 |
| **총합** | **최대 13배** |

> 참고: [InfoQ - WASM SIMD & Multi-Threading](https://www.infoq.com/articles/webassembly-simd-multithreading-performance-gains/)

#### 4GB 메모리 제한

```
┌─────────────────────────────────────────────────────────────────┐
│                    WASM 메모리 아키텍처                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WASM 32비트 = 최대 4GB 선형 메모리                             │
│  (Chrome: 예전 2GB → 현재 4GB)                                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Phase 1-2: 안전                                        │   │
│  │  - 단순 도형 수백~수천 개 = 수십 MB                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Phase 3+: 주의 필요                                     │   │
│  │  - 복잡한 3D 모델 = 수백 MB~수 GB                        │   │
│  │  - Undo/Redo 히스토리 누적                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Phase 4+: 한계 도달 가능                                │   │
│  │  - 대형 CAD 어셈블리 = 4GB 초과 가능                     │   │
│  │  - 완화: 분할 로딩, LOD, Memory64 (미래)                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> 참고: [Rust Forum - WASM 4GB Workarounds](https://users.rust-lang.org/t/wasm-32bit-4gb-workarounds/55490)

#### Phase별 성능 전략

| Phase | CPU 전략 | 메모리 전략 |
|-------|----------|------------|
| **Phase 1** | 단일 스레드 충분 | 수십 MB, 관리 불필요 |
| **Phase 2** | 단일 스레드 | 히스토리 크기 제한 |
| **Phase 3** | SIMD 고려 (기하 연산) | LOD, 점진적 로딩 |
| **Phase 4+** | 멀티스레딩 필수 | 분할 로딩, 메모리 풀 |

#### CAD 최적화 기법 (Phase 3+)

**메모리 최적화**:

```rust
// 1. 메모리 풀 - 빈번한 할당/해제 방지
struct EntityPool {
    entities: Vec<Entity>,
    free_indices: Vec<usize>,
}

// 2. LOD (Level of Detail)
fn get_entity_lod(&self, zoom: f64) -> EntityLOD {
    if zoom < 0.1 { EntityLOD::BoundingBox }
    else if zoom < 0.5 { EntityLOD::Simplified }
    else { EntityLOD::Full }
}

// 3. 점진적 로딩
fn load_scene_incremental(&mut self, chunk_size: usize) {
    // 청크 단위로 로딩, UI 블로킹 방지
}
```

**CPU 최적화**:

```rust
// 1. SIMD (wasm32-unknown-unknown + simd128)
#[cfg(target_feature = "simd128")]
fn transform_points_simd(points: &mut [f32]) {
    // 4개 점 동시 변환
}

// 2. 멀티스레딩 (rayon + wasm-bindgen-rayon)
#[cfg(feature = "parallel")]
fn mesh_geometry_parallel(&self) -> Mesh {
    self.faces.par_iter()
        .map(|face| face.triangulate())
        .collect()
}
```

> 참고: [Medium - WebAssembly for CAD](https://altersquare.medium.com/webassembly-for-cad-applications-when-javascript-isnt-fast-enough-56fcdc892004)

#### Memory64: 4GB 제한 해제 (Stable)

> **2025년 현재: 더 이상 실험적이 아님!**

**브라우저 지원 현황**:

| 브라우저 | 버전 | 상태 |
|----------|------|------|
| Chrome | 133+ (2025.01) | **Stable** |
| Firefox | 134+ (2025.01) | **Stable** |
| Safari | 구현 중 | 2025년 내 예상 |
| Edge | Chromium 기반 | **Stable** |

> WASM 3.0에 공식 포함 (2025년 9월 17일 완료)
> 참고: [SpiderMonkey Blog](https://spidermonkey.dev/blog/2025/01/15/is-memory64-actually-worth-using.html)

**Rust 지원**:

```rust
// wasm64-unknown-unknown 타겟 (Stable)
// Cargo.toml 또는 빌드 시
rustup target add wasm64-unknown-unknown
cargo build --target wasm64-unknown-unknown
```

> 참고: [Rust wasm64 Target](https://doc.rust-lang.org/rustc/platform-support/wasm64-unknown-unknown.html)

**성능 트레이드오프** (중요):

```
┌─────────────────────────────────────────────────────────────────┐
│                    Memory64 성능 고려사항                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  장점:                                                          │
│  - 4GB 제한 해제 → 현재 8GB까지 (JS 엔진 제한)                  │
│  - 대형 CAD 어셈블리 처리 가능                                  │
│                                                                 │
│  단점:                                                          │
│  - 포인터 크기 2배 (4바이트 → 8바이트)                          │
│  - 메모리 사용량 증가                                           │
│  - 성능 저하 10~100% 가능                                       │
│                                                                 │
│  결론:                                                          │
│  - 4GB 초과 필요할 때만 사용                                    │
│  - "더 현대적"이거나 "더 빠른" 것이 아님                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> 참고: [Chrome Status - Memory64](https://chromestatus.com/feature/5070065734516736)

**우리 프로젝트 적용**:

> **참고**: SpineLift (동일 팀 프로젝트)가 이미 4GB+ 메모리 사용 중
>
> 복잡한 CAD 어셈블리는 예상보다 빨리 4GB 한계에 도달할 수 있음

| Phase | Memory64 필요성 | 이유 |
|-------|----------------|------|
| Phase 1-2 | 불필요 | 단순 도형, 수십 MB |
| Phase 3 | 모니터링 | 3D 도형 복잡도에 따라 변동 |
| Phase 4+ | **높음** | SpineLift 사례로 볼 때 조기 도달 가능 |

**전략**:
1. Phase 3부터 메모리 사용량 모니터링
2. 2GB 도달 시 Memory64 전환 준비 시작
3. 성능 저하(10~100%) 감수 vs 기능 제한 트레이드오프 검토

**사용 시점**: 실제로 4GB 초과 시에만 전환. 성능 저하 감수 필요.

#### Rust WASM 생태계 현황 (2025)

```
┌─────────────────────────────────────────────────────────────────┐
│                    rustwasm 조직 상황                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [2025년 7월] rustwasm 조직 sunset 발표                         │
│  [2025년 9월] 전체 아카이브 예정                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  wasm-bindgen → 새 조직으로 이전 (활발히 유지보수)       │   │
│  │  github.com/wasm-bindgen/wasm-bindgen                   │   │
│  │  새 메인테이너: @daxpedda, @guybedford (Cloudflare)     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  wasm-pack → drager fork로 유지보수                      │   │
│  │  github.com/drager/wasm-pack                            │   │
│  │  장기 유지보수 불확실 → 직접 빌드 전환 고려              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> 참고: [Sunsetting rustwasm](https://blog.rust-lang.org/inside-rust/2025/07/21/sunsetting-the-rustwasm-github-org/), [Life after wasm-pack](https://nickb.dev/blog/life-after-wasm-pack-an-opinionated-deconstruction/)

#### 완화 전략

1. **wasm-bindgen 의존**: 새 조직에서 활발히 유지보수 중 → 안전
2. **wasm-pack 대안 준비**: 직접 빌드 스크립트 옵션 B 문서화 완료
3. **브라우저 타겟 명확화**: IE 미지원, 최신 브라우저만 지원

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

### E2E Tests (Phase 3)

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
└── selection/         # Phase 3 Selection UI
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
