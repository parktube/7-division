# Story 5.2: 선택 상태 시각적 표시

Status: backlog

## Story

As a **사용자 (인간)**,
I want **선택된 도형이 시각적으로 구분되도록**,
so that **어떤 도형이 선택되었는지 알 수 있다**.

## Acceptance Criteria

1. **AC1: 선택 하이라이트 표시**
   - Given: 도형이 선택된 상태
   - When: Canvas 렌더링 실행
   - Then: 선택된 도형 주변에 바운딩 박스가 표시된다
   - And: 바운딩 박스는 파란색 점선으로 표시된다

2. **AC2: 선택 해제 시 하이라이트 제거**
   - Given: 도형이 선택된 상태에서 하이라이트가 표시됨
   - When: 빈 공간 클릭으로 선택 해제
   - Then: 바운딩 박스가 사라진다

3. **AC3: 다중 선택 하이라이트**
   - Given: 여러 도형이 선택된 상태
   - When: Canvas 렌더링 실행
   - Then: 모든 선택된 도형에 개별 바운딩 박스가 표시된다

4. **AC4: 바운딩 박스 계산 - Circle**
   - Given: Circle이 선택된 상태
   - When: 바운딩 박스 렌더링
   - Then: center ± radius 영역을 감싸는 사각형이 표시된다

5. **AC5: 바운딩 박스 계산 - Rect**
   - Given: Rect가 선택된 상태
   - When: 바운딩 박스 렌더링
   - Then: origin부터 (origin + width, origin + height)를 감싸는 사각형이 표시된다

6. **AC6: 바운딩 박스 계산 - Line**
   - Given: Line이 선택된 상태
   - When: 바운딩 박스 렌더링
   - Then: 모든 points를 감싸는 최소 사각형이 표시된다

7. **AC7: 바운딩 박스 계산 - Arc**
   - Given: Arc가 선택된 상태
   - When: 바운딩 박스 렌더링
   - Then: 호의 양 끝점과 극값을 감싸는 사각형이 표시된다

8. **AC8: Transform 적용된 바운딩 박스**
   - Given: translate, rotate, scale이 적용된 도형
   - When: 바운딩 박스 렌더링
   - Then: 변환된 위치에 바운딩 박스가 표시된다
   - Note: 회전 시 바운딩 박스도 함께 회전하거나 AABB 확장

9. **AC9: 선택 핸들 표시 (Optional)**
   - Given: 도형이 선택된 상태
   - When: 바운딩 박스 렌더링
   - Then: 모서리와 변 중앙에 작은 핸들(사각형)이 표시된다
   - Note: MVP Stretch - 구현하지 않아도 됨

10. **AC10: 하이라이트 스타일 일관성**
    - Given: 다양한 색상/스타일의 도형들
    - When: 선택
    - Then: 모든 도형에 동일한 하이라이트 스타일이 적용된다
    - And: 하이라이트가 도형 스타일과 충돌하지 않는다 (다른 색상)

## Tasks / Subtasks

- [ ] **Task 1: 바운딩 박스 계산 함수** (AC: 4, 5, 6, 7)
  - [ ] 1.1: `getBoundingBox(entity) -> { minX, minY, maxX, maxY }`
  - [ ] 1.2: Circle 바운딩 박스: center ± radius
  - [ ] 1.3: Rect 바운딩 박스: origin, origin + size
  - [ ] 1.4: Line 바운딩 박스: points의 min/max
  - [ ] 1.5: Arc 바운딩 박스: 양 끝점 + 극값 고려

- [ ] **Task 2: Transform 적용 바운딩 박스** (AC: 8)
  - [ ] 2.1: 로컬 바운딩 박스 계산
  - [ ] 2.2: 4개 코너에 월드 변환 적용
  - [ ] 2.3: 변환된 코너들의 min/max로 AABB 계산
  - [ ] 2.4: 또는 바운딩 박스도 함께 회전 (OBB 표시)

