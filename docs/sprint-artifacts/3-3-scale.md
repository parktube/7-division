# Story 3.3: Scale 변환 구현

Status: done

## Story

As a **AI 에이전트 (Claude Code)**,
I want **기존 도형을 지정된 비율로 확대/축소할 수 있도록**,
So that **"팔을 더 길게" 같은 크기 조정 요청을 처리할 수 있다**.

## Acceptance Criteria

### AC1: 기본 스케일
**Given** Scene에 Entity가 존재 (name으로 식별)
**When** `scene.scale(name, sx, sy)` 호출
**Then** 해당 Entity의 transform.scale 값이 [sx, sy]로 설정된다
**And** 기존 scale 값이 있으면 곱해진다 ([prev_sx * sx, prev_sy * sy])

### AC2: 비균일 스케일
**Given** sx와 sy가 다른 경우 (비균일 스케일)
**When** scale(name, 2, 1) 호출
**Then** 가로로만 2배 늘어나는 변환이 적용된다

### AC3: 0 이하 스케일 처리
**Given** scale 값이 0 이하인 경우
**When** scale 호출
**Then** max(0.001, abs(v))로 보정되어 적용된다
**And** (정책: 관대한 입력 보정, docs/architecture.md#Error Handling Policy)

### AC4: 축소 (1 미만)
**Given** scale 값이 1 미만인 경우 (축소)
**When** scale(name, 0.5, 0.5) 호출
**Then** 도형이 절반 크기로 축소된다

## Tasks / Subtasks

- [ ] **Task 1: scale 함수 구현** (AC: #1, #2)
  - [ ] 1.1: `scale(&mut self, name: &str, sx: f64, sy: f64)` 구현
  - [ ] 1.2: name으로 Entity 찾기 로직
  - [ ] 1.3: transform.scale 곱셈 로직

- [ ] **Task 2: 입력 보정** (AC: #3)
  - [ ] 2.1: sx <= 0 또는 sy <= 0 검증
  - [ ] 2.2: abs().max(0.001)로 양수 변환 (관대한 입력 보정)

- [ ] **Task 3: Scene에 통합** (AC: #1, #4)
  - [ ] 3.1: Scene impl에 scale 메서드 추가
  - [ ] 3.2: wasm_bindgen export 확인

- [ ] **Task 4: 테스트 작성** (AC: #1, #2, #3, #4)
  - [ ] 4.1: 기본 scale 테스트 (확대)
  - [ ] 4.2: 축소 scale 테스트
  - [ ] 4.3: 비균일 scale 테스트
  - [ ] 4.4: 0 이하 scale 보정 테스트 (abs() 변환 확인)
  - [ ] 4.5: 누적 scale 테스트

- [ ] **Task 5: Tool Use 등록** (AC: #1)
  - [ ] 5.1: `cad-tools/src/schema.ts` - scale 스키마 추가
  - [ ] 5.2: `cad-tools/src/executor.ts` - scale case 추가
  - [ ] 5.3: DOMAINS.transforms에 "scale" 추가
  - [ ] 5.4: `cad-tools/tests/executor.test.ts` - scale 테스트 추가

## Dev Notes

### Architecture Patterns

#### scale 함수 시그니처

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    /// Entity를 지정된 비율로 확대/축소합니다.
    ///
    /// # Arguments
    /// * `id` - 대상 Entity의 ID
    /// * `sx` - x축 스케일 비율 (음수/0 → abs()로 보정)
    /// * `sy` - y축 스케일 비율 (음수/0 → abs()로 보정)
    ///
    /// # Returns
    /// * 성공 시 Ok(true), name 미발견 시 Ok(false)
    pub fn scale(&mut self, name: &str, sx: f64, sy: f64) -> bool {
        // 관대한 입력 보정: 음수/0은 abs()로 변환
        let sx = if sx <= 0.0 { sx.abs().max(0.001) } else { sx };
        let sy = if sy <= 0.0 { sy.abs().max(0.001) } else { sy };

        if let Some(entity) = self.entities.iter_mut().find(|e| e.id == id) {
            // 기존 값에 곱셈
            entity.transform.scale[0] *= sx;
            entity.transform.scale[1] *= sy;
            true
        } else {
            false  // name 미발견 시 no-op
        }
    }
}
```

#### 사용 예시

```javascript
// 팔을 1.5배 길게 (y축만)
scene.scale("left_arm", 1.0, 1.5);

// 전체 2배 확대
scene.scale("head", 2.0, 2.0);

// 절반 축소
scene.scale("torso", 0.5, 0.5);
```

### Scale 누적 (곱셈)

```
초기: scale = [1.0, 1.0]
scale(2, 2) → [2.0, 2.0]
scale(0.5, 0.5) → [1.0, 1.0]  // 원래 크기로 복귀
```

### 디렉토리 구조

```
cad-engine/src/
└── transforms/
    ├── mod.rs
    ├── translate.rs
    ├── rotate.rs
    └── scale.rs        # ← 이 스토리 (선택적)
```

### Project Structure Notes

- 초기 scale: [1, 1] (100%)
- 음수 scale은 뒤집기 효과이나 Phase 1에서는 지원 안 함
- 비균일 스케일 지원 (가로/세로 독립)

### Dependencies

- Story 1.2 (Scene 클래스 및 Entity 구조)
- Story 3.1 (Translate) - 동일 구조
- **Story 3.0 (Tool Use Foundation)** - Tool 등록용

## References

- [Source: docs/architecture.md#API Design - scale]
- [Source: docs/prd.md#검증 시나리오 - 수정 요청]
- [Source: docs/epics.md#Story 3.3]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- cad-engine/src/transforms/scale.rs (선택적)
- cad-engine/src/scene/mod.rs (수정 - scale 추가)
