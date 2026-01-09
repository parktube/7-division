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
| 7 | 인간-LLM 협업 UI | 🔄 진행 중 |
| 8 | LLM DX 개선 | 🆕 신규 |

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

### Epic 7.1: 기본 뷰어 프레임워크
사용자가 3패널 레이아웃에서 CAD 씬을 보고 작업 공간을 조절할 수 있다

**FRs covered:** FR31, FR32, FR40
**NFRs covered:** NFR18, NFR19, NFR20

### Epic 7.2: 레이어 탐색 및 선택
사용자가 레이어 패널에서 엔티티를 탐색하고 선택하여 LLM에 컨텍스트를 전달할 수 있다

**FRs covered:** FR33, FR34, FR35

### Epic 7.3: 엔티티 상태 관리
사용자가 가시성/잠금을 제어하여 LLM 작업 범위를 명확히 지정할 수 있다

**FRs covered:** FR36, FR37

### Epic 7.4: 스케치 의도 전달
사용자가 캔버스에 스케치하여 LLM Vision에 의도를 전달할 수 있다

**FRs covered:** FR38, FR39

### Epic 7.5: 좌표 시스템 개선
사용자/LLM이 로컬 좌표와 월드 좌표를 명시적으로 구분하여 혼란 없이 작업할 수 있다

**FRs covered:** FR41 (신규), FR42 (신규)

### Epic 8: LLM DX 개선
LLM이 CAD 코드를 작성할 때 겪는 마찰을 줄이고 워크플로우를 개선한다

**FRs covered:** FR43, FR44, FR45, FR46 (모두 신규)

---

## Epic 7.1: 기본 뷰어 프레임워크

**목표**: 사용자가 3패널 레이아웃에서 CAD 씬을 보고 작업 공간을 조절할 수 있다

### 핵심 개념

```
┌──────────────────────────────────────────────────────────────┐
│ 🔶 scene.json │ Grid ☑️ │ Rulers ☑️ │ ✏️ Sketch │  ☀️  ⚙️  │
├──────────┬───────────────────────────────────────┬───────────┤
│  Layer   │               Canvas                  │   Info    │
│  Panel   │                                       │   Panel   │
├──────────┴───────────────────────────────────────┴───────────┤
│ Normal │ Entities: 47 │ Selected: 3 │ x: 120, y: -45 │ 100% │
└──────────────────────────────────────────────────────────────┘
```

### 기술 스택

- **프레임워크**: React 19.2+ / TypeScript 5.7+
- **빌드**: Vite 7.3+
- **CSS**: TailwindCSS 4.x
- **패널 리사이즈**: react-resizable-panels
- **아이콘**: Lucide React
- **폰트**: Inter + JetBrains Mono

### Story 7.1.1: React 프로젝트 초기화

As a **개발자**,
I want **viewer/ 디렉토리에 React + TypeScript + Vite 프로젝트가 셋업되기를**,
So that **Epic 7 구현을 위한 기반이 마련된다**.

**Acceptance Criteria:**

**Given** viewer/ 디렉토리가 비어있거나 레거시 코드만 있을 때
**When** npm run dev를 실행하면
**Then** localhost:5173에서 React 앱이 렌더링된다
**And** TailwindCSS가 적용된 기본 스타일이 보인다
**And** TypeScript 타입 체크가 통과한다

---

### Story 7.1.2: 3패널 리사이즈 레이아웃

As a **사용자**,
I want **화면이 Layer Panel / Canvas / Info Panel 3개 영역으로 나뉘고 크기를 조절할 수 있기를**,
So that **내 작업 스타일에 맞게 UI를 구성할 수 있다**.

**Acceptance Criteria:**

**Given** 뷰어가 로드되었을 때
**When** 화면을 보면
**Then** 좌측 Layer Panel (~200px), 중앙 Canvas (flex), 우측 Info Panel (~280px)이 보인다
**And** 패널 경계를 드래그하면 크기가 조절된다
**And** 리사이즈가 60fps로 부드럽게 동작한다 (NFR18)

---

### Story 7.1.3: Top Bar 및 Status Bar

As a **사용자**,
I want **상단에 파일명과 토글 버튼이, 하단에 상태 정보가 표시되기를**,
So that **현재 작업 상태를 한눈에 파악할 수 있다**.

**Acceptance Criteria:**

