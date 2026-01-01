# Story 4.2: Group 해제 기능

Status: done

## Story

As a **AI 에이전트 (Claude Code)**,
I want **그룹을 해제하여 자식들을 독립 엔티티로 만들 수 있도록**,
so that **그룹 구조를 유연하게 변경할 수 있다**.

## Acceptance Criteria

1. **AC1: 기본 그룹 해제**
   - Given: Scene에 Group Entity "left_arm"이 존재하고 자식들 ["upper_arm", "lower_arm", "hand"]이 있음
   - When: `scene.ungroup("left_arm")` 호출
   - Then: "left_arm" 그룹 Entity가 Scene에서 삭제된다
   - And: 자식 Entity들의 parent_id가 None으로 설정된다
   - And: 자식들은 Scene에 독립 엔티티로 유지된다
   - And: Ok(true) 반환

2. **AC2: 존재하지 않는 그룹 ID 처리**
   - Given: Scene에 존재하지 않는 그룹 ID
   - When: `scene.ungroup("invalid_group")` 호출
   - Then: Ok(false) 반환하고 무시된다
   - And: 기존 Entity들은 영향받지 않는다

3. **AC3: 그룹이 아닌 Entity에 ungroup 호출**
   - Given: Scene에 Line 타입의 Entity "my_line"이 존재
   - When: `scene.ungroup("my_line")` 호출
   - Then: 에러 반환: `[ungroup] not_a_group: Entity 'my_line' is not a Group`

4. **AC4: 중첩 그룹 해제 (부모 그룹만 해제)**
   - Given: "arm_group" 안에 "forearm_subgroup"이 자식으로 존재
   - When: `scene.ungroup("arm_group")` 호출
   - Then: "arm_group"만 삭제된다
   - And: "forearm_subgroup"은 독립 엔티티가 된다 (parent_id = None)
   - And: "forearm_subgroup"의 자식들은 여전히 "forearm_subgroup"에 속함

5. **AC5: 자식 없는 빈 그룹 해제**
   - Given: 자식이 없는 빈 그룹 "empty_group"이 존재
   - When: `scene.ungroup("empty_group")` 호출
   - Then: "empty_group" 그룹이 삭제된다
   - And: Ok(true) 반환

6. **AC6: 월드 변환 유지 (Optional - MVP Stretch)**
   - Given: 그룹에 translate(100, 50)이 적용된 상태
   - When: ungroup 호출
   - Then: 자식들의 로컬 변환에 부모의 변환이 합성되어 월드 위치 유지
   - Note: MVP에서는 선택적 구현 (구현하지 않으면 자식들은 로컬 좌표 유지)

   > ⚠️ **MVP 제약 및 UX 영향**:
   > - 월드 변환 유지 미구현 시: ungroup 호출하면 자식들이 화면에서 **원래 위치에서 "점프"**할 수 있음
   > - 예: 그룹이 (100, 50) 이동된 상태에서 ungroup → 자식들은 (0, 0) 기준으로 돌아감
   > - **MVP 권장 대응**: 사용자에게 "그룹 해제 시 도형 위치가 변경될 수 있습니다" 안내
   > - **Post-MVP**: 월드 변환 자동 합성 구현

7. **AC7: export_json 반영**
   - Given: ungroup 후 상태
   - When: export_json() 호출
   - Then: JSON에서 해제된 그룹이 제거되어 있다
   - And: 자식 Entity들의 parent_id가 null로 직렬화된다

## Tasks / Subtasks

- [x] **Task 1: ungroup 함수 구현** (AC: 1, 2, 3, 5)
  - [x] 1.1: `ungroup(name: &str) -> Result<bool, JsValue>` 시그니처
  - [x] 1.2: name으로 Entity 조회 (has_entity 로직 재사용)
  - [x] 1.3: Entity가 존재하지 않으면 Ok(false) 반환
  - [x] 1.4: Entity가 Group 타입이 아니면 에러 반환
  - [x] 1.5: 그룹의 children 순회하여 각 자식의 parent_id를 None으로 설정
  - [x] 1.6: 그룹 Entity를 Scene.entities에서 제거 (remove_entity 로직)
  - [x] 1.7: Ok(true) 반환

