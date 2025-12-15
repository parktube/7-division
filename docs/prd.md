---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - docs/analysis/product-brief-r2-7f-division-2025-12-14.md
  - docs/ax-design-guide.md
  - docs/ai-native-cad-proposal.md
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 2
workflowType: 'prd'
lastStep: 2
project_name: 'AI-Native CAD'
user_name: 'Hoons'
date: '2025-12-14'
---

# Product Requirements Document - AI-Native CAD

**Author:** Hoons
**Date:** 2025-12-14

---

## Executive Summary

AI-Native CAD는 "말하고 가리키면, AI가 만든다" 패러다임의 CAD 도구이다.
인간은 의도를 전달하고 결과를 검증하며, AI가 도구를 직접 조작한다.

### What Makes This Special

1. **AI-Native 설계**: 기존 CAD에 AI 채팅을 붙이는 것이 아닌, 처음부터 AI가 사용하도록 설계
2. **Direct-First Architecture**: MCP 없이 WASM 직접 실행 (4계층 → 1계층)
3. **Minimal Direct Manipulation**: 선택/포인팅만 허용, 조작은 AI가 수행
4. **학습 곡선 제거**: 6개월 → 0분
5. **확장성**: LLM 교체 가능, MCP 래퍼 추가 가능

## Project Classification

**Technical Type:** Web App (WASM 기반)
**Domain:** Design Tools / Creative
**Complexity:** High (새로운 패러다임)
**Project Context:** Greenfield - 백지에서 시작

---

## Technical Architecture

### Direct-First Architecture

```
Claude Code CLI (Node.js)
    ↓ WASM 직접 로드 & 실행
Rust CAD 엔진
    ↓ scene.json 출력 (+ SVG export 옵션)
브라우저 뷰어 (Three.js, polling으로 갱신)
```

### 뷰어 전략

Three.js 기반 통합 뷰어:
- **2D**: `OrthographicCamera` + z=0 평면
- **3D**: `PerspectiveCamera` + orbit controls
- **전환**: 카메라 교체만으로 geometry 유지

Phase 1부터 Three.js 사용 → Phase 3 3D 확장 자연스러움

### CAD 엔진 (Rust → WASM)

**Primitives** (JSCAD 참조):
- `circle(radius)` / `ellipse(rx, ry)`
- `rectangle(width, height)` / `square(size)`
- `line(points)` / `polygon(points)`
- `arc(radius, startAngle, endAngle)`

**Transforms**:
- `translate(x, y)` / `rotate(angle)` / `scale(sx, sy)`

**Output**:
- Phase 1: scene.json (Three.js 렌더링용) + SVG export
- Phase 2: DXF export
- Phase 3: STL (필수), STEP (옵션)

---

## Success Criteria

### User Success

| 지표 | 목표 |
|------|------|
| 첫 결과물까지 시간 | < 5분 |
| 학습 시간 | 0분 (의도만 전달) |
| "원하는 결과" 도달률 | 측정 예정 |

**Aha! Moment**: "말했더니 진짜 그려졌다"

### Business Success

- Phase 1: 기술 검증 (스켈레톤 테스트 통과)
- Phase 2: 도메인 확장 검증 (그룹화, ActionHints)
- Phase 3: 사용자 검증 (Selection UI, 실제 사용 케이스)
- Phase 4: 시장 검증

### Technical Success

- WASM 엔진 직접 실행 성공
- SVG 출력 정상 동작
- Claude Code에서 도구 호출 원활

---

## Product Scope

### Phase 1: 최소 검증 — "사람 스켈레톤을 그려줘"

**목표**: 기초 도형 도구만으로 AI가 복잡한 형상을 만들 수 있는지 검증

- 기초 도형: `line`, `circle`, `rect`
- 변환: `translate`, `rotate`, `scale`, `delete`
- 출력: scene.json (Three.js용) + SVG export
- Claude Code 직접 실행
- Three.js 뷰어 (polling 방식)

**검증 시나리오**: "사람 스켈레톤을 그려줘"

### Phase 2: 도메인 확장

**목표**: AI가 더 복잡한 구조를 다룰 수 있는지 검증

- Phase 1 도구 + 그룹화, 레이어
- 더 복잡한 요청: "팔을 구부린 포즈로", "걷는 자세로"
- ActionHints 동작 확인
- 검증 UI 프로토타입

### Phase 3: Selection UI + 실사용 테스트

**목표**: "가리키기 + 말하기" 인터랙션 검증

- Selection UI (클릭으로 객체 선택)
- 실제 작업 시도 (캐릭터 리깅용 스켈레톤 등)
- DXF 출력
- 인간-AI 협업 플로우 검증

### Phase 4+: Vision

- Gateway + 채팅 UI
- MCP 래퍼
- 로컬 LLM 지원
- 3D 확장

---

## User Journey

### Phase 1: 말하기만 (최소 검증)

```
사용자: "사람 스켈레톤을 그려줘"
    ↓
Claude Code: WASM 엔진 호출 → scene.json 생성
    ↓
브라우저: Three.js 렌더링 (polling으로 갱신)
    ↓
사용자: 결과 확인 → "팔을 더 길게"
    ↓
Claude Code: translate/scale 적용 → scene.json 업데이트
```

