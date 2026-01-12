# ADR-006: Geometry Engine Selection

**Status**: Accepted
**Date**: 2025-01-07
**Updated**: 2026-01-08
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

**Option B: Manifold Only** 채택

### 근거

1. **실제 병목은 LLM 추론**: Boolean 연산 0.1ms vs LLM 호출 500ms. 20-80x 성능 차이가 UX에 영향 없음.
2. **단일 의존성**: 두 라이브러리 유지보수 부담 제거
3. **통합 API**: CrossSection(2D) → Manifold(3D) 자연스러운 확장
4. **이미 통합됨**: `manifold.ts` 래퍼가 작동 중
5. **3D 준비 완료**: 향후 3D 기능 즉시 사용 가능

### iShape 제거 이유

```
실제 지연: LLM 추론 (500ms) >> 렌더링 (10ms) >> Boolean (0.1ms)
```

iShape의 20-80x 성능 이점은 **측정 불가능한 차이**. 복잡성 증가 대비 이득 없음.

### Migration Path

```
Phase 1 (완료): 순수 Rust 구현 - 기본 도형
Phase 2 (현재): Manifold 통합 - 2D CrossSection (Clipper2 기반)
Phase 3 (향후): Manifold 3D CSG 활성화
Phase 4 (향후): 텍스트 렌더링 (ttf-parser 또는 opentype.js)
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

---

## Extended Research (2026-01-08)

### 추가 평가 엔진

#### 6. OpenCascade.js

**개요**: OpenCascade 산업용 CAD 커널의 JavaScript/WASM 포트

| 항목 | 내용 |
|------|------|
| **언어** | C++ (Emscripten) |
| **라이센스** | LGPL-2.1 |
| **WASM 크기** | 66 MB (v1.1.1), 6-120 MB 모듈화 (v2.0.0) |
| **2D Boolean** | ✅ |
| **3D Boolean** | ✅ |
| **Fillet/Chamfer** | ✅ |
| **STEP/IGES** | ✅ |

**테스트 결과 (2026-01-08)**:

| 버전 | 크기 | 로딩 시간 | Node.js | 평가 |
|------|------|----------|---------|------|
| v1.1.1 | 66 MB | ~700ms | △ 불완전 API | ❌ |
| v2.0.0-beta | 6-120 MB | - | ❌ 브라우저 전용 | ❌ |

**v2.0.0-beta 모듈 크기**:
```
opencascade.core.wasm         18 MB  (기본)
opencascade.modelingAlgorithms.wasm  34 MB  (Boolean, Fillet)
opencascade.dataExchangeBase.wasm    22 MB  (STEP/IGES)
module.TKBool.wasm            5.7 MB
module.TKFillet.wasm          3.3 MB
module.TKBO.wasm              3.9 MB
```

**문제점**:
- v2.0.0의 `loadDynamicLibrary()`가 fetch 기반 → Node.js에서 `file://` 미지원
- CLI 도구(Claude Code)에서 66MB WASM 로딩은 부담
- API 복잡도 높음 (BRepAlgoAPI_Fuse_3, Message_ProgressRange_1 등)

**결론**: 브라우저 기반 3D 뷰어에만 적합. CLI 도구에는 **부적합**.

---

#### 7. JSCAD (@jscad/modeling)

**개요**: Pure JavaScript CSG 라이브러리

| 항목 | 내용 |
|------|------|
| **언어** | Pure JavaScript |
| **라이센스** | MIT |
| **크기** | 1.5 MB |
| **2D/3D Boolean** | ✅ |
| **Fillet** | ✅ |
| **성능** | 느림 (JS 기반) |

