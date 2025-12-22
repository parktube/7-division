---
stepsCompleted: [1, 2, 3, 4]
status: ready-for-development
validatedAt: 2025-12-17
inputDocuments:
  - docs/prd.md
  - docs/architecture.md
  - docs/ai-native-cad-proposal.md
  - docs/ax-design-guide.md
---

# AI-Native CAD - Epic Breakdown

## Overview

이 문서는 AI-Native CAD Phase 1의 PRD, Architecture, 제안서 및 AX 설계 가이드로부터 추출한 요구사항을 에픽과 스토리로 분해합니다.

## Requirements Inventory

### Functional Requirements

**CAD 엔진 (Rust → WASM)**

FR1: Rust CAD 엔진을 WASM으로 빌드하여 Node.js에서 직접 로드/실행할 수 있어야 한다
FR2: 기초 도형 `line(points)` - 두 점 사이의 선분을 생성할 수 있어야 한다
FR3: 기초 도형 `circle(x, y, radius)` - 중심점과 반지름으로 원을 생성할 수 있어야 한다
FR4: 기초 도형 `rect(x, y, width, height)` - 원점, 너비, 높이로 사각형을 생성할 수 있어야 한다
FR17: Style 데이터 구조 - stroke(width, color, dash, cap, join)와 fill(color)을 정의할 수 있어야 한다
FR18: 스타일 적용 도형 생성 - draw_*(geometry, style)로 스타일이 적용된 도형을 생성할 수 있어야 한다
FR19: 스타일 수정 - set_stroke/set_fill로 기존 도형의 스타일을 변경할 수 있어야 한다
FR20: 기초 도형 `arc(cx, cy, radius, start_angle, end_angle)` - 호를 생성할 수 있어야 한다
FR5: 변환 `translate(id, dx, dy)` - 엔티티를 지정된 거리만큼 이동시킬 수 있어야 한다
FR6: 변환 `rotate(id, angle)` - 엔티티를 지정된 각도만큼 회전시킬 수 있어야 한다
FR7: 변환 `scale(id, sx, sy)` - 엔티티를 지정된 비율로 확대/축소할 수 있어야 한다
FR8: 변환 `delete(id)` - 지정된 엔티티를 삭제할 수 있어야 한다

**출력/직렬화**

FR9: `export_json()` - Scene을 scene.json 포맷으로 출력할 수 있어야 한다
FR10: `export_svg()` - Scene을 SVG 포맷으로 출력할 수 있어야 한다

**뷰어**

FR11: Canvas 2D 뷰어가 scene.json을 polling(500ms)하여 실시간 렌더링해야 한다
FR12: 뷰어는 line, circle, rect 3종 도형을 렌더링할 수 있어야 한다
FR13: 뷰어는 transform(translate, rotate, scale)이 적용된 도형을 올바르게 렌더링해야 한다

**Claude Code 통합**

FR14: Claude Code에서 WASM 엔진의 Scene 클래스를 인스턴스화할 수 있어야 한다
FR15: Claude Code에서 도형 생성/변환/삭제 함수를 직접 호출할 수 있어야 한다
FR16: Claude Code에서 export_json(), export_svg()로 파일을 저장할 수 있어야 한다

### NonFunctional Requirements

**성능**

NFR1: 첫 결과물까지 시간 < 5분 (사용자가 의도를 전달하고 결과를 확인하기까지)
NFR2: WASM 도구 호출 지연 < 1ms (Direct-first architecture)
NFR3: 뷰어 polling 간격 500ms로 실시간 갱신 체감

**사용성**

NFR4: 학습 시간 0분 - 자연어로 의도만 전달하면 AI가 도구 조작
NFR5: 검증 UI 필수 - 인간이 결과를 확인하고 피드백할 수 있어야 함 (AX 가이드)

**아키텍처**

NFR6: Direct-First - MCP 프로토콜 없이 WASM 직접 호출
NFR7: 오프라인 우선 - 서버 의존 없이 로컬에서 완전 동작

**AX (Agent eXperience)**

NFR8: LLM의 추론을 막지 않는다 - 도메인 6개 + description, 100개 명령어 나열 금지
NFR9: 도구 이름만 보고 의도 이해 가능 - add_circle, translate 등 시맨틱 명확
NFR10: 협업은 자동화가 아니다 - 인간 검증 필수, 피드백 루프 유지

**코드 품질**

NFR11: wasm-bindgen 클래스 래퍼 패턴 사용 (struct 왕복 피함)
NFR12: Float64Array 등 명확한 타입 사용 (wasm-bindgen 제약 회피)
NFR13: uuid js feature 또는 js_sys::Math::random() 사용 (getrandom 이슈 회피)

### Additional Requirements

**Tech Stack (Architecture 결정사항)**

