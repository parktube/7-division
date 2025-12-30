# Story 4.1: Group 생성 기능

Status: ready-for-dev

## Story

As a **AI 에이전트 (Claude Code)**,
I want **여러 도형을 그룹으로 묶을 수 있도록**,
so that **팔, 다리 등의 신체 부위를 하나의 단위로 관리할 수 있다**.

## Acceptance Criteria

1. **AC1: 기본 그룹 생성**
   - Given: Scene에 여러 Entity가 존재 (예: "upper_arm", "lower_arm", "hand")
   - When: `scene.create_group("left_arm", ["upper_arm", "lower_arm", "hand"])` 호출
   - Then: Group 타입의 Entity가 생성된다
   - And: 지정된 자식 Entity들의 parent_id가 그룹 ID로 설정된다
   - And: name ("left_arm")이 반환된다

2. **AC2: 존재하지 않는 자식 처리 (관대한 입력 보정)**
   - Given: children 배열에 존재하지 않는 ID가 포함된 경우
   - When: create_group 호출
   - Then: 존재하는 자식들만 그룹에 추가된다
   - And: 에러 없이 정상 생성된다

3. **AC3: 빈 children 배열**
   - Given: children이 빈 배열인 경우
   - When: create_group 호출
   - Then: 자식이 없는 빈 그룹이 생성된다

4. **AC4: 중복 name 방지**
   - Given: Scene에 이미 "left_arm" Entity가 존재
   - When: create_group("left_arm", [...]) 호출
   - Then: 에러 반환: `[create_group] duplicate_name: Entity 'left_arm' already exists`

5. **AC5: 그룹 중첩 지원 (NFR14)**
   - Given: 기존 그룹 "forearm"이 존재
   - When: create_group("left_arm", ["shoulder", "forearm"]) 호출
   - Then: forearm 그룹이 left_arm의 자식으로 설정된다
   - And: forearm의 parent_id가 left_arm의 ID로 변경된다

6. **AC6: export_json 포함**
   - Given: 그룹이 생성된 상태
   - When: export_json() 호출
   - Then: JSON에 Group Entity가 포함된다
   - And: parent_id, children 필드가 올바르게 직렬화된다

## Tasks / Subtasks

- [ ] **Task 1: Entity 구조 확장** (AC: 1, 5, 6)
  - [ ] 1.1: EntityType enum에 `Group` 추가
  - [ ] 1.2: Entity struct에 `parent_id: Option<String>` 필드 추가
  - [ ] 1.3: Entity struct에 `children: Vec<String>` 필드 추가
  - [ ] 1.4: Default 구현에서 parent_id=None, children=vec![] 설정
  - [ ] 1.5: Serde 직렬화 테스트 (JSON 출력 확인)

- [ ] **Task 2: create_group 함수 구현** (AC: 1, 2, 3, 4, 5)
  - [ ] 2.1: `create_group(name: &str, children: Vec<String>) -> Result<String, JsValue>` 시그니처
  - [ ] 2.2: name 중복 검사 (기존 has_entity 로직 재사용)
  - [ ] 2.3: children에서 존재하는 Entity만 필터링
  - [ ] 2.4: Group Entity 생성 (EntityType::Group, geometry는 Empty 또는 None)
  - [ ] 2.5: 각 자식의 parent_id를 그룹 ID로 설정
  - [ ] 2.6: 자식이 이미 다른 그룹에 속한 경우 처리 (AC5 그룹 중첩/이동)
    - [ ] 2.6.1: 자식 Entity의 기존 parent_id 확인
    - [ ] 2.6.2: 기존 부모가 있으면 기존 부모의 children 배열에서 해당 자식 제거
    - [ ] 2.6.3: 자식의 parent_id를 새 그룹으로 업데이트
    - [ ] 2.6.4: 자식이 그룹인 경우 자식의 children은 유지 (계층 구조 보존)
      - 예: forearm이 원래 elbow, wrist를 자식으로 가진 경우
      - forearm이 left_arm의 자식이 되어도 elbow, wrist는 여전히 forearm의 자식
  - [ ] 2.7: Scene.entities에 그룹 추가

- [ ] **Task 3: Geometry 확장** (AC: 1)
  - [ ] 3.1: Geometry enum에 `Empty` 또는 `Group` variant 추가 (그룹은 geometry 없음)

- [ ] **Task 4: WASM 바인딩** (AC: 1, 2)
  - [ ] 4.1: `#[wasm_bindgen]` 매크로로 create_group 노출
  - [ ] 4.2: children 파라미터는 `js_sys::Array` 또는 JSON 문자열로 받기

- [ ] **Task 5: CLI 통합** (AC: 1, 2)
  - [ ] 5.1: cad-cli.ts에 `create_group` 명령어 추가
  - [ ] 5.2: JSON 파라미터 파싱: `'{"name":"left_arm","children":["a","b"]}'`

- [ ] **Task 6: 테스트** (AC: 1, 2, 3, 4, 5, 6)
  - [ ] 6.1: Rust 단위 테스트 - 기본 그룹 생성
  - [ ] 6.2: Rust 단위 테스트 - 존재하지 않는 자식 처리
  - [ ] 6.3: Rust 단위 테스트 - 빈 children
  - [ ] 6.4: Rust 단위 테스트 - 중복 name 에러
  - [ ] 6.5: Rust 단위 테스트 - 그룹 중첩
  - [ ] 6.6: WASM 빌드 및 Node.js 통합 테스트

## Dev Notes

### Architecture Compliance

**ADR-MVP-001 준수사항:**

- EntityType에 Group 추가
- Entity에 parent_id, children 필드 추가
- create_group API는 name + children[] 받음

**현재 Entity 구조** (`cad-engine/src/scene/entity.rs`):

```rust
pub struct Entity {
    pub id: String,
    pub entity_type: EntityType,
    pub geometry: Geometry,
    pub transform: Transform,
    pub style: Style,
    pub metadata: Metadata,
    // 추가 필요:
    // pub parent_id: Option<String>,
    // pub children: Vec<String>,
}
```

### Technical Requirements

1. **Geometry 처리**: Group은 자체 geometry가 없음
   - Option 1: `Geometry::Empty` variant 추가
   - Option 2: `geometry: Option<Geometry>` 변경 (breaking change)
   - **권장**: Option 1 (하위 호환성)

2. **자식 참조 방식**: ID 기반 참조 (String)
   - 장점: 순환 참조 방지, Serde 직렬화 용이
   - 단점: 매번 lookup 필요 (성능은 MVP에서 문제 없음)

3. **parent_id 설정 타이밍**:
   - create_group 시 자식들의 parent_id 즉시 설정
   - 기존 parent_id가 있으면 기존 그룹에서 제거 (이동)

### File Structure Notes

수정 대상 파일:

- `cad-engine/src/scene/entity.rs` - Entity, EntityType, Geometry 확장
- `cad-engine/src/scene/mod.rs` - create_group 함수 추가
- `cad-tools/cad-cli.ts` - CLI 명령어 추가

### References

- [Source: docs/architecture.md#ADR-MVP-001: Group System 설계]
- [Source: docs/epics.md#Story 4.1: Group 생성 기능]
- [Source: cad-engine/src/scene/entity.rs - 현재 Entity 구조]

## Dev Agent Record

### Context Reference

- docs/architecture.md (ADR-MVP-001)
- docs/epics.md (Epic 4, Story 4.1)

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
