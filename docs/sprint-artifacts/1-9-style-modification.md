# Story 1.9: 스타일 수정 Action 함수

Status: ready-for-dev

## Story

As a **AI 에이전트 (Claude Code)**,
I want **기존 도형의 스타일을 변경할 수 있도록**,
So that **"이 원을 빨간색으로 바꿔줘" 같은 수정 요청을 처리할 수 있다**.

## Acceptance Criteria

### AC1: set_stroke 함수
**Given** Scene에 Entity가 존재 (name으로 식별)
**When** `scene.set_stroke(name, stroke_json)` 호출
**Then** 해당 Entity의 style.stroke가 업데이트된다
**And** Ok(true) 반환

### AC2: set_fill 함수
**Given** Scene에 Entity가 존재 (name으로 식별)
**When** `scene.set_fill(name, fill_json)` 호출
**Then** 해당 Entity의 style.fill이 업데이트된다
**And** Ok(true) 반환

### AC3: remove_stroke 함수
**Given** Entity에 stroke가 있는 경우
**When** `scene.remove_stroke(name)` 호출
**Then** style.stroke가 None으로 설정된다
**And** 도형이 선 없이 표시된다

### AC4: remove_fill 함수
**Given** Entity에 fill이 있는 경우
**When** `scene.remove_fill(name)` 호출
**Then** style.fill이 None으로 설정된다
**And** 도형이 채움 없이 표시된다

