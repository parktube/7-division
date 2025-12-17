# Story 1.5: Rect 도형 생성 기능

Status: ready-for-dev

## Story

As a **AI 에이전트 (Claude Code)**,
I want **원점, 너비, 높이로 사각형을 생성할 수 있도록**,
So that **스켈레톤의 몸통이나 배경 요소를 표현할 수 있다**.

## Acceptance Criteria

### AC1: 기본 사각형 생성
**Given** Scene 인스턴스가 존재
**When** `scene.add_rect(x, y, width, height)` 호출
**Then** Rect 타입의 Entity가 생성된다
**And** geometry에 `{ origin: [x, y], width: width, height: height }` 형태로 저장된다
**And** 고유한 ID가 반환된다

### AC2: 음수 크기 처리
**Given** width 또는 height가 0 이하인 경우
**When** add_rect 호출
**Then** abs()로 양수 변환되어 정상 생성된다
**And** (정책: 관대한 입력 보정, docs/architecture.md#Error Handling Policy)

### AC3: Y-up 중심 좌표계
**Given** 중심 원점 Y-up 좌표계 (CAD 표준)
**When** add_rect(0, 0, 100, 50) 호출
**Then** origin(0,0)에서 width=100, height=50인 사각형이 생성된다
**And** Canvas 2D 뷰어에서는 Y-flip 변환 후 표시 (Story 2.3)
**And** (정책: docs/architecture.md#Coordinate System Contract)

### AC4: 시맨틱 함수명 (NFR9)
**Given** AX 원칙
**When** 함수를 정의할 때
**Then** `add_rect`로 명명하여 의도가 명확함

## Tasks / Subtasks

- [ ] **Task 1: Rect 생성 함수 구현** (AC: #1, #3, #4)
  - [ ] 1.1: `add_rect(&mut self, x: f64, y: f64, width: f64, height: f64) -> String` 구현
  - [ ] 1.2: RectGeometry 생성
  - [ ] 1.3: Entity 추가 및 ID 반환

- [ ] **Task 2: 크기 보정** (AC: #2)
  - [ ] 2.1: width <= 0 또는 height <= 0 검증
  - [ ] 2.2: abs().max(0.001)로 양수 변환 (관대한 입력 보정)
  - [ ] 2.3: 보정 로직 문서화

- [ ] **Task 3: Scene에 통합** (AC: #1, #4)
  - [ ] 3.1: Scene impl에 add_rect 메서드 추가
  - [ ] 3.2: wasm_bindgen export 확인

- [ ] **Task 4: 테스트 작성** (AC: #1, #2, #3)
  - [ ] 4.1: 기본 사각형 생성 테스트
  - [ ] 4.2: 음수 크기 보정 테스트 (abs() 변환 확인)
  - [ ] 4.3: Y-up 중심 좌표계 테스트

## Dev Notes

### Architecture Patterns

#### add_rect 함수 시그니처

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    /// 사각형(Rect) 도형을 생성합니다.
    ///
    /// # Arguments
    /// * `x` - 원점 x 좌표 (Y-up 중심 좌표계)
    /// * `y` - 원점 y 좌표 (Y-up 중심 좌표계)
    /// * `width` - 너비 (음수/0 → abs()로 보정)
    /// * `height` - 높이 (음수/0 → abs()로 보정)
    ///
    /// # Returns
    /// * 생성된 Entity의 ID (문자열)
    pub fn add_rect(&mut self, x: f64, y: f64, width: f64, height: f64) -> String {
        // 관대한 입력 보정: 음수/0은 abs()로 변환
        let width = if width <= 0.0 { width.abs().max(0.001) } else { width };
        let height = if height <= 0.0 { height.abs().max(0.001) } else { height };

        let id = generate_id();
        let entity = Entity {
            id: id.clone(),
            entity_type: EntityType::Rect,
            geometry: Geometry::Rect {
                origin: [x, y],
                width,
                height,
            },
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata::default(),
        };

        self.entities.push(entity);
        id
    }
}
```

#### 스켈레톤 몸통 예시

```javascript
// 스켈레톤 몸통 (rect - 선택적, line으로도 가능)
const torso = scene.add_rect(-5, 50, 10, 40);  // 좌상단 (-5, 50), 10x40
```

### Geometry 구조

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Geometry {
    // ... Line, Circle
    Rect {
        origin: [f64; 2],  // [x, y] - 좌상단
        width: f64,
        height: f64,
    },
}
```

### 좌표계 (Y-up 중심 좌표계)

```
      y ▲
        │    ┌────────────┐
        │    │   Rect     │ height
        │    │  (x,y)     │
        │    └────────────┘
        │         width
  ──────┼──────────────────► x
        │ (0,0) = 중심
```

- CAD 엔진: Y-up 중심 좌표계 (수학적 표준)
- Canvas 2D 뷰어: Y-flip 변환 필요 (Story 2.3에서 처리)

### 디렉토리 구조

```
cad-engine/src/
├── lib.rs
├── scene/
│   ├── mod.rs          # add_rect 메서드 추가
│   └── entity.rs       # RectGeometry 포함
└── primitives/
    ├── mod.rs
    ├── line.rs
    ├── circle.rs
    └── rect.rs         # ← 이 스토리 (선택적 분리)
```

### Project Structure Notes

- Epic 1의 마지막 도형 생성 스토리
- 이 스토리 완료 시 FR2, FR3, FR4 모두 충족
- Epic 2 (JSON Export, 뷰어)로 진행 가능

### Dependencies

- Story 1.2 (Scene 클래스 및 Entity 구조)

## References

- [Source: docs/architecture.md#API Design - WASM Exports]
- [Source: docs/prd.md#검증 시나리오]
- [Source: docs/epics.md#Story 1.5]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- cad-engine/src/primitives/rect.rs (선택적)
- cad-engine/src/scene/mod.rs (수정 - add_rect 추가)
