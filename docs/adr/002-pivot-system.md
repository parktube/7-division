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

```
M = T(dx,dy) * T(pivot) * R(angle) * S(sx,sy) * T(-pivot)
```

1. translate(-pivot) - 피봇을 원점으로
2. scale(sx, sy)
3. rotate(angle)
4. translate(pivot) - 피봇 위치 복원
5. translate(dx, dy) - 최종 이동

## API

```typescript
setPivot(entity, px, py)
rotate(entity, angle)  // 내부적으로 pivot 적용
```

## 관련 코드

- `cad-engine/src/scene/transform.rs`
- `viewer/renderer.js` (렌더링 적용)
