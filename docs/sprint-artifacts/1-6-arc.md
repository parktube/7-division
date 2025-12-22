# Story 1.6: Arc 도형 생성 기능

> **재정렬 사유**: Arc는 Line(1.3), Circle(1.4), Rect(1.5)와 같은 기초 도형(Primitive)입니다.
> Style 시스템(1.7~1.9)보다 먼저 정의되어야 합니다.
> PRD에 `arc(radius, startAngle, endAngle)`로 명시됨.

Status: done

## Story

As a **AI 에이전트 (Claude Code)**,
I want **호(arc)를 생성할 수 있도록**,
So that **스켈레톤의 곡선 팔, 관절 회전 표시, 부채꼴 등을 표현할 수 있다**.

## Acceptance Criteria

### AC1: 기본 Arc 생성
**Given** Scene 인스턴스가 존재
**When** `scene.add_arc("shoulder_arc", cx, cy, radius, start_angle, end_angle)` 호출
**Then** Arc 타입의 Entity가 생성된다
**And** geometry에 `{ center: [cx, cy], radius, start_angle, end_angle }` 저장
**And** name ("shoulder_arc")이 반환된다
**And** (AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해함)

### AC2: 각도 단위 (라디안)
**Given** 각도가 라디안으로 주어짐
**When** add_arc(0, 0, 50, 0, Math.PI/2) 호출
**Then** 0도에서 90도(시계 반대 방향)의 호가 생성된다
**And** Canvas/SVG 렌더링 시 올바르게 표시된다

### AC3: 음수 반지름 처리
**Given** radius가 0 이하인 경우
**When** add_arc 호출
**Then** abs()로 양수 변환되어 정상 생성된다
**And** (정책: 관대한 입력 보정)

### AC4: 360도 이상 각도 처리
**Given** end_angle - start_angle > 2π인 경우
**When** add_arc 호출
**Then** 정상 처리된다 (full circle 이상도 허용)

### AC5: draw_arc (스타일 포함)
**Given** Scene 인스턴스가 존재
**When** `scene.draw_arc(cx, cy, radius, start_angle, end_angle, style_json)` 호출
**Then** 스타일이 적용된 Arc가 생성된다

### AC6: 시맨틱 함수명 (NFR9)
**Given** AX 원칙
**When** 함수를 정의할 때
**Then** `add_arc`, `draw_arc`로 명명하여 의도가 명확함

## Tasks / Subtasks

