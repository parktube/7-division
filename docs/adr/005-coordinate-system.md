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

## 로컬 좌표 패턴 (필수)

그룹/모듈 생성 시 **로컬 원점(0,0) 기준**으로 부품을 먼저 생성하고, 그룹화 후 `translate()`로 최종 위치로 이동:

```typescript
// ✅ 올바른 패턴
class Robot {
  build() {
    drawRect(this.name+'_body', -10, 0, 20, 40);  // 로컬 좌표 (0,0 기준)
    createGroup(this.name, [...]);
    translate(this.name, this.x, this.y);  // 그룹 전체를 최종 위치로
  }
}

// ❌ 잘못된 패턴 - 좌표 중첩 발생
class Robot {
  build() {
    drawRect(this.name+'_body', this.x-10, this.y, 20, 40);  // 절대 좌표
    createGroup(this.name, [...]);
    translate(this.name, this.x, this.y);  // 이동 또 적용 → 2배 이동!
  }
}
```

## 렌더러별 변환

| 렌더러 | 좌표계 | 변환 |
|--------|--------|------|
| Canvas 2D | Y-down | `ctx.scale(1, -1)` + `ctx.translate(0, -height)` |
| SVG | Y-down | `<g transform="translate(0, height) scale(1,-1)">` |
| wgpu | Y-up (NDC) | 변환 불필요 |

**Canvas 2D 변환 적용**:
```javascript
ctx.save();
ctx.translate(canvas.width / 2, canvas.height / 2);  // 중앙 원점
ctx.scale(zoom, -zoom);  // Y축 반전 + 줌
// ... 도형 렌더링 ...
ctx.restore();
```

## 관련 코드

- `cad-engine/src/scene/transform.rs`
- `viewer/renderer.js`
