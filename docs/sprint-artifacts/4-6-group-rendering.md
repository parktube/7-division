# Story 4.6: 그룹화된 도형 렌더링

Status: done

## Story

As a **사용자 (인간)**,
I want **그룹화된 도형들이 올바르게 렌더링되도록**,
so that **그룹 변환이 적용된 결과를 확인할 수 있다**.

## Acceptance Criteria

1. **AC1: 기본 그룹 렌더링**
   - Given: "arm_group"에 "upper_arm", "lower_arm" Entity가 자식으로 존재
   - When: Canvas 렌더링 실행
   - Then: 모든 자식 Entity들이 화면에 렌더링된다
   - And: 그룹 자체는 보이지 않음 (geometry 없음)

2. **AC2: 그룹 변환이 적용된 렌더링**
   - Given: "arm_group"에 translate(100, 50)이 적용된 상태
   - When: Canvas 렌더링 실행
   - Then: 모든 자식들이 (100, 50)만큼 이동한 위치에 렌더링된다

3. **AC3: 중첩 그룹 렌더링**
   - Given: "body" 그룹 안에 "arm" 그룹이 자식으로 존재
   - And: "body"에 rotate(30), "arm"에 translate(50, 0)이 적용
   - When: Canvas 렌더링 실행
   - Then: "arm" 내 Entity들이 부모 변환들이 합성된 위치에 렌더링된다

4. **AC4: Pivot 기준 회전 렌더링**
   - Given: Entity에 pivot(0, 50), rotate(45)가 설정된 상태
   - When: Canvas 렌더링 실행
   - Then: 도형이 (0, 50) 위치를 중심으로 45도 회전되어 표시된다

5. **AC5: 스타일 유지 렌더링**
   - Given: 그룹 내 자식들에 각각 다른 stroke/fill 스타일이 적용
   - When: Canvas 렌더링 실행
   - Then: 각 Entity의 스타일이 변환과 독립적으로 올바르게 적용된다

6. **AC6: SVG Export에서 그룹 변환 적용**
   - Given: 그룹 구조와 변환이 적용된 Scene
   - When: export_svg() 호출
   - Then: SVG에서 `<g transform="...">` 태그로 그룹 구조가 표현된다
   - And: 계층적 변환이 올바르게 적용된다

7. **AC7: 렌더링 순서 (z-order)**
   - Given: Scene의 entities 순서대로 Entity가 존재
   - When: Canvas 렌더링 실행
   - Then: 먼저 정의된 Entity가 먼저 렌더링된다 (나중 Entity가 위에 표시)
   - And: 그룹 내에서는 children 순서대로 렌더링

8. **AC8: JSON 기반 렌더링 (파일 폴링 아키텍처)**
   - Given: scene.json이 그룹 구조를 포함
   - When: viewer가 scene.json을 polling하여 로드
   - Then: JSON에서 parent_id, children을 파싱하여 계층 구조 재구성
   - And: 올바른 변환으로 렌더링

## Tasks / Subtasks

- [x] **Task 1: Viewer 계층 구조 파싱** (AC: 8)
  - [x] 1.1: scene.json 로드 후 parent_id, children 필드 파싱
  - [x] 1.2: root 레벨 Entity 식별 (parent_id가 null 또는 undefined인 Entity)
  - [x] 1.3: Entity 조회 맵 구성 (`Map<string, Entity>` - id → Entity 매핑)
  - [x] 1.4: parent_id 유효성 검증 (존재하지 않는 parent 참조 시 root로 처리)

- [x] **Task 2: 재귀적 렌더링 함수** (AC: 1, 2, 3, 7)
  - [x] 2.1: `renderEntity(entity, ctx)` 재귀 함수 구현
  - [x] 2.2: ctx.save() / ctx.restore()로 변환 상태 관리
  - [x] 2.3: 로컬 변환 적용 후 geometry 렌더링
  - [x] 2.4: children 순회하며 재귀 호출

- [x] **Task 3: Pivot 기준 회전 구현** (AC: 4)
  - [x] 3.1: pivot 값 읽기 (기본값 [0, 0])
  - [x] 3.2: Canvas 변환 순서: translate(pivot) → rotate → translate(-pivot)
  - [x] 3.3: 테스트 케이스로 검증

- [x] **Task 4: 스타일 적용 유지** (AC: 5)
  - [x] 4.1: 기존 스타일 렌더링 로직 유지
  - [x] 4.2: 변환 후에도 strokeWidth가 올바르게 적용되는지 확인
  - [x] 4.3: Note: Canvas scale 시 strokeWidth도 스케일됨 (의도된 동작)

- [x] **Task 5: Group Entity 스킵** (AC: 1)
  - [x] 5.1: EntityType이 Group인 경우 geometry 렌더링 스킵
  - [x] 5.2: 변환만 적용하고 자식들만 렌더링

- [x] **Task 6: SVG Export 그룹 지원** (AC: 6)
  - [x] 6.1: export_svg()에서 그룹 구조 파싱
  - [x] 6.2: `<g>` 태그로 그룹 표현
  - [x] 6.3: transform 속성에 translate, rotate, scale 적용
  - [x] 6.4: pivot은 rotate 변환에 반영