**특이사항**:
- JSCAD 커뮤니티가 **Manifold 통합 추진 중** ([Discussion #340](https://github.com/elalish/manifold/discussions/340))
- "boolean operations are instantaneous" with Manifold
- JSCAD API 호환 래퍼 작성 가능

**결론**: Pure JS라 느림. Manifold 통합 후 재평가.

---

#### 8. CGAL.js

**개요**: CGAL(Computational Geometry Algorithms Library)의 WASM 포트

| 항목 | 내용 |
|------|------|
| **언어** | C++ (Emscripten) |
| **라이센스** | GPL/LGPL |
| **상태** | 실험적 |

**문제점**:
- JavaScript에서 floating point rounding 제어 불가
- Non-simple CGAL kernels에서 assertion errors 발생
- 생성된 JS 코드가 매우 큼

**결론**: **프로덕션 사용 불가** (실험적)

---

### 텍스트 렌더링 라이브러리

CAD에서 텍스트를 폴리곤/베지어로 변환하기 위한 라이브러리 비교:

| 라이브러리 | 타입 | 크기 | 성능 | Node.js | 특징 |
|-----------|------|------|------|---------|------|
| **opentype.js** | Pure JS | 200 KB | 기준 | ✅ | 베지어 커맨드 직접 접근 |
| **rustybuzz-wasm** | Rust WASM | ~1 MB | 3x faster | ✅ | HarfBuzz 포트, 복잡 스크립트 |
| **ttf-parser** | Rust | 50 KB | 빠름 | ✅ (crate) | OutlineBuilder trait |
| **text-to-svg** | Pure JS | 작음 | 보통 | ✅ | opentype.js 기반 |
| **fontdue** | Rust | ~100 KB | 빠름 | ✅ (crate) | 래스터라이징 전용 |
| **resvg-js** | Rust WASM | ~2 MB | 빠름 | ✅ | SVG 렌더링 |

**권장: ttf-parser (Rust 엔진) 또는 opentype.js (TS 레이어)**

```rust
// Rust 엔진에 ttf-parser 추가 시
// Cargo.toml
[dependencies]
ttf-parser = "0.24"

// 글리프 → 베지어 변환
impl OutlineBuilder for PathBuilder {
    fn move_to(&mut self, x: f32, y: f32) { ... }
    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) { ... }
}
```

```javascript
// TypeScript 레이어에서 opentype.js 사용 시
import opentype from 'opentype.js';
const font = await opentype.load('font.ttf');
const path = font.getPath('Hello', 0, 0, 72);
// path.commands = [{type:'M', x, y}, {type:'C', ...}, ...]
```

---

### 종합 비교표 (Extended)

| 엔진 | 크기 | 2D | 3D | Boolean | Fillet | Offset | Text | Node.js | 성능 |
|------|------|----|----|---------|--------|--------|------|---------|------|
| **Manifold** | 1.8 MB | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | 빠름 |
| **iShape-js** | 500 KB | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | **최고** |
| **Clipper2-WASM** | 1.2 MB | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | 빠름 |
| **OpenCascade.js** | 66-120 MB | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | △ | 느림 |
| **JSCAD** | 1.5 MB | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | 느림 |
| **csgrs** | ? | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ✅ | ? |
| **CGAL.js** | 큼 | ✅ | ✅ | ✅ | ? | ? | ❌ | ? | ? |

**LLM-Native 관점 평가**:

| 엔진 | API 복잡도 | LLM 친화성 | 권장 |
|------|-----------|-----------|------|
| Manifold | 심플 | ✅ 높음 | **✅ 권장** |
| iShape-js | 심플 | ✅ 높음 | **✅ 권장** |
| OpenCascade.js | 매우 복잡 | ❌ 낮음 | ❌ |
| JSCAD | 보통 | ⚠️ 중간 | △ |

---

### 최종 결론

**Manifold 단일 사용** (2026-01-08 결정)

| 용도 | 엔진 | 이유 |
|------|------|------|
| **2D Boolean** | Manifold CrossSection | Clipper2 기반, 충분히 빠름 |
| **3D Boolean** | Manifold | Blender/OpenSCAD 검증 |
| **텍스트** | ttf-parser (Rust) 또는 opentype.js (TS) | 50-200KB 추가 |
| **Fillet/Chamfer** | LLM 직접 계산 | 베지어 곡선으로 근사 |

**제거됨**:
- iShape-js: 성능 이점이 실제 UX에 영향 없음 (LLM 추론이 병목)

**부적합 판정**:
- OpenCascade.js: 66MB 부담, Node.js 미지원 (v2.0)
- JSCAD: Pure JS라 느림
- csgrs: 치명적 버그
- CGAL.js: 실험적

---

### 텍스트 렌더링 통합 계획

#### 옵션 1: Rust 엔진에 ttf-parser 통합 (권장)

```rust
// cad-engine/Cargo.toml
[dependencies]
ttf-parser = "0.24"

// cad-engine/src/text.rs
use ttf_parser::{Face, OutlineBuilder};

struct PathBuilder {
    commands: Vec<PathCommand>,
}

impl OutlineBuilder for PathBuilder {
    fn move_to(&mut self, x: f32, y: f32) {
        self.commands.push(PathCommand::MoveTo(x, y));
    }
    fn line_to(&mut self, x: f32, y: f32) {
        self.commands.push(PathCommand::LineTo(x, y));
    }
    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        // 쿼드라틱 → 큐빅 변환
        self.commands.push(PathCommand::QuadTo(x1, y1, x, y));
    }
    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.commands.push(PathCommand::CurveTo(x1, y1, x2, y2, x, y));
    }
    fn close(&mut self) {
        self.commands.push(PathCommand::Close);
    }
}

// WASM 인터페이스
#[wasm_bindgen]
pub fn text_to_paths(font_data: &[u8], text: &str, size: f32) -> JsValue {
    let face = Face::parse(font_data, 0).unwrap();
    let scale = size / face.units_per_em() as f32;

    let mut paths = Vec::new();
    let mut x = 0.0;

    for c in text.chars() {
        if let Some(glyph_id) = face.glyph_index(c) {
            let mut builder = PathBuilder::new();
            face.outline_glyph(glyph_id, &mut builder);
            // 스케일 및 위치 적용
            paths.push(builder.to_path(x, 0.0, scale));
            x += face.glyph_hor_advance(glyph_id).unwrap_or(0) as f32 * scale;
        }
    }

    serde_wasm_bindgen::to_value(&paths).unwrap()
}
```

**장점**:
- WASM 크기 최소 (~50KB 추가)
- Rust 빌드 체인 통합
- 폰트 파싱 성능 우수

#### 옵션 2: TypeScript 레이어에서 opentype.js 사용

```typescript
// cad-tools/src/sandbox/text.ts
import opentype from 'opentype.js';

export async function textToPath(
  fontPath: string,
  text: string,
  x: number,
  y: number,
  fontSize: number
): Promise<PathCommand[]> {
  const font = await opentype.load(fontPath);
  const path = font.getPath(text, x, y, fontSize);

  return path.commands.map(cmd => {
    switch (cmd.type) {
      case 'M': return { type: 'moveTo', x: cmd.x, y: cmd.y };
      case 'L': return { type: 'lineTo', x: cmd.x, y: cmd.y };
      case 'C': return { type: 'curveTo', x1: cmd.x1, y1: cmd.y1, x2: cmd.x2, y2: cmd.y2, x: cmd.x, y: cmd.y };
      case 'Q': return { type: 'quadTo', x1: cmd.x1, y1: cmd.y1, x: cmd.x, y: cmd.y };
      case 'Z': return { type: 'close' };
    }
  });
}

// Sandbox에서 사용
async function drawText(name: string, text: string, x: number, y: number, fontSize: number) {
  const commands = await textToPath('/fonts/NotoSans.ttf', text, x, y, fontSize);
  // drawBezier로 변환하여 렌더링
  drawBezier(name, commandsToSvgPath(commands));
}
```

**장점**:
- Pure JS, 설치 간단
- 커닝, 리가처 등 OpenType 기능 완벽 지원
- 디버깅 용이

#### 권장 순서

```
1. MVP: opentype.js (빠른 프로토타입)
2. 최적화: ttf-parser (WASM 크기/성능 중요시)
```

---

---

## Implementation Status (2026-01-09)

### PR #27: Manifold 통합 + 텍스트 렌더링 완료

#### Manifold 2D Boolean 연산

**구현 위치**: `cad-tools/src/sandbox/manifold.ts`

```typescript
// 지원 연산
booleanUnion(nameA, nameB, resultName)      // 합집합
booleanDifference(nameA, nameB, resultName) // 차집합 (A - B)
booleanIntersect(nameA, nameB, resultName)  // 교집합

// 기하 분석
offsetPolygon(name, delta, resultName, joinType?)  // 확장/축소
getArea(name)                                       // 면적 계산
convexHull(name, resultName)                        // 볼록 껍질
decompose(name, prefix)                             // 분리 컴포넌트 추출
```

**기술 세부사항**:
- Manifold WASM ~3MB, lazy loading (Boolean 연산 시에만 로드)
- CrossSection API 기반 2D 연산
- Polygon → CrossSection → Polygon 변환 래퍼
- 메모리 관리: `cs.delete()` 자동 호출

**지원 도형**:
| 도형 | Boolean | 면적 | Offset | 비고 |
|------|---------|------|--------|------|
| Circle | ✅ | ✅ | ✅ | 32분할 폴리곤 변환 |
| Rect | ✅ | ✅ | ✅ | 폴리곤 변환 |
| Polygon | ✅ | ✅ | ✅ | 네이티브 지원 |
| Arc | ✅ | ✅ | ✅ | 폴리곤 변환 |
| Line | ❌ | ❌ | ❌ | 열린 도형 |
| Bezier | ❌ | ❌ | ❌ | 폴리곤 근사 필요 |

**Holes 지원**:
- Boolean 결과에 holes 자동 추출
- `draw_polygon_with_holes` API로 저장
- Viewer에서 evenodd fill rule 적용

---

#### 텍스트 렌더링

**구현 위치**: `cad-tools/src/sandbox/text.ts`

```typescript
// API
drawText(name, text, x, y, fontSize, options?)
// options: { fontPath?, align?: 'left'|'center'|'right', color?: [r,g,b,a] }

getTextMetrics(text, fontSize, fontPath?)
// returns: { width, height }
```

**기술 세부사항**:
- opentype.js 기반 폰트 파싱
- 글리프 → 베지어 경로 변환
- 다중 서브패스 처리: 각 글자를 개별 Bezier로 생성 후 그룹화
- 시스템 폰트 자동 검색 (Linux/macOS/Windows)

**폰트 검색 순서**:
1. `options.fontPath` 지정 경로
2. 프로젝트 `fonts/` 디렉토리
3. 시스템 폰트 디렉토리

**서브패스 버그 해결**:
- 문제: `e`, `a` 등 내부 구멍 있는 글자에서 스파이크 발생
- 원인: 여러 서브패스를 하나의 베지어로 연결 시 불필요한 선 생성
- 해결: 각 글자를 개별 Bezier 엔티티로 생성 후 그룹화

---

#### Mirror/Duplicate 기능 확장

**구현 위치**: `cad-tools/src/sandbox/index.ts`

```typescript
// Duplicate - 모든 도형 지원
duplicate(sourceName, newName)

// Mirror - 모든 도형 + 그룹 지원
mirror(sourceName, newName, axis)  // axis: 'x' | 'y'
```

**Mirror 지원 도형**:
| 도형 | 지원 | 특수 처리 |
|------|------|----------|
| Circle | ✅ | 중심점 반전 |
| Rect | ✅ | 중심점 반전 |
| Polygon | ✅ | 모든 점 + holes 반전 |
| Line | ✅ | 모든 점 반전 |
| Arc | ✅ | 중심점 + 각도 변환 (π-angle / -angle) |
| Bezier | ✅ | 시작점 + 제어점 + 끝점 반전 |
| Group | ✅ | 재귀적 자식 미러링 |

**Duplicate Holes 버그 해결**:
- 문제: `duplicate()` 시 Polygon의 holes가 복사되지 않음
- 해결: holes 존재 시 `draw_polygon_with_holes` 호출

---

#### Viewer 렌더링 개선

**구현 위치**: `viewer/src/utils/renderEntity.ts`

**변경사항**:
1. Polygon holes 렌더링 지원 (evenodd fill rule)
2. 조건부 evenodd 적용 (holes 있을 때만, 성능 최적화)
3. 렌더 함수 path 생성 여부 반환 (early return 버그 방지)

---

### 입력 검증 강화

**Rust (cad-engine/src/scene/primitives.rs)**:
```rust
// holes 좌표 NaN/Infinity 검증
for (i, hole) in holes.iter().enumerate() {
    for (j, point) in hole.iter().enumerate() {
        if !point[0].is_finite() || !point[1].is_finite() {
            return Err("invalid_hole: contains NaN or Infinity");
        }
    }
}
```

**TypeScript (cad-tools/src/executor.ts)**:
```typescript
// holes 좌표 Number.isFinite 검증
if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
    return { success: false, error: "contains NaN or Infinity" };
}

// drawText 입력 검증
if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(fontSize)) {
    return false;
}
```

---

### 성능 최적화

1. **Manifold Lazy Loading**: Boolean 연산 사용 시에만 WASM 로드
2. **정규식 최적화**: `MANIFOLD_OPERATIONS.some(op => ...)` → 단일 정규식 패턴
3. **evenodd 조건부 적용**: holes 없으면 기본 fill 사용

---

### Migration Path 업데이트

```
Phase 1 (완료): 순수 Rust 구현 - 기본 도형
Phase 2 (완료): Manifold 통합 - 2D CrossSection ✅
Phase 3 (완료): 텍스트 렌더링 - opentype.js ✅
Phase 4 (향후): Manifold 3D CSG 활성화
Phase 5 (향후): ttf-parser Rust 통합 (선택적 최적화)
```

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-01-07 | Claude | Initial draft |
| 2025-01-07 | Claude | 현재 한계점 섹션 추가, Rust 대안 라이브러리 비교 추가 |
| 2026-01-08 | Claude | OpenCascade.js, JSCAD, CGAL.js 평가 추가 |
| 2026-01-08 | Claude | 텍스트 렌더링 라이브러리 비교 추가 |
| 2026-01-08 | Claude | Extended Research 섹션 추가, 종합 비교표 확장 |
| 2026-01-08 | Claude | **Decision: Manifold Only 채택, iShape 제거** |
| 2026-01-08 | Claude | 텍스트 렌더링 통합 계획 추가 (ttf-parser/opentype.js) |
| 2026-01-09 | Claude | **Implementation Status 추가** - PR #27 구현 완료 기록 |
| 2026-01-09 | Claude | Manifold Boolean, 텍스트 렌더링, Mirror/Duplicate 구현 상세 |
| 2026-01-09 | Claude | 입력 검증 강화, 성능 최적화, Migration Path 업데이트 |
