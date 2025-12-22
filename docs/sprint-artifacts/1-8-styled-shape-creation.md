# Story 1.8: 도형 생성 시 Style 적용

Status: done

## Story

As a **AI 에이전트 (Claude Code)**,
I want **도형 생성 시 스타일을 함께 지정할 수 있도록**,
So that **"빨간 테두리의 파란 원을 그려줘" 같은 요청을 한 번의 호출로 처리할 수 있다**.

## Acceptance Criteria

### AC1: draw_circle 함수 (스타일 포함 생성)
**Given** Scene 인스턴스가 존재
**When** `scene.draw_circle("head", x, y, radius, style_json)` 호출
**Then** Circle Entity가 지정된 스타일로 생성된다
**And** name ("head")이 반환된다
**And** (AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해함)

### AC2: draw_line 함수 (스타일 포함 생성)
**Given** Scene 인스턴스가 존재
**When** `scene.draw_line("spine", points, style_json)` 호출
**Then** Line Entity가 지정된 스타일로 생성된다
**And** name ("spine")이 반환된다

### AC3: draw_rect 함수 (스타일 포함 생성)
**Given** Scene 인스턴스가 존재
**When** `scene.draw_rect("torso", x, y, width, height, style_json)` 호출
**Then** Rect Entity가 지정된 스타일로 생성된다
**And** name ("torso")이 반환된다

### AC4: 스타일 JSON 파싱
**Given** style_json 문자열이 주어짐
**When** draw_* 함수 호출
**Then** JSON이 Style 구조체로 파싱된다
**And** 잘못된 JSON은 기본 스타일로 대체된다 (관대한 입력 보정)

### AC5: 기존 add_* 함수 유지 (하위 호환)
**Given** 기존 코드에서 add_circle 사용 중
**When** add_circle(name, x, y, radius) 호출
**Then** 기본 스타일(검은색 1px stroke)로 생성된다
**And** 기존 동작과 동일하다

### AC6: 스타일 단축 표현 지원
**Given** AI의 편의를 위해
**When** stroke만 또는 fill만 지정된 JSON
**Then** 나머지는 기본값으로 채워진다

## Tasks / Subtasks

