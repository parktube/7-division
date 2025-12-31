# Story 4.4: Pivot 설정 기능

Status: done

## Story

As a **AI 에이전트 (Claude Code)**,
I want **도형/그룹의 회전 중심점을 설정할 수 있도록**,
so that **팔꿈치 위치를 기준으로 팔을 구부릴 수 있다**.

## Acceptance Criteria

1. **AC1: 기본 Pivot 설정**
   - Given: Scene에 Entity "lower_arm"이 존재
   - When: `scene.set_pivot("lower_arm", 0, 50)` 호출
   - Then: "lower_arm" Entity의 pivot이 (0, 50)으로 설정된다
   - And: Ok(true) 반환

2. **AC2: Pivot 기준 회전**
   - Given: Entity에 pivot (0, 50)이 설정된 상태
   - When: `scene.rotate("lower_arm", 45)` 호출
   - Then: 도형이 (0, 50) 위치를 기준으로 45도 회전된다
   - And: pivot 위치는 변환 후에도 동일한 월드 좌표에 유지된다

3. **AC3: 기본 Pivot 값**
   - Given: 새로 생성된 Entity
   - When: pivot 값 확인
   - Then: 기본값 [0, 0] (엔티티 로컬 원점)

4. **AC4: Pivot 초기화**
   - Given: pivot이 (10, 20)으로 설정된 Entity
   - When: `scene.set_pivot("entity", 0, 0)` 호출
   - Then: pivot이 기본값 (0, 0)으로 초기화된다

5. **AC5: 존재하지 않는 Entity에 Pivot 설정**
   - Given: Scene에 존재하지 않는 Entity ID
   - When: `scene.set_pivot("invalid_id", 10, 20)` 호출
   - Then: Ok(false) 반환하고 무시된다

6. **AC6: 그룹에 Pivot 설정**
   - Given: Scene에 Group "left_arm"이 존재
   - When: `scene.set_pivot("left_arm", 0, 100)` 호출
   - Then: 그룹의 pivot이 (0, 100)으로 설정된다
   - And: 그룹 회전 시 해당 pivot을 기준으로 모든 자식들이 회전된다

7. **AC7: export_json 반영**
   - Given: pivot이 설정된 Entity
   - When: export_json() 호출
   - Then: JSON의 transform에 pivot 필드가 포함된다
   - And: pivot 값이 올바르게 직렬화된다

8. **AC8: get_pivot 조회**
   - Given: pivot이 (10, 30)으로 설정된 Entity
   - When: `scene.get_entity("entity")` 호출
   - Then: 반환된 Entity 정보에 pivot 값이 포함된다

## Tasks / Subtasks

- [x] **Task 1: Transform 구조 확장** (AC: 3, 7)
  - [x] 1.1: Transform struct에 `pivot: [f64; 2]` 필드 추가
  - [x] 1.2: Transform::default()에서 pivot = [0.0, 0.0] 설정
  - [x] 1.3: Serde 직렬화 테스트 (JSON 출력 확인)

- [x] **Task 2: set_pivot 함수 구현** (AC: 1, 4, 5, 6)
  - [x] 2.1: `set_pivot(name: &str, px: f64, py: f64) -> Result<bool, JsValue>` 시그니처
  - [x] 2.2: name으로 Entity 조회 (없으면 Ok(false))
  - [x] 2.3: Entity의 transform.pivot 업데이트
  - [x] 2.4: Ok(true) 반환

- [x] **Task 3: rotate 함수 수정 (Pivot 적용)** (AC: 2)
  - [x] 3.1: 기존 rotate 함수에서 pivot 고려
  - [x] 3.2: 회전 변환 시 pivot 오프셋 적용
  - [x] 3.3: Note: 실제 변환은 렌더러에서 수행, 여기서는 데이터만 저장

- [x] **Task 4: WASM 바인딩** (AC: 1)
  - [x] 4.1: `#[wasm_bindgen]` 매크로로 set_pivot 노출
  - [x] 4.2: px, py 파라미터는 f64로 직접 받기

- [x] **Task 5: CLI 통합** (AC: 1)
  - [x] 5.1: cad-cli.ts에 `set_pivot` 명령어 추가
  - [x] 5.2: JSON 파라미터 파싱: `'{\"name\":\"lower_arm\",\"px\":0,\"py\":50}'`

- [x] **Task 6: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] 6.1: Rust 단위 테스트 - 기본 Pivot 설정
  - [x] 6.2: Rust 단위 테스트 - 기본 Pivot 값 확인
  - [x] 6.3: Rust 단위 테스트 - Pivot 초기화
  - [x] 6.4: Rust 단위 테스트 - 존재하지 않는 Entity
  - [x] 6.5: Rust 단위 테스트 - 그룹에 Pivot 설정
  - [x] 6.6: Rust 단위 테스트 - export_json에 pivot 포함
  - [x] 6.7: WASM 빌드 및 Node.js 통합 테스트

## Dev Notes

### Architecture Compliance

**ADR-MVP-001 준수사항:**

- Transform 구조에 pivot 필드 추가
- 기본 pivot: [0, 0] (엔티티 로컬 원점)

**렌더링과의 관계:**

- WASM에서는 pivot 데이터만 저장
- 실제 pivot 기준 회전은 렌더러(Canvas/SVG)에서 적용
- Story 4-6 (그룹화된 도형 렌더링)에서 pivot 적용 렌더링 구현

### Technical Requirements

1. **Transform 구조 수정**:

   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct Transform {
       pub translate: [f64; 2],
       pub rotate: f64,
       pub scale: [f64; 2],
       pub pivot: [f64; 2],  // 추가
   }

   impl Default for Transform {
       fn default() -> Self {
           Self {
               translate: [0.0, 0.0],
               rotate: 0.0,
               scale: [1.0, 1.0],
               pivot: [0.0, 0.0],  // 추가
           }
       }
   }
   ```

2. **Pivot 기준 회전 수학**:
   - 렌더링 시 변환 순서:
     1. pivot만큼 역이동 (translate(-px, -py))
     2. 회전 적용 (rotate)
     3. pivot만큼 원위치 (translate(px, py))
   - Canvas 2D에서:

     ```javascript
     ctx.translate(pivot[0], pivot[1]);
     ctx.rotate(angle);
     ctx.translate(-pivot[0], -pivot[1]);
     ```

3. **Pivot vs Translate 구분**:
   - pivot: 회전의 중심점 (로컬 좌표)
   - translate: 전체 위치 이동 (부모 기준)
   - 두 값은 독립적으로 설정 가능

### File Structure Notes

수정 대상 파일:

- `cad-engine/src/scene/entity.rs` - Transform 구조에 pivot 추가
- `cad-engine/src/scene/mod.rs` - set_pivot 함수 추가
- `cad-tools/cad-cli.ts` - CLI 명령어 추가
- `viewer/renderer.js` - pivot 적용 렌더링 (Story 4-6에서 상세 구현)

### References

- [Source: docs/architecture.md#ADR-MVP-001: Group System 설계]
- [Source: docs/epics.md#Story 4.4: Pivot 설정 기능]
- [Source: docs/sprint-artifacts/4-1-group-creation.md - 그룹 구조]

## Dev Agent Record

### Context Reference

- docs/architecture.md (ADR-MVP-001)
- docs/epics.md (Epic 4, Story 4.4)
- cad-engine/src/scene/entity.rs (Transform 구조)

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
