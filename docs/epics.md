---
status: ready-for-dev
currentEpic: 7
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - docs/prd.md
  - docs/architecture.md
  - docs/ux-design-specification.md
---

# AI-Native CAD - Epic Breakdown

## Overview

AI-Native CAD 프로젝트의 에픽 목록입니다.

## Epic 진행 상황

| Epic | 제목 | 상태 |
|------|------|------|
| 1 | CAD 엔진 기초 | ✅ 완료 |
| 2 | Canvas 2D 뷰어 | ✅ 완료 |
| 3 | 변환과 Export | ✅ 완료 |
| 4 | 그룹화 및 피봇 | ✅ 완료 |
| 5 | Selection UI | ✅ 완료 |
| 6 | Electron 앱 | ✅ 완료 |
| 7 | 인간-LLM 협업 UI | ✅ 완료 |
| 8 | Manifold 기하 엔진 + 텍스트 렌더링 | ✅ 완료 |

---

## Requirements Inventory

### Functional Requirements

| ID | 기능 | 설명 |
|----|------|------|
| FR31 | 3패널 레이아웃 | Layer Panel / Canvas / Info Panel 구성 |
| FR32 | 패널 리사이즈 | 드래그로 패널 너비 조절 |
| FR33 | 계층 트리뷰 | JS 코드의 그룹/오브젝트를 트리로 표시 |
| FR34 | 그룹 탐색 | 그룹 선택, 확장, 중첩 그룹 탐색 |
| FR35 | 다중 선택 | Ctrl/Shift + 클릭으로 복수 선택 |
| FR36 | Visible 토글 | 끄면 Canvas에서 숨김 |
| FR37 | Lock 가드 | 잠긴 엔티티 수정 시 LLM에 경고 반환 |
| FR38 | 스케치 모드 | Canvas에 그리기/지우기 UI, 투명 오버레이 |
| FR39 | 스케치 캡쳐 | capture_viewport로 스케치 포함 캡쳐 → Vision 해석 |
| FR40 | 단일 소스 | viewer/가 유일한 소스, 웹/Electron 동일 코드 |
| FR41 | 좌표 정보 표시 | Info Panel에서 로컬/월드 좌표 토글 표시 |
| FR42 | 이중 좌표 API | 변환 API에 space 옵션 ('world' \| 'local') 지원 |

### Non-Functional Requirements

| ID | 요구사항 | 설명 |
|----|---------|------|
| NFR18 | 패널 리사이즈 성능 | 60fps 유지 |
| NFR19 | 렌더링 동등성 | React 전환 후 기존과 동일 품질 |
| NFR20 | 웹/Electron 동등성 | 동일 기능 동작 |

### Additional Requirements

**기술 스택:**
- React 19.2+ / TypeScript 5.7+
- Vite 7.3+ / TailwindCSS 4.x
- react-resizable-panels / Lucide React
- Inter + JetBrains Mono 폰트

**아키텍처:**
- 단일 소스 패턴 (viewer/ → web + Electron)
- scene.json 폴링 (100ms)
- selection.json 확장 (lock, hidden 필드)

**UX/접근성:**
- WCAG AA 준수
- 키보드 네비게이션 완전 지원
- 듀얼 테마 (Dark/Light)

### FR Coverage Map

| 요구사항 | Epic | 설명 |
|----------|------|------|
| FR31 | 7.1 | 3패널 레이아웃 |
| FR32 | 7.1 | 패널 리사이즈 |
| FR33 | 7.2 | 계층 트리뷰 |
| FR34 | 7.2 | 그룹 탐색 |
| FR35 | 7.2 | 다중 선택 |
| FR36 | 7.3 | Visible 토글 |
| FR37 | 7.3 | Lock 가드 |
| FR38 | 7.4 | 스케치 모드 |
| FR39 | 7.4 | 스케치 캡쳐 |
| FR40 | 7.1 | 단일 소스 |
| NFR18 | 7.1 | 60fps 성능 |
| NFR19 | 7.1 | 렌더링 동등성 |
| NFR20 | 7.1 | Web/Electron 동등성 |
| FR41 | 7.5 | 좌표 정보 표시 |
| FR42 | 7.5 | 이중 좌표 API |

---

## Epic List

### Epic 8: Manifold 기하 엔진 + 텍스트 렌더링 ✅
고급 기하 연산과 텍스트 렌더링으로 CAD 기능을 확장한다

**FRs covered:** FR43-FR50

---

## 완료된 Epics (요약)

