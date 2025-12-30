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

---

> **2025-12-30 업데이트**: MVP 범위 확장으로 FR21~FR30, NFR14~NFR17 추가

**그룹화 및 피봇 (MVP 추가)**

FR21: Group 생성 - `create_group(name, children[])`으로 여러 도형을 그룹화할 수 있어야 한다
FR22: Group 해제 - `ungroup(group_id)`으로 그룹을 해제하고 자식들을 독립 엔티티로 만들 수 있어야 한다
FR23: Group 자식 관리 - `add_to_group`, `remove_from_group`으로 그룹 구성원을 관리할 수 있어야 한다
FR24: Pivot 설정 - `set_pivot(entity_id, px, py)`로 도형/그룹의 회전 중심점을 설정할 수 있어야 한다
FR25: 계층적 변환 - 부모 그룹의 translate/rotate/scale이 모든 자식 엔티티에 전파되어야 한다

**Selection UI (MVP 추가)**

FR26: 도형 선택 - Canvas 클릭으로 해당 위치의 도형을 선택할 수 있어야 한다
FR27: 선택 상태 표시 - 선택된 도형은 시각적으로 구분되어야 한다 (하이라이트, 바운딩 박스 등)
FR28: 선택 정보 전달 - 선택된 도형의 정보(id, type, geometry)를 AI에게 전달할 수 있어야 한다

**Electron 앱 (MVP 추가)**

FR29: 통합 앱 - WASM CAD 엔진 + Canvas 2D Viewer + 채팅 UI가 단일 Electron 앱으로 통합되어야 한다
FR30: API 키 입력 - 사용자가 자신의 Claude API 키를 입력하여 LLM과 대화할 수 있어야 한다

**MVP 추가 NFRs**

NFR14: 그룹 중첩 - 그룹 안에 그룹을 포함할 수 있어야 한다 (최대 깊이 제한 가능)
NFR15: 선택 반응 속도 - 클릭 후 선택 피드백이 100ms 이내에 표시되어야 한다
NFR16: 앱 시작 시간 - Electron 앱이 5초 이내에 시작되어야 한다
NFR17: 오프라인 동작 - API 키 없이도 CAD 기능(도형 생성/편집)은 동작해야 한다

---

> **2025-12-30 업데이트**: Dual-Architecture Strategy 도입

### Dual-Architecture Strategy

프로젝트는 두 가지 운영 모드를 지원합니다:

| 모드 | 사용 환경 | 아키텍처 | 데이터 흐름 | 통신 방식 |
|------|-----------|----------|-------------|-----------|
| **Mode A** (CLI) | cad-cli + 브라우저 | File Polling | CLI → scene.json → Viewer | File System Watch |
| **Mode B** (App) | Electron App | Client-Direct | Renderer → WASM (Memory) → Canvas | Direct Function Call |

**Epic별 모드 대응:**
- Epic 1~3: Mode A 기준으로 구현 완료
- Epic 4~5: Mode A 기준으로 설계, Epic 6 구현 시 Mode B 최적화 필요
- Epic 6: Mode B (Client-Direct) 전용

**CADExecutor Adapter 패턴:**
- `FileBasedExecutor`: Mode A용 (scene.json, selection.json 기반)
- `DirectExecutor`: Mode B용 (메모리 직접 접근)
- 비즈니스 로직은 Executor 타입과 무관하게 동작

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

- ActionHints: MVP에서는 기본 구조만, 확장은 Post-MVP
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
| FR21 | Epic 4 | Group 생성 |
| FR22 | Epic 4 | Group 해제 |
| FR23 | Epic 4 | Group 자식 관리 |
| FR24 | Epic 4 | Pivot 설정 |
| FR25 | Epic 4 | 계층적 변환 |
| FR26 | Epic 5 | 도형 선택 |
| FR27 | Epic 5 | 선택 상태 표시 |
| FR28 | Epic 5 | 선택 정보 전달 |
| FR29 | Epic 6 | Electron 통합 앱 |
| FR30 | Epic 6 | API 키 입력 |