- [x] **Task 2: 중첩 그룹 처리** (AC: 4)
  - [x] 2.1: 직접 자식만 parent_id 해제 (재귀 없음)
  - [x] 2.2: 자식 그룹의 구조는 그대로 유지 확인

- [x] **Task 3: 월드 변환 유지 (Optional)** (AC: 6)
  - [x] 3.1: get_world_transform 함수 구현 (부모 변환 합성)
  - [x] 3.2: ungroup 시 자식에 월드 변환 적용 옵션
  - Note: MVP Stretch Goal - 시간 부족 시 스킵 가능

- [x] **Task 4: WASM 바인딩** (AC: 1, 2)
  - [x] 4.1: `#[wasm_bindgen]` 매크로로 ungroup 노출
  - [x] 4.2: name 파라미터는 `&str`로 직접 받기

- [x] **Task 5: CLI 통합** (AC: 1, 2)
  - [x] 5.1: cad-cli.ts에 `ungroup` 명령어 추가
  - [x] 5.2: JSON 파라미터 파싱: `'{\"name\":\"left_arm\"}'`

- [x] **Task 6: 테스트** (AC: 1, 2, 3, 4, 5, 7)
  - [x] 6.1: Rust 단위 테스트 - 기본 그룹 해제
  - [x] 6.2: Rust 단위 테스트 - 존재하지 않는 그룹 ID
  - [x] 6.3: Rust 단위 테스트 - 그룹이 아닌 Entity에 호출
  - [x] 6.4: Rust 단위 테스트 - 중첩 그룹 해제
  - [x] 6.5: Rust 단위 테스트 - 빈 그룹 해제
  - [x] 6.6: Rust 단위 테스트 - export_json 반영 확인
  - [x] 6.7: WASM 빌드 및 Node.js 통합 테스트

## Dev Notes

### Architecture Compliance

**ADR-MVP-001 준수사항:**

- ungroup은 그룹만 삭제, 자식들은 독립 엔티티로 유지
- parent_id를 None으로 설정하여 계층 관계 해제
- 자식 그룹이 있을 경우 그 하위 구조는 유지

**Story 4-1과의 관계:**

- Story 4-1에서 추가한 `parent_id`, `children` 필드 활용
- EntityType::Group 타입 검사 필요
- 그룹 삭제는 기존 delete 로직과 유사하나 자식 처리가 다름

### Technical Requirements

1. **그룹 해제 순서**:
   - Step 1: 그룹 Entity의 children 목록 복사
   - Step 2: 각 자식의 parent_id를 None으로 설정
   - Step 3: 그룹 Entity 삭제
   - Note: 순서 중요 - 자식 해제 후 그룹 삭제

2. **월드 변환 유지 (Stretch)**:
   - 복잡도: 부모 Transform을 자식에 합성해야 함
   - 옵션: `ungroup(name, preserve_world_transform: bool)` 파라미터 추가
   - MVP 권장: 월드 변환 유지 없이 단순 해제 먼저 구현

3. **에러 메시지 형식**:

   ```
   [ungroup] not_a_group: Entity 'entity_name' is not a Group
   [ungroup] not_found: Entity 'entity_name' not found
   ```

### File Structure Notes

수정 대상 파일:

- `cad-engine/src/scene/mod.rs` - ungroup 함수 추가
- `cad-tools/cad-cli.ts` - CLI 명령어 추가

의존 파일 (Story 4-1에서 수정됨):

- `cad-engine/src/scene/entity.rs` - Entity에 parent_id, children, EntityType::Group

### References

- [Source: docs/architecture.md#ADR-MVP-001: Group System 설계]
- [Source: docs/epics.md#Story 4.2: Group 해제 기능]
- [Source: docs/sprint-artifacts/4-1-group-creation.md - 선행 스토리]

## Dev Agent Record

### Context Reference

- docs/architecture.md (ADR-MVP-001)
- docs/epics.md (Epic 4, Story 4.2)
- docs/sprint-artifacts/4-1-group-creation.md

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
