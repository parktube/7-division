# Story 3.4: Delete 기능 구현

Status: done

## Story

As a **AI 에이전트 (Claude Code)**,
I want **기존 도형을 삭제할 수 있도록**,
So that **"오른쪽 팔을 없애줘" 같은 요청을 처리할 수 있다**.

## Acceptance Criteria

### AC1: 기본 삭제
**Given** Scene에 Entity가 존재 (name으로 식별)
**When** `scene.delete(name)` 호출
**Then** 해당 Entity가 Scene의 entities 배열에서 제거된다
**And** 다음 export_json()에 해당 Entity가 포함되지 않는다

### AC2: 유효하지 않은 ID 처리
**Given** 존재하지 않는 ID로 delete 호출
**When** delete("invalid_id") 실행
**Then** Result<bool>에서 Ok(false) 반환 (no-op)
**And** (정책: name 미발견 시 no-op, docs/architecture.md#Error Handling Policy)
**And** 다른 Entity들은 영향받지 않는다

### AC3: 부분 삭제
**Given** 여러 Entity 중 하나를 삭제
**When** delete 호출 후 entities 배열 확인
**Then** 삭제된 Entity만 없어지고 나머지는 유지된다
**And** 다른 Entity들의 ID는 변경되지 않는다

## Tasks / Subtasks

- [ ] **Task 1: delete 함수 구현** (AC: #1)
  - [ ] 1.1: `delete(&mut self, name: &str)` 구현
  - [ ] 1.2: entities.retain(|e| e.id != id) 패턴 사용
  - [ ] 1.3: 삭제 성공/실패 반환

- [ ] **Task 2: 에러 처리** (AC: #2)
  - [ ] 2.1: name 미발견 시 처리 방식 결정
  - [ ] 2.2: 에러 반환 또는 무시 구현

- [ ] **Task 3: Scene에 통합** (AC: #1, #3)
  - [ ] 3.1: Scene impl에 delete 메서드 추가
  - [ ] 3.2: wasm_bindgen export 확인

- [ ] **Task 4: 테스트 작성** (AC: #1, #2, #3)
  - [ ] 4.1: 단일 Entity 삭제 테스트
  - [ ] 4.2: 여러 Entity 중 하나 삭제 테스트
  - [ ] 4.3: 잘못된 name 삭제 테스트
  - [ ] 4.4: export_json에서 삭제 확인 테스트

- [ ] **Task 5: Tool Use 등록** (AC: #1)
  - [ ] 5.1: `cad-tools/src/schema.ts` - delete 스키마 추가
  - [ ] 5.2: `cad-tools/src/executor.ts` - delete case 추가
  - [ ] 5.3: DOMAINS.transforms에 "delete" 추가
  - [ ] 5.4: `cad-tools/tests/executor.test.ts` - delete 테스트 추가

## Dev Notes

### Architecture Patterns

#### delete 함수 시그니처

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    /// Entity를 삭제합니다.
    ///
    /// # Arguments
    /// * `id` - 삭제할 Entity의 ID
    ///
    /// # Returns
    /// * 성공 시 Ok(true), name 미발견 시 Ok(false), 에러 시 Err
    pub fn delete(&mut self, name: &str) -> Result<bool, JsValue> {
        let before_len = self.entities.len();

        self.entities.retain(|e| e.id != id);

        let deleted = self.entities.len() < before_len;
        Ok(deleted)
    }
}
```

#### 사용 예시

```javascript
// 오른팔 삭제
const deleted = scene.delete("right_arm");
console.log("Deleted:", deleted);  // true

// 없는 ID 삭제 시도
const notFound = scene.delete("nonexistent");
console.log("Deleted:", notFound);  // false
```

### 삭제 패턴

```rust
// Vec::retain() 사용 - 조건에 맞는 것만 유지
self.entities.retain(|e| e.id != id);
```

### 디렉토리 구조

```
cad-engine/src/
├── scene/
│   ├── mod.rs          # delete 메서드 추가
│   └── entity.rs
└── transforms/
    └── ...
```

### Project Structure Notes

- delete는 transforms/ 모듈이 아닌 scene/ 모듈에 위치
- Undo/Redo는 Phase 2에서 구현 (History 패턴)
- 삭제된 Entity는 복구 불가 (Phase 1)

### Dependencies

- Story 1.2 (Scene 클래스 및 Entity 구조)
- **Story 3.0 (Tool Use Foundation)** - Tool 등록용

## References

- [Source: docs/architecture.md#API Design - delete]
- [Source: docs/epics.md#Story 3.4]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- cad-engine/src/scene/mod.rs (수정 - delete 추가)
