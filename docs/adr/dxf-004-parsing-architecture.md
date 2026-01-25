# ADR-dxf-004: Parsing Architecture (JS vs Rust)

## Status
**Proposed**

## Date
2026-01-21

## Context

DXF 파싱을 어디서 수행할지 결정해야 함:
- **Option A**: JavaScript (Node.js/MCP 서버)에서 파싱
- **Option B**: Rust (WASM)에서 파싱

각 접근 방식의 구조적 차이와 트레이드오프를 분석함.

## Decision

### JavaScript 파싱 채택 ⭐

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Server (Node.js)                      │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │  DXF 파일   │───▶│  dxf 라이브러리   │───▶│  CodeGenerator │  │
│  │  (.dxf)     │    │  (npm/JS 파싱)   │    │  (Entity→JS)   │  │
│  └─────────────┘    └──────────────────┘    └────────────────┘  │
│                                                      │          │
│                           JS 코드: drawLine(), drawCircle()...  │
│                                                      │          │
│  ┌───────────────────────────────────────────────────▼────────┐ │
│  │                      Sandbox Executor                       │ │
│  │  JS 코드 실행 → CADExecutor API 호출                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ WASM 경계
┌─────────────────────────────────────────────────────────────────┐
│                          Rust WASM                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                        Scene                                 │ │
│  │  - draw_line(), draw_circle(), draw_arc()                    │ │
│  │  - Entity 저장, Transform 처리                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                          Viewer (WebGL)                          │
│  - Scene JSON 수신                                               │
│  - WebGL 렌더링                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 구조적 비교

### Option A: JavaScript 파싱 (채택)

```
DXF → [JS] dxf 라이브러리 → [JS] Code Generator → [JS] Sandbox → [WASM] Scene
```

**장점:**
| 항목 | 설명 |
|------|------|
| 기존 라이브러리 | npm `dxf` 사용, 구현 비용 낮음 |
| 유연한 코드 생성 | JS 코드로 변환하여 수정/저장 가능 |
| AI-Native 호환 | LLM이 생성된 JS 코드 이해/편집 가능 |
| 디버깅 용이 | Node.js 환경에서 쉬운 디버깅 |

**단점:**
| 항목 | 설명 |
|------|------|
| 성능 | 대용량 파일 파싱 시 JS 성능 한계 |
| 중복 로직 | Entity 정보가 JS→WASM 경계를 넘음 |

### Option B: Rust 파싱 (직접 Scene 생성)

```
DXF → [WASM] Rust DXF 파서 → [WASM] Scene 직접 생성
```

**Rust DXF 라이브러리:**

