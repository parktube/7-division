# Story 3.2: Rotate 변환 구현

Status: ready-for-dev

## Story

As a **AI 에이전트 (Claude Code)**,
I want **기존 도형을 지정된 각도만큼 회전시킬 수 있도록**,
So that **"팔을 위로 들어" 같은 포즈 변경 요청을 처리할 수 있다**.

## Acceptance Criteria

### AC1: 기본 회전
**Given** Scene에 Entity가 존재 (ID로 식별)
**When** `scene.rotate(id, angle)` 호출 (angle은 라디안)
**Then** 해당 Entity의 transform.rotate 값이 angle로 설정된다
**And** 기존 rotate 값이 있으면 누적된다 (prev_angle + angle)

### AC2: 360도 이상 처리
**Given** angle이 360도 이상인 경우
**When** rotate 호출
**Then** 정상적으로 처리된다 (modulo 연산은 렌더러에서)

### AC3: 음수 각도 처리
**Given** 음수 angle인 경우
**When** rotate 호출
**Then** 반시계 방향 회전으로 처리된다

## Tasks / Subtasks

- [ ] **Task 1: rotate 함수 구현** (AC: #1)
  - [ ] 1.1: `rotate(&mut self, id: &str, angle: f64)` 구현
  - [ ] 1.2: ID로 Entity 찾기 로직
  - [ ] 1.3: transform.rotate 누적 로직

- [ ] **Task 2: 각도 처리** (AC: #2, #3)
  - [ ] 2.1: 라디안 단위 문서화
  - [ ] 2.2: 음수 각도 허용 확인
  - [ ] 2.3: 360도 이상 허용 확인 (modulo 불필요)

- [ ] **Task 3: Scene에 통합** (AC: #1)
  - [ ] 3.1: Scene impl에 rotate 메서드 추가
  - [ ] 3.2: wasm_bindgen export 확인

- [ ] **Task 4: 테스트 작성** (AC: #1, #2, #3)
  - [ ] 4.1: 기본 rotate 테스트 (양수)
  - [ ] 4.2: 음수 rotate 테스트
  - [ ] 4.3: 누적 rotate 테스트
  - [ ] 4.4: 360도 이상 테스트

## Dev Notes

### Architecture Patterns

#### rotate 함수 시그니처

```rust
use wasm_bindgen::prelude::*;
use std::f64::consts::PI;

#[wasm_bindgen]
impl Scene {
    /// Entity를 지정된 각도만큼 회전합니다.
    ///
    /// # Arguments
    /// * `id` - 대상 Entity의 ID
    /// * `angle` - 회전 각도 (라디안, 양수=반시계방향 CCW)
    ///
    /// # Returns
    /// * 성공 시 Ok(()), 실패 시 Err
    pub fn rotate(&mut self, id: &str, angle: f64) -> Result<(), JsValue> {
        let entity = self.entities
            .iter_mut()
            .find(|e| e.id == id)
            .ok_or_else(|| JsValue::from_str(&format!("Entity not found: {}", id)))?;

        // 기존 값에 누적
        entity.transform.rotate += angle;

        Ok(())
    }
}
```

#### 각도 단위

```javascript
// 라디안 사용 (Canvas API와 일치)
const PI = Math.PI;

// 45도 회전
scene.rotate("left_arm", PI / 4);

// 90도 회전
scene.rotate("left_arm", PI / 2);

// -30도 (반시계방향)
scene.rotate("left_arm", -PI / 6);
```

#### 회전 중심

- Phase 1에서는 원점(0, 0) 기준 회전
- Entity 자체의 중심 기준 회전은 Phase 2+ 고려

### 디렉토리 구조

```
cad-engine/src/
└── transforms/
    ├── mod.rs
    ├── translate.rs
    └── rotate.rs       # ← 이 스토리 (선택적)
```

### Project Structure Notes

- 라디안 단위 사용 (Canvas 2D API와 일치)
- 회전 중심은 Phase 1에서는 원점 기준
- Phase 2+에서 Entity 중심 기준 회전 옵션 추가 가능

### Dependencies

- Story 1.2 (Scene 클래스 및 Entity 구조)
- Story 3.1 (Translate) - 동일 구조

## References

- [Source: docs/architecture.md#API Design - rotate]
- [Source: docs/epics.md#Story 3.2]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- cad-engine/src/transforms/rotate.rs (선택적)
- cad-engine/src/scene/mod.rs (수정 - rotate 추가)
