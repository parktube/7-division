# Story 2.3: Line, Circle, Rect 렌더링 구현

Status: ready-for-dev

## Story

As a **사용자 (인간)**,
I want **생성된 line, circle, rect 도형을 Canvas에서 시각적으로 확인할 수 있도록**,
So that **AI가 만든 스켈레톤이 올바르게 표현되었는지 검증할 수 있다**.

## Acceptance Criteria

### AC1: Line 렌더링
**Given** scene.json에 Line Entity가 있는 경우
**When** Canvas 렌더링 실행
**Then** points 배열의 좌표들이 연결된 선으로 그려진다
**And** ctx.moveTo/lineTo/stroke가 호출된다

### AC2: Circle 렌더링
**Given** scene.json에 Circle Entity가 있는 경우
**When** Canvas 렌더링 실행
**Then** center 좌표에 radius 크기의 원이 그려진다
**And** ctx.arc(center[0], center[1], radius, 0, Math.PI*2)가 호출된다

### AC3: Rect 렌더링
**Given** scene.json에 Rect Entity가 있는 경우
**When** Canvas 렌더링 실행
**Then** origin 좌표에서 width x height 크기의 사각형이 그려진다
**And** ctx.strokeRect(origin[0], origin[1], width, height)가 호출된다

### AC4: 복합 도형 렌더링
**Given** 여러 도형이 섞여 있는 scene.json
**When** Canvas 렌더링 실행
**Then** 모든 도형이 순서대로 렌더링된다
**And** 도형 타입에 따라 적절한 렌더링 함수가 호출된다

### AC5: 스켈레톤 시각화
**Given** 스켈레톤 도형 (머리 circle + 몸통/팔/다리 line)
**When** Canvas 렌더링 실행
**Then** 사람 형태의 스켈레톤이 시각적으로 인식 가능하다

## Tasks / Subtasks

