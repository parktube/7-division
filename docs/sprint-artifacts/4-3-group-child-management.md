# Story 4.3: Group 자식 관리

Status: drafted

## Story

As a **AI 에이전트 (Claude Code)**,
I want **그룹에 자식을 추가하거나 제거할 수 있도록**,
so that **그룹 구성을 동적으로 변경할 수 있다**.

## Acceptance Criteria

1. **AC1: 그룹에 자식 추가**
   - Given: Scene에 Group "left_arm"과 독립 Entity "wrist"가 존재
   - When: `scene.add_to_group("left_arm", "wrist")` 호출
   - Then: "wrist" Entity의 parent_id가 "left_arm"으로 설정된다
   - And: "left_arm" 그룹의 children에 "wrist"가 추가된다
   - And: Ok(true) 반환

2. **AC2: 그룹에서 자식 제거**
   - Given: Group "left_arm"에 자식 "hand"가 존재
   - When: `scene.remove_from_group("left_arm", "hand")` 호출
   - Then: "hand" Entity의 parent_id가 None으로 설정된다
   - And: "left_arm" 그룹의 children에서 "hand"가 제거된다
   - And: "hand"는 Scene에 독립 엔티티로 유지된다
   - And: Ok(true) 반환

3. **AC3: 다른 그룹에 속한 엔티티 이동**
   - Given: "hand"가 "forearm" 그룹에 속해 있는 상태
   - When: `scene.add_to_group("left_arm", "hand")` 호출
   - Then: "hand"가 "forearm" 그룹에서 제거된다
   - And: "hand"가 "left_arm" 그룹의 자식으로 추가된다
   - And: 기존 그룹의 children 목록도 업데이트된다

4. **AC4: 존재하지 않는 그룹에 추가 시도**
   - Given: Scene에 "invalid_group"이 존재하지 않음
   - When: `scene.add_to_group("invalid_group", "entity")` 호출
   - Then: 에러 반환: `[add_to_group] group_not_found: Group 'invalid_group' not found`

5. **AC5: 존재하지 않는 엔티티 추가 시도**
   - Given: Scene에 "invalid_entity"가 존재하지 않음
   - When: `scene.add_to_group("left_arm", "invalid_entity")` 호출
   - Then: Ok(false) 반환 (관대한 입력 보정 - 무시)

6. **AC6: 그룹이 아닌 Entity에 자식 추가 시도**
   - Given: Scene에 Line 타입의 Entity "my_line"이 존재
   - When: `scene.add_to_group("my_line", "some_entity")` 호출
   - Then: 에러 반환: `[add_to_group] not_a_group: Entity 'my_line' is not a Group`

7. **AC7: 그룹에 없는 엔티티 제거 시도**
   - Given: "wrist"가 "left_arm" 그룹에 속해 있지 않음
   - When: `scene.remove_from_group("left_arm", "wrist")` 호출
   - Then: Ok(false) 반환 (이미 없는 상태, 무시)

8. **AC8: 순환 참조 방지**
   - Given: "parent_group"이 존재하고 "child_group"이 그 자식인 상태
   - When: `scene.add_to_group("child_group", "parent_group")` 호출
   - Then: 에러 반환: `[add_to_group] circular_reference: Cannot add ancestor 'parent_group' as child`

9. **AC9: export_json 반영**
   - Given: 그룹 자식 관리 후 상태
   - When: export_json() 호출
   - Then: JSON에서 parent_id와 children이 올바르게 반영된다

## Tasks / Subtasks

- [ ] **Task 1: add_to_group 함수 구현** (AC: 1, 3, 4, 5, 6, 8)
  - [ ] 1.1: `add_to_group(group_name: &str, child_name: &str) -> Result<bool, JsValue>` 시그니처
  - [ ] 1.2: group_name으로 Entity 조회 및 Group 타입 검증
  - [ ] 1.3: child_name으로 Entity 조회 (없으면 Ok(false))
  - [ ] 1.4: 순환 참조 검사 (자식이 조상인지 확인)
  - [ ] 1.5: 기존 parent_id가 있으면 기존 그룹에서 제거
  - [ ] 1.6: 자식의 parent_id를 그룹 ID로 설정
  - [ ] 1.7: 그룹의 children에 자식 추가
  - [ ] 1.8: Ok(true) 반환

- [ ] **Task 2: remove_from_group 함수 구현** (AC: 2, 7)
  - [ ] 2.1: `remove_from_group(group_name: &str, child_name: &str) -> Result<bool, JsValue>` 시그니처
  - [ ] 2.2: group_name으로 Entity 조회 및 Group 타입 검증
  - [ ] 2.3: 그룹의 children에 child_name이 없으면 Ok(false)
  - [ ] 2.4: 자식의 parent_id를 None으로 설정
  - [ ] 2.5: 그룹의 children에서 자식 제거
  - [ ] 2.6: Ok(true) 반환

