# Story 4.5: 계층적 변환 구현

Status: done

## Story

As a **AI 에이전트 (Claude Code)**,
I want **부모 그룹의 변환이 자식들에게 전파되도록**,
so that **어깨를 회전하면 팔 전체가 함께 회전한다**.

## Acceptance Criteria

1. **AC1: 그룹 Translate 전파**
   - Given: "left_arm_group"에 "upper_arm", "lower_arm", "hand"가 자식으로 존재
   - When: `scene.translate("left_arm_group", 10, 0)` 호출
   - Then: 그룹의 transform.translate가 (10, 0)으로 설정된다
   - And: 렌더링/Export 시 모든 자식들이 (10, 0)만큼 이동한 위치에 표시된다

2. **AC2: 그룹 Rotate 전파**
   - Given: "shoulder" 그룹에 "upper_arm" 등 자식들이 존재
   - When: `scene.rotate("shoulder", 45)` 호출
   - Then: 그룹의 transform.rotate가 45도로 설정된다
   - And: 렌더링 시 모든 자식들이 그룹 기준으로 45도 회전된 위치에 표시된다

3. **AC3: 그룹 Scale 전파**
   - Given: "body" 그룹에 여러 자식 Entity가 존재
   - When: `scene.scale("body", 2, 2)` 호출
   - Then: 그룹의 transform.scale이 (2, 2)로 설정된다
   - And: 렌더링 시 모든 자식들이 2배 크기로 표시된다

4. **AC4: 중첩 그룹 변환 합성**
   - Given: "arm" 그룹 안에 "forearm" 그룹이 자식으로 존재
   - And: "arm"에 rotate(30), "forearm"에 rotate(45)가 적용된 상태
   - When: "forearm" 내 Entity 렌더링
   - Then: 총 75도(30+45) 회전된 위치에 표시된다 (변환 합성)

5. **AC5: get_world_transform 함수**
   - Given: 계층 구조가 있는 Entity
   - When: `scene.get_world_transform("lower_arm")` 호출
   - Then: 모든 조상의 변환이 합성된 월드 변환을 반환한다
   - And: 반환 형식: `{ translate: [x, y], rotate: angle, scale: [sx, sy], pivot: [px, py] }`

6. **AC6: 자식 개별 변환과 부모 변환 독립**
   - Given: 그룹에 translate(10, 0)이 적용되고, 자식에 translate(5, 0)이 개별 적용
   - When: 렌더링
   - Then: 자식은 월드 좌표 (15, 0)에 표시된다 (부모 + 자식 변환 합산)

7. **AC7: export_json에서 로컬 변환 유지**
   - Given: 계층 구조가 있는 Scene
   - When: export_json() 호출
   - Then: 각 Entity는 자신의 로컬 transform만 포함한다
   - And: 월드 변환은 렌더러에서 계산 (JSON 크기 최소화)

8. **AC8: Pivot과 계층 변환 조합**
   - Given: 부모 그룹에 pivot(0, 50), rotate(30)이 설정
   - And: 자식에 pivot(10, 0), rotate(15)가 설정
   - When: 렌더링
   - Then: 각 pivot 기준으로 회전이 올바르게 적용된다

## Tasks / Subtasks

- [x] **Task 1: get_world_transform 함수 구현** (AC: 5, 7)
  - [x] 1.1: `get_world_transform(name: &str) -> Result<JsValue, JsValue>` 시그니처
  - [x] 1.2: parent_id 체인을 따라 모든 조상 변환 수집
  - [x] 1.3: 변환 합성 로직 (translate 누적, rotate 누적, scale 곱셈)
  - [x] 1.4: 결과를 JSON 형식으로 반환

- [x] **Task 2: 변환 합성 유틸리티** (AC: 4, 6)
  - [x] 2.1: `compose_transforms(parent: &Transform, child: &Transform) -> Transform` 함수
  - [x] 2.2: translate: parent.translate + child.translate (parent 회전 적용 시 회전 후 더하기)
  - [x] 2.3: rotate: parent.rotate + child.rotate
  - [x] 2.4: scale: parent.scale * child.scale (원소별 곱셈)
  - [x] 2.5: pivot 처리 (로컬 pivot은 변환 순서에서 고려)

- [x] **Task 3: 아키텍처 결정 - TRS vs Matrix** (AC: 4, 8)
  - [x] 3.1: MVP에서는 TRS 구조 유지, 단순 합성 로직 사용
  - [x] 3.2: 변환 순서: Scale → Rotate (pivot 기준) → Translate
  - [x] 3.3: 문서화: 복잡한 변환 시 한계점 명시

- [x] **Task 4: WASM 바인딩** (AC: 5)
  - [x] 4.1: `#[wasm_bindgen]` 매크로로 get_world_transform 노출
  - [x] 4.2: 반환값은 JSON 문자열 또는 JsValue

- [x] **Task 5: CLI 통합** (AC: 5)
  - [x] 5.1: cad-cli.ts에 `get_world_transform` 명령어 추가
  - [x] 5.2: 결과를 사람이 읽기 좋은 형식으로 출력