### NFR Coverage Map

| NFR | Epic | Story | 설명 |
|-----|------|-------|------|
| NFR1 | Epic 3 | 전체 | 첫 결과물까지 < 5분 |
| NFR2 | Epic 1 | 1.1 | WASM 호출 지연 < 1ms |
| NFR3 | Epic 2 | 2.2 | Polling 간격 500ms |
| NFR4 | Epic 3 | 전체 | 학습 시간 0분 |
| NFR5 | Epic 2 | 2.2, 2.3 | 검증 UI 필수 |
| NFR6 | Epic 1 | 1.1 | Direct-First (MCP 없이) |
| NFR7 | Epic 1, 6 | 1.1, 6.5 | 오프라인 우선 |
| NFR8 | Epic 3 | 3.0 | LLM 추론 방해 금지 |
| NFR9 | Epic 1 | 전체 | 시맨틱 명확한 함수명 |
| NFR10 | Epic 2 | 2.2 | 인간 검증 필수 |
| NFR11 | Epic 1 | 1.2 | wasm-bindgen 클래스 래퍼 |
| NFR12 | Epic 1 | 1.3 | Float64Array 명확한 타입 |
| NFR13 | Epic 1 | 1.2 | uuid js feature |
| NFR14 | Epic 4 | 4.1, 4.3 | 그룹 중첩 지원 |
| NFR15 | Epic 5 | 5.1 | 선택 반응 100ms 이내 |
| NFR16 | Epic 6 | 6.2 | 앱 시작 5초 이내 |
| NFR17 | Epic 6 | 6.5 | 오프라인 CAD 동작 |

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

**Given** 유효 좌표에 NaN 또는 Infinity 값이 포함된 경우
**When** add_line 호출
**Then** 에러가 반환된다: `[add_line] invalid_input: NaN or Infinity not allowed`
**And** (홀수 좌표 trim 후 유효 좌표에서만 검증)

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

**Given** x, y, 또는 radius에 NaN/Infinity 값이 포함된 경우
**When** add_circle 호출
**Then** 에러가 반환된다: `[add_circle] invalid_input: NaN or Infinity not allowed`

**Technical Notes:**
- 시맨틱 명확한 함수명: `add_circle` (NFR9)
- f64 타입 사용
- NaN/Infinity 입력 시 에러 반환 (유효하지 않은 geometry 방지)

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
**Then** abs().max(0.001)로 양수 변환되어 정상 생성된다 (0일 경우 최소값 0.001 적용, 관대한 입력 보정)

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
**Then** abs().max(0.001)로 양수 변환되어 정상 생성된다 (0일 경우 최소값 0.001 적용, 관대한 입력 보정)

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

## Story 3.0: Tool Use Foundation (에이전트 런타임)

As a **AI 에이전트 (Claude Code)**,
I want **CAD 도구를 tool_use 스키마로 직접 호출할 수 있도록**,
So that **스크립트 작성 없이 도구를 자기 몸처럼 사용할 수 있다**.

**Acceptance Criteria:**

**Given** Claude Code가 "원을 그려줘"라고 요청받은 경우
**When** 에이전트 런타임이 동작
**Then** draw_circle 도구가 tool_use 형식으로 호출된다
**And** 결과가 JSON/텍스트로 Claude에게 피드백된다

**Given** CAD 도구가 정의된 상태
**When** 도구 스키마를 조회
**Then** 각 도구의 name, description, input_schema가 반환된다
**And** LLM이 도구를 이해하고 선택할 수 있다

**Given** 도구 호출 결과가 반환된 경우
**When** 에이전트 런타임이 결과를 처리
**Then** 성공/실패 여부와 생성된 entity 정보가 Claude에게 전달된다
**And** Claude가 다음 행동을 결정할 수 있다

