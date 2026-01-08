# RFC: Boolean Operations for CAD Engine

## Summary

cad-engine에 [iOverlay](https://github.com/iShape-Rust/iOverlay) 라이브러리를 통합하여 2D 도형의 Boolean 연산을 지원합니다.

**지원 연산:**
- **Union** (합집합): A ∪ B
- **Intersection** (교집합): A ∩ B  
- **Difference** (차집합): A - B
- **XOR** (대칭차): A ⊕ B

---

## 핵심 설계 결정 사항

### 1. 모든 연산 결과는 Polygon 타입

> ⚠️ **중요**: Boolean 연산의 결과는 입력 타입과 관계없이 **항상 Polygon**입니다.

| 입력 | 연산 | 결과 |
|------|------|------|
| Rect + Rect | Union | **Polygon** |
| Circle + Circle | Intersection | **Polygon** |
| Polygon + Line | Difference | **Polygon** |

**이유:**
- iOverlay는 모든 결과를 점들의 시퀀스(contour)로 반환
- 원본 도형 타입 정보는 연산 과정에서 상실됨
- 결과가 사각형 모양이어도 `Geometry::Polygon { points: [...] }`로 저장

```
┌───────┐   ┌───────┐           ┌───────────┐
│ Rect  │ + │ Rect  │  ==>  │  Polygon  │  (6점)
│   A   │   │   B   │           │   결과     │
└───────┘   └───────┘           └───────────┘
```

---

### 2. 원과 곡선은 다각형으로 근사화(Approximation)

> ⚠️ **중요**: Circle, Arc, Bezier는 **N개의 직선 세그먼트로 근사화**되어 처리됩니다.

iOverlay는 **폴리곤(직선 세그먼트의 연결)** 만 처리할 수 있습니다. 곡선 도형은 사전에 다각형으로 변환됩니다.

```
     원 (Circle)                    64-gon (근사화)
         ●                              ●
       ╱   ╲                          ╱   ╲
      ●     ●         ==>          ●─●─●─●─●
       ╲   ╱                          ╲   ╱
         ●                              ●
                               (64개의 직선 세그먼트)
```

**curve_segments 옵션:**

| 값 | 용도 | 정밀도 | 성능 |
|----|------|--------|------|
| 16-32 | 미리보기, 빠른 연산 | 낮음 | 빠름 |
| **64** (기본) | 일반 용도 | 보통 | 보통 |
| 128-256 | 고정밀 출력, 확대 뷰 | 높음 | 느림 |

**근사화 대상:**

| 도형 | 변환 방식 |
|------|----------|
| Circle | N-gon (정다각형 근사) |
| Arc | 호를 N개 선분으로 분할 + 중심점 연결 (부채꼴) |
| Bezier | 베지어 곡선을 N개 직선으로 선형화 |

---

## 지원 도형 타입

| Geometry | Boolean 지원 | 변환 방식 |
|----------|-------------|----------|
| **Rect** | ✅ | 4점 폴리곤 변환 |
| **Circle** | ✅ | N-gon 근사화 |
| **Polygon** | ✅ | 직접 사용 |
| **Arc** | ✅ | 부채꼴 폴리곤 |
| **Line** | ✅ | Stroke → 폴리곤 (기존 style의 width, cap, join 사용) |
| **Bezier** | ✅ | 선형화 후 폴리곤 |
| **Group** | ❌ | 하위 Entity 개별 처리 필요 |

---

## 제안 API

### JavaScript (WASM)

```javascript
// 두 도형 Boolean 연산
scene.boolean_op(
    "result",           // 결과 Entity 이름
    "shape_a",          // 첫 번째 도형
    "shape_b",          // 두 번째 도형
    "union",            // 연산: "union" | "intersection" | "difference" | "xor"
    64,                 // curve_segments (0 = 기본값 64)
    "{}"                // 결과 스타일 JSON
);

// 여러 도형 Union
scene.boolean_union_all(
    "merged",
    '["c1", "c2", "c3"]',  // Entity 이름 배열 (JSON)
    64,
    "{}"
);
```

### 예시: 두 원의 Union

```javascript
const scene = Scene.new("test");
scene.draw_circle("left", 0, 0, 50, "{}");
scene.draw_circle("right", 40, 0, 50, "{}");

// Union → 결과는 항상 Polygon
scene.boolean_op("venn", "left", "right", "union", 64, "{}");

// "venn" Entity: Geometry::Polygon { points: [...약 128개의 점...] }
```

---

## 논의 사항

### Q1. curve_segments 기본값 64가 적절한가?
- 더 높은 값(128)이 기본이어야 하는가?
- 도형 크기에 따라 자동 조절하는 옵션이 필요한가?

### Q2. 결과가 여러 개의 분리된 폴리곤일 경우?
- **Option A**: 가장 큰 폴리곤만 반환
- **Option B**: 여러 Polygon Entity 생성 (result_0, result_1, ...)
- **Option C**: Group으로 묶어서 반환

### Q3. 원본 Entity 삭제 옵션?
- Boolean 연산 후 원본 도형을 자동 삭제하는 옵션이 필요한가?
- 예: `delete_sources: true`

### Q4. Line의 stroke width가 없을 때?
- 현재 계획: 기본값 1.0 사용
- 대안: 에러 반환?

---

## 의존성

```toml
[dependencies]
i_overlay = "4.0"
```

- [iOverlay GitHub](https://github.com/iShape-Rust/iOverlay)
- [iOverlay Demo](https://ishape-rust.github.io/iShape-js/overlay/shapes_editor.html)

---

## 참고 자료

- iOverlay는 f64 좌표를 네이티브로 지원
- 결과 폴리곤의 외곽선은 반시계방향, 홀은 시계방향
- 자기교차(self-intersection) 도형도 처리 가능