### AC5: name 미발견 시 no-op
**Given** 존재하지 않는 name
**When** set_stroke/set_fill/remove_* 호출
**Then** Ok(false) 반환하고 무시된다
**And** (정책: docs/architecture.md#Error Handling Policy)

### AC6: 부분 업데이트 지원
**Given** 기존 stroke가 { width: 2, color: red }
**When** set_stroke(name, { "color": [0,0,1,1] }) 호출 (color만)
**Then** width는 유지되고 color만 변경된다

## Tasks / Subtasks

- [ ] **Task 1: set_stroke 구현** (AC: #1, #5, #6)
  - [ ] 1.1: `set_stroke(name: &str, stroke_json: &str) -> Result<bool, JsValue>`
  - [ ] 1.2: Entity 조회 (name으로) 및 stroke 업데이트
  - [ ] 1.3: name 미발견 시 Ok(false) 반환
  - [ ] 1.4: 부분 업데이트 (기존 값 merge)

- [ ] **Task 2: set_fill 구현** (AC: #2, #5)
  - [ ] 2.1: `set_fill(name: &str, fill_json: &str) -> Result<bool, JsValue>`
  - [ ] 2.2: Entity 조회 (name으로) 및 fill 업데이트

- [ ] **Task 3: remove_stroke 구현** (AC: #3, #5)
  - [ ] 3.1: `remove_stroke(name: &str) -> Result<bool, JsValue>`
  - [ ] 3.2: style.stroke = None 설정

- [ ] **Task 4: remove_fill 구현** (AC: #4, #5)
  - [ ] 4.1: `remove_fill(name: &str) -> Result<bool, JsValue>`
  - [ ] 4.2: style.fill = None 설정

- [ ] **Task 5: 테스트** (AC: #1-#6)
  - [ ] 5.1: set_stroke 전체 업데이트 테스트
  - [ ] 5.2: set_stroke 부분 업데이트 테스트
  - [ ] 5.3: set_fill 테스트
  - [ ] 5.4: remove_stroke 테스트
  - [ ] 5.5: remove_fill 테스트
  - [ ] 5.6: name 미발견 테스트

## Dev Notes

### Architecture Patterns

#### set_stroke 함수

> **AX 원칙**: Entity는 UUID(id)가 아닌 의미있는 이름(name)으로 식별합니다.
> AI는 "head", "left_arm" 같은 이름을 자연어처럼 이해합니다.

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    /// 기존 도형의 stroke 스타일을 변경합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "head", "left_arm")
    /// * `stroke_json` - StrokeStyle JSON
    ///
    /// # Returns
    /// * Ok(true) - 성공
    /// * Ok(false) - name 미발견
    pub fn set_stroke(&mut self, name: &str, stroke_json: &str) -> Result<bool, JsValue> {
        let entity = match self.entities.iter_mut().find(|e| e.metadata.name.as_deref() == Some(name)) {
            Some(e) => e,
            None => return Ok(false),
        };

        let new_stroke: StrokeStyle = serde_json::from_str(stroke_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // 부분 업데이트: 기존 값과 merge
        if let Some(ref mut existing) = entity.style.stroke {
            // JSON에 명시된 필드만 업데이트
            existing.merge_from(&new_stroke);
        } else {
            entity.style.stroke = Some(new_stroke);
        }

        Ok(true)
    }

    /// stroke를 제거합니다 (선 없음).
    pub fn remove_stroke(&mut self, name: &str) -> Result<bool, JsValue> {
        let entity = match self.entities.iter_mut().find(|e| e.metadata.name.as_deref() == Some(name)) {
            Some(e) => e,
            None => return Ok(false),
        };

        entity.style.stroke = None;
        Ok(true)
    }

    /// 기존 도형의 fill 스타일을 변경합니다.
    pub fn set_fill(&mut self, name: &str, fill_json: &str) -> Result<bool, JsValue> {
        let entity = match self.entities.iter_mut().find(|e| e.metadata.name.as_deref() == Some(name)) {
            Some(e) => e,
            None => return Ok(false),
        };

        let new_fill: FillStyle = serde_json::from_str(fill_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        entity.style.fill = Some(new_fill);
        Ok(true)
    }

    /// fill을 제거합니다 (채움 없음).
    pub fn remove_fill(&mut self, name: &str) -> Result<bool, JsValue> {
        let entity = match self.entities.iter_mut().find(|e| e.metadata.name.as_deref() == Some(name)) {
            Some(e) => e,
            None => return Ok(false),
        };

        entity.style.fill = None;
        Ok(true)
    }
}
```

### JavaScript 호출 예시

```javascript
// 기존 도형 생성 (name 필수)
scene.add_circle("head", 0, 100, 10);

// stroke 변경 (빨간색 2px) - name으로 식별
scene.set_stroke("head", JSON.stringify({
    width: 2,
    color: [1, 0, 0, 1]
}));

// fill 추가 (연한 파란색)
scene.set_fill("head", JSON.stringify({
    color: [0, 0.5, 1, 0.3]
}));

// 나중에 stroke 제거 (fill만 남김)
scene.remove_stroke("head");

// 존재하지 않는 name (무시됨)
const result = scene.set_stroke("unknown_entity", "{}");
console.log(result);  // false
```

### 부분 업데이트 예시

```javascript
// 기존: width=2, color=red
scene.draw_circle("my_circle", 0, 0, 10, JSON.stringify({
    stroke: { width: 2, color: [1, 0, 0, 1] }
}));

// color만 변경 → width는 유지됨
scene.set_stroke("my_circle", JSON.stringify({
    color: [0, 0, 1, 1]  // 파란색으로 변경
}));
// 결과: width=2 (유지), color=blue (변경)
```

### 디렉토리 구조

```
cad-engine/src/
├── lib.rs
├── scene/
│   ├── mod.rs          # set_stroke, set_fill, remove_* 추가
│   ├── entity.rs
│   └── style.rs        # merge_from 메서드 추가
└── primitives/
```

### Dependencies

- Story 1.2 (Scene 클래스)
- Story 1.6 (Style 데이터 구조)

## References

- [Source: docs/architecture.md#Error Handling Policy - ID 미발견 시 no-op]
- [Source: docs/prd.md#Entity 구조]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### File List

- cad-engine/src/scene/mod.rs (수정 - set_*/remove_* 추가)
- cad-engine/src/scene/style.rs (수정 - merge_from 추가)
