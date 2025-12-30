# Story 5.1: 도형 클릭 선택

Status: drafted

## Story

As a **사용자 (인간)**,
I want **Canvas에서 도형을 클릭하여 선택할 수 있도록**,
so that **"이거 더 길게" 같은 지시를 할 수 있다**.

## Acceptance Criteria

1. **AC1: 도형 클릭 선택**
   - Given: Canvas에 circle, line, rect 도형들이 렌더링된 상태
   - When: 도형 위를 클릭
   - Then: 해당 도형이 선택 상태가 된다
   - And: selection.json에 선택된 도형 ID가 기록된다

2. **AC2: 선택 반응 속도 (NFR15)**
   - Given: 도형을 클릭한 시점
   - When: 시각적 피드백 표시
   - Then: 100ms 이내에 하이라이트가 표시된다

3. **AC3: 빈 공간 클릭 시 선택 해제**
   - Given: 도형이 선택된 상태
   - When: 도형이 없는 빈 공간을 클릭
   - Then: 기존 선택이 해제된다
   - And: selection.json에서 선택 정보가 비워진다

4. **AC4: Circle Hit Test**
   - Given: Canvas에 circle(center, radius)이 존재
   - When: 클릭 위치가 center로부터 radius 이내
   - Then: 해당 circle이 선택된다

5. **AC5: Rect Hit Test**
   - Given: Canvas에 rect(origin, width, height)가 존재
   - When: 클릭 위치가 사각형 영역 내부
   - Then: 해당 rect가 선택된다

6. **AC6: Line Hit Test (Tolerance)**
   - Given: Canvas에 line(points)이 존재
   - When: 클릭 위치가 선분으로부터 5px 이내
   - Then: 해당 line이 선택된다
   - Note: 얇은 선의 클릭 편의를 위한 tolerance 적용

7. **AC7: Arc Hit Test**
   - Given: Canvas에 arc(center, radius, start_angle, end_angle)가 존재
   - When: 클릭 위치가 호 경로로부터 5px 이내
   - Then: 해당 arc가 선택된다

8. **AC8: Transform 적용된 도형 Hit Test**
   - Given: translate, rotate, scale이 적용된 도형
   - When: 변환된 위치를 클릭
   - Then: 올바르게 hit test가 수행된다
   - Note: 월드 좌표 → 로컬 좌표 변환 필요

9. **AC9: 겹친 도형 처리 (z-order)**
   - Given: 여러 도형이 겹쳐 있는 영역
   - When: 클릭
   - Then: 가장 위에 있는 도형(나중에 렌더링된)이 선택된다

10. **AC10: 그룹 선택 (MVP UX 결정)**
    - Given: 그룹과 그 자식들이 존재
    - When: 자식 도형을 클릭
    - Then: 해당 자식 도형이 선택된다 (그룹 전체가 아님)
    - Note: 그룹 전체 선택은 별도 UI (예: 더블클릭) 고려

    > **MVP UX 결정 근거**:
    > - 일반 디자인 도구 (Figma, Illustrator): 클릭 → 그룹 선택 → 더블클릭 → 자식 선택
    > - **MVP 선택**: 클릭 → 자식 직접 선택 (AI-Native CAD 특성 반영)
    >
    > **이유**:
    > - AI 에이전트는 특정 도형을 지정할 때 "팔꿈치를 선택해" 같은 명시적 요청이 많음
    > - 그룹 단위 작업이 필요하면 "팔 전체를 선택해" → AI가 그룹 ID를 selection에 설정
    > - 단순한 클릭 동작 = 도형 수준 선택 (직관적)
    >
    > **Post-MVP 고려**:
    > - 더블클릭으로 그룹 진입/탈출 (Figma 스타일)
    > - Shift+클릭으로 그룹 전체 선택
    > - AI에게 "그룹으로 선택해" 옵션 제공

## Tasks / Subtasks

- [ ] **Task 1: selection.json 구조 정의** (AC: 1, 3)
  - [ ] 1.1: selection.json 스키마 정의
  - [ ] 1.2: 구조: `{ selected_ids: string[], last_selected: string | null, timestamp: number }`
  - [ ] 1.3: 초기 빈 파일 생성

- [ ] **Task 2: Canvas 클릭 이벤트 핸들링** (AC: 1, 3)
  - [ ] 2.1: canvas.addEventListener('click', handler) 추가
  - [ ] 2.2: 클릭 좌표를 Canvas 좌표로 변환 (getBoundingClientRect)
  - [ ] 2.3: Y축 뒤집기 고려 (CAD 좌표계 vs Canvas 좌표계)

- [ ] **Task 3: Hit Test 알고리즘 구현** (AC: 4, 5, 6, 7)
  - [ ] 3.1: `hitTestCircle(click, entity) -> bool`
  - [ ] 3.2: `hitTestRect(click, entity) -> bool`
  - [ ] 3.3: `hitTestLine(click, entity, tolerance) -> bool`
  - [ ] 3.4: `hitTestArc(click, entity, tolerance) -> bool`
  - [ ] 3.5: tolerance 상수 정의 (기본 5px)

