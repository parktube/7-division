# Story 1.4: Circle 도형 생성 기능

Status: Ready for Review

## Story

As a **AI 에이전트 (Claude Code)**,
I want **중심점과 반지름으로 원을 생성할 수 있도록**,
So that **스켈레톤의 머리나 관절 등을 표현할 수 있다**.

## Acceptance Criteria

### AC1: 기본 원 생성
**Given** Scene 인스턴스가 존재
**When** `scene.add_circle("head", x, y, radius)` 호출
**Then** Circle 타입의 Entity가 생성된다
**And** geometry에 `{ center: [x, y], radius: radius }` 형태로 저장된다
**And** name ("head")이 반환된다
**And** (AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해함)

### AC2: 음수 반지름 처리
**Given** radius가 0 이하인 경우
**When** add_circle 호출
**Then** abs().max(0.001)로 양수 변환되어 정상 생성된다 (0일 경우 최소값 0.001 적용)
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

- [x] **Task 1: Circle 생성 함수 구현** (AC: #1, #4)
  - [x] 1.1: `add_circle(&mut self, name: &str, x: f64, y: f64, radius: f64) -> Result<String, JsValue>` 구현
  - [x] 1.2: name 중복 체크 (has_entity)
  - [x] 1.3: CircleGeometry 생성 (metadata.name = name)
  - [x] 1.4: Entity 추가 및 name 반환

- [x] **Task 2: 반지름 보정** (AC: #2)
  - [x] 2.1: radius <= 0 검증 로직 추가
  - [x] 2.2: abs().max(0.001)로 양수 변환 (관대한 입력 보정)
  - [x] 2.3: 보정 로직 문서화

- [x] **Task 3: Scene에 통합** (AC: #1, #3, #4)
  - [x] 3.1: Scene impl에 add_circle 메서드 추가
  - [x] 3.2: wasm_bindgen export 확인

- [x] **Task 4: 테스트 작성** (AC: #1, #2, #3)
  - [x] 4.1: 기본 원 생성 테스트
  - [x] 4.2: 음수 반지름 보정 테스트 (abs() 변환 확인)
  - [x] 4.3: 음수 좌표 허용 테스트

### Review Follow-ups (AI)

- [x] [AI-Review][Medium] Dev Agent Record File List에 `docs/sprint-artifacts/1-4-circle.md` 변경을 추가하거나 변경 이력을 분리해 기록 정합성 유지 `docs/sprint-artifacts/1-4-circle.md:193`
- [x] [AI-Review][Medium] Dev Agent Record File List에 `docs/sprint-artifacts/sprint-status.yaml` 변경을 추가해 실제 변경과 기록 일치 `docs/sprint-artifacts/1-4-circle.md:193`
- [x] [AI-Review][Medium] AC2의 `abs()` 보정 서술과 구현(`abs().max(0.001)`) 불일치 → AC 문구/테스트/로직 중 하나로 기준 통일 `docs/sprint-artifacts/1-4-circle.md:21`
- [x] [AI-Review][Medium] NaN/Infinity 입력(x/y/radius) 검증 부재로 잘못된 geometry 생성 가능 → 입력 유효성 체크 추가 `cad-engine/src/scene/mod.rs:106`
- [x] [AI-Review][Low] Debug Log의 테스트/빌드 성공 주장에 근거(로그/커맨드) 없음 → 증빙 첨부 또는 가정 표기 `docs/sprint-artifacts/1-4-circle.md:182`

## Dev Notes

### Architecture Patterns

#### add_circle 함수 시그니처

> **AX 원칙**: name이 첫 번째 파라미터입니다. AI는 "head", "joint_elbow" 같은 의미있는 이름으로 Entity를 식별합니다.

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    /// 원(Circle) 도형을 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "head", "joint_elbow") - Scene 내 unique
    /// * `x` - 중심점 x 좌표
    /// * `y` - 중심점 y 좌표
    /// * `radius` - 반지름 (음수/0 → abs()로 보정)
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    /// * Err - name 중복
    pub fn add_circle(&mut self, name: &str, x: f64, y: f64, radius: f64) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!("Entity '{}' already exists", name)));
        }

        // 관대한 입력 보정: 음수/0은 abs()로 변환
        let radius = if radius <= 0.0 { radius.abs().max(0.001) } else { radius };

        let id = generate_id();  // 내부 ID (JSON export용)
        let entity = Entity {
            id,
            entity_type: EntityType::Circle,
            geometry: Geometry::Circle {
                center: [x, y],
                radius,
            },
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata {
                name: name.to_string(),
                layer: None,
                locked: false,
            },
        };

        self.entities.push(entity);
        Ok(name.to_string())
    }
}
```

#### 스켈레톤 머리 예시

```javascript
// 스켈레톤 머리 (circle) - name 필수
scene.add_circle("head", 0, 100, 10);  // 중심 (0, 100), 반지름 10

// 이후 수정 시 name으로 식별
scene.set_fill("head", JSON.stringify({ color: [1, 0.8, 0.6, 1] }));  // 살색으로
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

- Story 1.3 (Line) 구현 패턴 참조: `_internal` 함수로 테스트, WASM export는 위임만

### Agent Model Used

Claude Opus 4.5

### Debug Log References

**테스트 검증 (2025-12-22):**
```
$ cd cad-engine && cargo test --features dev
running 23 tests
test scene::tests::test_add_circle_basic ... ok
test scene::tests::test_add_circle_nan_error ... ok
test scene::tests::test_add_circle_infinity_error ... ok
test scene::tests::test_add_circle_negative_radius_corrected ... ok
test scene::tests::test_add_circle_zero_radius_corrected ... ok
test scene::tests::test_add_circle_negative_coordinates ... ok
test scene::tests::test_add_circle_duplicate_name_error ... ok
... (16 line/entity tests)
test result: ok. 23 passed; 0 failed
```

**WASM 빌드 검증:**
```
$ wasm-pack build --target nodejs --features dev
[INFO]: ✨ Done in 1.07s
[INFO]: 📦 Your wasm pkg is ready to publish at .../cad-engine/pkg
```

### Completion Notes List

- `add_circle_internal`: 내부용 Circle 생성 함수 (테스트 가능)
- `add_circle`: WASM export 함수 (internal 위임)
- 음수/0 반지름 → `abs().max(0.001)` 보정 (AC2)
- 음수 좌표 허용 (AC3)
- Line 패턴 재사용: 별도 primitives/circle.rs 불필요 (파라미터가 단순)
- ✅ Resolved review finding [Medium]: File List 정합성 - 누락 파일 추가
- ✅ Resolved review finding [Medium]: AC2 스펙-구현 일치 - AC 문구 수정
- ✅ Resolved review finding [Medium]: NaN/Infinity 검증 추가 - is_finite() 체크
- ✅ Resolved review finding [Low]: Debug Log 근거 - 실행 로그 첨부

### File List

- cad-engine/src/scene/mod.rs (수정 - add_circle, add_circle_internal 추가)
- docs/sprint-artifacts/1-4-circle.md (수정 - 상태 업데이트)
- docs/sprint-artifacts/sprint-status.yaml (수정 - 1-4-circle 상태 변경)

### Change Log

- 2025-12-22: Story 1-4 Circle 도형 생성 기능 구현 완료
- 2025-12-22: Addressed code review findings - 5 items resolved (4 Medium, 1 Low)