### Epic 7: 인간-LLM 협업 UI (완료)

- React 19 + TypeScript + Vite 뷰어
- 3패널 레이아웃 (Layer / Canvas / Info)
- 레이어 트리뷰 및 다중 선택
- Visible/Lock 상태 관리
- 스케치 모드 (의도 전달)
- 이중 좌표 시스템 (Local/World)
- Electron 통합

### Epic 1-3: MVP 기초 (완료)

- WASM CAD 엔진 (Rust → WASM)
- 기초 도형 6종 (Circle, Rect, Line, Polygon, Arc, Bezier)
- 스타일 시스템 (Fill, Stroke)
- 변환 (Translate, Rotate, Scale)
- Canvas 2D 뷰어
- JSON/SVG Export

### Epic 4-5: 그룹화 및 선택 (완료)

- Group/Ungroup
- Pivot 설정
- 계층적 변환
- 클릭 선택
- 다중 선택
- selection.json 연동

### Epic 6: Electron 앱 (완료)

- electron-vite 기반 앱
- File polling 아키텍처
- Windows/Mac 빌드
- Claude Code 연동 가이드

---

## Epic 8: Manifold 기하 엔진 + 텍스트 렌더링

**목표**: 고급 기하 연산과 텍스트 렌더링으로 CAD 기능을 확장한다

### 배경

MVP 이후 필요해진 기능들:
- Boolean 연산 (union, difference, intersect) - 복합 도형 생성
- 기하 분석 (offset, convexHull, area, decompose) - 정밀 작업
- 텍스트 렌더링 (다양한 한글 폰트) - 도면 주석/라벨
- DX 개선 (변수 접근, 트랜잭션) - LLM 생산성

### FR Coverage Map

| 요구사항 | Story | 설명 |
|----------|-------|------|
| FR43 | 8.1 | 추가 모드 변수 접근 |
| FR44 | 8.2 | 스케치 자동 클리어 |
| FR45 | 8.3 | 자동 스케일 계산 |
| FR46 | 8.4 | 실행 트랜잭션 |
| FR47 | 8.5 | Manifold Boolean 연산 |
| FR48 | 8.6 | Manifold 기하 분석 |
| FR49 | 8.7 | 텍스트 렌더링 |
| FR50 | 8.8 | 한글 폰트 자동 검색 |

---

### Story 8.1: 코드 추가 모드 변수 접근

As a **LLM**,
I want **+ prefix로 코드를 추가할 때 기존 모듈의 변수/함수에 접근할 수 있기를**,
So that **전체 코드를 다시 작성하지 않고 점진적으로 확장할 수 있다** (FR43).

**Acceptance Criteria:**

**Given** main 모듈에 `const W = 13550;`이 정의되어 있을 때
**When** `run_cad_code main "+drawRect('r', W/2, 0, 100, 100)"`를 실행하면
**Then** W 변수를 참조하여 정상 실행된다
**And** 새 코드가 기존 코드 뒤에 추가된다

**Given** main 모듈에 `function wall(id, x, y, w, h) {...}`가 정의되어 있을 때
**When** `run_cad_code main "+wall('new_wall', 0, 0, 100, 10)"`를 실행하면
**Then** wall 함수를 호출하여 정상 실행된다

**Given** 추가할 코드에 동일한 변수명이 있을 때
**When** `run_cad_code main "+const W = 500;"`를 실행하면
**Then** 명확한 에러 메시지가 반환된다: "Variable 'W' already defined. Use a different name or modify existing code."

**Technical Notes:**
- 기존 코드와 추가 코드를 결합하여 단일 스크립트로 실행
- 변수 충돌 시 사전 검사하여 실행 전 에러 반환

---

### Story 8.2: 스케치 자동 클리어

As a **LLM**,
I want **스케치 기반 작업 완료 후 스케치를 자동으로 클리어하는 옵션이 있기를**,
So that **매번 수동으로 sketch.json을 비우지 않아도 된다** (FR44).

**Acceptance Criteria:**

**Given** 스케치가 그려져 있고 run_cad_code로 구현을 완료했을 때
**When** `--clear-sketch` 플래그와 함께 실행하면
**Then** 코드 실행 후 sketch.json이 `{"strokes":[]}`로 초기화된다
**And** 다음 캡처에서 빨간 스케치 선이 보이지 않는다

**Given** 스케치 클리어 없이 실행할 때
**When** 플래그 없이 `run_cad_code main "..."`를 실행하면
**Then** sketch.json은 변경되지 않는다 (기존 동작 유지)