- [x] **Task 7: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] 7.1: 시각적 테스트 - 기본 그룹 렌더링
  - [x] 7.2: 시각적 테스트 - 그룹 translate 적용
  - [x] 7.3: 시각적 테스트 - 중첩 그룹 변환
  - [x] 7.4: 시각적 테스트 - pivot 회전
  - [x] 7.5: 시각적 테스트 - 스타일 유지
  - [x] 7.6: SVG Export 결과 검증
  - [x] 7.7: E2E 테스트 - JSON 폴링 후 렌더링

## Dev Notes

### Architecture Compliance

**Dual-Architecture Strategy 준수:**

| 모드 | 데이터 소스 | 렌더링 흐름 |
|------|------------|-------------|
| **Mode A** (CLI) | scene.json 폴링 | JSON 파싱 → 계층 구조 재구성 → Canvas |
| **Mode B** (App) | WASM 메모리 직접 | executor.getScene() → Canvas |

**Mode A (현재 구현 대상):**

- viewer는 scene.json을 500ms 폴링
- JSON에서 parent_id, children을 파싱하여 계층 구조 재구성
- 별도의 IPC 없이 기존 아키텍처 그대로 사용

**Mode B 최적화 (Epic 6 구현 시):**

- DirectExecutor.getScene()에서 WASM 메모리 직접 읽기
- 파일 I/O 없이 즉각적인 렌더링
- 렌더링 로직 자체는 Mode A와 동일 (재사용 가능)

**Story 4-5와의 관계:**

- Story 4-5에서 get_world_transform 함수 제공
- 이 스토리에서는 렌더러가 계층 변환을 직접 계산 (Canvas 변환 스택 활용)

### Technical Requirements

1. **scene.json 구조 (그룹 포함)**:

   ```json
   {
     "entities": [
       {
         "id": "arm_group",
         "entity_type": "Group",
         "geometry": { "Empty": null },
         "transform": { "translate": [100, 0], "rotate": 0, "scale": [1, 1], "pivot": [0, 0] },
         "parent_id": null,
         "children": ["upper_arm", "lower_arm"]
       },
       {
         "id": "upper_arm",
         "entity_type": "Line",
         "geometry": { "Line": { "points": [[0, 0], [50, 0]] } },
         "transform": { ... },
         "parent_id": "arm_group",
         "children": []
       }
     ]
   }
   ```

2. **렌더링 알고리즘**:

   ```javascript
   function renderScene(scene) {
       const entityMap = buildEntityMap(scene.entities);
       const rootEntities = scene.entities.filter(e => !e.parent_id);

       for (const entity of rootEntities) {
           renderEntityRecursive(entity, entityMap, ctx);
       }
   }

   function renderEntityRecursive(entity, entityMap, ctx) {
       ctx.save();

       // 로컬 변환 적용
       applyTransform(entity.transform, ctx);

       // Geometry 렌더링 (Group이 아닌 경우)
       if (entity.entity_type !== 'Group') {
           renderGeometry(entity, ctx);
       }

       // 자식들 재귀 렌더링
       for (const childId of entity.children || []) {
           const child = entityMap.get(childId);
           if (child) {
               renderEntityRecursive(child, entityMap, ctx);
           }
       }

       ctx.restore();
   }

   function applyTransform(transform, ctx) {
       const { translate, rotate, scale, pivot } = transform;

       ctx.translate(translate[0], translate[1]);

       // Pivot 기준 회전
       ctx.translate(pivot[0], pivot[1]);
       ctx.rotate(rotate); // 라디안
       ctx.translate(-pivot[0], -pivot[1]);

       ctx.scale(scale[0], scale[1]);
   }
   ```

3. **SVG 그룹 구조**:

   ```xml
   <g id="arm_group" transform="translate(100, 0)">
     <line id="upper_arm" x1="0" y1="0" x2="50" y2="0" .../>
     <line id="lower_arm" .../>
   </g>
   ```

4. **성능 고려**:
   - Entity 수가 적은 MVP에서는 재귀 렌더링 성능 문제 없음
   - 그룹 깊이 제한 (최대 10레벨 등) 고려 가능

### File Structure Notes

수정 대상 파일:

- `viewer/renderer.js` - 계층적 렌더링 로직 추가
- `cad-engine/src/serializers/svg.rs` - SVG Export 그룹 지원

의존 파일:

- `cad-engine/src/scene/entity.rs` - EntityType::Group, parent_id, children
- `cad-engine/src/scene/mod.rs` - export_json (그룹 구조 포함)

### References

- [Source: docs/architecture.md#파일 폴링 아키텍처]
- [Source: docs/epics.md#Story 4.6: 그룹화된 도형 렌더링]
- [Source: docs/sprint-artifacts/4-5-hierarchy-transform.md - 계층 변환 로직]
- [Source: docs/sprint-artifacts/4-4-pivot-setting.md - Pivot 구조]

## Dev Agent Record

### Context Reference

- docs/architecture.md (파일 폴링 아키텍처)
- docs/epics.md (Epic 4, Story 4.6)
- docs/sprint-artifacts/4-5-hierarchy-transform.md
- viewer/renderer.js (기존 렌더러)

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