- [ ] **Task 3: 순환 참조 검사 헬퍼** (AC: 8)
  - [ ] 3.1: `is_ancestor(entity_id, potential_ancestor_id) -> bool` 헬퍼 함수
  - [ ] 3.2: parent_id 체인을 따라 조상 확인
  - [ ] 3.3: 무한 루프 방지 (최대 깊이 제한 또는 visited 집합)

- [ ] **Task 4: WASM 바인딩** (AC: 1, 2)
  - [ ] 4.1: `#[wasm_bindgen]` 매크로로 add_to_group 노출
  - [ ] 4.2: `#[wasm_bindgen]` 매크로로 remove_from_group 노출

- [ ] **Task 5: CLI 통합** (AC: 1, 2)
  - [ ] 5.1: cad-cli.ts에 `add_to_group` 명령어 추가
  - [ ] 5.2: cad-cli.ts에 `remove_from_group` 명령어 추가
  - [ ] 5.3: JSON 파라미터 파싱: `'{\"group\":\"left_arm\",\"child\":\"wrist\"}'`

- [ ] **Task 6: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9)
  - [ ] 6.1: Rust 단위 테스트 - 기본 자식 추가
  - [ ] 6.2: Rust 단위 테스트 - 기본 자식 제거
  - [ ] 6.3: Rust 단위 테스트 - 다른 그룹에서 이동
  - [ ] 6.4: Rust 단위 테스트 - 존재하지 않는 그룹
  - [ ] 6.5: Rust 단위 테스트 - 존재하지 않는 엔티티
  - [ ] 6.6: Rust 단위 테스트 - 그룹이 아닌 Entity
  - [ ] 6.7: Rust 단위 테스트 - 그룹에 없는 엔티티 제거
  - [ ] 6.8: Rust 단위 테스트 - 순환 참조 방지
  - [ ] 6.9: Rust 단위 테스트 - export_json 반영
  - [ ] 6.10: WASM 빌드 및 Node.js 통합 테스트

## Dev Notes

### Architecture Compliance

**ADR-MVP-001 준수사항:**
- add_to_group: 그룹에 자식 추가
- remove_from_group: 그룹에서 자식 제거
- 이미 다른 그룹에 속한 엔티티는 기존 그룹에서 제거 후 추가

**NFR14 (그룹 중첩 지원) 준수:**
- 그룹 안에 그룹을 추가할 수 있어야 함
- 순환 참조만 방지하면 됨

### Technical Requirements

1. **자식 이동 시 기존 그룹 업데이트**:
   - 자식의 기존 parent_id 확인
   - 기존 부모 그룹의 children에서 제거
   - 새 그룹의 children에 추가
   - 자식의 parent_id 업데이트

2. **순환 참조 검사 알고리즘**:
   ```rust
   fn is_ancestor(&self, entity_id: &str, potential_ancestor_id: &str) -> bool {
       let mut current = Some(entity_id.to_string());
       while let Some(id) = current {
           if id == potential_ancestor_id {
               return true;
           }
           current = self.get_entity(&id)
               .and_then(|e| e.parent_id.clone());
       }
       false
   }
   ```

3. **에러 메시지 형식**:
   ```
   [add_to_group] group_not_found: Group 'group_name' not found
   [add_to_group] not_a_group: Entity 'entity_name' is not a Group
   [add_to_group] circular_reference: Cannot add ancestor 'entity_name' as child
   [remove_from_group] group_not_found: Group 'group_name' not found
   [remove_from_group] not_a_group: Entity 'entity_name' is not a Group
   ```

4. **관대한 입력 보정**:
   - 존재하지 않는 child_name → Ok(false) (에러 아님)
   - 이미 없는 엔티티 제거 시도 → Ok(false) (에러 아님)

### File Structure Notes

수정 대상 파일:
- `cad-engine/src/scene/mod.rs` - add_to_group, remove_from_group 함수 추가
- `cad-tools/cad-cli.ts` - CLI 명령어 추가

의존 파일 (Story 4-1에서 수정됨):
- `cad-engine/src/scene/entity.rs` - Entity에 parent_id, children, EntityType::Group

### References

- [Source: docs/architecture.md#ADR-MVP-001: Group System 설계]
- [Source: docs/epics.md#Story 4.3: Group 자식 관리]
- [Source: docs/sprint-artifacts/4-1-group-creation.md - 선행 스토리]
- [Source: docs/sprint-artifacts/4-2-group-ungroup.md - 관련 스토리]

## Dev Agent Record

### Context Reference

- docs/architecture.md (ADR-MVP-001)
- docs/epics.md (Epic 4, Story 4.3)
- docs/sprint-artifacts/4-1-group-creation.md
- docs/sprint-artifacts/4-2-group-ungroup.md

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
