# Story 7.5.3: addToGroup 월드 위치 유지

Status: ready-for-dev

## Story

As a **LLM**,
I want **addToGroup 시 엔티티의 월드 위치가 유지되기를**,
so that **스케치 위치에 만든 엔티티를 그룹에 추가해도 위치가 틀어지지 않는다**.

## Background

현재 문제:
```javascript
// 스케치 위치에 창문 생성
drawRect('window', 100, 50, 20, 30)  // world 좌표 (100, 50)

// 그룹에 추가
addToGroup('house', 'window')
// 결과: 위치가 틀어짐! (부모 transform이 중첩 적용)
```

LLM이 역변환을 계산해야 하는 것은 AX 원칙 위반.
시스템이 자동으로 월드 위치를 유지해야 함.

## Acceptance Criteria

1. **AC1**: addToGroup 후 엔티티의 월드 위치가 동일하게 유지됨
2. **AC2**: 시스템이 내부적으로 로컬 좌표를 자동 계산
3. **AC3**: 중첩 그룹 (그룹 안의 그룹)에서도 동작
4. **AC4**: getWorldBounds로 검증 가능

## Tasks / Subtasks

- [ ] Task 1: addToGroup 월드 위치 유지 로직 (AC: #1, #2)
  - [ ] 추가 전 엔티티의 world transform 저장
  - [ ] 부모 그룹의 world transform 역행렬 계산
  - [ ] 엔티티의 local transform = 역행렬 × 기존 world transform
  - [ ] 결과: 월드 위치 동일

- [ ] Task 2: Rust executor 수정 (AC: #1, #2)
  - [ ] add_to_group 명령어 수정
  - [ ] 행렬 연산 추가 (역변환)
  - [ ] transform 필드 업데이트

- [ ] Task 3: 중첩 그룹 처리 (AC: #3)
  - [ ] 부모 체인 전체 world transform 계산
  - [ ] 깊은 중첩에서도 정확한 역변환

- [ ] Task 4: Sandbox 바인딩 확인 (AC: #1)
  - [ ] addToGroup 함수 동작 확인
  - [ ] 기존 시그니처 유지 (하위 호환)

## Dev Notes

### 알고리즘

```
1. entity_world = get_world_transform(entity)
2. parent_world = get_world_transform(parent_group)
3. parent_world_inverse = inverse(parent_world)
4. entity_new_local = parent_world_inverse × entity_world
5. entity.transform = entity_new_local
6. entity.parent = parent_group
```

### 예시

```
Before:
  window: world position (100, 50), local = (100, 50), parent = none
  house: world position (0, 0), transform translate(-80, -10)

After addToGroup('house', 'window'):
  window: world position (100, 50), local = (180, 60), parent = house

  검증: local (180, 60) + parent transform (-80, -10) = world (100, 50) ✓
```

### 행렬 연산 (2D Affine)

```rust
// 2D affine transform matrix
struct Transform2D {
    translate: (f64, f64),
    rotate: f64,
    scale: (f64, f64),
}

impl Transform2D {
    fn to_matrix(&self) -> Matrix3x3 { ... }
    fn from_matrix(m: Matrix3x3) -> Self { ... }
    fn inverse(&self) -> Self { ... }
}
```

### 기존 동작과 호환성

- 기존: addToGroup 시 로컬 좌표 그대로, 위치 틀어짐
- 개선: addToGroup 시 로컬 좌표 재계산, 위치 유지

**Breaking Change**: 기존 동작에 의존하는 코드는 수정 필요.
하지만 기존 동작은 버그/혼란이므로 개선이 맞음.

## Testing Checklist

- [ ] addToGroup 후 getWorldBounds가 동일한지 확인
- [ ] 회전된 그룹에 추가해도 위치 유지
- [ ] 스케일된 그룹에 추가해도 위치 유지
- [ ] 중첩 그룹 (3레벨)에서 동작 확인
- [ ] 루트에서 그룹으로 이동 시 동작 확인
