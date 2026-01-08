# ADR-006: Geometry Engine Selection

**Status**: Proposed
**Date**: 2025-01-07
**Decision Makers**: @parktube, @claude

## Context

현재 CAD 엔진(`cad-engine`)은 **외부 기하 라이브러리 없이** 순수 Rust로 직접 구현되어 있습니다.

### 현재 구현 (cad-engine)

```toml
# Cargo.toml - 기하 라이브러리 없음
[dependencies]
wasm-bindgen = "0.2.92"
serde = { version = "1.0", features = ["derive"] }
uuid = { version = "1", features = ["v4", "js"] }
# geo crate 없음!
```

**지원 도형**: Line, Circle, Rect, Arc, Polygon, Bezier

### 현재 한계점

| 기능 | 상태 | 문제점 |
|------|------|--------|
| **Boolean 연산** | ❌ 없음 | Union, Intersection, Difference 불가 |
| **Polygon Clipping** | ❌ 없음 | 도형 합치기/빼기 불가 |
| **Self-intersection 처리** | ❌ 없음 | 교차 폴리곤 처리 불가 |
| **삼각분할** | ❌ 없음 | 복잡한 폴리곤 렌더링 제한 |
| **3D 지원** | ❌ 없음 | CSG 불가 |
| **Hit Testing 최적화** | ❌ 없음 | 대규모 엔티티 성능 저하 |

### 왜 바꿔야 하는가?

1. **Boolean 연산 필요**: 도형 합치기(Union), 빼기(Difference), 교차(Intersection)는 CAD 필수 기능
2. **복잡한 도형 지원**: 구멍 뚫린 폴리곤, self-intersection 처리 필요
3. **성능 최적화**: 대규모 폴리곤 연산 시 검증된 알고리즘 필요
4. **3D 확장**: 향후 CSG(Constructive Solid Geometry) 지원

### 필요한 기능

1. **2D Boolean 연산** (Union, Intersection, Difference, XOR)
2. **Polygon Offsetting** (Buffering)
3. **삼각분할** (Triangulation)
4. **3D CSG** (향후)

## Candidates

### 1. iShape-Rust (iOverlay)

**개요**: Rust 네이티브 2D 기하 라이브러리

| 항목 | 내용 |
|------|------|
| **언어** | Rust |
| **라이센스** | MIT |
| **WASM** | ✅ `ishape_wasm` (npm) |
| **2D Boolean** | ✅ Union, Intersection, Difference, XOR |
| **3D** | ❌ 없음 |
| **성능** | Clipper2 대비 **20~80x 빠름** |

**장점**:
- Rust 네이티브 → 현재 `cad-engine`과 같은 빌드 체인
- Self-intersection 처리 가능
- Fill rules 지원 (even-odd, non-zero, positive, negative)
- 삼각분할 (i_triangle) 포함

**벤치마크** (vs Clipper2 C++):
| 테스트 | iOverlay (Rust) | Clipper2 (C++) | 비율 |
|--------|-----------------|----------------|------|
| Checkerboard (8.3M squares) | 33.74s | 644.34s | **19x** |
| Spiral (1M squares) | 3.23s | 259.87s | **80x** |

**링크**:
- GitHub: https://github.com/iShape-Rust/iOverlay
- npm: https://www.npmjs.com/package/ishape_wasm
- 벤치마크: https://ishape-rust.github.io/iShape-js/overlay/performance/performance.html

---

### 2. Manifold

**개요**: C++ 기반 검증된 3D 기하 엔진 (Blender, OpenSCAD 채택)

| 항목 | 내용 |
|------|------|
| **언어** | C++ |
| **라이센스** | Apache 2.0 |
| **WASM** | ✅ `manifold-3d` (npm) |
| **2D Boolean** | ✅ CrossSection (Clipper2 기반) |
| **3D Boolean** | ✅ CSG (Union, Intersection, Difference) |
| **성능** | Clipper2 수준 |

