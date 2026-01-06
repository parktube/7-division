# ADR-002: Pivot System

**상태**: 완료

## Context

팔꿈치를 구부리려면 lower_arm이 elbow 위치를 기준으로 회전해야 함.

## Decision

Entity에 pivot 필드 추가, rotate 시 pivot 기준 회전.

```rust
pub struct Transform {
    pub translate: [f64; 2],
    pub rotate: f64,
    pub scale: [f64; 2],
    pub pivot: [f64; 2],  // 기본값: [0, 0]
}
```

## 렌더링 변환 순서 (SRT)

**행렬 표기** (오른쪽에서 왼쪽으로 적용):
```
M = T(dx,dy) * T(pivot) * R(angle) * S(sx,sy) * T(-pivot)
```

**적용 순서** (점 변환 시):
1. `T(-pivot)`: 피봇을 원점으로 이동
2. `S(sx,sy)`: 스케일 적용
3. `R(angle)`: 회전 적용 (원점 기준)
4. `T(pivot)`: 피봇 위치 복원
5. `T(dx,dy)`: 최종 위치 이동

> **참고**: 행렬 곱은 오른쪽→왼쪽 순서로 적용되므로, 수식의 가장 오른쪽 `T(-pivot)`이 먼저 적용됩니다.

## API

```typescript
setPivot(entity, px, py)
rotate(entity, angle)  // 내부적으로 pivot 적용
```

## 관련 코드

- `cad-engine/src/scene/transform.rs`
- `viewer/renderer.js` (렌더링 적용)