### Phase 2: 도메인 확장 (여전히 말하기만)

```
사용자: "팔을 구부린 포즈로 바꿔줘"
    ↓
Claude Code: 그룹화된 엔티티 인식 → 관절 기준 회전 계산
    ↓
WASM: rotate + translate 조합 적용 → scene.json 업데이트
    ↓
브라우저: Three.js 렌더링 갱신
    ↓
Claude Code: ActionHints 반환 → "다리도 구부릴까요?"
```

### Phase 3: 가리키기 + 말하기

```
사용자: [왼팔 클릭] + "이거 더 길게"
    ↓
브라우저: selection event {id: "left_arm", bounds: {...}}
    ↓
Claude Code: 선택된 객체 scale 적용 → scene.json 업데이트
    ↓
브라우저: Three.js 렌더링 갱신
```

### Interaction Pattern (Phase 3+)

| 허용 | 불허 |
|------|------|
| 클릭/탭 (선택) | 드래그로 이동 |
| 드래그 (범위 선택) | 직접 회전/스케일 |
| 핀치/줌 (뷰 조작) | 파라미터 입력 |

**원칙**: 선택/포인팅만 허용, 조작은 AI가 수행

---

## Data Model

### Scene 구조

```
Scene
├── metadata: { name, created_at, modified_at }
├── settings: { unit, grid_size, origin }
└── entities: Entity[]
```

### Entity 구조

```
Entity
├── id: string (uuid)
├── type: "line" | "circle" | "rect" | "polygon" | "arc" | "group"
├── geometry: Geometry (type별 상이)
├── transform: { translate, rotate, scale }
├── style: { stroke, fill, stroke_width }
└── metadata: { name?, layer?, locked? }
```

### Geometry 예시

```rust
// Line
{ points: [[x1, y1], [x2, y2], ...] }

// Circle
{ center: [x, y], radius: f64 }

// Rect
{ origin: [x, y], width: f64, height: f64 }
```

### 상태 관리

- **History**: Command 패턴으로 Undo/Redo 지원
- **Persistence**: JSON 직렬화 → 파일 저장

---

## Risks & Mitigations

| 리스크 | 영향 | 완화 전략 |
|--------|------|-----------|
| AI가 의도를 잘못 해석 | 높음 | 반복 수정으로 보완, 명확한 피드백 루프 |
| WASM 성능 부족 | 중간 | Phase 1은 간단한 도형만, 복잡도 점진적 증가 |
| Three.js 2D 표현 한계 | 낮음 | SVG fallback 옵션 유지 |
| 3D 확장 시 API 재설계 | 중간 | Point 타입을 처음부터 확장 가능하게 설계 |
| **wasm-bindgen API 설계** | 높음 | 클래스 래퍼 방식 사용, struct 왕복 피함 |
| **UUID/getrandom 호환성** | 중간 | `js_sys::Math::random()` 또는 `uuid` js feature |
| **Phase 3 역방향 통신** | 중간 | WebSocket 또는 이벤트 파일 큐 필요 (Selection UI용) |
| **DXF/STEP 복잡도 과소평가** | 중간 | Phase 3 이후로 미룸, "쉽다" 전제 금지 |

### 기술 부채 방지

- `Serializer` trait로 출력 포맷 추상화
- `Point<const N: usize>` 제네릭으로 2D/3D 통합
- wasm-bindgen 클래스 래퍼 패턴으로 API 설계
- `Float64Array` 등 명확한 타입 사용

---

## Out of Scope (Phase 1)

| 항목 | 이유 | 예정 |
|------|------|------|
| 그룹화/레이어 | Phase 1은 기초 도형만 | Phase 2 |
| ActionHints | 도메인 확장 단계에서 | Phase 2 |
| Selection UI | "가리키기" 인터랙션 | Phase 3 |
| DXF/DWG 출력 | SVG로 검증 후 | Phase 3 |
| 3D 기능 | 2D 먼저 검증 | Phase 4+ |
| 채팅 UI | Claude Code로 충분 | Phase 4+ |
| MCP 래퍼 | Direct-First 검증 후 | Phase 4+ |
| 실시간 협업 | 단일 사용자 먼저 | Phase 4+ |
| Undo/Redo UI | 엔진만 구현 | Phase 2-3 |

---

## Definition of Done (Phase 1)

### 필수 완료 조건

- [ ] Rust CAD 엔진 WASM 빌드 성공
- [ ] 기초 도형 3종: `line`, `circle`, `rect`
- [ ] 변환 4종: `translate`, `rotate`, `scale`, `delete`
- [ ] scene.json 출력 정상 동작
- [ ] Claude Code에서 WASM 직접 호출 성공
- [ ] Three.js 뷰어에서 scene.json 렌더링 (polling)

### 검증 시나리오 통과

```
입력: "사람 스켈레톤을 그려줘"
기대 결과:
- 머리 (circle)
- 몸통 (line 또는 rect)
- 팔 2개 (line)
- 다리 2개 (line)
- 적절한 비율과 위치
```

### 수정 요청 테스트

```
입력: "왼쪽 팔을 더 길게 해줘"
기대 결과: 해당 entity의 scale 또는 points 수정
```

---

