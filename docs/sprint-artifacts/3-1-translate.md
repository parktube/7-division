# Story 3.1: Translate 변환 구현

Status: ready-for-dev

## Story

As a **AI 에이전트 (Claude Code)**,
I want **기존 도형을 지정된 거리만큼 이동시킬 수 있도록**,
So that **"왼쪽 팔을 더 왼쪽으로" 같은 수정 요청을 처리할 수 있다**.

## Acceptance Criteria

### AC1: 기본 이동
**Given** Scene에 Entity가 존재 (name으로 식별)
**When** `scene.translate("left_arm", dx, dy)` 호출
**Then** 해당 Entity의 transform.translate 값이 [dx, dy]로 설정된다
**And** 기존 translate 값이 있으면 누적된다 ([prev_dx + dx, prev_dy + dy])
**And** (AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해함)

### AC2: 유효하지 않은 name 처리
**Given** 존재하지 않는 name으로 translate 호출
**When** translate("unknown_entity", 10, 20) 실행
**Then** Result<bool>에서 Ok(false) 반환 (no-op)
**And** (정책: name 미발견 시 no-op, docs/architecture.md#Error Handling Policy)
**And** 다른 Entity들은 영향받지 않는다

### AC3: JSON Export 반영
**Given** translate가 적용된 Entity
**When** export_json() 호출
**Then** JSON에 transform.translate 값이 포함된다

## Tasks / Subtasks

- [ ] **Task 1: transforms 모듈 생성** (AC: #1)
  - [ ] 1.1: `transforms/` 디렉토리 생성
  - [ ] 1.2: `transforms/mod.rs` 파일 생성
  - [ ] 1.3: `transforms/translate.rs` 파일 생성

- [ ] **Task 2: translate 함수 구현** (AC: #1)
  - [ ] 2.1: `translate(&mut self, name: &str, dx: f64, dy: f64)` 구현
  - [ ] 2.2: name으로 Entity 찾기 로직 (metadata.name 사용)
  - [ ] 2.3: transform.translate 누적 로직

- [ ] **Task 3: 에러 처리** (AC: #2)
  - [ ] 3.1: name 미발견 시 Ok(false) 반환 (no-op)
  - [ ] 3.2: 에러 처리 방식 문서화

- [ ] **Task 4: Scene에 통합** (AC: #1, #3)
  - [ ] 4.1: Scene impl에 translate 메서드 추가
  - [ ] 4.2: wasm_bindgen export 확인

- [ ] **Task 5: 테스트 작성** (AC: #1, #2, #3)
  - [ ] 5.1: 기본 translate 테스트
  - [ ] 5.2: 누적 translate 테스트
  - [ ] 5.3: 잘못된 ID 테스트
  - [ ] 5.4: export_json에 translate 포함 확인

## Dev Notes

### Architecture Patterns

#### translate 함수 시그니처

> **AX 원칙**: name으로 Entity를 식별합니다. AI는 "left_arm", "head" 같은 의미있는 이름을 사용합니다.

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    /// Entity를 지정된 거리만큼 이동합니다.
    ///
    /// # Arguments
    /// * `name` - 대상 Entity의 이름 (예: "left_arm")
    /// * `dx` - x축 이동 거리
    /// * `dy` - y축 이동 거리
    ///
    /// # Returns
    /// * Ok(true) - 성공
    /// * Ok(false) - name 미발견 (no-op)
    pub fn translate(&mut self, name: &str, dx: f64, dy: f64) -> Result<bool, JsValue> {
        let entity = match self.entities.iter_mut().find(|e| e.metadata.name.as_str() == name) {
            Some(e) => e,
            None => return Ok(false),  // name 미발견 시 no-op
        };

        // 기존 값에 누적
        entity.transform.translate[0] += dx;
        entity.transform.translate[1] += dy;

        Ok(true)
    }
}
```

#### Transform 구조

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Transform {
    pub translate: [f64; 2],  // [dx, dy] - 누적됨
    pub rotate: f64,          // radians - 누적됨
    pub scale: [f64; 2],      // [sx, sy] - 곱해짐
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
```

#### 사용 예시

```javascript
// 왼팔을 왼쪽으로 10 이동
scene.translate("left_arm", -10, 0);

// 또는 아래로 5 이동
scene.translate("left_arm", 0, -5);

// 누적: 총 (-10, -5) 이동됨
```

### 디렉토리 구조

```
cad-engine/src/
├── lib.rs
├── scene/
│   ├── mod.rs          # translate 메서드 추가
│   └── entity.rs       # Transform 구조체
├── primitives/
│   └── ...
├── serializers/
│   └── ...
└── transforms/
    ├── mod.rs          # ← 이 스토리
    └── translate.rs    # ← 이 스토리 (선택적)
```

### Project Structure Notes

- transforms/ 모듈은 변환 로직을 분리하여 관리
- 실제 메서드는 Scene impl에 직접 구현
- Epic 3의 첫 번째 변환 스토리

### Dependencies

- Story 1.2 (Scene 클래스 및 Entity 구조)
- Story 1.3 (Line 도형) - 테스트용

## References

- [Source: docs/architecture.md#API Design - translate]
- [Source: docs/prd.md#검증 시나리오 - 수정 요청]
- [Source: docs/epics.md#Story 3.1]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- cad-engine/src/transforms/mod.rs (신규)
- cad-engine/src/transforms/translate.rs (선택적)
- cad-engine/src/scene/mod.rs (수정 - translate 추가)
- cad-engine/src/lib.rs (수정 - mod transforms 추가)