**Technical Notes:**
- Progressive Exposure 패턴: listDomains → listTools → getTool → exec
- tool_use 스키마 정의 (name, description, input_schema)
- WASM 함수 래핑 (Float64Array 변환, JSON.stringify 자동화)
- 에이전트 루프: LLM 호출 → tool_use 감지 → 실행 → 결과 반환 → 반복

**Requirements Fulfilled:** FR15, NFR8, NFR9

**Details:** [docs/sprint-artifacts/3-0-tool-use-foundation.md](./sprint-artifacts/3-0-tool-use-foundation.md)

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

# Epic 4: "포즈를 바꾼다" - 그룹화 및 피봇

> **2025-12-30 추가**: MVP 범위 확장

**Epic Goal**: 도형들을 그룹화하고 피봇을 설정하여 포즈를 변경할 수 있다.

**FRs Covered**: FR21, FR22, FR23, FR24, FR25
**NFRs Addressed**: NFR14 (그룹 중첩)

**Dependencies**: Epic 1, Epic 2, Epic 3 완료

### Feasibility & Risk Analysis

| 항목 | 평가 |
|------|------|
| **구현 가능성** | 🟢 높음 (High) |
| **리스크 수준** | 🟡 낮음 |

**긍정적 요인**:
- 현재 Entity 구조가 깔끔하여 `parent_id` 필드 추가 및 트리 탐색 구현이 직관적
- String ID 기반 그룹화 로직은 wasm-bindgen에서 성능/복잡도 측면에서 큰 이슈 없음

**주요 리스크 및 고려사항**:
1. **계층적 변환 (Recursive Transform)**: 부모의 회전/스케일이 자식에게 전파될 때, 현재 단순 `Transform` struct로는 변환 순서 문제 발생 가능. Matrix3x3 도입 검토 필요
2. **AX 시맨틱**: AI가 "그룹 내 특정 개체"를 지칭할 때의 문법 정의 필요 (예: `group_1.child_A` vs `child_A (in group_1)`)

---

## Story 4.1: Group 생성 기능

As a **AI 에이전트 (Claude Code)**,
I want **여러 도형을 그룹으로 묶을 수 있도록**,
So that **팔, 다리 등의 신체 부위를 하나의 단위로 관리할 수 있다**.

**Acceptance Criteria:**

**Given** Scene에 여러 Entity가 존재
**When** `scene.create_group("left_arm", ["upper_arm", "lower_arm", "hand"])` 호출
**Then** Group 타입의 Entity가 생성된다
**And** 지정된 자식 Entity들의 parent_id가 그룹 ID로 설정된다
**And** name ("left_arm")이 반환된다

**Given** 존재하지 않는 자식 ID가 포함된 경우
**When** create_group 호출
**Then** 존재하는 자식들만 그룹에 추가된다 (관대한 입력 보정)

**Technical Notes:**
- Entity에 parent_id, children 필드 추가
- 그룹 중첩 지원 (NFR14)

**Requirements Fulfilled:** FR21

---

## Story 4.2: Group 해제 기능

As a **AI 에이전트 (Claude Code)**,
I want **그룹을 해제하여 자식들을 독립 엔티티로 만들 수 있도록**,
So that **그룹 구조를 유연하게 변경할 수 있다**.

**Acceptance Criteria:**

**Given** Scene에 Group Entity가 존재
**When** `scene.ungroup("left_arm")` 호출
**Then** 그룹이 삭제되고 자식 Entity들의 parent_id가 None으로 설정된다
**And** 자식들은 독립 엔티티로 Scene에 유지된다

**Given** 존재하지 않는 그룹 ID
**When** ungroup 호출
**Then** Ok(false) 반환하고 무시된다

**Technical Notes:**
- 그룹 삭제 시 자식들의 월드 변환 유지 고려

**Requirements Fulfilled:** FR22

---

## Story 4.3: Group 자식 관리

As a **AI 에이전트 (Claude Code)**,
I want **그룹에 자식을 추가하거나 제거할 수 있도록**,
So that **그룹 구성을 동적으로 변경할 수 있다**.