- [x] **Task 1: Arc Geometry 정의** (AC: #1)
  - [x] 1.1: Geometry enum에 Arc variant 추가
  - [x] 1.2: EntityType에 Arc 추가
  - [x] 1.3: serde 직렬화 확인

- [x] **Task 2: add_arc 함수 구현** (AC: #1, #2, #3, #4, #6)
  - [x] 2.1: `add_arc(name: &str, cx, cy, radius, start_angle, end_angle) -> Result<String, JsValue>`
  - [x] 2.2: name 중복 체크 (has_entity)
  - [x] 2.3: 음수 radius 보정 (abs().max(0.001))
  - [x] 2.4: Entity 생성 (metadata.name = name) 및 name 반환

- [x] **Task 3: draw_arc 함수 구현** (AC: #5, #6)
  - [x] 3.1: `draw_arc(name: &str, cx, cy, radius, start_angle, end_angle, style_json) -> Result<String, JsValue>`
  - [x] 3.2: name 중복 체크
  - [x] 3.3: 스타일 파싱 및 적용 (실패 시 기본 스타일)

- [x] **Task 4: 테스트** (AC: #1-#5)
  - [x] 4.1: 기본 arc 생성 테스트
  - [x] 4.2: 90도 호 (0 to π/2)
  - [x] 4.3: 반원 (0 to π)
  - [x] 4.4: 음수 radius 보정 테스트
  - [x] 4.5: 360도 이상 테스트
  - [x] 4.6: draw_arc WASM export 확인

### Review Follow-ups (AI) - 2025-12-22

- [x] [AI-Review][HIGH] draw_arc에서 NaN/Infinity 검증 및 반지름 보정 로직이 add_arc_internal과 중복됨. DRY 원칙 위반. [mod.rs:387-418] → **Accepted**: draw_* 함수는 스타일 파싱 포함으로 _internal 재사용이 복잡함. 현재 구조 유지.
- [x] [AI-Review][MEDIUM] Dependencies 섹션에 "Story 1.6 (Style 시스템)"이라고 되어 있으나, 이 스토리가 1.6임. "Story 1.7 (Style 시스템)"으로 수정 필요. [1-6-arc.md:319] → **Fixed**

## Dev Notes

### Architecture Patterns

#### Geometry 확장

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Geometry {
    Line { points: Vec<[f64; 2]> },
    Circle { center: [f64; 2], radius: f64 },
    Rect { origin: [f64; 2], width: f64, height: f64 },
    Arc {
        center: [f64; 2],
        radius: f64,
        start_angle: f64,  // 라디안, 0 = 3시 방향
        end_angle: f64,    // 라디안, 양수 = 반시계방향 (CCW)
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntityType {
    Line,
    Circle,
    Rect,
    Arc,  // ← 추가
}
```

#### add_arc 함수

> **AX 원칙**: name이 첫 번째 파라미터입니다. AI는 "shoulder_arc", "joint_range" 같은 의미있는 이름으로 Entity를 식별합니다.

```rust
#[wasm_bindgen]
impl Scene {
    /// 호(Arc)를 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "shoulder_arc") - Scene 내 unique
    /// * `cx` - 중심점 x 좌표
    /// * `cy` - 중심점 y 좌표
    /// * `radius` - 반지름
    /// * `start_angle` - 시작 각도 (라디안, 0 = 3시 방향)
    /// * `end_angle` - 끝 각도 (라디안, 양수 = CCW)
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    /// * Err - name 중복
    pub fn add_arc(
        &mut self,
        name: &str,
        cx: f64,
        cy: f64,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
    ) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!("Entity '{}' already exists", name)));
        }

        let radius = if radius <= 0.0 { radius.abs().max(0.001) } else { radius };

        let id = generate_id();  // 내부 ID (JSON export용)
        let entity = Entity {
            id,
            entity_type: EntityType::Arc,
            geometry: Geometry::Arc {
                center: [cx, cy],
                radius,
                start_angle,
                end_angle,
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

    /// 스타일이 적용된 호(Arc)를 생성합니다.
    pub fn draw_arc(
        &mut self,
        name: &str,
        cx: f64,
        cy: f64,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
        style_json: &str,
    ) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!("Entity '{}' already exists", name)));
        }

        let radius = if radius <= 0.0 { radius.abs().max(0.001) } else { radius };

        let style = serde_json::from_str::<Style>(style_json)
            .unwrap_or_else(|_| Style::default());

        let id = generate_id();
        let entity = Entity {
            id,
            entity_type: EntityType::Arc,
            geometry: Geometry::Arc {
                center: [cx, cy],
                radius,
                start_angle,
                end_angle,
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
// 90도 호 (3시 → 12시 방향) - name 필수
scene.add_arc("quarter_arc", 0, 0, 50, 0, Math.PI / 2);

// 반원 (3시 → 9시 방향)
scene.add_arc("half_circle", 0, 0, 50, 0, Math.PI);

// 3/4 원
scene.add_arc("three_quarter", 0, 0, 50, 0, Math.PI * 1.5);

// 스타일 적용 호 (빨간 2px)
scene.draw_arc("styled_arc", 0, 0, 50, 0, Math.PI, JSON.stringify({
    stroke: { width: 2, color: [1, 0, 0, 1] }
}));

// 스켈레톤 관절 표시
scene.draw_arc("shoulder_joint", 0, 70, 5, -Math.PI/4, Math.PI/4, JSON.stringify({
    stroke: { width: 1, color: [0.5, 0.5, 0.5, 1] }
}));

// 이후 수정 시 name으로 식별
scene.set_stroke("shoulder_joint", JSON.stringify({ color: [1, 0, 0, 1] }));  // 빨간색으로
```

### 각도 규칙

```
Y-up 좌표계에서:

         π/2 (90°)
           │
           │
  π ───────┼─────── 0 (0°)
 (180°)    │
           │
        3π/2 (270°)
        또는 -π/2

양수 각도 = 반시계방향 (CCW)
음수 각도 = 시계방향 (CW)
```

### Canvas 2D 렌더링 (뷰어)

```javascript
// renderer.js에 추가
case 'arc':
    ctx.beginPath();
    // Canvas arc: (x, y, radius, startAngle, endAngle, counterclockwise)
    // 주의: Canvas는 Y-down이므로 각도 반전 필요
    ctx.arc(
        entity.geometry.center[0],
        entity.geometry.center[1],
        entity.geometry.radius,
        -entity.geometry.start_angle,  // Y-flip으로 인해 부호 반전
        -entity.geometry.end_angle,
        true  // counterclockwise (CCW)
    );
    ctx.stroke();
    break;
```

### SVG Export

```rust
// Arc → SVG path
fn arc_to_svg_path(center: [f64; 2], radius: f64, start: f64, end: f64) -> String {
    let start_x = center[0] + radius * start.cos();
    let start_y = center[1] + radius * start.sin();
    let end_x = center[0] + radius * end.cos();
    let end_y = center[1] + radius * end.sin();

    let large_arc = if (end - start).abs() > std::f64::consts::PI { 1 } else { 0 };
    let sweep = if end > start { 1 } else { 0 };

    format!(
        "M {} {} A {} {} 0 {} {} {} {}",
        start_x, start_y,
        radius, radius,
        large_arc, sweep,
        end_x, end_y
    )
}
```

### 디렉토리 구조

```
cad-engine/src/
├── lib.rs
├── scene/
│   ├── mod.rs          # add_arc, draw_arc 추가
│   ├── entity.rs       # Geometry::Arc, EntityType::Arc 추가
│   └── style.rs
├── primitives/
│   ├── mod.rs
│   └── arc.rs          # ← 이 스토리 (선택적)
└── serializers/
    ├── json.rs
    └── svg.rs          # Arc SVG 출력 추가
```

### Dependencies

- Story 1.2 (Scene 클래스 및 Entity 구조)
- Story 1.7 (Style 시스템) - draw_arc용

## References

- [Source: docs/prd.md#Primitives - arc(radius, startAngle, endAngle)]
- [Source: docs/architecture.md#Coordinate System Contract - 회전 규칙]
- [Source: docs/architecture.md#Error Handling Policy]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Context Reference

- Story 1.4 Circle, Story 1.5 Rect 패턴 참조하여 일관된 구현

### Completion Notes List

- EntityType::Arc, Geometry::Arc 추가
- add_arc_internal: 내부 함수 구현 (NaN/Infinity 검증, 반지름 보정)
- add_arc: wasm_bindgen export 함수 구현
- draw_arc: 스타일 적용 Arc 생성 (JSON 파싱, 실패 시 기본 스타일)
- 테스트 10개 추가: 기본 생성, 90도/반원, 음수/0 반지름 보정, 360도+, 음수 각도, 중복 에러, NaN/Infinity 에러
- Story 1.6 완료 시점: 50개 테스트 통과 (기존 40개 + 신규 10개)
- Epic 1 최종: 60개 테스트 통과 (Story 1.7~1.9 추가분 포함)

### Change Log

- 2025-12-22: Story 1.6 Arc 도형 생성 기능 구현 완료

### File List

- cad-engine/src/scene/entity.rs (수정 - Geometry::Arc, EntityType::Arc)
- cad-engine/src/scene/mod.rs (수정 - add_arc_internal, add_arc, draw_arc, 테스트 10개)
- docs/sprint-artifacts/sprint-status.yaml (수정 - 1-5-rect: done, 1-6-arc: done)
- docs/sprint-artifacts/1-6-arc.md (수정 - 태스크 체크, Dev Agent Record 업데이트)