**Given** 뷰어가 로드되었을 때
**When** 상단 바를 보면
**Then** 로고 "AI-Native CAD", 파일명 "scene.json", Grid/Rulers/Sketch 토글이 보인다
**And** 테마 전환 버튼 (다크/라이트)이 있다

**Given** 뷰어가 로드되었을 때
**When** 하단 상태 바를 보면
**Then** 모드 (Normal), 엔티티 수, 선택 수, 마우스 좌표, 줌 레벨이 표시된다

---

### Story 7.1.4: Canvas 씬 렌더링

As a **사용자**,
I want **scene.json의 모든 도형이 Canvas에 정확히 렌더링되기를**,
So that **LLM이 생성한 CAD 결과물을 확인할 수 있다**.

**Acceptance Criteria:**

**Given** scene.json에 Circle, Rect, Line, Polygon, Arc, Bezier, Group이 있을 때
**When** 뷰어를 로드하면
**Then** 모든 도형이 올바른 위치, 크기, 스타일로 렌더링된다
**And** 기존 바닐라 JS 렌더러와 동일한 품질이다 (NFR19)
**And** scene.json 변경 시 100ms 내에 화면이 갱신된다

---

### Story 7.1.5: Canvas Pan/Zoom

As a **사용자**,
I want **Canvas를 드래그하여 이동하고 휠로 확대/축소할 수 있기를**,
So that **씬의 특정 부분을 자세히 볼 수 있다**.

**Acceptance Criteria:**

**Given** Canvas가 렌더링되었을 때
**When** 마우스 드래그 (또는 스페이스+드래그)하면
**Then** 뷰포트가 이동한다

**Given** Canvas가 렌더링되었을 때
**When** 마우스 휠을 스크롤하면
**Then** 커서 위치를 중심으로 확대/축소된다
**And** 상태 바의 줌 레벨이 업데이트된다

---

### Story 7.1.6: Electron 통합

As a **사용자**,
I want **웹 브라우저와 Electron 앱에서 동일하게 동작하기를**,
So that **어떤 환경에서든 같은 경험을 할 수 있다** (FR40, NFR20).

**Acceptance Criteria:**

**Given** viewer/가 빌드되었을 때
**When** Electron 앱을 실행하면
**Then** 웹 브라우저와 동일한 UI가 로드된다
**And** 모든 기능 (3패널, Pan/Zoom, 렌더링)이 동일하게 동작한다
**And** 개발 모드에서 Vite HMR이 동작한다

---

## Epic 7.2: 레이어 탐색 및 선택

**목표**: 사용자가 레이어 패널에서 엔티티를 탐색하고 선택하여 LLM에 컨텍스트를 전달할 수 있다

### Story 7.2.1: 엔티티 트리뷰

As a **사용자**,
I want **Layer Panel에 scene.json의 모든 엔티티가 트리 구조로 표시되기를**,
So that **씬의 구조를 한눈에 파악할 수 있다** (FR33).

**Acceptance Criteria:**

**Given** scene.json에 여러 엔티티와 그룹이 있을 때
**When** Layer Panel을 보면
**Then** 모든 엔티티가 트리 형태로 표시된다
**And** 그룹은 폴더 아이콘, 개별 엔티티는 도형 타입에 맞는 아이콘이 표시된다
**And** 엔티티 이름이 표시된다

---

### Story 7.2.2: 그룹 확장/축소

As a **사용자**,
I want **그룹을 확장하거나 축소하여 내부 엔티티를 탐색할 수 있기를**,
So that **복잡한 씬에서 원하는 부분만 볼 수 있다** (FR34).

**Acceptance Criteria:**

**Given** 트리뷰에 그룹이 표시되어 있을 때
**When** 그룹의 Chevron 아이콘을 클릭하면
**Then** 그룹이 확장되어 자식 엔티티가 보인다
**And** 다시 클릭하면 축소된다

**Given** 중첩된 그룹 (그룹 안의 그룹)이 있을 때
**When** 각 레벨의 Chevron을 클릭하면
**Then** 각 레벨이 독립적으로 확장/축소된다
**And** 들여쓰기로 계층 구조가 시각적으로 표현된다

---

### Story 7.2.3: 엔티티 단일 선택

As a **사용자**,
I want **트리뷰에서 엔티티를 클릭하여 선택할 수 있기를**,
So that **특정 엔티티를 LLM에게 지정할 수 있다**.

**Acceptance Criteria:**