**Acceptance Criteria:**

**Given** Scene에 Group과 Entity가 존재
**When** `scene.add_to_group("left_arm", "wrist")` 호출
**Then** wrist Entity가 left_arm 그룹의 자식으로 추가된다

**Given** 그룹에 자식이 존재
**When** `scene.remove_from_group("left_arm", "hand")` 호출
**Then** hand Entity가 그룹에서 제거되고 독립 엔티티가 된다

**Technical Notes:**
- 이미 다른 그룹에 속한 엔티티는 기존 그룹에서 제거 후 추가

**Requirements Fulfilled:** FR23

---

## Story 4.4: Pivot 설정 기능

As a **AI 에이전트 (Claude Code)**,
I want **도형/그룹의 회전 중심점을 설정할 수 있도록**,
So that **팔꿈치 위치를 기준으로 팔을 구부릴 수 있다**.

**Acceptance Criteria:**

**Given** Scene에 Entity가 존재
**When** `scene.set_pivot("lower_arm", 0, 50)` 호출
**Then** lower_arm Entity의 pivot이 (0, 50)으로 설정된다

**Given** pivot이 설정된 Entity
**When** `scene.rotate("lower_arm", 45)` 호출
**Then** 도형이 pivot 위치를 기준으로 45도 회전된다

**Technical Notes:**
- Transform 구조에 pivot 필드 추가
- 기본 pivot: [0, 0] (엔티티 로컬 원점)
- 렌더링 시 pivot 고려한 변환 적용

**Requirements Fulfilled:** FR24

---

## Story 4.5: 계층적 변환 구현

As a **AI 에이전트 (Claude Code)**,
I want **부모 그룹의 변환이 자식들에게 전파되도록**,
So that **어깨를 회전하면 팔 전체가 함께 회전한다**.

**Acceptance Criteria:**

**Given** 그룹과 자식들이 존재
**When** `scene.translate("left_arm_group", 10, 0)` 호출
**Then** 그룹 내 모든 자식들이 함께 (10, 0)만큼 이동된다

**Given** 그룹에 rotate 적용
**When** Canvas 렌더링 실행
**Then** 자식들이 부모의 변환을 상속받아 올바른 위치에 렌더링된다

**Technical Notes:**
- 렌더링/Export 시 월드 변환 계산 (부모 → 자식 순)
- WASM에서는 로컬 변환만 저장

**Requirements Fulfilled:** FR25

---

## Story 4.6: 그룹화된 도형 렌더링

As a **사용자 (인간)**,
I want **그룹화된 도형들이 올바르게 렌더링되도록**,
So that **그룹 변환이 적용된 결과를 확인할 수 있다**.

**Acceptance Criteria:**

**Given** 그룹과 자식들에 변환이 적용된 상태
**When** Canvas 렌더링 실행
**Then** 자식들이 부모의 변환을 상속받아 올바른 위치에 렌더링된다

**Given** pivot이 설정된 도형
**When** 회전 후 렌더링
**Then** pivot 위치를 기준으로 회전된 결과가 표시된다

**Technical Notes:**
- getWorldTransform() 함수로 계층 변환 계산
- 렌더링 순서: 부모 → 자식

---

# Epic 5: "가리키며 말한다" - Selection UI

> **2025-12-30 추가**: MVP 범위 확장

**Epic Goal**: 사용자가 클릭으로 도형을 선택하고, AI가 선택된 도형을 인식할 수 있다.

**FRs Covered**: FR26, FR27, FR28
**NFRs Addressed**: NFR15 (선택 반응 속도)

**Dependencies**: Epic 2 (뷰어), Epic 4 (그룹)

### Feasibility & Risk Analysis

| 항목 | 평가 |
|------|------|
| **구현 가능성** | 🟢 중간-높음 (Medium-High) |
| **리스크 수준** | 🟡 중간 |

