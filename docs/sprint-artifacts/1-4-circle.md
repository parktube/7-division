# Story 1.4: Circle 도형 생성 기능

Status: ready-for-dev

## Story

As a **AI 에이전트 (Claude Code)**,
I want **중심점과 반지름으로 원을 생성할 수 있도록**,
So that **스켈레톤의 머리나 관절 등을 표현할 수 있다**.

## Acceptance Criteria

### AC1: 기본 원 생성
**Given** Scene 인스턴스가 존재
**When** `scene.add_circle(x, y, radius)` 호출
**Then** Circle 타입의 Entity가 생성된다
**And** geometry에 `{ center: [x, y], radius: radius }` 형태로 저장된다
**And** 고유한 ID가 반환된다

### AC2: 음수 반지름 처리
**Given** radius가 0 이하인 경우
**When** add_circle 호출
**Then** abs()로 양수 변환되어 정상 생성된다
**And** (정책: 관대한 입력 보정, docs/architecture.md#Error Handling Policy)

### AC3: 음수 좌표 허용
**Given** 좌표가 음수인 경우
**When** add_circle 호출
**Then** 정상적으로 생성된다 (음수 좌표 허용)

### AC4: 시맨틱 함수명 (NFR9)
**Given** AX 원칙
**When** 함수를 정의할 때
**Then** `add_circle`로 명명하여 의도가 명확함

## Tasks / Subtasks

- [ ] **Task 1: Circle 생성 함수 구현** (AC: #1, #4)
  - [ ] 1.1: `add_circle(&mut self, x: f64, y: f64, radius: f64) -> String` 구현
  - [ ] 1.2: CircleGeometry 생성
  - [ ] 1.3: Entity 추가 및 ID 반환

- [ ] **Task 2: 반지름 보정** (AC: #2)
  - [ ] 2.1: radius <= 0 검증 로직 추가
  - [ ] 2.2: abs().max(0.001)로 양수 변환 (관대한 입력 보정)
  - [ ] 2.3: 보정 로직 문서화

- [ ] **Task 3: Scene에 통합** (AC: #1, #3, #4)
  - [ ] 3.1: Scene impl에 add_circle 메서드 추가
  - [ ] 3.2: wasm_bindgen export 확인

- [ ] **Task 4: 테스트 작성** (AC: #1, #2, #3)
  - [ ] 4.1: 기본 원 생성 테스트
  - [ ] 4.2: 음수 반지름 보정 테스트 (abs() 변환 확인)
  - [ ] 4.3: 음수 좌표 허용 테스트

## Dev Notes

### Architecture Patterns

#### add_circle 함수 시그니처

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    /// 원(Circle) 도형을 생성합니다.
    ///
    /// # Arguments
    /// * `x` - 중심점 x 좌표
    /// * `y` - 중심점 y 좌표
    /// * `radius` - 반지름 (음수/0 → abs()로 보정)
    ///
    /// # Returns
    /// * 생성된 Entity의 ID (문자열)
    pub fn add_circle(&mut self, x: f64, y: f64, radius: f64) -> String {
        // 관대한 입력 보정: 음수/0은 abs()로 변환
        let radius = if radius <= 0.0 { radius.abs().max(0.001) } else { radius };

        let id = generate_id();
        let entity = Entity {
            id: id.clone(),
            entity_type: EntityType::Circle,
            geometry: Geometry::Circle {
                center: [x, y],
                radius,
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

#### 스켈레톤 머리 예시

```javascript
// 스켈레톤 머리 (circle)
const head = scene.add_circle(0, 100, 10);  // 중심 (0, 100), 반지름 10
```

### Geometry 구조

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Geometry {
    // ... Line
    Circle {
        center: [f64; 2],  // [x, y]
        radius: f64,
    },
    // ... Rect
}
```

### 디렉토리 구조

```
cad-engine/src/
├── lib.rs
├── scene/
│   ├── mod.rs          # add_circle 메서드 추가
│   └── entity.rs       # CircleGeometry 포함
└── primitives/
    ├── mod.rs
    ├── line.rs
    └── circle.rs       # ← 이 스토리 (선택적 분리)
```

### Project Structure Notes

- 원은 가장 간단한 도형 중 하나
- f64 타입으로 정밀도 보장
- 음수 좌표는 허용 (캔버스 좌표계에서 유효)

### Dependencies

- Story 1.2 (Scene 클래스 및 Entity 구조)

## References

- [Source: docs/architecture.md#API Design - WASM Exports]
- [Source: docs/prd.md#검증 시나리오 - 스켈레톤 생성]
- [Source: docs/epics.md#Story 1.4]
- [Source: docs/ai-native-cad-proposal.md#Phase 1 - circle]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- cad-engine/src/primitives/circle.rs (선택적)
- cad-engine/src/scene/mod.rs (수정 - add_circle 추가)