**장점**:
- **Blender, OpenSCAD에서 채택** → 프로덕션 검증됨
- 2D (CrossSection) + 3D 모두 지원
- Guaranteed manifold output (edge case 없음)
- glTF 확장 지원 (EXT_mesh_manifold)

**단점**:
- C++ Emscripten 빌드 복잡
- WASM 수동 메모리 관리 필요 (`delete()` 호출)

**링크**:
- GitHub: https://github.com/elalish/manifold
- npm: https://www.npmjs.com/package/manifold-3d
- 문서: https://manifoldcad.org/docs/html/

---

### 3. csgrs

**개요**: Rust 네이티브 CSG 라이브러리

| 항목 | 내용 |
|------|------|
| **언어** | Rust |
| **라이센스** | MIT |
| **WASM** | ✅ 지원 |
| **2D Boolean** | ⚠️ 제한적 |
| **3D Boolean** | ✅ CSG |
| **성능** | 미검증 |

**치명적 버그** (2025-01 현재, 12개 open issues):
| Issue | 설명 | 심각도 |
|-------|------|--------|
| #110 | `Node::from_polygons` 무한 재귀 → 스택 오버플로우 | 🔴 Critical |
| #38, #84 | Non-manifold 결과 (구멍 뚫린 큐브 실패) | 🔴 Critical |
| #25 | 원점 포함 폴리곤에서 NaN 발생 | 🟠 High |
| #33 | f32 feature 컴파일 실패 | 🟡 Medium |

**결론**: 현재 **프로덕션 사용 불가**. 버그 해결 후 재평가.

**링크**:
- GitHub: https://github.com/timschmidt/csgrs
- Issues: https://github.com/timschmidt/csgrs/issues

---

### 4. Clipper2-WASM

**개요**: C++ Clipper2의 WASM 포트

| 항목 | 내용 |
|------|------|
| **언어** | C++ |
| **라이센스** | Boost |
| **WASM** | ✅ `clipper2-wasm` (npm) |
| **2D Boolean** | ✅ |
| **3D** | ❌ |
| **성능** | 기준선 |

**비고**: Manifold의 CrossSection이 Clipper2 기반이므로 별도 사용 불필요.

**링크**:
- GitHub: https://github.com/ErikSom/Clipper2-WASM
- npm: https://www.npmjs.com/package/clipper2-wasm

---

### 5. Rust 생태계 대안 (미채택)

#### geo-booleanop

- **설명**: Martinez-Rueda 알고리즘 기반 Boolean 연산
- **문제점**: JavaScript 구현을 Rust로 포팅한 것으로, 원본 알고리즘의 버그 그대로 포함
- **상태**: 업데이트 드묾

#### polygon_clipping

- **설명**: 순수 Rust Boolean 연산
- **문제점**:
  - NaN/Infinity 좌표 처리 안 됨
  - 겹치는 엣지(overlapping edges) 미지원
  - 한 정점에서 3개 이상 엣지 만날 때 버그
  - Sweep line 구현이 Vec 기반 (성능 저하)
- **상태**: 프로덕션 사용 부적합

#### geo-clipper

- **설명**: C++ Clipper1의 Rust 바인딩
- **문제점**: Clipper1 기반 (Clipper2보다 느림)
- **비고**: 굳이 바인딩 쓸 바에 Clipper2-WASM이 나음

**결론**: Rust 생태계의 Boolean 연산 라이브러리들은 **iOverlay를 제외하고** 모두 안정성/성능 문제가 있음.

---

## Comparison Matrix

| 기능 | iOverlay | Manifold | csgrs | Clipper2 |
|------|----------|----------|-------|----------|
| 언어 | Rust | C++ | Rust | C++ |
| 2D Boolean | ✅ | ✅ | ⚠️ | ✅ |
| 3D CSG | ❌ | ✅ | ⚠️ | ❌ |
| 성능 (2D) | **20-80x** | 1x | ? | 1x |
| 안정성 | ✅ | ✅ | ❌ | ✅ |
| Rust 통합 | ✅ Native | Binding | ✅ Native | Binding |
| npm 패키지 | ✅ | ✅ | ❌ | ✅ |