- [x] **Task 1: draw_circle 구현** (AC: #1, #4, #6)
  - [x] 1.1: `draw_circle(name: &str, x, y, radius, style_json: &str)` 시그니처
  - [x] 1.2: name 중복 체크 (has_entity)
  - [x] 1.3: style_json 파싱 로직 (실패 시 기본값)
  - [x] 1.4: Entity 생성 (metadata.name = name) 및 name 반환

- [x] **Task 2: draw_line 구현** (AC: #2, #4, #6)
  - [x] 2.1: `draw_line(name: &str, points: Float64Array, style_json: &str)` 시그니처
  - [x] 2.2: name 중복 체크 및 style_json 파싱
  - [x] 2.3: Entity 생성 및 name 반환

- [x] **Task 3: draw_rect 구현** (AC: #3, #4, #6)
  - [x] 3.1: `draw_rect(name: &str, x, y, w, h, style_json: &str)` 시그니처
  - [x] 3.2: name 중복 체크 및 style_json 파싱
  - [x] 3.3: Entity 생성 및 name 반환

- [x] **Task 4: 기존 함수 유지** (AC: #5)
  - [x] 4.1: add_circle, add_line, add_rect는 그대로 유지
  - [x] 4.2: 내부적으로 Style::default() 사용 확인

- [x] **Task 5: 테스트** (AC: #1-#6)
  - [x] 5.1: draw_circle with full style
  - [x] 5.2: draw_circle with stroke only
  - [x] 5.3: draw_circle with fill only
  - [x] 5.4: draw_circle with invalid JSON (fallback)
  - [x] 5.5: add_circle 기존 동작 유지 확인

### Review Follow-ups (AI) - 2025-12-22

- [x] [AI-Review][HIGH] draw_circle, draw_line에서 검증 로직이 *_internal과 중복됨. DRY 원칙 위반. [mod.rs:460-563] → **Accepted**: draw_* 함수는 스타일 파싱 포함으로 _internal 재사용이 복잡함. 현재 구조 유지.
- [ ] [AI-Review][LOW] WASM 경계 테스트가 `node -e` 명령으로 수동 실행됨. `tests/wasm_boundary.js` 파일로 자동화 권장.

## Dev Notes

### Architecture Patterns

#### draw_circle 함수 시그니처

> **AX 원칙**: name이 첫 번째 파라미터입니다. AI는 의미있는 이름으로 Entity를 식별합니다.

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    /// 스타일이 적용된 원을 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "head") - Scene 내 unique
    /// * `x` - 중심점 x 좌표
    /// * `y` - 중심점 y 좌표
    /// * `radius` - 반지름
    /// * `style_json` - 스타일 JSON 문자열
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    /// * Err - name 중복
    pub fn draw_circle(&mut self, name: &str, x: f64, y: f64, radius: f64, style_json: &str) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!("Entity '{}' already exists", name)));
        }

        let radius = if radius <= 0.0 { radius.abs().max(0.001) } else { radius };

        // 스타일 파싱 (실패 시 기본값)
        let style = serde_json::from_str::<Style>(style_json)
            .unwrap_or_else(|_| Style::default());

        let id = generate_id();
        let entity = Entity {
            id,
            entity_type: EntityType::Circle,
            geometry: Geometry::Circle {
                center: [x, y],
                radius,
            },
            transform: Transform::default(),
            style,
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

### JavaScript 호출 예시

```javascript
// 빨간 테두리 + 파란 채움 - name 필수
scene.draw_circle("head", 0, 0, 10, JSON.stringify({
    stroke: { width: 2, color: [1, 0, 0, 1] },  // 빨간 테두리
    fill: { color: [0, 0, 1, 0.5] }              // 반투명 파란 채움
}));

// stroke만 (fill 없음)
scene.draw_circle("outline_circle", 50, 0, 10, JSON.stringify({
    stroke: { width: 1, color: [0, 0, 0, 1] }
}));

// fill만 (stroke 없음)
scene.draw_circle("filled_circle", 100, 0, 10, JSON.stringify({
    fill: { color: [0, 1, 0, 1] }
}));

// 기존 방식 (하위 호환) - name 필수
scene.add_circle("simple_circle", 150, 0, 10);  // 검은색 1px stroke

// 이후 수정 시 name으로 식별
scene.set_fill("head", JSON.stringify({ color: [1, 0.8, 0.6, 1] }));  // 살색으로
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

### Context Reference

- Story 1.6 Arc의 draw_arc 패턴을 Circle, Line, Rect에 확장 적용
- 기존 add_* 함수는 그대로 유지하여 하위 호환성 보장

### Completion Notes List

- draw_circle: NaN/Infinity 검증, 반지름 보정, 스타일 파싱 (실패 시 기본값)
- draw_line: 좌표 파싱 (parse_line_points 재사용), 스타일 파싱
- draw_rect: NaN/Infinity 검증, 크기 보정, 스타일 파싱
- WASM 경계 테스트 통과: full style, stroke only, fill only, invalid JSON fallback
- 기존 add_* 함수 동작 유지 확인
- 전체 테스트 60개 통과

### Change Log

- 2025-12-22: Story 1.8 도형 생성 시 Style 적용 완료

### File List

- cad-engine/src/scene/mod.rs (수정 - draw_circle, draw_line, draw_rect 추가)
- docs/sprint-artifacts/sprint-status.yaml (수정 - 1-7-style-system: done, 1-8-styled-shape-creation: review)
- docs/sprint-artifacts/1-8-styled-shape-creation.md (수정 - 태스크 체크, Dev Agent Record 업데이트)