**긍정적 요인**:
- Canvas 2D에서 기초 도형(선, 원, 사각형)에 대한 클릭 판정(Hit-testing)은 수학적으로 간단
- 기존 "File-based Polling" 아키텍처를 확장하여 `selection.json`을 통해 브라우저 → Claude 방향의 통신 가능

**주요 리스크 및 고려사항**:
1. **폴링 지연 (Latency)**: 사용자가 클릭한 후 Claude가 이를 인지하기까지 최대 500ms(NFR 기준) 지연 발생. 사용자 경험상 "느리다"고 느껴질 수 있음
2. **정밀도**: Line처럼 얇은 객체를 클릭할 때의 판정 범위(Tolerance) 설정 필요

---

## Story 5.1: 도형 클릭 선택

As a **사용자 (인간)**,
I want **Canvas에서 도형을 클릭하여 선택할 수 있도록**,
So that **"이거 더 길게" 같은 지시를 할 수 있다**.

**Acceptance Criteria:**

**Given** Canvas에 도형들이 렌더링된 상태
**When** 도형 위를 클릭
**Then** 해당 도형이 선택 상태가 된다
**And** 100ms 이내에 시각적 피드백이 표시된다 (NFR15)

**Given** 빈 공간을 클릭
**When** 클릭 이벤트 발생
**Then** 기존 선택이 해제된다

**Technical Notes:**
- Hit Test: 바운딩 박스 검사
- 선택 상태는 viewer/selection.json에 저장

**Requirements Fulfilled:** FR26

---

## Story 5.2: 선택 상태 시각적 표시

As a **사용자 (인간)**,
I want **선택된 도형이 시각적으로 구분되도록**,
So that **어떤 도형이 선택되었는지 알 수 있다**.

**Acceptance Criteria:**

**Given** 도형이 선택된 상태
**When** Canvas 렌더링 실행
**Then** 선택된 도형 주변에 하이라이트 또는 바운딩 박스가 표시된다

**Given** 선택 해제
**When** Canvas 렌더링
**Then** 하이라이트가 사라진다

**Technical Notes:**
- 하이라이트 색상: 파란색 점선 바운딩 박스
- 다중 선택 시 모든 선택된 도형에 표시

**Requirements Fulfilled:** FR27

---

## Story 5.3: 선택 정보 AI 전달

As a **AI 에이전트 (Claude Code)**,
I want **사용자가 선택한 도형 정보를 받을 수 있도록**,
So that **"이거" 같은 지시어를 이해할 수 있다**.

**Acceptance Criteria:**

**Given** 사용자가 도형을 선택한 상태
**When** AI가 viewer/selection.json을 읽음
**Then** 선택된 도형의 id, type, geometry 정보를 얻을 수 있다

**Given** "이거 더 길게" 같은 요청
**When** selection.json에 선택 정보가 있음
**Then** AI가 해당 도형에 scale을 적용할 수 있다

**Technical Notes:**
- selection.json 구조: { selected_ids, last_selected, timestamp }
- AI polling 간격: 500ms (scene.json과 동일)

**Requirements Fulfilled:** FR28

---

# Epic 6: "독립 실행 앱" - Electron 통합

> **2025-12-30 추가**: MVP 범위 확장

**Epic Goal**: WASM CAD 엔진 + 뷰어 + 채팅 UI를 단일 Electron 앱으로 패키징한다.

**FRs Covered**: FR29, FR30
**NFRs Addressed**: NFR16 (앱 시작 시간), NFR17 (오프라인 동작)

**Dependencies**: Epic 1, 2, 3, 4, 5 완료

### Feasibility & Risk Analysis

| 항목 | 평가 |
|------|------|
| **구현 가능성** | 🟡 중간 (Medium) |
| **리스크 수준** | 🟡 중간 |

**긍정적 요인**:
- Electron + Vite + WASM 조합은 검증된 스택
- Chat UI와 CAD Viewer를 한 화면에 배치하여 "AI와 함께 그리는" 경험 완성 가능