**Given** 트리뷰에 엔티티가 표시되어 있을 때
**When** 엔티티를 클릭하면
**Then** 해당 엔티티가 선택 상태로 하이라이트된다
**And** Canvas에서 해당 엔티티가 선택 표시(파란색 테두리)된다
**And** Info Panel에 선택된 엔티티 정보가 표시된다

**Given** 다른 엔티티가 이미 선택되어 있을 때
**When** 새로운 엔티티를 클릭하면
**Then** 기존 선택이 해제되고 새 엔티티만 선택된다

---

### Story 7.2.4: 다중 선택

As a **사용자**,
I want **Ctrl/Shift+클릭으로 여러 엔티티를 동시에 선택할 수 있기를**,
So that **여러 엔티티를 한번에 LLM에게 지정할 수 있다** (FR35).

**Acceptance Criteria:**

**Given** 엔티티가 선택되어 있을 때
**When** Ctrl+클릭으로 다른 엔티티를 클릭하면
**Then** 기존 선택이 유지되고 새 엔티티가 선택에 추가된다
**And** Ctrl+클릭으로 이미 선택된 엔티티를 클릭하면 선택이 해제된다

**Given** 엔티티가 선택되어 있을 때
**When** Shift+클릭으로 다른 엔티티를 클릭하면
**Then** 두 엔티티 사이의 모든 엔티티가 범위 선택된다

**Given** 여러 엔티티가 선택되어 있을 때
**When** Canvas를 보면
**Then** 모든 선택된 엔티티에 선택 표시가 보인다
**And** Status Bar에 "Selected: N"이 표시된다

---

### Story 7.2.5: selection.json 연동

As a **LLM**,
I want **사용자가 선택한 엔티티 목록이 selection.json에 저장되기를**,
So that **get_selection 명령으로 컨텍스트를 받을 수 있다**.

**Acceptance Criteria:**

**Given** 사용자가 엔티티를 선택했을 때
**When** selection.json을 읽으면
**Then** 선택된 엔티티 이름 배열이 저장되어 있다
**And** 선택이 변경될 때마다 즉시 업데이트된다

---

## Epic 7.3: 엔티티 상태 관리

**목표**: 사용자가 가시성/잠금을 제어하여 LLM 작업 범위를 명확히 지정할 수 있다

### Story 7.3.1: Visible 토글

As a **사용자**,
I want **트리뷰에서 엔티티의 가시성을 토글할 수 있기를**,
So that **불필요한 엔티티를 숨기고 작업에 집중할 수 있다** (FR36).

**Acceptance Criteria:**

**Given** 트리뷰에 엔티티가 표시되어 있을 때
**When** 눈 아이콘을 클릭하면
**Then** 아이콘이 eye → eye-off로 변경된다
**And** Canvas에서 해당 엔티티가 숨겨진다

**Given** 숨겨진 엔티티가 있을 때
**When** eye-off 아이콘을 클릭하면
**Then** 아이콘이 eye로 변경되고 Canvas에 다시 표시된다

**Given** 그룹의 가시성을 토글할 때
**When** 그룹의 눈 아이콘을 클릭하면
**Then** 그룹과 모든 자식 엔티티가 함께 숨겨진다

---

### Story 7.3.2: Lock 토글

As a **사용자**,
I want **엔티티를 잠금 처리하여 LLM이 수정하지 못하게 보호할 수 있기를**,
So that **중요한 엔티티가 실수로 변경되는 것을 방지할 수 있다** (FR37).

**Acceptance Criteria:**

**Given** 트리뷰에 엔티티가 표시되어 있을 때
**When** 자물쇠 아이콘을 클릭하면
**Then** 아이콘이 unlock → lock으로 변경되고 주황색으로 표시된다
**And** Canvas에서 해당 엔티티에 잠금 표시(주황색 테두리)가 나타난다

**Given** 잠긴 엔티티가 있을 때
**When** lock 아이콘을 클릭하면
**Then** 잠금이 해제되고 아이콘이 unlock으로 변경된다

---

### Story 7.3.3: 상태 저장 및 LLM 경고

As a **LLM**,
I want **hidden/lock 상태가 selection.json에 저장되고, Lock된 엔티티 수정 시 경고를 받기를**,
So that **사용자 의도를 존중하고 보호된 엔티티를 건드리지 않을 수 있다** (FR37).

**Acceptance Criteria:**

**Given** 엔티티의 hidden 또는 lock 상태가 변경되었을 때
**When** selection.json을 읽으면
**Then** 상태가 저장되어 있다

