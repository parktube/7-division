# Story 1.8: 도형 생성 시 Style 적용

Status: ready-for-dev

## Story

As a **AI 에이전트 (Claude Code)**,
I want **도형 생성 시 스타일을 함께 지정할 수 있도록**,
So that **"빨간 테두리의 파란 원을 그려줘" 같은 요청을 한 번의 호출로 처리할 수 있다**.

## Acceptance Criteria

### AC1: draw_circle 함수 (스타일 포함 생성)
**Given** Scene 인스턴스가 존재
**When** `scene.draw_circle(x, y, radius, style_json)` 호출
**Then** Circle Entity가 지정된 스타일로 생성된다
**And** 고유한 ID가 반환된다

### AC2: draw_line 함수 (스타일 포함 생성)
**Given** Scene 인스턴스가 존재
**When** `scene.draw_line(points, style_json)` 호출
**Then** Line Entity가 지정된 스타일로 생성된다
**And** 고유한 ID가 반환된다

### AC3: draw_rect 함수 (스타일 포함 생성)
**Given** Scene 인스턴스가 존재
**When** `scene.draw_rect(x, y, width, height, style_json)` 호출
**Then** Rect Entity가 지정된 스타일로 생성된다
**And** 고유한 ID가 반환된다

### AC4: 스타일 JSON 파싱
**Given** style_json 문자열이 주어짐
**When** draw_* 함수 호출
**Then** JSON이 Style 구조체로 파싱된다
**And** 잘못된 JSON은 기본 스타일로 대체된다 (관대한 입력 보정)

### AC5: 기존 add_* 함수 유지 (하위 호환)
**Given** 기존 코드에서 add_circle 사용 중
**When** add_circle(x, y, radius) 호출
**Then** 기본 스타일(검은색 1px stroke)로 생성된다
**And** 기존 동작과 동일하다

### AC6: 스타일 단축 표현 지원
**Given** AI의 편의를 위해
**When** stroke만 또는 fill만 지정된 JSON
**Then** 나머지는 기본값으로 채워진다

## Tasks / Subtasks

- [ ] **Task 1: draw_circle 구현** (AC: #1, #4, #6)
  - [ ] 1.1: `draw_circle(x, y, radius, style_json: &str)` 시그니처
  - [ ] 1.2: style_json 파싱 로직
  - [ ] 1.3: 파싱 실패 시 기본값 적용
  - [ ] 1.4: Entity 생성 및 ID 반환

- [ ] **Task 2: draw_line 구현** (AC: #2, #4, #6)
  - [ ] 2.1: `draw_line(points: Float64Array, style_json: &str)` 시그니처
  - [ ] 2.2: style_json 파싱 및 Entity 생성

- [ ] **Task 3: draw_rect 구현** (AC: #3, #4, #6)
  - [ ] 3.1: `draw_rect(x, y, w, h, style_json: &str)` 시그니처
  - [ ] 3.2: style_json 파싱 및 Entity 생성

- [ ] **Task 4: 기존 함수 유지** (AC: #5)
  - [ ] 4.1: add_circle, add_line, add_rect는 그대로 유지
  - [ ] 4.2: 내부적으로 Style::default() 사용 확인

- [ ] **Task 5: 테스트** (AC: #1-#6)
  - [ ] 5.1: draw_circle with full style
  - [ ] 5.2: draw_circle with stroke only
  - [ ] 5.3: draw_circle with fill only
  - [ ] 5.4: draw_circle with invalid JSON (fallback)
  - [ ] 5.5: add_circle 기존 동작 유지 확인

## Dev Notes

### Architecture Patterns

#### draw_circle 함수 시그니처

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    /// 스타일이 적용된 원을 생성합니다.
    ///
    /// # Arguments
    /// * `x` - 중심점 x 좌표
    /// * `y` - 중심점 y 좌표
    /// * `radius` - 반지름
    /// * `style_json` - 스타일 JSON 문자열
    ///
    /// # Example style_json
    /// ```json
    /// {
    ///   "stroke": { "width": 2, "color": [0, 0, 1, 1] },
    ///   "fill": { "color": [1, 0, 0, 0.5] }
    /// }
    /// ```
    pub fn draw_circle(&mut self, x: f64, y: f64, radius: f64, style_json: &str) -> String {
        let radius = if radius <= 0.0 { radius.abs().max(0.001) } else { radius };

        // 스타일 파싱 (실패 시 기본값)
        let style = serde_json::from_str::<Style>(style_json)
            .unwrap_or_else(|_| Style::default());

        let id = generate_id();
        let entity = Entity {
            id: id.clone(),
            entity_type: EntityType::Circle,
            geometry: Geometry::Circle {
                center: [x, y],
                radius,
            },
            transform: Transform::default(),
            style,
            metadata: Metadata::default(),
        };

        self.entities.push(entity);
        id
    }
}
```

### JavaScript 호출 예시

```javascript
// 빨간 테두리 + 파란 채움
const id = scene.draw_circle(0, 0, 10, JSON.stringify({
    stroke: { width: 2, color: [1, 0, 0, 1] },  // 빨간 테두리
    fill: { color: [0, 0, 1, 0.5] }              // 반투명 파란 채움
}));

// stroke만 (fill 없음)
const id2 = scene.draw_circle(50, 0, 10, JSON.stringify({
    stroke: { width: 1, color: [0, 0, 0, 1] }
}));

// fill만 (stroke 없음)
const id3 = scene.draw_circle(100, 0, 10, JSON.stringify({
    fill: { color: [0, 1, 0, 1] }
}));

// 기존 방식 (하위 호환)
const id4 = scene.add_circle(150, 0, 10);  // 검은색 1px stroke
```

### 스타일 JSON 단축 표현

```json
// 최소 (stroke만)
{ "stroke": { "color": [1, 0, 0, 1] } }
// → width: 1.0 (default), cap: Butt (default), join: Miter (default)

// fill만
{ "fill": { "color": [0, 1, 0, 1] } }
// → stroke: null

// 둘 다
{
    "stroke": { "width": 2, "color": [0, 0, 1, 1] },
    "fill": { "color": [1, 1, 0, 0.5] }
}
```

### 디렉토리 구조

```
cad-engine/src/
├── lib.rs
├── scene/
│   ├── mod.rs          # draw_circle, draw_line, draw_rect 추가
│   ├── entity.rs
│   └── style.rs
└── primitives/
```

### Dependencies

- Story 1.2 (Scene 클래스)
- Story 1.3 (Line)
- Story 1.4 (Circle)
- Story 1.5 (Rect)
- Story 1.6 (Style 데이터 구조)

## References

- [Source: docs/prd.md#Entity 구조]
- [Source: docs/architecture.md#Error Handling Policy]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### File List

- cad-engine/src/scene/mod.rs (수정 - draw_* 함수 추가)
