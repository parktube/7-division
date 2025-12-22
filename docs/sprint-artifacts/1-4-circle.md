# Story 1.4: Circle 도형 생성 기능

Status: in-progress

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
- [x] [AI-Review][Medium] Error Handling Policy의 음수 radius 보정 규칙이 `abs()`로 남아 있음 → `abs().max(0.001)` 또는 구현에 맞춰 일치시키기 `docs/architecture.md:613`
- [x] [AI-Review][Medium] Epic의 Story 1.4 AC2가 `abs()` 보정만 명시 → 현재 구현/스토리(0.001 최소값)와 불일치 `docs/epics.md:354`
- [x] [AI-Review][Low] Dev Notes 코드 주석이 "abs()로 변환"만 언급 → 0.001 최소값 보정도 명시 `docs/sprint-artifacts/1-4-circle.md:89`
- [x] [AI-Review][Medium] Error Handling Policy에서 width/height 보정 규칙이 `abs().max(0.001)`로 변경됐지만 Story 1.5는 `abs()`만 명시 → 스펙 불일치 해소 필요 `docs/architecture.md:614` `docs/epics.md:385`
- [x] [AI-Review][Medium] Error Handling Policy에서 radius 보정이 `abs().max(0.001)`로 강화됐지만 Story 1.6(Arc)는 `abs()`만 명시 → 스펙 불일치 해소 필요 `docs/architecture.md:613` `docs/epics.md:419`
- [x] [AI-Review][Medium] 에러 메시지 형식 규약(함수명 포함)과 실제 에러 메시지 불일치 → `add_circle` 입력 에러 메시지 포맷 정렬 필요 `docs/architecture.md:619` `cad-engine/src/scene/mod.rs:109`
- [x] [AI-Review][Medium] Error Handling Policy의 에러 메시지 포맷([function] type: detail)이 name 중복 에러에 적용되지 않음 → add_* duplicate name 에러도 포맷 통일 또는 정책 업데이트 `docs/architecture.md:619` `cad-engine/src/scene/mod.rs:20` `cad-engine/src/scene/mod.rs:444`
- [x] [AI-Review][Medium] add_line 잘못된 입력 에러가 포맷 규약과 불일치(현재 "At least 2 points required") → parse_line_points/add_line 에러 메시지 포맷 및 테스트 갱신 `docs/architecture.md:619` `cad-engine/src/scene/mod.rs:340`
- [x] [AI-Review][Low] add_circle 공개 API 주석이 NaN/Infinity 에러 가능성을 언급하지 않음 → Returns/Errors 문서 갱신 `cad-engine/src/scene/mod.rs:188`
- [x] [AI-Review][Low] NaN/Infinity 검증 테스트가 x/y만 커버, radius Infinity 케이스 누락 → 테스트 추가 `cad-engine/src/scene/mod.rs:467`
- [x] [AI-Review][Medium] line 좌표에 NaN/Infinity 검증이 없어 비정상 geometry 저장 가능 → add_line/parse_line_points 입력 유효성 검사 및 테스트 추가 `cad-engine/src/primitives/line.rs:14`
- [x] [AI-Review][Medium] 공개 API `add_entity`가 문서/스토리에 없고 더미 Line을 생성 → 내부 전용으로 숨기거나 스펙에 명시 `cad-engine/src/scene/mod.rs:147`
- [x] [AI-Review][Low] Dev Notes 코드 스니펫의 중복 에러 메시지가 최신 포맷과 불일치 → 예시 코드/설명 갱신 `docs/sprint-artifacts/1-4-circle.md:97`
- [x] [AI-Review][Medium] 홀수 좌표 입력에서 마지막 값이 NaN/Infinity인 경우에도 즉시 에러 처리됨 → "마지막 좌표 무시" 정책과 충돌하므로 trim 후 검증 또는 마지막 값 제외 검증 필요 `cad-engine/src/primitives/line.rs:14` `docs/architecture.md:616`
- [x] [AI-Review][Medium] Line NaN/Infinity 입력 에러 정책이 Architecture Error Handling Policy에 없음 → 정책 문서에 명시하거나 validation 완화 `docs/architecture.md:611` `cad-engine/src/primitives/line.rs:24`
- [x] [AI-Review][Low] Debug Log 테스트 수(23개)가 현재 테스트 수와 불일치 → 최신 실행 로그로 갱신 또는 가정 표기 `docs/sprint-artifacts/1-4-circle.md:201` `cad-engine/src/primitives/line.rs:45`

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
    /// * `radius` - 반지름 (음수/0 → abs().max(0.001)로 보정)
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    ///
    /// # Errors
    /// * name 중복 시: `[add_circle] duplicate_name: Entity 'name' already exists`
    /// * NaN/Infinity 입력 시: `[add_circle] invalid_input: NaN or Infinity not allowed`
    pub fn add_circle(&mut self, name: &str, x: f64, y: f64, radius: f64) -> Result<String, JsValue> {
        self.add_circle_internal(name, x, y, radius)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }
}

