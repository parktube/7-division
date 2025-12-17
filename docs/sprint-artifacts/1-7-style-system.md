# Story 1.7: Style 데이터 구조 정의

> **설계 결정**: Style은 Renderer가 아닌 Entity에 포함됩니다.
> - 이유: 도면 출력(DXF, SVG, PDF)시 스타일 정보가 필요
> - 3D 확장 시 Material Reference로 발전 가능

Status: ready-for-dev

## Story

As a **AI 에이전트 (Claude Code)**,
I want **도형의 선(stroke)과 면(fill) 스타일을 정의하는 데이터 구조가 있도록**,
So that **"빨간 원", "파란 점선" 같은 스타일이 적용된 도형을 생성할 수 있다**.

## Acceptance Criteria

### AC1: StrokeStyle 구조체 정의
**Given** CAD 엔진 개발 중
**When** StrokeStyle 구조체를 정의할 때
**Then** 다음 필드가 포함된다:
- `width: f64` - 선 두께
- `color: [f64; 4]` - RGBA (0.0-1.0)
- `dash: Option<Vec<f64>>` - 대시 패턴 (예: [5, 3])
- `cap: LineCap` - Butt, Round, Square
- `join: LineJoin` - Miter, Round, Bevel

### AC2: FillStyle 구조체 정의
**Given** CAD 엔진 개발 중
**When** FillStyle 구조체를 정의할 때
**Then** 다음 필드가 포함된다:
- `color: [f64; 4]` - RGBA (0.0-1.0)

### AC3: Style 구조체 정의
**Given** StrokeStyle과 FillStyle이 정의됨
**When** Style 구조체를 정의할 때
**Then** 다음 필드가 포함된다:
- `stroke: Option<StrokeStyle>` - None이면 선 없음
- `fill: Option<FillStyle>` - None이면 채움 없음

### AC4: 기본값 (Default) 구현
**Given** Style 구조체
**When** `Style::default()` 호출
**Then** stroke: 검은색(0,0,0,1) 1px, fill: None으로 설정된다
**And** (기존 동작과 호환: 선만 있는 도형)

### AC5: JSON 직렬화
**Given** Style이 적용된 Entity
**When** `export_json()` 호출
**Then** style 필드가 JSON에 포함된다
**And** 뷰어가 style 정보를 읽을 수 있다

## Tasks / Subtasks

- [ ] **Task 1: 타입 정의** (AC: #1, #2, #3)
  - [ ] 1.1: LineCap enum 정의 (Butt, Round, Square)
  - [ ] 1.2: LineJoin enum 정의 (Miter, Round, Bevel)
  - [ ] 1.3: StrokeStyle 구조체 정의
  - [ ] 1.4: FillStyle 구조체 정의
  - [ ] 1.5: Style 구조체 정의

- [ ] **Task 2: Default 구현** (AC: #4)
  - [ ] 2.1: StrokeStyle::default() - width: 1.0, color: black
  - [ ] 2.2: FillStyle::default() - color: black
  - [ ] 2.3: Style::default() - stroke: Some(default), fill: None

- [ ] **Task 3: Serde 직렬화** (AC: #5)
  - [ ] 3.1: 모든 타입에 Serialize, Deserialize derive
  - [ ] 3.2: JSON 출력 테스트

- [ ] **Task 4: Entity 통합** (AC: #5)
  - [ ] 4.1: Entity 구조체의 style 필드 타입 확인/수정
  - [ ] 4.2: 기존 Style::default() 호출 부분 확인

- [ ] **Task 5: 테스트** (AC: #1-#5)
  - [ ] 5.1: StrokeStyle 생성 테스트
  - [ ] 5.2: FillStyle 생성 테스트
  - [ ] 5.3: Style JSON 직렬화 테스트
  - [ ] 5.4: Default 값 테스트

## Dev Notes

### Architecture Patterns

#### 타입 정의

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum LineCap {
    Butt,
    Round,
    Square,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum LineJoin {
    Miter,
    Round,
    Bevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrokeStyle {
    pub width: f64,
    pub color: [f64; 4],  // RGBA, 0.0-1.0
    pub dash: Option<Vec<f64>>,
    pub cap: LineCap,
    pub join: LineJoin,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FillStyle {
    pub color: [f64; 4],  // RGBA, 0.0-1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Style {
    pub stroke: Option<StrokeStyle>,
    pub fill: Option<FillStyle>,
}
```

#### Default 구현

```rust
impl Default for LineCap {
    fn default() -> Self { LineCap::Butt }
}

impl Default for LineJoin {
    fn default() -> Self { LineJoin::Miter }
}

impl Default for StrokeStyle {
    fn default() -> Self {
        StrokeStyle {
            width: 1.0,
            color: [0.0, 0.0, 0.0, 1.0],  // 검은색
            dash: None,
            cap: LineCap::default(),
            join: LineJoin::default(),
        }
    }
}

impl Default for FillStyle {
    fn default() -> Self {
        FillStyle {
            color: [0.0, 0.0, 0.0, 1.0],  // 검은색
        }
    }
}

impl Default for Style {
    fn default() -> Self {
        Style {
            stroke: Some(StrokeStyle::default()),
            fill: None,
        }
    }
}
```

### JSON 출력 예시

```json
{
  "id": "entity_123",
  "type": "circle",
  "geometry": { "center": [0, 0], "radius": 10 },
  "style": {
    "stroke": {
      "width": 2.0,
      "color": [0.0, 0.0, 1.0, 1.0],
      "dash": null,
      "cap": "Round",
      "join": "Miter"
    },
    "fill": {
      "color": [1.0, 0.0, 0.0, 0.5]
    }
  }
}
```

### 디렉토리 구조

```
cad-engine/src/
├── lib.rs
├── scene/
│   ├── mod.rs
│   ├── entity.rs
│   └── style.rs         # ← 이 스토리 (신규)
└── primitives/
```

### Dependencies

- Story 1.2 (Scene 클래스 및 Entity 구조)

## References

- [Source: docs/prd.md#Entity 구조 - style: { stroke, fill, stroke_width }]
- [Source: docs/architecture.md#Error Handling Policy]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### File List

- cad-engine/src/scene/style.rs (신규)
- cad-engine/src/scene/mod.rs (수정 - mod style 추가)
- cad-engine/src/scene/entity.rs (수정 - Style import 확인)