**Given** 엔티티가 잠금 상태일 때
**When** LLM이 해당 엔티티를 수정하는 명령을 실행하면
**Then** 경고 메시지가 반환된다: "Warning: [entity] is locked by user"
**And** 명령은 실행되지 않거나 경고와 함께 실행된다 (설정에 따라)

---

## Epic 7.4: 스케치 의도 전달

**목표**: 사용자가 캔버스에 스케치하여 LLM Vision에 의도를 전달할 수 있다

### Story 7.4.1: 스케치 모드 진입/종료

As a **사용자**,
I want **스케치 모드를 켜고 끌 수 있기를**,
So that **일반 탐색과 스케치 작업을 구분할 수 있다** (FR38).

**Acceptance Criteria:**

**Given** 뷰어가 Normal 모드일 때
**When** Top Bar의 "Sketch Mode" 버튼을 클릭하면
**Then** Status Bar에 "MODE: SKETCH"가 표시된다
**And** Canvas 위에 투명한 스케치 오버레이가 활성화된다
**And** 마우스 커서가 펜 모양으로 변경된다

**Given** Sketch 모드일 때
**When** "Sketch Mode" 버튼을 다시 클릭하거나 ESC를 누르면
**Then** Normal 모드로 돌아간다
**And** 스케치는 캔버스에 유지된다

---

### Story 7.4.2: 프리핸드 그리기

As a **사용자**,
I want **캔버스에 자유롭게 그림을 그릴 수 있기를**,
So that **LLM에게 원하는 변경사항을 시각적으로 전달할 수 있다** (FR38).

**Acceptance Criteria:**

**Given** Sketch 모드가 활성화되어 있을 때
**When** 마우스를 드래그하면
**Then** 드래그 경로를 따라 빨간색 선이 그려진다
**And** 선은 기존 CAD 도형 위에 오버레이로 표시된다

**Given** 스케치 중일 때
**When** 마우스 버튼을 떼면
**Then** 해당 스트로크가 스케치 레이어에 저장된다
**And** 여러 스트로크를 연속으로 그릴 수 있다

---

### Story 7.4.3: 지우개 도구

As a **사용자**,
I want **그린 스케치를 지울 수 있기를**,
So that **잘못 그린 부분을 수정할 수 있다** (FR38).

**Acceptance Criteria:**

**Given** Sketch 모드에서 스케치가 있을 때
**When** 지우개 버튼을 클릭하고 드래그하면
**Then** 드래그한 영역의 스케치가 지워진다

**Given** Sketch 모드일 때
**When** "Clear All" 버튼을 클릭하면
**Then** 모든 스케치가 삭제된다
**And** CAD 도형은 영향받지 않는다

---

### Story 7.4.4: 스케치 캡쳐

As a **LLM**,
I want **capture_viewport가 스케치를 포함한 이미지를 캡쳐하기를**,
So that **Vision 모델이 사용자 의도를 해석할 수 있다** (FR39).

**Acceptance Criteria:**

**Given** 사용자가 스케치를 그린 상태일 때
**When** capture_viewport 명령을 실행하면
**Then** CAD 도형 + 스케치 오버레이가 함께 캡쳐된다
**And** PNG 이미지로 저장된다

**Given** 캡쳐된 이미지가 있을 때
**When** LLM Vision이 이미지를 분석하면
**Then** 빨간색 스케치 선을 "사용자 의도 표시"로 인식할 수 있다
**And** "여기에 원 추가", "이 선 연장" 등의 의도를 해석할 수 있다

---

## Epic 7.5: 좌표 시스템 개선

**목표**: 사용자/LLM이 로컬 좌표와 월드 좌표를 명시적으로 구분하여 혼란 없이 작업할 수 있다

### 배경

그룹 시스템에서 로컬 좌표만 노출되면 LLM이 혼란을 겪음:
- 스케치는 World 좌표로 그려짐
- 그룹 내 엔티티는 로컬 좌표로 저장됨
- addToGroup 시 위치가 틀어지는 것처럼 보임

해결: API에서 로컬/월드 좌표 둘 다 지원하고 명시적으로 선택 가능하게 함.

### 아키텍처 원칙: "Dumb View"

