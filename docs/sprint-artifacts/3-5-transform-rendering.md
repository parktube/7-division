# Story 3.5: Transform 적용 렌더링 구현

Status: ready-for-dev

## Story

As a **사용자 (인간)**,
I want **translate, rotate, scale이 적용된 도형을 뷰어에서 올바르게 볼 수 있도록**,
So that **AI가 수정한 결과가 정확히 반영되었는지 확인할 수 있다**.

## Acceptance Criteria

### AC1: Translate 렌더링
**Given** Entity에 translate: [10, 20]이 적용된 경우
**When** Canvas 렌더링 실행
**Then** 도형이 원래 위치에서 (10, 20)만큼 이동해서 그려진다

### AC2: Rotate 렌더링
**Given** Entity에 rotate: Math.PI/4 (45도)가 적용된 경우
**When** Canvas 렌더링 실행
**Then** 도형이 45도 회전해서 그려진다
**And** ctx.rotate()가 호출된다

### AC3: Scale 렌더링
**Given** Entity에 scale: [2, 0.5]가 적용된 경우
**When** Canvas 렌더링 실행
**Then** 도형이 가로 2배, 세로 0.5배로 그려진다
**And** ctx.scale()가 호출된다

### AC4: 복합 변환 렌더링
**Given** translate + rotate + scale이 모두 적용된 경우
**When** Canvas 렌더링 실행
**Then** 변환이 올바른 순서로 적용된다 (scale → rotate → translate)
**And** ctx.save()/ctx.restore()로 상태 관리된다

### AC5: 스켈레톤 수정 확인
**Given** 스켈레톤에서 "왼팔을 길게" 수정 후
**When** 뷰어에서 확인
**Then** 왼팔 Entity만 scale이 적용되어 길어져 보인다
**And** 다른 Entity들은 변경 없이 표시된다

## Tasks / Subtasks

- [ ] **Task 1: Transform 적용 렌더링 함수** (AC: #1, #2, #3, #4)
  - [ ] 1.1: applyTransform(ctx, transform) 함수 구현
  - [ ] 1.2: ctx.translate(dx, dy) 적용
  - [ ] 1.3: ctx.rotate(angle) 적용
  - [ ] 1.4: ctx.scale(sx, sy) 적용

- [ ] **Task 2: 상태 관리** (AC: #4)
  - [ ] 2.1: ctx.save() 호출 (변환 전)
  - [ ] 2.2: ctx.restore() 호출 (변환 후)
  - [ ] 2.3: 각 Entity별 독립적 변환 보장

- [ ] **Task 3: 렌더링 순서** (AC: #4)
  - [ ] 3.1: 변환 순서 결정: scale → rotate → translate
  - [ ] 3.2: 변환 순서 문서화

- [ ] **Task 4: renderEntity 통합** (AC: #1, #2, #3, #5)
  - [ ] 4.1: renderEntity에 transform 적용 로직 추가
  - [ ] 4.2: 기본값 처리 (transform 없는 경우)

- [ ] **Task 5: 테스트** (AC: #1, #2, #3, #4, #5)
  - [ ] 5.1: translate만 적용 테스트
  - [ ] 5.2: rotate만 적용 테스트
  - [ ] 5.3: scale만 적용 테스트
  - [ ] 5.4: 복합 변환 테스트
  - [ ] 5.5: 스켈레톤 수정 시각 확인

## Dev Notes

### Architecture Patterns

#### Transform 적용 렌더링

```javascript
// renderer.js

function renderEntity(ctx, entity) {
    // 상태 저장
    ctx.save();

    // Transform 적용 (순서: scale → rotate → translate)
    const t = entity.transform || { translate: [0, 0], rotate: 0, scale: [1, 1] };

    // 1. 이동 (마지막에 적용되지만, Canvas는 역순으로 적용)
    ctx.translate(t.translate[0], t.translate[1]);

    // 2. 회전
    ctx.rotate(t.rotate);

    // 3. 스케일 (가장 먼저 적용됨)
    ctx.scale(t.scale[0], t.scale[1]);

    // 스타일 적용
    ctx.strokeStyle = entity.style?.stroke || '#000000';
    ctx.lineWidth = entity.style?.stroke_width || 1;

    // 도형 렌더링
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
    }

    // 상태 복원
    ctx.restore();
}
```

#### Canvas 변환 순서

Canvas 2D API에서 변환은 **역순**으로 적용됩니다:

```javascript
// 코드 순서:
ctx.translate(10, 20);  // 1번째 호출
ctx.rotate(0.5);        // 2번째 호출
ctx.scale(2, 2);        // 3번째 호출

// 실제 적용 순서:
// scale(2, 2) → rotate(0.5) → translate(10, 20)
```

따라서 원하는 순서가 "scale → rotate → translate"라면:
```javascript
ctx.translate(dx, dy);   // 마지막에 적용됨
ctx.rotate(angle);       // 중간에 적용됨
ctx.scale(sx, sy);       // 먼저 적용됨
```

#### 스켈레톤 수정 예시

```javascript
// 원본 scene.json
{
  "entities": [
    {
      "id": "left_arm",
      "entity_type": "Line",
      "geometry": { "Line": { "points": [[0, 85], [-20, 70], [-25, 50]] } },
      "transform": {
        "translate": [0, 0],
        "rotate": 0,
        "scale": [1, 1]
      }
    }
  ]
}

// "팔을 더 길게" 수정 후
{
  "entities": [
    {
      "id": "left_arm",
      "entity_type": "Line",
      "geometry": { "Line": { "points": [[0, 85], [-20, 70], [-25, 50]] } },
      "transform": {
        "translate": [0, 0],
        "rotate": 0,
        "scale": [1, 1.5]  // y축으로 1.5배
      }
    }
  ]
}
```

### ctx.save() / ctx.restore() 중요성

```javascript
// 각 Entity마다 독립적인 변환 적용
for (const entity of scene.entities) {
    ctx.save();           // 현재 상태 저장
    applyTransform(ctx, entity.transform);
    renderShape(ctx, entity);
    ctx.restore();        // 이전 상태 복원
}
```

### 디렉토리 구조

```
viewer/
├── index.html
├── renderer.js     # ← 이 스토리에서 transform 렌더링 추가
└── scene.json
```

### Project Structure Notes

- Story 2.3의 렌더링 코드 확장
- 각 Entity별 독립적 transform 적용
- ctx.save()/restore()로 상태 격리

### Dependencies

- Story 2.3 (Line, Circle, Rect 렌더링)
- Story 3.1 (Translate)
- Story 3.2 (Rotate)
- Story 3.3 (Scale)

## References

- [Source: docs/architecture.md#Viewer Architecture]
- [Source: docs/prd.md#검증 시나리오 - 수정 요청]
- [Source: docs/epics.md#Story 3.5]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- viewer/renderer.js (수정 - transform 렌더링 추가)