- [ ] **Task 1: 도형 렌더링 함수 분리** (AC: #1, #2, #3)
  - [ ] 1.1: renderLine(ctx, entity) 함수 구현
  - [ ] 1.2: renderCircle(ctx, entity) 함수 구현
  - [ ] 1.3: renderRect(ctx, entity) 함수 구현

- [ ] **Task 2: 렌더링 분기 로직** (AC: #4)
  - [ ] 2.1: entity.entity_type 기반 switch 문 구현
  - [ ] 2.2: 알 수 없는 타입 처리 (무시 또는 경고)

- [ ] **Task 3: 스타일 적용** (AC: #1, #2, #3)
  - [ ] 3.1: 기본 스타일 설정 (stroke: black, lineWidth: 1)
  - [ ] 3.2: entity.style 값 적용 (있으면)

- [ ] **Task 4: 좌표 변환** (AC: #5)
  - [ ] 4.1: Canvas 중앙 기준 좌표계 설정 (선택적)
  - [ ] 4.2: 또는 좌상단 기준 유지

- [ ] **Task 5: 테스트** (AC: #1, #2, #3, #4, #5)
  - [ ] 5.1: 단일 Line 렌더링 테스트
  - [ ] 5.2: 단일 Circle 렌더링 테스트
  - [ ] 5.3: 단일 Rect 렌더링 테스트
  - [ ] 5.4: 스켈레톤 복합 렌더링 테스트

## Dev Notes

### Architecture Patterns

#### 렌더링 함수 구현

```javascript
// renderer.js (Story 2.2에서 생성, 이 스토리에서 확장)

function render(scene) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!scene.entities) return;

    // 좌표계 변환: 캔버스 중앙을 원점으로 (선택적)
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(1, -1);  // y축 뒤집기 (위로 양수)

    for (const entity of scene.entities) {
        renderEntity(ctx, entity);
    }

    ctx.restore();
}

function renderEntity(ctx, entity) {
    // 기본 스타일
    ctx.strokeStyle = entity.style?.stroke || '#000000';
    ctx.lineWidth = entity.style?.stroke_width || 1;

    switch (entity.entity_type) {
        case 'Line':
            renderLine(ctx, entity);
            break;
        case 'Circle':
            renderCircle(ctx, entity);
            break;
        case 'Rect':
            renderRect(ctx, entity);
            break;
        default:
            console.warn('Unknown entity type:', entity.entity_type);
    }
}

function renderLine(ctx, entity) {
    const points = entity.geometry.Line?.points;
    if (!points || points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
    }

    ctx.stroke();
}

function renderCircle(ctx, entity) {
    const { center, radius } = entity.geometry.Circle || {};
    if (!center || !radius) return;

    ctx.beginPath();
    ctx.arc(center[0], center[1], radius, 0, Math.PI * 2);
    ctx.stroke();
}

function renderRect(ctx, entity) {
    const { origin, width, height } = entity.geometry.Rect || {};
    if (!origin || !width || !height) return;

    ctx.strokeRect(origin[0], origin[1], width, height);
}
```

#### 스켈레톤 렌더링 예시

```javascript
// scene.json (예시 - Claude Code가 생성)
{
  "name": "skeleton",
  "entities": [
    {
      "id": "head",
      "entity_type": "Circle",
      "geometry": { "Circle": { "center": [0, 100], "radius": 10 } }
    },
    {
      "id": "spine",
      "entity_type": "Line",
      "geometry": { "Line": { "points": [[0, 90], [0, 50]] } }
    },
    {
      "id": "left_arm",
      "entity_type": "Line",
      "geometry": { "Line": { "points": [[0, 85], [-20, 70], [-25, 50]] } }
    },
    {
      "id": "right_arm",
      "entity_type": "Line",
      "geometry": { "Line": { "points": [[0, 85], [20, 70], [25, 50]] } }
    },
    {
      "id": "left_leg",
      "entity_type": "Line",
      "geometry": { "Line": { "points": [[0, 50], [-15, 20], [-15, 0]] } }
    },
    {
      "id": "right_leg",
      "entity_type": "Line",
      "geometry": { "Line": { "points": [[0, 50], [15, 20], [15, 0]] } }
    }
  ]
}
```

### Canvas 2D API 참고

```javascript
// Line
ctx.beginPath();
ctx.moveTo(x1, y1);
ctx.lineTo(x2, y2);
ctx.stroke();

// Circle
ctx.beginPath();
ctx.arc(cx, cy, radius, 0, Math.PI * 2);
ctx.stroke();

// Rect
ctx.strokeRect(x, y, width, height);
```

### 좌표계 선택

**옵션 A: 캔버스 좌상단 기준 (기본)**
- Canvas 기본 좌표계와 동일
- 변환 불필요
- y축이 아래로 증가

**옵션 B: 캔버스 중앙 기준 + y축 뒤집기**
- 수학적 좌표계와 유사
- ctx.translate + ctx.scale 필요
- 스켈레톤 표현에 더 직관적

→ Phase 1에서는 옵션 B 권장 (스켈레톤 검증 시나리오에 적합)

### 디렉토리 구조

```
viewer/
├── index.html
├── renderer.js     # ← 이 스토리에서 렌더링 로직 추가
└── scene.json
```

### Project Structure Notes

- 이 스토리 완료 시 Phase 1 검증 시나리오 실행 가능
- "사람 스켈레톤을 그려줘" → 뷰어에서 확인 가능
- Transform 적용 렌더링은 Epic 3 (Story 3.5)에서 구현

### Dependencies

- Story 2.2 (Canvas 2D 뷰어 기초 및 Polling)
- Story 2.1 (JSON Export)
- Story 1.3-1.5 (도형 생성)

## References

- [Source: docs/architecture.md#Viewer Architecture - Phase 1 Canvas 2D]
- [Source: docs/prd.md#검증 시나리오 - 스켈레톤 생성]
- [Source: docs/epics.md#Story 2.3]
- [Source: docs/ai-native-cad-proposal.md#Phase 1 검증 시나리오]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- viewer/renderer.js (수정 - 렌더링 로직 추가)