**주요 리스크 및 고려사항**:
1. **Client-Direct Architecture**: Electron Renderer에서 모든 로직 직접 실행. Main Process는 창 생성/파일 다이얼로그만. IPC 불필요 → 웹 버전과 코드 100% 동일
2. **보안**: 사용자 API Key를 안전하게 저장(electron-store, Electron keytar 등)하고 관리하는 설계 필요

---

## Story 6.1: Electron 프로젝트 셋업

As a **개발자**,
I want **Electron + Vite 프로젝트를 구성하도록**,
So that **WASM과 Viewer를 데스크톱 앱으로 빌드할 수 있다**.

**Acceptance Criteria:**

**Given** 빈 electron-app 디렉토리
**When** 프로젝트 셋업 완료
**Then** `npm run dev`로 개발 모드 실행 가능
**And** `npm run build`로 패키징 가능

**Technical Notes:**
- electron-builder 사용
- Client-Direct Architecture: Renderer에서 전부 처리
- Vite로 Renderer 빌드
- Main Process는 최소 역할 (창 생성, 파일 다이얼로그)

**Requirements Fulfilled:** FR29 (부분)

---

## Story 6.2: WASM 엔진 통합

As a **개발자**,
I want **WASM CAD 엔진을 Electron Renderer에서 직접 로드하도록**,
So that **채팅에서 CAD 명령을 실행할 수 있다**.

**Acceptance Criteria:**

**Given** Electron 앱이 시작된 상태
**When** WASM 로딩
**Then** CAD 엔진이 정상적으로 초기화된다
**And** 5초 이내에 앱이 시작된다 (NFR16)

**Technical Notes:**
- Renderer에서 WASM 직접 로드 (웹 브라우저와 동일)
- IPC 불필요 - 메모리에서 직접 렌더링

**Requirements Fulfilled:** FR29 (부분), NFR16

---

## Story 6.3: Canvas 2D Viewer 이식

As a **개발자**,
I want **기존 viewer/를 Electron Renderer에 이식하도록**,
So that **CAD 결과를 앱 내에서 확인할 수 있다**.

**Acceptance Criteria:**

**Given** Electron 앱 실행
**When** CAD 명령 실행 후
**Then** Renderer의 Canvas에 도형이 렌더링된다
**And** Selection UI가 동작한다

**Technical Notes:**
- 기존 viewer/ 코드 재사용
- 메모리에서 직접 렌더링 (파일 폴링 불필요)

**Requirements Fulfilled:** FR29 (부분)

---

## Story 6.4: 채팅 UI 구현

As a **사용자 (인간)**,
I want **앱 내에서 AI와 대화할 수 있도록**,
So that **별도 터미널 없이 CAD 작업을 할 수 있다**.

**Acceptance Criteria:**

**Given** Electron 앱 실행
**When** 채팅 입력창에 "원을 그려줘" 입력
**Then** AI 응답이 채팅 영역에 표시된다
**And** CAD 결과가 Canvas에 렌더링된다

**Technical Notes:**
- 간단한 채팅 UI (입력창 + 메시지 목록)
- Renderer에서 Claude API 직접 호출 (IPC 불필요)
- tool_use 응답 → WASM 직접 실행 → Canvas 렌더링

**Requirements Fulfilled:** FR29 (부분)

---

## Story 6.5: API 키 입력 및 관리

As a **사용자 (인간)**,
I want **내 Claude API 키를 입력하여 사용하도록**,
So that **자체 API 키로 AI를 사용할 수 있다**.

**Acceptance Criteria:**

**Given** 앱 첫 실행
**When** API 키가 없는 경우
**Then** API 키 입력 화면이 표시된다

**Given** 유효한 API 키 입력
**When** 저장 버튼 클릭
**Then** 키가 안전하게 저장된다 (electron-store 등)
**And** 채팅 기능이 활성화된다

**Given** API 키 없이
**When** CAD 기능 사용
**Then** 도형 생성/편집은 정상 동작한다 (NFR17)
**And** AI 채팅만 비활성화된다

