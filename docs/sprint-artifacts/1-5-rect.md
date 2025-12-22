# Story 1.5: Rect 도형 생성 기능

Status: done

## Story

As a **AI 에이전트 (Claude Code)**,
I want **원점, 너비, 높이로 사각형을 생성할 수 있도록**,
So that **스켈레톤의 몸통이나 배경 요소를 표현할 수 있다**.

## Acceptance Criteria

### AC1: 기본 사각형 생성
**Given** Scene 인스턴스가 존재
**When** `scene.add_rect("torso", x, y, width, height)` 호출
**Then** Rect 타입의 Entity가 생성된다
**And** geometry에 `{ origin: [x, y], width: width, height: height }` 형태로 저장된다
**And** name ("torso")이 반환된다
**And** (AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해함)

### AC2: 음수 크기 처리
**Given** width 또는 height가 0 이하인 경우
**When** add_rect 호출
**Then** abs()로 양수 변환되어 정상 생성된다
**And** (정책: 관대한 입력 보정, docs/architecture.md#Error Handling Policy)

### AC3: Y-up 중심 좌표계
**Given** 중심 원점 Y-up 좌표계 (CAD 표준)
**When** add_rect(0, 0, 100, 50) 호출
**Then** origin(0,0)에서 width=100, height=50인 사각형이 생성된다
**And** Canvas 2D 뷰어에서는 Y-flip 변환 후 표시 (Story 2.3)
**And** (정책: docs/architecture.md#Coordinate System Contract)

### AC4: 시맨틱 함수명 (NFR9)
**Given** AX 원칙
**When** 함수를 정의할 때
**Then** `add_rect`로 명명하여 의도가 명확함

## Tasks / Subtasks

- [x] **Task 1: Rect 생성 함수 구현** (AC: #1, #3, #4)
  - [x] 1.1: `add_rect(&mut self, name: &str, x: f64, y: f64, width: f64, height: f64) -> Result<String, JsValue>` 구현
  - [x] 1.2: name 중복 체크 (has_entity)
  - [x] 1.3: RectGeometry 생성 (metadata.name = name)
  - [x] 1.4: Entity 추가 및 name 반환

- [x] **Task 2: 크기 보정** (AC: #2)
  - [x] 2.1: width <= 0 또는 height <= 0 검증
  - [x] 2.2: abs().max(0.001)로 양수 변환 (관대한 입력 보정)
  - [x] 2.3: 보정 로직 문서화

- [x] **Task 3: Scene에 통합** (AC: #1, #4)
  - [x] 3.1: Scene impl에 add_rect 메서드 추가
  - [x] 3.2: wasm_bindgen export 확인

- [x] **Task 4: 테스트 작성** (AC: #1, #2, #3)
  - [x] 4.1: 기본 사각형 생성 테스트
  - [x] 4.2: 음수 크기 보정 테스트 (abs() 변환 확인)
  - [x] 4.3: Y-up 중심 좌표계 테스트

### Review Follow-ups (AI) - 2025-12-22

- [x] [AI-Review][HIGH] draw_rect에서 NaN/Infinity 검증 및 크기 보정 로직이 add_rect_internal과 중복됨. DRY 원칙 위반. [mod.rs:581-615] → **Accepted**: draw_* 함수는 스타일 파싱 포함으로 _internal 재사용이 복잡함. 현재 구조 유지.

## Dev Notes

### Architecture Patterns

#### add_rect 함수 시그니처

> **AX 원칙**: name이 첫 번째 파라미터입니다. AI는 "torso", "background" 같은 의미있는 이름으로 Entity를 식별합니다.

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    /// 사각형(Rect) 도형을 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "torso", "background") - Scene 내 unique
    /// * `x` - 원점 x 좌표 (Y-up 중심 좌표계)
    /// * `y` - 원점 y 좌표 (Y-up 중심 좌표계)
    /// * `width` - 너비 (음수/0 → abs()로 보정)
    /// * `height` - 높이 (음수/0 → abs()로 보정)
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    /// * Err - name 중복
    pub fn add_rect(&mut self, name: &str, x: f64, y: f64, width: f64, height: f64) -> Result<String, JsValue> {
        // name 중복 체크
        if self.has_entity(name) {
            return Err(JsValue::from_str(&format!("Entity '{}' already exists", name)));
        }

        // 관대한 입력 보정: 음수/0은 abs()로 변환
        let width = if width <= 0.0 { width.abs().max(0.001) } else { width };
        let height = if height <= 0.0 { height.abs().max(0.001) } else { height };

        let id = generate_id();  // 내부 ID (JSON export용)
        let entity = Entity {
            id,
            entity_type: EntityType::Rect,
            geometry: Geometry::Rect {
                origin: [x, y],
                width,
                height,
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

#### 스켈레톤 몸통 예시

```javascript
// 스켈레톤 몸통 (rect) - name 필수
scene.add_rect("torso", -5, 50, 10, 40);  // 좌하단 (-5, 50), 10x40 (위쪽으로 확장)

// 이후 수정 시 name으로 식별
scene.set_fill("torso", JSON.stringify({ color: [0.5, 0.5, 0.5, 1] }));  // 회색으로
```

### Geometry 구조

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Geometry {
    // ... Line, Circle
    Rect {
        origin: [f64; 2],  // [x, y] - 좌하단 기준점 (anchor point)
        width: f64,        // 오른쪽(+x)으로 확장
        height: f64,       // 위쪽(+y)으로 확장
    },
}
```

### 좌표계 (Y-up 중심 좌표계)

```
      y ▲
        │    ┌────────────┐
        │    │   Rect     │ height (+y)
        │    │            │
        │    └────────────┘
        │    (x,y)  width (+x)
  ──────┼──────────────────► x
        │ (0,0) = 화면 중심
```

- **좌표계**: Y-up 중심 좌표계 (수학적 표준, Y가 위로 증가)
- **origin**: Rect의 좌하단 기준점 (anchor point)
- **확장 방향**: width는 +x, height는 +y 방향으로 확장
- Canvas 2D 뷰어: Y-flip 변환 필요 (Story 2.3에서 처리)

### 디렉토리 구조

```
cad-engine/src/
├── lib.rs
├── scene/
│   ├── mod.rs          # add_rect 메서드 추가
│   └── entity.rs       # RectGeometry 포함
└── primitives/
    ├── mod.rs
    ├── line.rs
    ├── circle.rs
    └── rect.rs         # ← 이 스토리 (선택적 분리)
```

### WASM 테스트 전략

> **참고**: `JsValue`는 WASM 환경에서만 사용 가능하여 `cargo test`로는 직접 테스트 불가

- **단위 테스트**: `_internal` 함수로 핵심 로직 검증 (NaN/Infinity, 크기 보정, 중복 체크)
- **WASM 경계 테스트**: Node.js에서 빌드된 WASM 모듈 직접 호출하여 검증
  ```bash
  wasm-pack build --target nodejs
  node -e "const w = require('./pkg'); const s = new w.Scene('t'); console.log(s.add_rect('r', 0, 0, 10, 10));"
  ```
- 이 패턴은 `add_line`, `add_circle`과 동일함

### Project Structure Notes

- Epic 1의 마지막 도형 생성 스토리
- 이 스토리 완료 시 FR2, FR3, FR4 모두 충족
- Epic 2 (JSON Export, 뷰어)로 진행 가능

### Dependencies

- Story 1.2 (Scene 클래스 및 Entity 구조)

## References

- [Source: docs/architecture.md#API Design - WASM Exports]
- [Source: docs/prd.md#검증 시나리오]
- [Source: docs/epics.md#Story 1.5]

## Dev Agent Record

### Context Reference

- Story 1.4 Circle 패턴 참조하여 일관된 구현

### Agent Model Used

Claude Opus 4.5

### Debug Log References

없음 (첫 시도에 성공)

### Completion Notes List

- add_rect_internal: 내부 함수 구현 (NaN/Infinity 검증, 크기 보정)
- add_rect: wasm_bindgen export 함수 구현
- 단위 테스트 9개 추가: 기본 생성, 음수 크기 보정, 0 크기 보정, 작은 음수 클램프, 음수 좌표, name 중복, NaN 에러, Infinity 에러
- 전체 단위 테스트 40개 통과 (기존 31개 + 신규 9개)
- WASM 경계 검증: Node.js에서 add_rect 호출 테스트 (기본 생성, 음수 크기 보정, 중복 에러 처리) 통과

### Change Log

- 2025-12-22: Story 1.5 Rect 도형 생성 기능 구현 완료
- 2025-12-22: 코드 리뷰 피드백 반영 (File List 보완, WASM 경계 검증, origin 문서 명확화)

### File List

- cad-engine/src/scene/mod.rs (수정 - add_rect_internal, add_rect, 테스트 추가)
- docs/sprint-artifacts/sprint-status.yaml (수정 - 1-4-circle: done, 1-5-rect: review)
- docs/sprint-artifacts/1-5-rect.md (수정 - 태스크 체크, Dev Agent Record 업데이트)