---

## Proposed Options

### Option A: iOverlay + Manifold (권장)

```
┌─────────────────────────────────────────────────────────────┐
│                    2D 기하 엔진                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  iOverlay (Rust WASM) - ishape_wasm                 │   │
│  │  - Boolean: Union, Intersection, Difference, XOR    │   │
│  │  - Triangulation                                    │   │
│  │  - 성능: Clipper2 대비 20-80x                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    3D 기하 엔진 (향후)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Manifold (C++ WASM) - manifold-3d                  │   │
│  │  - 3D CSG: Union, Intersection, Difference          │   │
│  │  - Guaranteed manifold output                       │   │
│  │  - Blender/OpenSCAD 검증됨                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**장점**:
- 2D 초고속 (iOverlay)
- 3D 검증됨 (Manifold)
- 각 영역 최적 솔루션

**단점**:
- 두 개의 WASM 모듈 관리

---

### Option B: Manifold Only

```
┌─────────────────────────────────────────────────────────────┐
│                    단일 기하 엔진                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Manifold (C++ WASM) - manifold-3d                  │   │
│  │  - 2D: CrossSection (Clipper2 기반)                 │   │
│  │  - 3D: CSG                                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**장점**:
- 단일 WASM 모듈
- 2D/3D 통합 API

**단점**:
- 2D 성능이 iOverlay 대비 20-80x 느림

---

### Option C: csgrs 대기

csgrs의 치명적 버그(#110, #38, #84, #25) 해결 후 재평가.

**예상 시점**: 미정 (활발한 개발 중이나 안정화 시점 불확실)

---

## Decision

**Option A: iOverlay + Manifold** 권장

### 근거

1. **2D 성능 중요**: CAD 작업 대부분은 2D. 20-80x 성능 차이는 UX에 직접 영향.
2. **3D는 선택적**: 현재 MVP는 2D. 3D는 향후 확장.
3. **Rust 통합**: iOverlay는 Rust 네이티브로 현재 빌드 체인과 호환.
4. **검증된 솔루션**: 두 라이브러리 모두 프로덕션 사용 중.

### Migration Path

```
Phase 1 (현재): 순수 Rust 구현 - 기본 도형만 (Boolean 없음)
Phase 2: + iOverlay → 2D Boolean 연산, 삼각분할, Offsetting
Phase 3: + Manifold → 3D CSG (필요 시)
```

---

## Implementation Notes

### iOverlay 통합

```rust
// Cargo.toml
[dependencies]
i_overlay = "1.9"

// 사용 예시
use i_overlay::core::fill_rule::FillRule;
use i_overlay::core::overlay::ShapeType;
use i_overlay::core::overlay_rule::OverlayRule;

let overlay = Overlay::with_paths(&subject, &clip);
let result = overlay.overlay(OverlayRule::Union, FillRule::NonZero);
```

### WASM 바인딩 (JS)

```javascript
import { Overlay, OverlayRule, FillRule } from 'ishape_wasm';

const overlay = Overlay.new_with_subj_and_clip(subject, clip);
const result = overlay.overlay(OverlayRule.Union, FillRule.NonZero);
```

---

## References

- [iOverlay GitHub](https://github.com/iShape-Rust/iOverlay)
- [iOverlay Performance Benchmarks](https://ishape-rust.github.io/iShape-js/overlay/performance/performance.html)
- [Manifold GitHub](https://github.com/elalish/manifold)
- [Manifold Documentation](https://manifoldcad.org/docs/html/)
- [csgrs GitHub](https://github.com/timschmidt/csgrs)
- [csgrs Issues](https://github.com/timschmidt/csgrs/issues)
- [Clipper2-WASM](https://github.com/ErikSom/Clipper2-WASM)

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-01-07 | Claude | Initial draft |
| 2025-01-07 | Claude | 현재 한계점 섹션 추가, Rust 대안 라이브러리 비교 추가 |