| 라이브러리 | crates.io | Stars | 라이센스 | 특징 |
|-----------|-----------|-------|---------|------|
| `dxf` (dxf-rs) | [dxf](https://crates.io/crates/dxf) | 125 ⭐ | MIT ✅ | ASCII/Binary 지원, Spline/Hatch 등 복잡 Entity |

```rust
// Cargo.toml
[dependencies]
dxf = "0.5.0"
```

**장점:**
| 항목 | 설명 |
|------|------|
| 성능 | WASM 네이티브 속도, C#보다 2-3배 빠름 |
| 메모리 | 30-50% 적은 메모리, zero-copy 파싱 |
| 단일 경계 | 파싱→Scene 생성이 WASM 내부 |

**단점:**
| 항목 | 설명 |
|------|------|
| 코드 생성 불가 | 직접 Scene 생성 → JS 코드 없음 → LLM 편집 불가 |
| AI-Native 미호환 | import 결과가 "코드"가 아닌 "데이터" |

### Option C: Hybrid (Rust 파싱 → JS 코드 생성) ⭐ 향후 고려

```
DXF → [WASM] Rust DXF 파서 → [WASM] JS 코드 문자열 생성 → [JS] Sandbox 실행
```

**아키텍처:**
```
┌─────────────────────────────────────────────────────────────────┐
│                          Rust WASM                               │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │  DXF 파일   │───▶│  dxf-rs 라이브러리│───▶│  CodeGenerator │  │
│  │  (.dxf)     │    │  (Rust 파싱)     │    │  (Rust→JS문자열)│  │
│  └─────────────┘    └──────────────────┘    └────────────────┘  │
│                                                      │          │
│                                          JS 코드 문자열 반환     │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ WASM→JS 경계 (문자열)
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Server (Node.js)                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  generatedCode = wasm.parse_dxf_to_code(dxfContent);        │ │
│  │  sandbox.exec(generatedCode);                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**장점:**
| 항목 | 설명 |
|------|------|
| 성능 | Rust 파싱 속도 |
| AI-Native 호환 | JS 코드 생성으로 LLM 편집 가능 ✅ |
| 최적의 조합 | Rust 성능 + JS 유연성 |

**단점:**
| 항목 | 설명 |
|------|------|
| 구현 복잡도 | WASM 바인딩 + Rust CodeGenerator 필요 |
| 유지보수 | Rust/JS 양쪽 코드 관리 |

**예시 코드:**
```rust
// Rust (WASM)
#[wasm_bindgen]
pub fn parse_dxf_to_code(dxf_content: &str) -> String {
    let drawing = dxf::Drawing::load_from_string(dxf_content).unwrap();
    let mut code = String::new();
    
    for entity in drawing.entities {
        match entity {
            Entity::Line(line) => {
                code.push_str(&format!(
                    "drawLine('line_{}', {}, {}, {}, {});\n",
                    line.handle, line.p1.x, line.p1.y, line.p2.x, line.p2.y
                ));
            }
            Entity::Circle(circle) => {
                code.push_str(&format!(
                    "drawCircle('circle_{}', {}, {}, {});\n",
                    circle.handle, circle.center.x, circle.center.y, circle.radius
                ));
            }
            // ... 다른 Entity
        }
    }
    code
}
```

**결론:**
- **MVP**: Option A (JS 파싱) - 빠른 구현
- **성능 이슈 시**: Option C (Hybrid) - Rust 성능 + AI-Native

## 핵심 결정 요소

### 1. AI-Native 철학

> **Import = 번역 (Translation)**
> DXF를 JS 코드로 "번역"하면, LLM이 이해하고 수정할 수 있다.

Rust 파싱은 데이터만 생성하지만, JS 파싱은 **코드**를 생성함.
LLM이 코드를 이해하고 "나무를 소나무로 바꿔줘" 같은 요청 처리 가능.

### 2. Source of Truth

| 접근 방식 | Source of Truth | LLM 편집 |
|-----------|-----------------|----------|
| JS 파싱 | main.js 파일 | ✅ 가능 |
| Rust 파싱 | Scene JSON | ❌ 어려움 |

### 3. 성능 고려

| 파일 크기 | Entity 수 | JS 파싱 | 권장 |
|-----------|-----------|---------|------|
| 소형 | ~1,000 | ✅ 문제없음 | JS |
| 중형 | ~10,000 | ⚠️ 수초 | JS + 경고 |
| 대형 | 10,000+ | ❌ 느림 | 청크 처리 |

대형 파일은 레이어별 청크 처리로 해결 가능.

## Data Flow 상세

```
1. User: "이 DXF 파일 import 해줘" + 파일 업로드

2. MCP Server:
   const dxfContent = fs.readFileSync(path);
   const helper = new Helper(dxfContent);
   const entities = helper.denormalised;

3. Code Generator:
   entities.forEach(e => {
     switch(e.type) {
       case 'LINE': emit(`drawLine('${name}', ${x1}, ${y1}, ${x2}, ${y2});`);
       case 'CIRCLE': emit(`drawCircle('${name}', ${cx}, ${cy}, ${r});`);
       ...
     }
   });

4. Sandbox Executor:
   eval(generatedCode);  // CADExecutor API 호출

5. WASM Scene:
   Scene.draw_line(), Scene.draw_circle()...

6. Viewer:
   scene.json 수신 → WebGL 렌더링

7. LLM 후속 작업:
   "import된 집을 파란색으로 바꿔줘"
   → edit({ file: 'main', old_code: "setFill('house'...", new_code: "..." })
```

## Consequences

### Positive
- AI-Native 워크플로우 완전 호환
- 기존 npm 라이브러리 활용으로 빠른 구현
- 생성된 코드를 모듈로 저장/재사용 가능

### Negative
- 대용량 파일 성능 제한 (청크 처리로 완화)

### Neutral
- WASM과 JS 사이 데이터 전달 오버헤드 (무시 가능 수준)

## References

- [ADR-dxf-001: DXF Import](./dxf-001-import.md)
- [ADR-dxf-003: Library Selection](./dxf-003-library-selection.md)
- [RFC: import-to-code.md](../rfc/import-to-code.md) - AI-Native Import 철학