- Rust 1.85.0+ (stable, 2024 Edition)
- wasm-pack 0.13.1 ([drager fork](https://github.com/drager/wasm-pack))
- wasm-bindgen 0.2.92 (버전 고정)
- Node.js 22.x LTS
- HTML Canvas 2D (Phase 1 뷰어)
- Vitest 3.x (테스트)
- 정적 서버 (Vite 미사용)

**디렉토리 구조 (Architecture planned)**

```
cad-engine/
├── src/
│   ├── lib.rs           # WASM 엔트리포인트
│   ├── primitives/      # line.rs, circle.rs, rect.rs
│   ├── transforms/      # translate.rs, rotate.rs, scale.rs
│   ├── scene/           # entity.rs, history.rs
│   └── serializers/     # json.rs, svg.rs
└── pkg/                 # WASM 빌드 결과

viewer/
├── index.html
├── renderer.js          # Canvas 2D 렌더링
└── scene.json           # WASM 출력 (polling 대상)
```

**검증 시나리오 (제안서 기반)**

- 입력: "사람 스켈레톤을 그려줘"
- 기대: AI가 circle(머리) + line(척추, 팔, 다리)를 조합하여 스켈레톤 생성
- 수정: "왼쪽 팔을 더 길게 해줘" → translate/scale 적용

**AX 원칙 적용 (ax-design-guide 기반)**

- ActionHints 지원 준비 (Phase 2용, Phase 1에서는 구조만)
- 진행상황 투명성 - export 후 파일 경로 반환
- 블랙박스 금지 - 각 도구 호출 결과가 명확히 보여야 함

### FR Coverage Map

| FR | Epic | 설명 |
|----|------|------|
| FR1 | Epic 1 | WASM 빌드 → Node.js 로드 |
| FR2 | Epic 1 | 기초 도형 line 생성 |
| FR3 | Epic 1 | 기초 도형 circle 생성 |
| FR4 | Epic 1 | 기초 도형 rect 생성 |
| FR5 | Epic 3 | 변환 translate |
| FR6 | Epic 3 | 변환 rotate |
| FR7 | Epic 3 | 변환 scale |
| FR8 | Epic 3 | 변환 delete |
| FR9 | Epic 2 | JSON 출력 |
| FR10 | Epic 3 | SVG 출력 |
| FR11 | Epic 2 | Polling 실시간 렌더링 |
| FR12 | Epic 2 | 3종 도형 렌더링 |
| FR13 | Epic 3 | Transform 적용 렌더링 |
| FR14 | Epic 1 | Scene 인스턴스화 |
| FR15 | Epic 3 | 함수 직접 호출 |
| FR16 | Epic 2 | 파일 저장 |

## Epic List

### Epic 1: "AI가 도형을 그린다" - CAD 엔진 기초

**목표**: Claude Code에게 요청하면 AI가 기초 도형(선, 원, 사각형)을 생성할 수 있다.

**사용자 스토리**: "사람 스켈레톤을 그려줘"라고 요청하면, AI가 머리(circle), 척추/팔/다리(line)를 조합하여 도형을 생성한다.

**FRs covered**: FR1, FR2, FR3, FR4, FR14

**NFRs addressed**: NFR2 (< 1ms 호출), NFR6 (Direct-First), NFR7 (오프라인), NFR8-9 (AX 시맨틱), NFR11-13 (코드 품질)

**완료 조건**:
- [ ] Rust CAD 엔진 WASM 빌드 성공 (wasm-pack)
- [ ] `line(points)` 함수로 선분 생성
- [ ] `circle(x, y, radius)` 함수로 원 생성
- [ ] `rect(x, y, width, height)` 함수로 사각형 생성
- [ ] Claude Code에서 `new Scene("name")` 인스턴스화 성공
- [ ] wasm-bindgen 클래스 래퍼 패턴 적용

---

### Epic 2: "결과를 실시간으로 본다" - Canvas 2D 뷰어

**목표**: 생성된 도형을 브라우저에서 실시간으로 확인하고, JSON 파일로 저장할 수 있다.

**사용자 스토리**: AI가 도형을 생성하면, 브라우저 뷰어에서 500ms 간격으로 갱신되어 실시간으로 결과를 확인할 수 있다.

**FRs covered**: FR9, FR11, FR12, FR16

**NFRs addressed**: NFR3 (500ms polling), NFR5 (검증 UI 필수), NFR10 (인간 검증)

**선행 조건**: Epic 1 완료 (도형 생성 기능)

**완료 조건**:
- [ ] `export_json()` 함수로 scene.json 출력
- [ ] Canvas 2D 뷰어가 scene.json을 500ms polling
- [ ] line, circle, rect 3종 도형 렌더링
- [ ] Claude Code에서 파일 시스템에 JSON 저장
- [ ] 정적 HTML 서버로 뷰어 동작 (Vite 없이)

---

### Epic 3: "원하는 대로 수정한다" - 변환과 Export

**목표**: 기존 도형을 이동/회전/확대/삭제하고, 수정된 결과를 확인하며, SVG로 내보낼 수 있다.

**사용자 스토리**: "왼쪽 팔을 더 길게 해줘"라고 요청하면, AI가 해당 엔티티에 scale/translate를 적용하고, 뷰어에서 변환된 결과를 확인할 수 있다.

**FRs covered**: FR5, FR6, FR7, FR8, FR10, FR13, FR15

**NFRs addressed**: NFR1 (< 5분 첫 결과물), NFR4 (학습 시간 0분)

**선행 조건**: Epic 1, Epic 2 완료

**완료 조건**:
- [ ] `translate(id, dx, dy)` 함수로 이동
- [ ] `rotate(id, angle)` 함수로 회전
- [ ] `scale(id, sx, sy)` 함수로 확대/축소
- [ ] `delete(id)` 함수로 삭제
- [ ] `export_svg()` 함수로 SVG 출력
- [ ] 뷰어에서 transform 적용된 도형 올바르게 렌더링
- [ ] Claude Code에서 모든 함수 직접 호출 성공

---

## 검증 시나리오 (Phase 1 Definition of Done)

### 시나리오 1: 스켈레톤 생성
```
입력: "사람 스켈레톤을 그려줘"
기대 결과:
- 머리 (circle)
- 몸통 (line 또는 rect)
- 팔 2개 (line)
- 다리 2개 (line)
- 적절한 비율과 위치
- 뷰어에서 실시간 확인
```

### 시나리오 2: 수정 요청
```
입력: "왼쪽 팔을 더 길게 해줘"
기대 결과:
- 해당 entity의 scale 또는 points 수정
- 뷰어에서 변환 결과 확인
- SVG로 최종 결과물 export
```

---

# Epic 1: "AI가 도형을 그린다" - CAD 엔진 기초

**Epic Goal**: Claude Code에게 요청하면 AI가 기초 도형(선, 원, 사각형)을 생성할 수 있다.

**FRs Covered**: FR1, FR2, FR3, FR4, FR14
**NFRs Addressed**: NFR2, NFR6, NFR7, NFR8-9, NFR11-13

---

## Story 1.1: WASM 프로젝트 초기화 및 빌드 설정

As a **AI 에이전트 (Claude Code)**,
I want **Rust CAD 엔진을 Node.js에서 직접 로드할 수 있도록 WASM 빌드 환경을 구축**,
So that **MCP 없이 직접 CAD 함수를 호출할 수 있다** (Direct-First Architecture).

**Acceptance Criteria:**

**Given** 빈 프로젝트 디렉토리
**When** `wasm-pack build --target nodejs` 명령 실행
**Then** `pkg/` 디렉토리에 WASM 파일과 JS wrapper가 생성된다
**And** Node.js에서 `require('./pkg/cad_engine')` 또는 ESM import가 성공한다

**Given** WASM 모듈이 로드된 상태
**When** Node.js 스크립트에서 모듈을 사용
**Then** 메모리 초기화 및 기본 함수 호출이 가능하다
**And** 호출 지연 시간이 1ms 미만이다 (NFR2)

**Technical Notes:**
- Cargo.toml: `wasm-bindgen = "0.2.92"`, `serde = "1.0"`, `uuid = { version = "1", features = ["js"] }`
- wasm-pack 0.13.1 (drager fork) 사용
- Rust 1.85.0+ (2024 Edition)

**Requirements Fulfilled:** FR1

---

## Story 1.2: Scene 클래스 및 Entity 구조 구현

As a **AI 에이전트 (Claude Code)**,
I want **Scene 클래스를 인스턴스화하고 내부 Entity를 관리할 수 있도록**,
So that **도형들을 하나의 씬에서 관리하고 추적할 수 있다**.

**Acceptance Criteria:**

**Given** WASM 모듈이 로드된 상태
**When** `new Scene("my-scene")` 호출
**Then** Scene 인스턴스가 생성되고 이름이 "my-scene"으로 설정된다
**And** 빈 entities 배열이 초기화된다

**Given** Scene 인스턴스가 존재
**When** Entity를 추가하는 함수 호출 (name 파라미터 필수)
**Then** name(문자열)이 반환된다
**And** Entity가 Scene의 entities에 추가된다
**And** (AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해함)

**Given** wasm-bindgen 제약
**When** 클래스를 정의할 때
**Then** `#[wasm_bindgen] impl Scene` 패턴을 사용한다 (struct 왕복 피함)
**And** `js_sys::Math::random()` 또는 `uuid` js feature로 ID 생성

**Technical Notes:**
- Entity 구조: `{ id, type, geometry, transform, style, metadata }`
- wasm-bindgen 클래스 래퍼 패턴 적용 (NFR11)
- getrandom 이슈 회피 (NFR13)

**Requirements Fulfilled:** FR14

---

## Story 1.3: Line 도형 생성 기능

As a **AI 에이전트 (Claude Code)**,
I want **두 개 이상의 점을 연결하는 선분을 생성할 수 있도록**,
So that **스켈레톤의 척추, 팔, 다리 등을 표현할 수 있다**.

**Acceptance Criteria:**

**Given** Scene 인스턴스가 존재
**When** `scene.add_line("spine", Float64Array([x1, y1, x2, y2]))` 호출
**Then** Line 타입의 Entity가 생성된다
**And** geometry에 `{ points: [[x1, y1], [x2, y2]] }` 형태로 저장된다
**And** name ("spine")이 반환된다
**And** (AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해함)

**Given** 4개 이상의 좌표가 주어진 경우 (폴리라인)
**When** `scene.add_line("left_arm", Float64Array([x1, y1, x2, y2, x3, y3, x4, y4]))` 호출
**Then** 연결된 선분들이 하나의 Entity로 생성된다
**And** geometry.points에 4개 점이 순서대로 저장된다

**Given** 홀수 개의 좌표가 주어진 경우
**When** add_line 호출
**Then** 마지막 좌표가 무시되고 정상 생성된다 (관대한 입력 보정)

**Technical Notes:**
- Float64Array 입력 처리 (NFR12)
- 시맨틱 명확한 함수명: `add_line` (NFR9)

**Requirements Fulfilled:** FR2

---

## Story 1.4: Circle 도형 생성 기능

As a **AI 에이전트 (Claude Code)**,
I want **중심점과 반지름으로 원을 생성할 수 있도록**,
So that **스켈레톤의 머리나 관절 등을 표현할 수 있다**.

**Acceptance Criteria:**

**Given** Scene 인스턴스가 존재
**When** `scene.add_circle("head", x, y, radius)` 호출
**Then** Circle 타입의 Entity가 생성된다
**And** geometry에 `{ center: [x, y], radius: radius }` 형태로 저장된다
**And** name ("head")이 반환된다
**And** (AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해함)

**Given** radius가 0 이하인 경우
**When** add_circle 호출
**Then** abs().max(0.001)로 양수 변환되어 정상 생성된다 (0일 경우 최소값 0.001 적용, 관대한 입력 보정)

**Given** 좌표가 음수인 경우
**When** add_circle 호출
**Then** 정상적으로 생성된다 (음수 좌표 허용)

**Technical Notes:**
- 시맨틱 명확한 함수명: `add_circle` (NFR9)
- f64 타입 사용

**Requirements Fulfilled:** FR3

---

## Story 1.5: Rect 도형 생성 기능

As a **AI 에이전트 (Claude Code)**,
I want **원점, 너비, 높이로 사각형을 생성할 수 있도록**,
So that **스켈레톤의 몸통이나 배경 요소를 표현할 수 있다**.

**Acceptance Criteria:**

**Given** Scene 인스턴스가 존재
**When** `scene.add_rect("body", x, y, width, height)` 호출
**Then** Rect 타입의 Entity가 생성된다
**And** geometry에 `{ origin: [x, y], width: width, height: height }` 형태로 저장된다
**And** name ("body")이 반환된다
**And** (AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해함)

**Given** width 또는 height가 0 이하인 경우
**When** add_rect 호출
**Then** abs()로 양수 변환되어 정상 생성된다 (관대한 입력 보정)

**Given** Y-up 좌표계에서 origin이 좌하단인 경우
**When** add_rect(0, 0, 100, 50) 호출
**Then** origin(0,0)에서 width=100, height=50인 사각형이 생성된다

**Technical Notes:**
- 시맨틱 명확한 함수명: `add_rect` (NFR9)
- origin은 좌하단 기준 (Y-up 좌표계)

**Requirements Fulfilled:** FR4

---

## Story 1.6: Arc 도형 생성 기능

> **재정렬 사유**: Arc는 Line(1.3), Circle(1.4), Rect(1.5)와 같은 기초 도형(Primitive)입니다.
> Style 시스템(1.7~1.9)보다 먼저 정의되어야 합니다.

As a **AI 에이전트 (Claude Code)**,
I want **호(arc)를 생성할 수 있도록**,
So that **스켈레톤의 곡선 팔, 관절 회전 표시 등을 표현할 수 있다**.

**Acceptance Criteria:**

**Given** Scene 인스턴스가 존재
**When** `scene.add_arc("elbow_joint", cx, cy, radius, start_angle, end_angle)` 호출
**Then** Arc 타입의 Entity가 생성된다
**And** geometry에 center, radius, start_angle, end_angle이 저장된다
**And** name ("elbow_joint")이 반환된다
**And** (AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해함)

**Given** radius가 0 이하인 경우
**When** add_arc 호출
**Then** abs()로 양수 변환되어 정상 생성된다 (관대한 입력 보정)

**Given** Scene 인스턴스가 존재
**When** `scene.draw_arc(cx, cy, radius, start_angle, end_angle, style_json)` 호출
**Then** 스타일이 적용된 Arc가 생성된다

**Technical Notes:**
- 각도 단위: 라디안
- 양수 각도 = 반시계방향 (CCW, Y-up 좌표계)
- PRD에 정의됨: `arc(radius, startAngle, endAngle)`

**Requirements Fulfilled:** FR20

**Details:** [docs/sprint-artifacts/1-6-arc.md](./sprint-artifacts/1-6-arc.md)

---

## Story 1.7: Style 데이터 구조 정의

> **설계 결정**: Style은 Renderer가 아닌 Entity에 포함됩니다.
> - 이유: 도면 출력(DXF, SVG, PDF)시 스타일 정보가 필요
> - 3D 확장 시 Material Reference로 발전 가능

As a **AI 에이전트 (Claude Code)**,
I want **도형의 선(stroke)과 면(fill) 스타일을 정의하는 데이터 구조가 있도록**,
So that **"빨간 원", "파란 점선" 같은 스타일이 적용된 도형을 생성할 수 있다**.

**Acceptance Criteria:**

**Given** CAD 엔진 개발 중
**When** Style 구조체를 정의할 때
**Then** StrokeStyle (width, color, dash, cap, join)이 포함된다
**And** FillStyle (color)이 포함된다
**And** Style은 stroke와 fill을 Option으로 갖는다

**Given** Style 구조체
**When** `Style::default()` 호출
**Then** stroke: 검은색 1px, fill: None으로 설정된다 (기존 호환)

**Technical Notes:**
- LineCap: Butt, Round, Square
- LineJoin: Miter, Round, Bevel
- color: [f64; 4] - RGBA (0.0-1.0)

**Requirements Fulfilled:** FR17

**Details:** [docs/sprint-artifacts/1-7-style-system.md](./sprint-artifacts/1-7-style-system.md)

---

## Story 1.8: 도형 생성 시 Style 적용

As a **AI 에이전트 (Claude Code)**,
I want **도형 생성 시 스타일을 함께 지정할 수 있도록**,
So that **"빨간 테두리의 파란 원" 같은 요청을 한 번의 호출로 처리할 수 있다**.

**Acceptance Criteria:**

**Given** Scene 인스턴스가 존재
**When** `scene.draw_circle(x, y, radius, style_json)` 호출
**Then** 스타일이 적용된 Circle Entity가 생성된다

**Given** 잘못된 style_json이 주어진 경우
**When** draw_* 함수 호출
**Then** 기본 스타일로 대체되어 생성된다 (관대한 입력 보정)

**Given** 기존 add_* 함수 사용 시
**When** add_circle(name, x, y, radius) 호출
**Then** 기본 스타일로 생성된다 (하위 호환)

**Technical Notes:**
- draw_circle, draw_line, draw_rect, draw_arc 추가
- 기존 add_* 함수는 유지 (하위 호환)

**Requirements Fulfilled:** FR18

**Details:** [docs/sprint-artifacts/1-8-styled-shape-creation.md](./sprint-artifacts/1-8-styled-shape-creation.md)

---

## Story 1.9: 스타일 수정 Action 함수

As a **AI 에이전트 (Claude Code)**,
I want **기존 도형의 스타일을 변경할 수 있도록**,
So that **"이 원을 빨간색으로 바꿔줘" 같은 수정 요청을 처리할 수 있다**.

**Acceptance Criteria:**

**Given** Scene에 Entity가 존재
**When** `scene.set_stroke(id, stroke_json)` 호출
**Then** 해당 Entity의 stroke가 업데이트된다

**Given** Scene에 Entity가 존재
**When** `scene.set_fill(id, fill_json)` 호출
**Then** 해당 Entity의 fill이 업데이트된다

**Given** 존재하지 않는 ID
**When** set_stroke/set_fill 호출
**Then** Ok(false) 반환하고 무시된다 (ID 미발견 시 no-op)

**Technical Notes:**
- set_stroke, set_fill, remove_stroke, remove_fill 함수
- 부분 업데이트 지원 (color만 변경 등)

**Requirements Fulfilled:** FR19

**Details:** [docs/sprint-artifacts/1-9-style-modification.md](./sprint-artifacts/1-9-style-modification.md)

---

# Epic 2: "결과를 실시간으로 본다" - Canvas 2D 뷰어

**Epic Goal**: 생성된 도형을 브라우저에서 실시간으로 확인하고, JSON 파일로 저장할 수 있다.

**FRs Covered**: FR9, FR11, FR12, FR16
**NFRs Addressed**: NFR3, NFR5, NFR10

**Dependencies**: Epic 1 완료 (도형 생성 기능)

---

## Story 2.1: JSON Export 기능 구현

As a **AI 에이전트 (Claude Code)**,
I want **Scene을 JSON 형식으로 직렬화하여 파일로 저장할 수 있도록**,
So that **뷰어가 파일을 읽어 렌더링할 수 있다**.

**Acceptance Criteria:**

**Given** Scene에 여러 Entity가 추가된 상태
**When** `scene.export_json()` 호출
**Then** 전체 Scene이 JSON 문자열로 반환된다
**And** JSON에 모든 entities 배열이 포함된다
**And** 각 Entity의 id, type, geometry, transform 정보가 포함된다

**Given** JSON 문자열이 반환된 상태
**When** Claude Code가 `fs.writeFileSync('scene.json', json)` 실행
**Then** 파일 시스템에 scene.json 파일이 생성된다
**And** 파일 내용이 유효한 JSON이다

**Given** 빈 Scene (entities가 없음)
**When** export_json() 호출
**Then** `{"entities": []}` 형태의 유효한 JSON이 반환된다

**Technical Notes:**
- serde_json 사용하여 직렬화
- scene.json 포맷은 뷰어와 공유되는 계약

**Requirements Fulfilled:** FR9, FR16

---

## Story 2.2: Canvas 2D 뷰어 기초 및 Polling 구현

As a **사용자 (인간)**,
I want **브라우저에서 scene.json 파일을 자동으로 갱신하여 볼 수 있도록**,
So that **AI가 도형을 생성할 때마다 실시간으로 결과를 확인할 수 있다** (검증 UI).

**Acceptance Criteria:**

**Given** viewer/index.html 파일이 존재
**When** 브라우저에서 파일을 열면
**Then** Canvas 요소가 화면에 표시된다
**And** 500ms 간격으로 scene.json을 fetch한다

**Given** scene.json 파일이 업데이트된 경우
**When** 다음 polling 주기 (500ms 이내)
**Then** 새로운 scene.json 내용이 로드된다
**And** Canvas가 새 내용으로 다시 렌더링된다

**Given** scene.json 파일이 없거나 fetch 실패
**When** polling 시도
**Then** 에러가 콘솔에 출력되지만 polling은 계속된다
**And** 다음 주기에 다시 시도한다

**Given** 정적 파일 서버에서 뷰어 실행
**When** `python -m http.server` 또는 유사 서버로 viewer 폴더 서빙
**Then** http://localhost:8000에서 뷰어가 동작한다
**And** Vite 없이 정상 동작한다

**Technical Notes:**
- setInterval(fetch, 500) 패턴
- 정적 HTML + vanilla JS
- Vite 미사용 (Phase 1 단순화)

**Requirements Fulfilled:** FR11

---

## Story 2.3: Line, Circle, Rect 렌더링 구현

As a **사용자 (인간)**,
I want **생성된 line, circle, rect 도형을 Canvas에서 시각적으로 확인할 수 있도록**,
So that **AI가 만든 스켈레톤이 올바르게 표현되었는지 검증할 수 있다**.

**Acceptance Criteria:**

**Given** scene.json에 Line Entity가 있는 경우
**When** Canvas 렌더링 실행
**Then** points 배열의 좌표들이 연결된 선으로 그려진다
**And** ctx.moveTo/lineTo/stroke가 호출된다

**Given** scene.json에 Circle Entity가 있는 경우
**When** Canvas 렌더링 실행
**Then** center 좌표에 radius 크기의 원이 그려진다
**And** ctx.arc(center[0], center[1], radius, 0, Math.PI*2)가 호출된다

**Given** scene.json에 Rect Entity가 있는 경우
**When** Canvas 렌더링 실행
**Then** origin 좌표에서 width x height 크기의 사각형이 그려진다
**And** ctx.strokeRect(origin[0], origin[1], width, height)가 호출된다

**Given** 여러 도형이 섞여 있는 scene.json
**When** Canvas 렌더링 실행
**Then** 모든 도형이 순서대로 렌더링된다
**And** 도형 타입에 따라 적절한 렌더링 함수가 호출된다

**Given** 스켈레톤 도형 (머리 circle + 몸통/팔/다리 line)
**When** Canvas 렌더링 실행
**Then** 사람 형태의 스켈레톤이 시각적으로 인식 가능하다

**Technical Notes:**
- Canvas 2D API 사용
- switch(entity.type) 패턴으로 분기
- stroke 스타일 기본값: black, 1px

**Requirements Fulfilled:** FR12

---

# Epic 3: "원하는 대로 수정한다" - 변환과 Export

**Epic Goal**: 기존 도형을 이동/회전/확대/삭제하고, 수정된 결과를 확인하며, SVG로 내보낼 수 있다.

**FRs Covered**: FR5, FR6, FR7, FR8, FR10, FR13, FR15
**NFRs Addressed**: NFR1, NFR4

**Dependencies**: Epic 1, Epic 2 완료

---

## Story 3.1: Translate 변환 구현

As a **AI 에이전트 (Claude Code)**,
I want **기존 도형을 지정된 거리만큼 이동시킬 수 있도록**,
So that **"왼쪽 팔을 더 왼쪽으로" 같은 수정 요청을 처리할 수 있다**.

**Acceptance Criteria:**

**Given** Scene에 Entity가 존재 (ID로 식별)
**When** `scene.translate(id, dx, dy)` 호출
**Then** 해당 Entity의 transform.translate 값이 [dx, dy]로 설정된다
**And** 기존 translate 값이 있으면 누적된다 ([prev_dx + dx, prev_dy + dy])

**Given** 존재하지 않는 ID로 translate 호출
**When** translate("invalid_id", 10, 20) 실행
**Then** Ok(false) 반환하고 무시된다 (ID 미발견 시 no-op)
**And** 다른 Entity들은 영향받지 않는다

**Given** translate가 적용된 Entity
**When** export_json() 호출
**Then** JSON에 transform.translate 값이 포함된다

**Technical Notes:**
- Transform 구조: `{ translate: [dx, dy], rotate: angle, scale: [sx, sy] }`
- 초기 transform: `{ translate: [0, 0], rotate: 0, scale: [1, 1] }`

**Requirements Fulfilled:** FR5, FR15

---

## Story 3.2: Rotate 변환 구현

As a **AI 에이전트 (Claude Code)**,
I want **기존 도형을 지정된 각도만큼 회전시킬 수 있도록**,
So that **"팔을 위로 들어" 같은 포즈 변경 요청을 처리할 수 있다**.

**Acceptance Criteria:**

**Given** Scene에 Entity가 존재 (ID로 식별)
**When** `scene.rotate(id, angle)` 호출 (angle은 라디안 또는 도)
**Then** 해당 Entity의 transform.rotate 값이 angle로 설정된다
**And** 기존 rotate 값이 있으면 누적된다 (prev_angle + angle)

**Given** angle이 360도 이상인 경우
**When** rotate 호출
**Then** 정상적으로 처리된다 (modulo 연산은 렌더러에서)

**Given** 음수 angle인 경우
**When** rotate 호출
**Then** 반시계 방향 회전으로 처리된다

**Technical Notes:**
- 각도 단위: 라디안 권장 (Canvas API와 일치)
- 회전 중심: Entity의 중심 또는 원점 (Phase 1에서는 원점 기준)

**Requirements Fulfilled:** FR6

---

## Story 3.3: Scale 변환 구현

As a **AI 에이전트 (Claude Code)**,
I want **기존 도형을 지정된 비율로 확대/축소할 수 있도록**,
So that **"팔을 더 길게" 같은 크기 조정 요청을 처리할 수 있다**.

**Acceptance Criteria:**

**Given** Scene에 Entity가 존재 (ID로 식별)
**When** `scene.scale(id, sx, sy)` 호출
**Then** 해당 Entity의 transform.scale 값이 [sx, sy]로 설정된다
**And** 기존 scale 값이 있으면 곱해진다 ([prev_sx * sx, prev_sy * sy])

**Given** sx와 sy가 다른 경우 (비균일 스케일)
**When** scale(id, 2, 1) 호출
**Then** 가로로만 2배 늘어나는 변환이 적용된다

**Given** scale 값이 0 이하인 경우
**When** scale 호출
**Then** max(0.001, abs(v))로 보정되어 적용된다 (관대한 입력 보정)

**Given** scale 값이 1 미만인 경우 (축소)
**When** scale(id, 0.5, 0.5) 호출
**Then** 도형이 절반 크기로 축소된다

**Technical Notes:**
- 초기 scale: [1, 1] (100%)
- 음수 scale은 뒤집기 효과 (Phase 1에서는 지원 안 함)

**Requirements Fulfilled:** FR7

---

## Story 3.4: Delete 기능 구현

As a **AI 에이전트 (Claude Code)**,
I want **기존 도형을 삭제할 수 있도록**,
So that **"오른쪽 팔을 없애줘" 같은 요청을 처리할 수 있다**.

**Acceptance Criteria:**

**Given** Scene에 Entity가 존재 (ID로 식별)
**When** `scene.delete(id)` 호출
**Then** 해당 Entity가 Scene의 entities 배열에서 제거된다
**And** 다음 export_json()에 해당 Entity가 포함되지 않는다

**Given** 존재하지 않는 ID로 delete 호출
**When** delete("invalid_id") 실행
**Then** Ok(false) 반환하고 무시된다 (ID 미발견 시 no-op)
**And** 다른 Entity들은 영향받지 않는다

**Given** 여러 Entity 중 하나를 삭제
**When** delete 호출 후 entities 배열 확인
**Then** 삭제된 Entity만 없어지고 나머지는 유지된다
**And** 다른 Entity들의 ID는 변경되지 않는다

**Technical Notes:**
- entities.retain(|e| e.id != id) 패턴 사용
- Undo/Redo는 Phase 2에서 구현

**Requirements Fulfilled:** FR8

---

## Story 3.5: Transform 적용 렌더링 구현

As a **사용자 (인간)**,
I want **translate, rotate, scale이 적용된 도형을 뷰어에서 올바르게 볼 수 있도록**,
So that **AI가 수정한 결과가 정확히 반영되었는지 확인할 수 있다**.

**Acceptance Criteria:**

**Given** Entity에 translate: [10, 20]이 적용된 경우
**When** Canvas 렌더링 실행
**Then** 도형이 원래 위치에서 (10, 20)만큼 이동해서 그려진다

**Given** Entity에 rotate: Math.PI/4 (45도)가 적용된 경우
**When** Canvas 렌더링 실행
**Then** 도형이 45도 회전해서 그려진다
**And** ctx.rotate()가 호출된다

**Given** Entity에 scale: [2, 0.5]가 적용된 경우
**When** Canvas 렌더링 실행
**Then** 도형이 가로 2배, 세로 0.5배로 그려진다
**And** ctx.scale()가 호출된다

**Given** translate + rotate + scale이 모두 적용된 경우
**When** Canvas 렌더링 실행
**Then** 변환이 올바른 순서로 적용된다 (scale → rotate → translate)
**And** ctx.save()/ctx.restore()로 상태 관리된다

**Given** 스켈레톤에서 "왼팔을 길게" 수정 후
**When** 뷰어에서 확인
**Then** 왼팔 Entity만 scale이 적용되어 길어져 보인다
**And** 다른 Entity들은 변경 없이 표시된다

**Technical Notes:**
- 변환 순서: ctx.translate → ctx.rotate → ctx.scale
- 각 Entity 렌더링 전후로 ctx.save()/restore() 필수
- transform 값이 없으면 기본값 사용 (translate: [0,0], rotate: 0, scale: [1,1])

**Requirements Fulfilled:** FR13

---

## Story 3.6: SVG Export 구현

As a **AI 에이전트 (Claude Code)**,
I want **Scene을 SVG 형식으로 내보낼 수 있도록**,
So that **최종 결과물을 벡터 이미지로 저장하고 공유할 수 있다**.

**Acceptance Criteria:**

**Given** Scene에 여러 Entity가 있는 상태
**When** `scene.export_svg()` 호출
**Then** 유효한 SVG 문자열이 반환된다
**And** SVG 문자열이 `<svg>` 태그로 시작한다

**Given** Line Entity가 있는 경우
**When** export_svg() 실행
**Then** `<line>` 또는 `<polyline>` 요소가 생성된다
**And** points 좌표가 SVG 속성으로 변환된다

**Given** Circle Entity가 있는 경우
**When** export_svg() 실행
**Then** `<circle cx="..." cy="..." r="...">` 요소가 생성된다

**Given** Rect Entity가 있는 경우
**When** export_svg() 실행
**Then** `<rect x="..." y="..." width="..." height="...">` 요소가 생성된다

**Given** Transform이 적용된 Entity가 있는 경우
**When** export_svg() 실행
**Then** `transform="translate(...) rotate(...) scale(...)"` 속성이 포함된다

**Given** SVG 문자열이 반환된 상태
**When** Claude Code가 `fs.writeFileSync('output.svg', svg)` 실행
**Then** 유효한 SVG 파일이 생성된다
**And** 브라우저에서 열면 도형들이 표시된다

**Technical Notes:**
- SVG viewBox 자동 계산 또는 고정 크기 (500x500)
- stroke: black, fill: none 기본값
- SVG 1.1 표준 준수

**Requirements Fulfilled:** FR10

---

# Summary

## Epic & Story 총괄

| Epic | 스토리 수 | FRs Covered |
|------|----------|-------------|
| Epic 1: CAD 엔진 기초 | 5 | FR1, FR2, FR3, FR4, FR14 |
| Epic 2: Canvas 2D 뷰어 | 3 | FR9, FR11, FR12, FR16 |
| Epic 3: 변환과 Export | 6 | FR5, FR6, FR7, FR8, FR10, FR13, FR15 |
| **Total** | **14** | **16 FRs (100%)** |

## FR Coverage 검증

모든 16개 Functional Requirements가 스토리에 매핑되었습니다:
- FR1-FR4: Epic 1 (도형 생성)
- FR5-FR8: Epic 3 (변환)
- FR9-FR10: Epic 2, 3 (출력)
- FR11-FR13: Epic 2, 3 (뷰어)
- FR14-FR16: Epic 1, 2, 3 (Claude Code 통합)

## 구현 순서 권장

1. **Epic 1** → WASM 기반 구축, 도형 생성 기능 완성
2. **Epic 2** → 뷰어 연결, 검증 루프 확립
3. **Epic 3** → 수정 기능, 최종 Export

## 검증 시나리오 매핑

| 검증 시나리오 | 필요 스토리 |
|--------------|------------|
| "스켈레톤을 그려줘" | 1.1 → 1.2 → 1.3, 1.4, 1.5 → 2.1 → 2.2 → 2.3 |
| "팔을 더 길게" | 3.1 또는 3.3 → 3.5 |
| "SVG로 저장해줘" | 3.6 |