- [x] **Task 6: 렌더러 업데이트 (Viewer)** (AC: 1, 2, 3, 4, 8)
  - [x] 6.1: renderer.js에서 계층 구조 파싱 로직 추가
  - [x] 6.2: 렌더링 순서: 부모 먼저, 자식 나중 (Canvas context 상태 스택)
  - [x] 6.3: ctx.save() / ctx.restore()로 변환 상태 관리
  - [x] 6.4: Note: 상세 구현은 Story 4-6에서

- [x] **Task 7: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] 7.1: Rust 단위 테스트 - 그룹 translate 전파
  - [x] 7.2: Rust 단위 테스트 - 그룹 rotate 전파
  - [x] 7.3: Rust 단위 테스트 - 그룹 scale 전파
  - [x] 7.4: Rust 단위 테스트 - 중첩 그룹 변환 합성
  - [x] 7.5: Rust 단위 테스트 - get_world_transform 정확성
  - [x] 7.6: Rust 단위 테스트 - 자식 개별 변환 + 부모 변환
  - [x] 7.7: Rust 단위 테스트 - export_json 로컬 변환 확인
  - [x] 7.8: WASM 빌드 및 Node.js 통합 테스트
  - [x] 7.9: Viewer에서 시각적 검증 테스트

## Dev Notes

### Architecture Compliance

**ADR-MVP-001 준수사항:**

- WASM에서는 로컬 변환만 저장
- 렌더링/Export 시 월드 변환 계산 (부모 → 자식 순)

**MVP Technical Risks 대응 (architecture.md):**

- Option A (TRS 유지) 채택: 렌더러에서 변환 순서 고려
- 복잡한 케이스(회전+스케일 조합)는 제한적 지원

### Technical Requirements

1. **변환 합성 순서**:

   ```
   World = Parent_World * Local

   구체적으로:
   1. Parent의 월드 변환 계산 (재귀)
   2. Local Scale 적용
   3. Local Pivot 이동 → Rotate → Pivot 역이동
   4. Local Translate 적용
   5. Parent 변환과 합성
   ```

2. **TRS 단순 합성 (MVP)** - ⚠️ 참고용 의사코드, 실제 렌더링은 Canvas 변환 스택 사용:

   > **MVP 제약 사항**: 이 단순 합성은 부모가 회전하거나 비균등 스케일인 경우
   > 자식의 translate 방향이 부정확해집니다. MVP에서는 **Canvas 2D 변환 스택**으로
   > 정확한 계층적 변환을 처리합니다 (아래 참조).

   ```rust
   // ⚠️ MVP에서는 사용하지 않음 - 정확한 변환은 Canvas 스택으로 처리
   // Post-MVP에서 행렬 기반 변환 도입 시 참고
   fn compose_transforms(parent: &Transform, child: &Transform) -> Transform {
       // 주의: 이 방식은 부모 회전 시 자식 위치가 부정확함
       Transform {
           translate: [
               parent.translate[0] + child.translate[0],
               parent.translate[1] + child.translate[1],
           ],
           rotate: parent.rotate + child.rotate,
           scale: [
               parent.scale[0] * child.scale[0],
               parent.scale[1] * child.scale[1],
           ],
           pivot: child.pivot,
       }
   }
   ```

   **MVP 권장 방식**: Canvas 2D 변환 스택 사용 (아래 3번 참조)
   **Post-MVP 권장**: 3x3 행렬 곱셈으로 정확한 변환 합성

3. **Canvas 2D 렌더링 접근**:

   ```javascript
   function renderWithHierarchy(entity, parentTransform) {
       ctx.save();

       // 부모 변환 적용 (이미 적용된 상태)

       // 로컬 변환 적용
       ctx.translate(entity.transform.translate[0], entity.transform.translate[1]);

       // Pivot 기준 회전
       ctx.translate(entity.transform.pivot[0], entity.transform.pivot[1]);
       ctx.rotate(entity.transform.rotate);
       ctx.translate(-entity.transform.pivot[0], -entity.transform.pivot[1]);

       ctx.scale(entity.transform.scale[0], entity.transform.scale[1]);

       // 도형 렌더링
       renderGeometry(entity);

       // 자식들 렌더링 (현재 변환 상태 상속)
       for (const childId of entity.children || []) {
           renderWithHierarchy(getEntity(childId), currentTransform);
       }

       ctx.restore();
   }
   ```

### File Structure Notes

수정 대상 파일:

- `cad-engine/src/scene/mod.rs` - get_world_transform, compose_transforms 추가
- `cad-tools/cad-cli.ts` - CLI 명령어 추가
- `viewer/renderer.js` - 계층적 렌더링 로직 (Story 4-6과 연계)

의존 파일:

- `cad-engine/src/scene/entity.rs` - parent_id, children, Transform (Story 4-1, 4-4)

### References

- [Source: docs/architecture.md#MVP Technical Risks - Transform Matrix 검토]
- [Source: docs/epics.md#Story 4.5: 계층적 변환 구현]
- [Source: docs/sprint-artifacts/4-1-group-creation.md - 그룹 구조]
- [Source: docs/sprint-artifacts/4-4-pivot-setting.md - Pivot 설정]

## Dev Agent Record

### Context Reference

- docs/architecture.md (MVP Technical Risks)
- docs/epics.md (Epic 4, Story 4.5)
- docs/sprint-artifacts/4-1-group-creation.md
- docs/sprint-artifacts/4-4-pivot-setting.md

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
