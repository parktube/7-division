# ADR-005: Coordinate System

**상태**: 완료

## 월드 좌표계 (CAD Engine)

| 속성 | 값 | 이유 |
|------|-----|------|
| **Y축 방향** | Y-up (양수가 위) | wgpu NDC 일치, 수학적 직관 |
| **원점** | (0, 0) = 화면 중앙 | 대칭 도형 작업 용이 |
| **단위** | 픽셀 | 단순화 |

## 회전 규칙

| 속성 | 값 |
|------|-----|
| **단위** | 라디안 |
| **양수 방향** | 반시계방향 (CCW) |

```
    +Y (위)
     │
     │  ↺ 양수 회전 (CCW)
     │
─────┼────── +X (오른쪽)
     │
```

## Rect Origin

| 속성 | 값 |
|------|-----|
| **origin** | 좌하단 (left-bottom) |
| **width** | +X 방향 확장 |
| **height** | +Y 방향 확장 |

```
   (x, y+h) ───── (x+w, y+h)
       │             │
       │             │
   (x, y) ─────── (x+w, y)  ← origin
```

## 렌더러별 변환

| 렌더러 | 좌표계 | 변환 |
|--------|--------|------|
| Canvas 2D | Y-down | `ctx.scale(1, -1)` + translate |
| SVG | Y-down | `<g transform="scale(1,-1)">` |
| wgpu | Y-up (NDC) | 변환 불필요 |

## 관련 코드

- `cad-engine/src/scene/transform.rs`
- `viewer/renderer.js`