> **중요**: Viewer는 bounds를 계산하지 않는다. scene.json의 computed 필드에서 읽기만 한다.
>
> - WASM이 모든 bounds 계산 담당 (get_world_bounds_internal)
> - scene.json export 시 computed.world_bounds, computed.local_bounds 포함
> - Viewer의 InfoPanel은 entity.computed에서 읽기만

### Story 7.5.1: Info Panel 좌표 토글

As a **사용자**,
I want **Info Panel에서 로컬 좌표와 월드 좌표를 토글하여 볼 수 있기를**,
So that **엔티티의 실제 위치와 그룹 내 상대 위치를 모두 확인할 수 있다** (FR41).

**Acceptance Criteria:**

**Given** 엔티티가 선택되어 Info Panel에 정보가 표시될 때
**When** "Local / World" 토글 버튼을 보면
**Then** 현재 선택된 좌표계가 표시된다 (기본값: World)

**Given** World 모드가 선택되어 있을 때
**When** 좌표 정보를 보면
**Then** scene.json의 entity.computed.world_bounds가 표시된다
**And** bounds: { min: [x, y], max: [x, y] } 형태로 표시된다

**Given** Local 모드로 전환했을 때
**When** 좌표 정보를 보면
**Then** scene.json의 entity.computed.local_bounds가 표시된다
**And** 부모 그룹 이름이 함께 표시된다

**Implementation Note:** Viewer에서 calculateBounds 함수 구현 금지. scene.json에서 읽기만.

---

### Story 7.5.2: 이중 좌표 API

As a **LLM**,
I want **get_entity가 로컬/월드 좌표를 모두 반환하고, 변환 API에서 좌표계를 선택할 수 있기를**,
So that **스케치 기반 작업과 그룹 내 상대적 조정을 명확히 구분할 수 있다** (FR42).

**Acceptance Criteria:**

**Given** 그룹에 속한 엔티티가 있을 때
**When** get_entity('entity_name')을 호출하면
**Then** 응답에 local과 world 좌표가 모두 포함된다:
```json
{
  "local": { "bounds": {...}, "position": [...] },
  "world": { "bounds": {...}, "position": [...] },
  "parent": "group_name"
}
```

**Given** 엔티티를 이동하려 할 때
**When** translate('entity', 10, 0, { space: 'world' })를 호출하면
**Then** 화면 기준으로 10만큼 이동한다

**Given** 엔티티를 이동하려 할 때
**When** translate('entity', 10, 0, { space: 'local' })를 호출하면
**Then** 부모 그룹 기준으로 10만큼 이동한다

**Given** space 옵션을 생략할 때
**When** translate('entity', 10, 0)을 호출하면
**Then** 기본값 'world'로 동작한다 (스케치 워크플로우에 자연스러움)

---

### Story 7.5.3: addToGroup 월드 위치 유지

As a **LLM**,
I want **addToGroup 시 엔티티의 월드 위치가 유지되기를**,
So that **스케치 위치에 만든 엔티티를 그룹에 추가해도 위치가 틀어지지 않는다**.

**Acceptance Criteria:**

**Given** 월드 좌표 (100, 50)에 엔티티가 있을 때
**When** addToGroup('house', 'entity')를 호출하면
**Then** 엔티티가 house 그룹에 추가된다
**And** 엔티티의 월드 위치는 여전히 (100, 50)이다
**And** 시스템이 내부적으로 로컬 좌표를 자동 계산한다

---

## 완료된 Epics (요약)

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

---

## Epic 8: LLM 개발자 경험 (DX) 개선

**목표**: LLM이 CAD 코드를 작성할 때 겪는 마찰을 줄이고 워크플로우를 개선한다

### 배경

평면도 작업 중 발견된 DX 문제들:
- 코드 추가 시 기존 변수 재정의 오류
- 스케치 오버레이가 구현 후에도 잔존
- 적절한 스케일 값 찾기 위한 시행착오
- 실행 실패해도 파일이 변경되어 중복 정의 누적

### FR Coverage Map (신규)

| 요구사항 | Epic | 설명 |
|----------|------|------|
| FR43 | 8.1 | 추가 모드 변수 접근 |
| FR44 | 8.2 | 스케치 자동 클리어 |
| FR45 | 8.3 | 자동 스케일 계산 |
| FR46 | 8.4 | 실행 트랜잭션 |

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

## 관련 문서

- [PRD](./prd.md) - 제품 요구사항
- [Architecture](./architecture.md) - 기술 아키텍처
- [UX Design Specification](./ux-design-specification.md) - UX 설계
