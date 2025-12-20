# Story 1.3: Line 도형 생성 기능

Status: ready-for-dev

## Story

As a **AI 에이전트 (Claude Code)**,
I want **두 개 이상의 점을 연결하는 선분을 생성할 수 있도록**,
So that **스켈레톤의 척추, 팔, 다리 등을 표현할 수 있다**.

## Acceptance Criteria

### AC1: 기본 선분 생성
**Given** Scene 인스턴스가 존재
**When** `scene.add_line("spine", Float64Array([x1, y1, x2, y2]))` 호출
**Then** Line 타입의 Entity가 생성된다
**And** geometry에 `{ points: [[x1, y1], [x2, y2]] }` 형태로 저장된다
**And** name ("spine")이 반환된다
**And** (AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해함)

### AC2: 폴리라인 (4개 이상 좌표)
**Given** 4개 이상의 좌표가 주어진 경우 (폴리라인)
**When** `scene.add_line("left_arm", Float64Array([x1, y1, x2, y2, x3, y3, x4, y4]))` 호출
**Then** 연결된 선분들이 하나의 Entity로 생성된다
**And** geometry.points에 4개 점이 순서대로 저장된다

### AC3: 입력 보정 (홀수 좌표)
**Given** 홀수 개의 좌표가 주어진 경우
**When** add_line 호출
**Then** 마지막 좌표가 무시되고 정상 생성된다
**And** (정책: 관대한 입력 보정, docs/architecture.md#Error Handling Policy)

### AC4: 시맨틱 함수명 (NFR9)
**Given** AX 원칙
**When** 함수를 정의할 때
**Then** `add_line`으로 명명하여 의도가 명확함

## Tasks / Subtasks

- [ ] **Task 1: primitives 모듈 생성** (AC: #1)
  - [ ] 1.1: `primitives/` 디렉토리 생성
  - [ ] 1.2: `primitives/mod.rs` 파일 생성
  - [ ] 1.3: `primitives/line.rs` 파일 생성

- [ ] **Task 2: Line 생성 함수 구현** (AC: #1, #2, #4)
  - [ ] 2.1: `add_line(&mut self, name: &str, points: js_sys::Float64Array) -> Result<String, JsValue>` 구현
  - [ ] 2.2: name 중복 체크 (has_entity)
  - [ ] 2.3: Float64Array를 Vec<[f64; 2]>로 변환
  - [ ] 2.4: LineGeometry 생성 및 Entity 추가 (metadata.name = name)
  - [ ] 2.5: name 반환

- [ ] **Task 3: 에러 처리** (AC: #3)
  - [ ] 3.1: 좌표 개수 검증 (짝수인지 확인)
  - [ ] 3.2: 홀수일 경우 마지막 좌표 무시 또는 에러 반환
  - [ ] 3.3: 최소 4개 (2점) 필요 검증

- [ ] **Task 4: Scene에 통합** (AC: #1, #4)
  - [ ] 4.1: Scene impl에 add_line 메서드 추가
  - [ ] 4.2: wasm_bindgen export 확인

- [ ] **Task 5: 테스트 작성** (AC: #1, #2, #3)
  - [ ] 5.1: 2점 선분 생성 테스트
  - [ ] 5.2: 폴리라인 생성 테스트
  - [ ] 5.3: 홀수 좌표 에러 테스트

## Dev Notes

### Architecture Patterns

#### add_line 함수 시그니처

> **AX 원칙**: name이 첫 번째 파라미터입니다. AI는 "spine", "left_arm" 같은 의미있는 이름으로 Entity를 식별합니다.

```rust
use js_sys::Float64Array;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    /// 선분(Line) 도형을 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "spine", "left_arm") - Scene 내 unique
    /// * `points` - [x1, y1, x2, y2, ...] 형태의 Float64Array
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    /// * Err - name 중복 또는 잘못된 입력
    pub fn add_line(&mut self, name: &str, points: Float64Array) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!("Entity '{}' already exists", name)));
        }

        let points_vec: Vec<f64> = points.to_vec();

        // 짝수 개수 검증
        if points_vec.len() % 2 != 0 {
            return Err(JsValue::from_str("Points must be pairs of x,y coordinates"));
        }

        // 최소 2점 (4개 값) 필요
        if points_vec.len() < 4 {
            return Err(JsValue::from_str("At least 2 points required"));
        }

        // [f64; 2] 배열로 변환
        let point_pairs: Vec<[f64; 2]> = points_vec
            .chunks(2)
            .map(|chunk| [chunk[0], chunk[1]])
            .collect();

        let id = generate_id();  // 내부 ID (JSON export용)
        let entity = Entity {
            id,
            entity_type: EntityType::Line,
            geometry: Geometry::Line { points: point_pairs },
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata {
                name: name.to_string(),  // name으로 식별
                layer: None,
                locked: false,
            },
        };

        self.entities.push(entity);
        Ok(name.to_string())  // name 반환 (AI가 추적하기 쉬움)
    }
}
```

#### Float64Array 처리 (NFR12)

```rust
// JS에서 호출 (name 필수):
const spine = scene.add_line("spine", new Float64Array([0, 100, 0, 50]));
console.log(spine);  // "spine"

// Rust에서 처리:
let points_vec: Vec<f64> = points.to_vec();  // [0, 100, 0, 50]
```

### 스켈레톤 예시 (검증 시나리오)

```javascript
// 스켈레톤 척추 - name이 첫 번째 파라미터
scene.add_line("spine", new Float64Array([0, 90, 0, 50]));

// 왼팔 (상완 + 하완) - 의미있는 이름 사용
scene.add_line("left_arm", new Float64Array([0, 85, -20, 70, -25, 50]));

// 오른팔
scene.add_line("right_arm", new Float64Array([0, 85, 20, 70, 25, 50]));

// 왼다리
scene.add_line("left_leg", new Float64Array([0, 50, -15, 20, -15, 0]));

// 오른다리
scene.add_line("right_leg", new Float64Array([0, 50, 15, 20, 15, 0]));

// 이후 수정 시 name으로 식별
scene.set_stroke("left_arm", JSON.stringify({ color: [1, 0, 0, 1] }));  // 왼팔을 빨간색으로
```

### 디렉토리 구조

```
cad-engine/src/
├── lib.rs
├── scene/
│   ├── mod.rs          # add_line 메서드 추가
│   └── entity.rs
└── primitives/
    ├── mod.rs          # ← 이 스토리
    └── line.rs         # ← 이 스토리 (선택적 분리)
```

### Project Structure Notes

- primitives/ 모듈은 도형 생성 로직을 분리하여 관리
- 실제 add_line 메서드는 Scene impl에 직접 구현해도 됨
- 복잡해지면 primitives/line.rs로 헬퍼 함수 분리

### Dependencies

- Story 1.1 (WASM 프로젝트 초기화)
- Story 1.2 (Scene 클래스 및 Entity 구조)

## References

- [Source: docs/architecture.md#API Design - WASM Exports]
- [Source: docs/architecture.md#wasm-bindgen 주의사항 - Float64Array]
- [Source: docs/prd.md#검증 시나리오 - 스켈레톤 생성]
- [Source: docs/epics.md#Story 1.3]
- [Source: docs/ai-native-cad-proposal.md#Phase 1 검증 시나리오]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- cad-engine/src/primitives/mod.rs (신규)
- cad-engine/src/primitives/line.rs (선택적)
- cad-engine/src/scene/mod.rs (수정 - add_line 추가)
- cad-engine/src/lib.rs (수정 - mod primitives 추가)