// 내부 구현 (테스트용)
impl Scene {
    fn add_circle_internal(&mut self, name: &str, x: f64, y: f64, radius: f64) -> Result<String, SceneError> {
        // NaN/Infinity 검증
        if !x.is_finite() || !y.is_finite() || !radius.is_finite() {
            return Err(SceneError::InvalidInput(
                "[add_circle] invalid_input: NaN or Infinity not allowed".to_string(),
            ));
        }

        // 관대한 입력 보정: 음수/0은 abs().max(0.001)로 변환
        let radius = if radius <= 0.0 { radius.abs().max(0.001) } else { radius };

        self.add_entity_internal("add_circle", name, EntityType::Circle, Geometry::Circle {
            center: [x, y],
            radius,
        })
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
running 28 tests
test primitives::line::tests::test_parse_odd_with_nan_last_drops_and_succeeds ... ok
test primitives::line::tests::test_parse_odd_with_infinity_last_drops_and_succeeds ... ok
test scene::tests::test_add_circle_basic ... ok
test scene::tests::test_add_circle_nan_error ... ok
test scene::tests::test_add_circle_infinity_error ... ok
test scene::tests::test_add_circle_negative_radius_corrected ... ok
test scene::tests::test_add_circle_zero_radius_corrected ... ok
test scene::tests::test_add_circle_negative_coordinates ... ok
test scene::tests::test_add_circle_duplicate_name_error ... ok
... (19 line/entity/greet tests)
test result: ok. 28 passed; 0 failed
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

- cad-engine/src/scene/mod.rs (수정 - add_circle, add_circle_internal, NaN/Infinity 검증, add_entity 제거)
- cad-engine/src/primitives/line.rs (수정 - NaN/Infinity 검증 순서 변경, trim 후 검증, 테스트 5개)
- docs/sprint-artifacts/1-4-circle.md (수정 - 상태 업데이트, 리뷰 피드백 반영, Dev Notes/Debug Log 갱신)
- docs/sprint-artifacts/sprint-status.yaml (수정 - 1-4-circle 상태 변경)
- docs/architecture.md (수정 - Error Handling Policy 입력 보정 규칙: Line/Circle NaN/Infinity 명시)
- docs/epics.md (수정 - Story 1.4 AC2 정합성)

### Change Log

- 2025-12-22: Story 1-4 Circle 도형 생성 기능 구현 완료
- 2025-12-22: Addressed code review findings - 5 items resolved (4 Medium, 1 Low)
- 2025-12-22: Addressed re-review findings - 3 items resolved (문서 정합성: architecture.md, epics.md, Dev Notes)
- 2025-12-22: Addressed 3rd review findings - 3 items resolved (epics.md Story 1.5/1.6 정합성, 에러 메시지 형식)
- 2025-12-22: Addressed 4th review findings - 4 items resolved (에러 메시지 형식 통일, API 문서 보완, radius Infinity 테스트)
- 2025-12-22: Addressed 5th review findings - 3 items resolved (Line NaN/Infinity 검증, add_entity 제거, Dev Notes 갱신)
- 2025-12-22: Addressed 6th review findings - 3 items resolved (trim 후 검증 순서, Error Handling Policy 갱신, Debug Log 28개)