- [ ] **Task 3: 하이라이트 렌더링** (AC: 1, 2, 10)
  - [ ] 3.1: `renderSelectionHighlight(entity, ctx)` 함수
  - [ ] 3.2: 파란색(#0066ff) 점선 스타일 설정
  - [ ] 3.3: ctx.setLineDash([5, 3]) 적용
  - [ ] 3.4: strokeRect로 바운딩 박스 그리기
  - [ ] 3.5: 도형 렌더링 후 하이라이트 렌더링 (위에 표시)

- [ ] **Task 4: 다중 선택 처리** (AC: 3)
  - [ ] 4.1: selection.json에서 selected_ids 배열 읽기
  - [ ] 4.2: 각 선택된 entity에 대해 하이라이트 렌더링

- [ ] **Task 5: 선택 핸들 (Optional)** (AC: 9)
  - [ ] 5.1: 바운딩 박스 8개 지점(4코너 + 4중점)에 핸들 표시
  - [ ] 5.2: 핸들 크기: 6x6 픽셀 흰색 사각형 + 파란 테두리
  - [ ] 5.3: Note: MVP Stretch Goal

- [ ] **Task 6: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7, 8, 10)
  - [ ] 6.1: 수동 테스트 - Circle 선택 하이라이트
  - [ ] 6.2: 수동 테스트 - Rect 선택 하이라이트
  - [ ] 6.3: 수동 테스트 - Line 선택 하이라이트
  - [ ] 6.4: 수동 테스트 - Arc 선택 하이라이트
  - [ ] 6.5: 수동 테스트 - 변환된 도형 하이라이트
  - [ ] 6.6: 수동 테스트 - 다중 선택
  - [ ] 6.7: 수동 테스트 - 선택 해제 시 하이라이트 제거

## Dev Notes

### Architecture Compliance

**렌더링 순서:**
1. 도형들 렌더링 (기존 로직)
2. 선택된 도형들의 하이라이트 렌더링 (위에 오버레이)

**Dual-Architecture Strategy 준수:**

| 모드 | 선택 정보 소스 | 렌더링 흐름 |
|------|---------------|-------------|
| **Mode A** (CLI) | selection.json 폴링 | fetch → parse → highlight |
| **Mode B** (App) | 메모리 상태 직접 | selectedIds → highlight |

**Mode A (현재 구현 대상):**
- selection.json을 scene.json과 함께 폴링
- 또는 동일 렌더링 사이클에서 처리

**Mode B 최적화 (Epic 6 구현 시):**
- DirectExecutor.getSelection()에서 메모리 직접 읽기
- 파일 폴링 불필요 → 즉각적인 하이라이트 반영
- 렌더링 로직 자체는 Mode A와 동일 (재사용 가능)

### Technical Requirements

1. **하이라이트 스타일**:
   ```javascript
   const HIGHLIGHT_STYLE = {
       strokeColor: '#0066ff',
       lineWidth: 2,
       lineDash: [5, 3],
       padding: 4  // 바운딩 박스 여백
   };
   ```

2. **바운딩 박스 계산 예시**:
   ```javascript
   function getBoundingBox(entity) {
       const geom = entity.geometry;

       switch (entity.entity_type) {
           case 'Circle':
               return {
                   minX: geom.center[0] - geom.radius,
                   minY: geom.center[1] - geom.radius,
                   maxX: geom.center[0] + geom.radius,
                   maxY: geom.center[1] + geom.radius
               };
           case 'Rect':
               return {
                   minX: geom.origin[0],
                   minY: geom.origin[1],
                   maxX: geom.origin[0] + geom.width,
                   maxY: geom.origin[1] + geom.height
               };
           case 'Line':
               const xs = geom.points.map(p => p[0]);
               const ys = geom.points.map(p => p[1]);
               return {
                   minX: Math.min(...xs),
                   minY: Math.min(...ys),
                   maxX: Math.max(...xs),
                   maxY: Math.max(...ys)
               };
           // Arc는 더 복잡한 로직 필요
       }
   }
   ```

3. **하이라이트 렌더링**:
   ```javascript
   function renderSelectionHighlight(entity, ctx) {
       const bbox = getBoundingBox(entity);
       const padding = HIGHLIGHT_STYLE.padding;

       ctx.save();

       // 월드 변환 적용 (entity의 transform)
       applyTransform(entity.transform, ctx);

       ctx.strokeStyle = HIGHLIGHT_STYLE.strokeColor;
       ctx.lineWidth = HIGHLIGHT_STYLE.lineWidth;
       ctx.setLineDash(HIGHLIGHT_STYLE.lineDash);

       ctx.strokeRect(
           bbox.minX - padding,
           bbox.minY - padding,
           (bbox.maxX - bbox.minX) + padding * 2,
           (bbox.maxY - bbox.minY) + padding * 2
       );

       ctx.restore();
   }
   ```

4. **Arc 바운딩 박스 (복잡)**:
   - 호의 시작점과 끝점
   - 0°, 90°, 180°, 270° 지점이 호 범위 내에 있으면 극값으로 포함

### File Structure Notes

수정 대상 파일:
- `viewer/renderer.js` - 하이라이트 렌더링 로직 추가

### References

- [Source: docs/epics.md#Story 5.2: 선택 상태 시각적 표시]
- [Source: docs/sprint-artifacts/5-1-click-selection.md - 선택 로직]

## Dev Agent Record

### Context Reference

- docs/epics.md (Epic 5, Story 5.2)
- docs/sprint-artifacts/5-1-click-selection.md
- viewer/renderer.js

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