**Given** capture 명령 실행 시
**When** `run_cad_code --capture --clear-sketch`를 실행하면
**Then** 캡처 후 sketch.json이 클리어된다

**Technical Notes:**
- `--clear-sketch` 플래그 추가
- sketch.json 경로: `viewer/sketch.json`

---

### Story 8.3: 자동 스케일 계산 함수

As a **LLM**,
I want **실제 치수(mm)와 뷰포트 크기를 입력하면 최적 스케일을 계산해주는 함수가 있기를**,
So that **스케일 값을 시행착오 없이 빠르게 결정할 수 있다** (FR45).

**Acceptance Criteria:**

**Given** 평면도 실제 크기가 13550mm × 11800mm일 때
**When** `fitToViewport(13550, 11800)` 또는 `--fit 13550x11800` 옵션을 사용하면
**Then** 뷰포트(기본 1600×1000)에 맞는 최적 스케일이 계산된다
**And** 적절한 여백(10%)이 포함된다
**And** 결과 예: `{ scale: 0.042, offsetX: -285, offsetY: -248 }`

**Given** 커스텀 뷰포트 크기를 지정할 때
**When** `fitToViewport(13550, 11800, { viewport: [800, 600] })`를 실행하면
**Then** 해당 뷰포트 크기에 맞는 스케일이 계산된다

**Given** 계산된 스케일을 적용할 때
**When** 반환된 값을 코드에 사용하면
**Then** 도면이 뷰포트 중앙에 적절한 크기로 표시된다

**Technical Notes:**
- Sandbox에 `fitToViewport(realWidth, realHeight, options?)` 함수 추가
- 반환값: `{ scale, offsetX, offsetY, code }` (code는 복사 가능한 스니펫)

---

### Story 8.4: 실행 트랜잭션 (롤백)

As a **LLM**,
I want **코드 실행 실패 시 파일이 변경되지 않기를**,
So that **에러 발생 시 중복 정의나 불완전한 코드가 파일에 남지 않는다** (FR46).

**Acceptance Criteria:**

**Given** 추가 모드로 코드를 실행할 때
**When** 코드에 문법 오류나 런타임 에러가 있으면
**Then** 파일은 원래 상태로 유지된다 (변경되지 않음)
**And** 에러 메시지가 반환된다

**Given** 코드가 성공적으로 실행될 때
**When** 모든 엔티티가 정상 생성되면
**Then** 파일이 업데이트된다

**Given** 부분 실행 후 에러가 발생할 때
**When** 일부 엔티티만 생성되고 에러가 발생하면
**Then** 씬도 원래 상태로 롤백된다 (부분 생성된 엔티티 제거)

**Technical Notes:**
- 실행 전 파일 백업 (메모리)
- 에러 발생 시 백업에서 복원
- scene.json도 트랜잭션 범위에 포함

---

### Story 8.5: Manifold Boolean 연산 ✅

As a **LLM**,
I want **Manifold WASM을 통해 Boolean 연산(union, difference, intersect)을 실행할 수 있기를**,
So that **복잡한 복합 도형을 정밀하게 생성할 수 있다** (FR47).

**Acceptance Criteria:**

**Given** Circle, Rect, Polygon 등 기본 도형이 있을 때
**When** `booleanUnion('circle1', 'rect1', 'result')`를 실행하면
**Then** 두 도형의 합집합인 새 도형 'result'가 생성된다

**Given** 두 겹치는 도형이 있을 때
**When** `booleanDifference('base', 'hole', 'result')`를 실행하면
**Then** base에서 hole을 뺀 도형이 생성된다 (구멍 뚫기)

**Given** 두 겹치는 도형이 있을 때
**When** `booleanIntersect('a', 'b', 'result')`를 실행하면
**Then** 겹치는 영역만 남는다

**Technical Notes:**
- Manifold WASM 직접 호출 (< 1ms 성능)
- 결과는 Polygon 타입으로 저장
- CrossSection API 사용 (2D 연산)

---

### Story 8.6: Manifold 기하 분석 ✅

As a **LLM**,
I want **offset, convexHull, area, decompose 등 기하 분석 함수를 사용할 수 있기를**,
So that **정밀한 기하 조작과 분석이 가능하다** (FR48).

**Acceptance Criteria:**

**Given** Polygon 도형이 있을 때
**When** `offsetPolygon('wall', 5, 'wall_thick')`을 실행하면
**Then** 벽 두께가 5만큼 확장된 도형이 생성된다
**And** 음수 delta는 축소를 의미한다