- [ ] **Task 4: Transform 고려 Hit Test** (AC: 8)
  - [ ] 4.1: 클릭 좌표를 엔티티 로컬 좌표로 변환
  - [ ] 4.2: 역변환 행렬 계산 (또는 단순 TRS 역변환)
  - [ ] 4.3: 계층 구조 고려 (월드 → 로컬)

- [ ] **Task 5: Z-order 기반 선택** (AC: 9)
  - [ ] 5.1: entities를 역순으로 순회 (나중 렌더링 = 위에 있음)
  - [ ] 5.2: 첫 번째 hit된 entity 반환

- [ ] **Task 6: selection.json 저장** (AC: 1, 3)
  - [ ] 6.1: 선택 시 selection.json 업데이트
  - [ ] 6.2: 빈 공간 클릭 시 선택 정보 비우기
  - [ ] 6.3: viewer/ 디렉토리에 저장

- [ ] **Task 7: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
  - [ ] 7.1: 수동 테스트 - Circle 클릭
  - [ ] 7.2: 수동 테스트 - Rect 클릭
  - [ ] 7.3: 수동 테스트 - Line 클릭 (tolerance 확인)
  - [ ] 7.4: 수동 테스트 - Arc 클릭
  - [ ] 7.5: 수동 테스트 - Transform 적용된 도형
  - [ ] 7.6: 수동 테스트 - 겹친 도형 z-order
  - [ ] 7.7: 수동 테스트 - 빈 공간 클릭 해제
  - [ ] 7.8: 성능 테스트 - 100ms 이내 반응

## Dev Notes

### Architecture Compliance

**Dual-Architecture Strategy 준수:**

| 모드 | 선택 상태 저장 | AI 전달 방식 |
|------|---------------|--------------|
| **Mode A** (CLI) | selection.json 파일 | Claude가 selection.json 폴링 |
| **Mode B** (App) | 메모리 상태 (selectedIds) | executor.getSelection() |

**Mode A (현재 구현 대상):**

- 브라우저 → Claude 방향 통신은 selection.json 파일 사용
- Claude가 selection.json을 폴링하여 선택 정보 인지
- 기존 scene.json 폴링과 동일한 패턴

**Mode B 최적화 (Epic 6 구현 시):**

- DirectExecutor.setSelection(ids)로 메모리에 저장
- Claude API 요청 시 executor.getSelection() 포함
- selection.json 불필요 (파일 I/O 제거)

**NFR15 준수:**

- 클릭 후 100ms 이내 시각적 피드백
- Mode A: selection.json 저장은 비동기로 처리 (UI 블로킹 없음)
- Mode B: 메모리 즉시 반영 (더 빠름)

### Technical Requirements

1. **selection.json 구조**:

   ```json
   {
     "selected_ids": ["entity_1", "entity_2"],
     "last_selected": "entity_2",
     "timestamp": 1703912345678
   }
   ```

2. **Hit Test 수학**:

   ```javascript
   // Circle: 거리 비교
   function hitTestCircle(click, circle) {
       const dx = click.x - circle.center[0];
       const dy = click.y - circle.center[1];
       return Math.sqrt(dx*dx + dy*dy) <= circle.radius;
   }

   // Rect: 범위 검사
   function hitTestRect(click, rect) {
       return click.x >= rect.origin[0] &&
              click.x <= rect.origin[0] + rect.width &&
              click.y >= rect.origin[1] &&
              click.y <= rect.origin[1] + rect.height;
   }

   // Line: 점과 선분 사이 거리
   function hitTestLine(click, line, tolerance = 5) {
       // 각 segment에 대해 점-선분 거리 계산
       for (let i = 0; i < line.points.length - 1; i++) {
           const dist = pointToSegmentDistance(click, line.points[i], line.points[i+1]);
           if (dist <= tolerance) return true;
       }
       return false;
   }
   ```

3. **좌표 변환 고려**:
   - Canvas는 Y축이 아래로 증가
   - CAD 좌표계는 Y축이 위로 증가 (수학적 좌표계)
   - viewer에서 이미 Y축 뒤집기 처리 중이면 일관성 유지

4. **Transform 역변환**:

   ```javascript
   function toLocalCoords(worldClick, entity) {
       // 1. translate 역변환
       let local = {
           x: worldClick.x - entity.transform.translate[0],
           y: worldClick.y - entity.transform.translate[1]
       };
       // 2. rotate 역변환 (pivot 기준)
       // 3. scale 역변환
       return local;
   }
   ```

### File Structure Notes

수정/생성 대상 파일:

- `viewer/renderer.js` - 클릭 이벤트 핸들링, hit test 로직
- `viewer/selection.json` - 선택 상태 저장 (새 파일)

### References

- [Source: docs/architecture.md#파일 폴링 아키텍처]
- [Source: docs/epics.md#Story 5.1: 도형 클릭 선택]
- [Source: docs/epics.md#Epic 5 Feasibility & Risk Analysis]

## Dev Agent Record

### Context Reference

- docs/architecture.md (파일 폴링 아키텍처)
- docs/epics.md (Epic 5, Story 5.1)
- viewer/renderer.js (기존 렌더러)

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
