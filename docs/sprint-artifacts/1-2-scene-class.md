# Story 1.2: Scene 클래스 및 Entity 구조 구현

Status: ready-for-dev

## Story

As a **AI 에이전트 (Claude Code)**,
I want **Scene 클래스를 인스턴스화하고 내부 Entity를 관리할 수 있도록**,
So that **도형들을 하나의 씬에서 관리하고 추적할 수 있다**.

## Acceptance Criteria

### AC1: Scene 인스턴스 생성
**Given** WASM 모듈이 로드된 상태
**When** `new Scene("my-scene")` 호출
**Then** Scene 인스턴스가 생성되고 이름이 "my-scene"으로 설정된다
**And** 빈 entities 배열이 초기화된다

### AC2: Entity 추가 및 name 기반 식별
**Given** Scene 인스턴스가 존재
**When** Entity를 추가하는 함수 호출 (name 필수)
**Then** name이 Entity에 저장되고, 동일한 name이 반환된다
**And** Entity가 Scene의 entities에 추가된다
**And** (AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해함)

### AC2.1: name 중복 방지
**Given** Scene에 "head"라는 이름의 Entity가 존재
**When** 같은 이름 "head"로 Entity 추가 시도
**Then** Err(JsValue) 반환하여 중복 불가 알림
**And** Scene 내 name은 unique해야 함

### AC3: wasm-bindgen 패턴 준수
**Given** wasm-bindgen 제약
**When** 클래스를 정의할 때
**Then** `#[wasm_bindgen] impl Scene` 패턴을 사용한다 (struct 왕복 피함)
**And** `js_sys::Math::random()` 또는 `uuid` js feature로 ID 생성

### AC4: Node.js에서 사용 가능
**Given** WASM 빌드가 완료된 상태
**When** Node.js에서 Scene을 import하여 사용
**Then** `new Scene("test")` 인스턴스화가 성공한다

## Tasks / Subtasks