**Given** 여러 점으로 이루어진 도형이 있을 때
**When** `convexHull('shape', 'hull')`을 실행하면
**Then** 볼록 껍질(Convex Hull)이 생성된다

**Given** 닫힌 도형이 있을 때
**When** `getArea('shape')`를 호출하면
**Then** 면적(부호 있는)이 반환된다

**Given** 분리된 여러 컴포넌트가 있을 때
**When** `decompose('multi', 'part')`를 실행하면
**Then** 각 컴포넌트가 'part_0', 'part_1' 등으로 분리된다

**Technical Notes:**
- Manifold CrossSection.offset() 사용
- joinType: 'miter' | 'round' | 'square' 지원
- decompose는 Boolean 연산 후 분리된 조각 추출에 유용

---

### Story 8.7: 텍스트 렌더링 (opentype.js) ✅

As a **LLM**,
I want **텍스트를 CAD 도형(Polygon)으로 렌더링할 수 있기를**,
So that **도면에 주석, 라벨, 제목을 추가할 수 있다** (FR49).

**Acceptance Criteria:**

**Given** 텍스트와 폰트가 지정되었을 때
**When** `drawText('label', '거실', 100, 50, 24)`를 실행하면
**Then** 해당 위치에 텍스트가 Polygon 도형으로 렌더링된다

**Given** 한글/영문 혼합 텍스트일 때
**When** 한글 폰트로 렌더링하면
**Then** 모든 문자가 정확히 렌더링된다 (복잡한 글리프 포함: 뷁, 쀍, 퓶 등)

**Given** 정렬 옵션이 지정되었을 때
**When** `drawText('t', 'Center', 0, 0, 20, { align: 'center' })`
**Then** 텍스트가 중앙 정렬된다

**Given** 텍스트 크기를 알아야 할 때
**When** `getTextMetrics('텍스트', 24)`를 호출하면
**Then** `{ width, height }` 정보가 반환된다

**Technical Notes:**
- opentype.js로 TTF/OTF 파싱
- 글리프 → SVG path → Polygon 변환
- 다중 서브패스(구멍) 올바르게 처리 (한글 'ㅇ', 영문 'e' 등)

---

### Story 8.8: 한글 폰트 자동 검색 ✅

As a **LLM/사용자**,
I want **fontPath를 생략해도 시스템에서 한글 폰트가 자동 검색되기를**,
So that **폰트 설정 없이 바로 한글 텍스트를 사용할 수 있다** (FR50).

**Acceptance Criteria:**

**Given** Windows 시스템에서
**When** `drawText('t', '안녕', 0, 0, 20)` (fontPath 생략)
**Then** 맑은 고딕(malgun.ttf)이 자동으로 사용된다

**Given** macOS 시스템에서
**When** fontPath 없이 drawText 실행
**Then** Apple SD Gothic이 자동으로 사용된다

**Given** Linux 시스템에서
**When** fontPath 없이 drawText 실행
**Then** Noto Sans CJK 또는 나눔고딕이 자동으로 사용된다

**Given** 프로젝트 fonts/ 폴더에 폰트가 있을 때
**When** fontPath로 상대 경로 지정 (`fonts/NanumGothic.ttf`)
**Then** 해당 폰트가 사용된다

**사용 가능한 폰트** (`fonts/` 폴더):

| 폰트 | fontPath | 용도 |
|-----|----------|------|
| 나눔고딕 | `fonts/NanumGothic.ttf` | 기본 고딕 (default) |
| 나눔명조 | `fonts/NanumMyeongjo.ttf` | 명조체 |
| 나눔바른고딕 | `fonts/NanumBarunGothic.ttf` | 가독성 고딕 |
| 마루부리 | `fonts/MaruBuri-Regular.ttf` | 세리프체 |
| 나눔펜 | `fonts/NanumPen.ttf` | 손글씨 |
| D2Coding | `fonts/D2Coding-Ver1.3.2-20180524.ttf` | 코딩용 |

**Technical Notes:**
- DEFAULT_FONT_NAMES에 한글 폰트 우선 배치
- 플랫폼별 폰트 경로 자동 탐색
- 프로젝트 fonts/ 폴더 우선 검색

---

## 관련 문서

- [PRD](./prd.md) - 제품 요구사항
- [Architecture](./architecture.md) - 기술 아키텍처
- [UX Design Specification](./ux-design-specification.md) - UX 설계