**Technical Notes:**
- electron-store로 키 저장
- API 키 유효성 검증 (테스트 호출)

**Requirements Fulfilled:** FR30, NFR17

---

## Story 6.6: 앱 빌드 및 패키징

As a **개발자**,
I want **Windows/Mac/Linux용 앱을 빌드하도록**,
So that **사용자가 다운로드하여 실행할 수 있다**.

**Acceptance Criteria:**

**Given** 모든 기능 구현 완료
**When** `npm run build` 실행
**Then** Windows (.exe), Mac (.dmg), Linux (.AppImage) 파일이 생성된다

**Technical Notes:**
- electron-builder 설정
- WASM 파일을 리소스로 번들링
- 앱 크기 목표: ~100MB

**Requirements Fulfilled:** FR29

---

# Summary

> **2025-12-30 업데이트**: MVP 범위 확장으로 Epic 4, 5, 6 추가

## Epic & Story 총괄

| Epic | 스토리 수 | FRs Covered | 상태 |
|------|----------|-------------|------|
| Epic 1: CAD 엔진 기초 | 9 | FR1, FR2, FR3, FR4, FR14, FR17, FR18, FR19, FR20 | ✅ 완료 |
| Epic 2: Canvas 2D 뷰어 | 3 | FR9, FR11, FR12, FR16 | ✅ 완료 |
| Epic 3: 변환과 Export | 7 | FR5, FR6, FR7, FR8, FR10, FR13, FR15 | ✅ 완료 |
| Epic 4: 그룹화 및 피봇 | 6 | FR21, FR22, FR23, FR24, FR25 | ⬜ MVP |
| Epic 5: Selection UI | 3 | FR26, FR27, FR28 | ⬜ MVP |
| Epic 6: Electron 앱 | 6 | FR29, FR30 | ⬜ MVP |
| **Total** | **34** | **30 FRs** | |

## FR Coverage 검증

모든 30개 Functional Requirements가 스토리에 매핑되었습니다:
- FR1-FR4: Epic 1 (도형 생성)
- FR5-FR8: Epic 3 (변환)
- FR9-FR10: Epic 2, 3 (출력)
- FR11-FR13: Epic 2, 3 (뷰어)
- FR14-FR16: Epic 1, 2, 3 (Claude Code 통합)
- FR17-FR20: Epic 1 (Style, Arc)
- **FR21-FR25: Epic 4 (그룹화, 피봇)** ← MVP 추가
- **FR26-FR28: Epic 5 (Selection UI)** ← MVP 추가
- **FR29-FR30: Epic 6 (Electron 앱)** ← MVP 추가

## 구현 순서 권장

1. **Epic 1** → WASM 기반 구축, 도형 생성 기능 완성 ✅
2. **Epic 2** → 뷰어 연결, 검증 루프 확립 ✅
3. **Epic 3** → 수정 기능, 최종 Export ✅
4. **Epic 4** → 그룹화, 피봇, 계층 변환
5. **Epic 5** → Selection UI
6. **Epic 6** → Electron 앱 통합

## 검증 시나리오 매핑

| 검증 시나리오 | 필요 스토리 | 상태 |
|--------------|------------|------|
| "스켈레톤을 그려줘" | 1.1 → 1.2 → 1.3, 1.4, 1.5 → 2.1 → 2.2 → 2.3 | ✅ 가능 |
| "팔을 더 길게" | 3.1 또는 3.3 → 3.5 | ✅ 가능 |
| "SVG로 저장해줘" | 3.6 | ✅ 가능 |
| **"팔을 구부린 포즈로"** | 4.1 → 4.4 → 4.5 → 4.6 | ⬜ MVP |
| **[왼팔 클릭] + "이거 더 길게"** | 5.1 → 5.3 → 3.3 | ⬜ MVP |
| **Electron 앱 실행** | 6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6 | ⬜ MVP |