- [ ] **Task 1: Entity 구조체 정의** (AC: #2, #3)
  - [ ] 1.1: `scene/` 모듈 디렉토리 생성
  - [ ] 1.2: `entity.rs` 파일 생성
  - [ ] 1.3: Entity 구조체 정의 (id, type, geometry, transform, style, metadata)
  - [ ] 1.4: EntityType enum 정의 (Line, Circle, Rect)
  - [ ] 1.5: Geometry enum 정의 (LineGeometry, CircleGeometry, RectGeometry)
  - [ ] 1.6: Transform 구조체 정의 (translate, rotate, scale)

- [ ] **Task 2: Scene 클래스 구현** (AC: #1, #3)
  - [ ] 2.1: `scene/mod.rs` 파일 생성
  - [ ] 2.2: Scene 구조체 정의 (name, entities)
  - [ ] 2.3: `#[wasm_bindgen(constructor)]` 으로 new 함수 구현
  - [ ] 2.4: entities 벡터 초기화 로직 작성

- [ ] **Task 3: name 기반 Entity 식별** (AC: #2, #2.1)
  - [ ] 3.1: Entity.metadata.name 필수화 (Option → String)
  - [ ] 3.2: Scene에 `find_by_name(name: &str)` 헬퍼 메서드
  - [ ] 3.3: name 중복 체크 로직 (`has_entity(name)`)
  - [ ] 3.4: 내부 id는 UUID 유지 (JSON export용)

- [ ] **Task 4: lib.rs 통합** (AC: #4)
  - [ ] 4.1: `mod scene;` 추가
  - [ ] 4.2: Scene을 wasm_bindgen export에 포함
  - [ ] 4.3: WASM 빌드 및 테스트

- [ ] **Task 5: 테스트 작성** (AC: #1, #2)
  - [ ] 5.1: Scene 생성 테스트
  - [ ] 5.2: Entity 추가 시 ID 반환 테스트
  - [ ] 5.3: Node.js에서 import 테스트

## Dev Notes

### Architecture Patterns

#### Entity 데이터 모델 (PRD 기반)

```rust
// entity.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    pub entity_type: EntityType,
    pub geometry: Geometry,
    pub transform: Transform,
    pub style: Style,
    pub metadata: Metadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntityType {
    Line,
    Circle,
    Rect,
    // Phase 2+: Polygon, Arc, Group
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Geometry {
    Line { points: Vec<[f64; 2]> },
    Circle { center: [f64; 2], radius: f64 },
    Rect { origin: [f64; 2], width: f64, height: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Transform {
    pub translate: [f64; 2],  // [dx, dy]
    pub rotate: f64,          // radians
    pub scale: [f64; 2],      // [sx, sy]
}

impl Default for Transform {
    fn default() -> Self {
        Transform {
            translate: [0.0, 0.0],
            rotate: 0.0,
            scale: [1.0, 1.0],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Style {
    pub stroke: Option<String>,      // e.g., "#000000"
    pub fill: Option<String>,
    pub stroke_width: Option<f64>,
}

/// **AX 원칙**: Entity는 UUID(id)가 아닌 의미있는 이름(name)으로 식별합니다.
/// AI는 "head", "left_arm" 같은 이름을 자연어처럼 이해합니다.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub name: String,             // 필수! Scene 내 unique
    pub layer: Option<String>,
    pub locked: bool,
}

impl Default for Metadata {
    fn default() -> Self {
        Metadata {
            name: String::new(),  // 주의: 실제 사용 시 반드시 설정해야 함
            layer: None,
            locked: false,
        }
    }
}
```

#### Scene 클래스 (wasm-bindgen 패턴)

```rust
// scene/mod.rs
use wasm_bindgen::prelude::*;
use crate::scene::entity::{Entity, Transform, Style, Metadata};

mod entity;

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

    pub fn get_name(&self) -> String {
        self.name.clone()
    }

    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }

    // add_line, add_circle, add_rect는 Story 1.3-1.5에서 구현
}
```

#### ID 생성 (NFR13 - getrandom 이슈 회피)

```rust
use uuid::Uuid;

fn generate_id() -> String {
    Uuid::new_v4().to_string()
}

// 또는 uuid 없이:
fn generate_id_alt() -> String {
    format!("entity_{:016x}", js_sys::Math::random().to_bits())
}
```

### wasm-bindgen 주의사항

| 패턴 | 설명 |
|------|------|
| `#[wasm_bindgen]` on struct | JS에서 `new Scene()` 가능 |
| `#[wasm_bindgen(constructor)]` | constructor로 노출 |
| `pub fn` in impl | JS에서 메서드로 호출 가능 |
| `entities: Vec<Entity>` | JS로 직접 노출 불가 → getter 메서드 사용 |

### 디렉토리 구조

```
cad-engine/src/
├── lib.rs              # mod scene; 추가
└── scene/
    ├── mod.rs          # Scene 클래스 ← 이 스토리
    └── entity.rs       # Entity 구조체 ← 이 스토리
```

### Project Structure Notes

- Entity는 serde로 직렬화 가능하게 설계 (Story 2.1 export_json에서 활용)
- Transform 기본값: translate=[0,0], rotate=0, scale=[1,1]
- Style 기본값: stroke="#000000", fill=none, stroke_width=1.0

### Dependencies

Story 1.1 (WASM 프로젝트 초기화)가 완료되어야 함

## References

- [Source: docs/architecture.md#API Design - WASM Exports]
- [Source: docs/architecture.md#wasm-bindgen 주의사항]
- [Source: docs/prd.md#Data Model - Entity 구조]
- [Source: docs/epics.md#Story 1.2]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- cad-engine/src/scene/mod.rs (신규)
- cad-engine/src/scene/entity.rs (신규)
- cad-engine/src/lib.rs (수정 - mod scene 추가)
