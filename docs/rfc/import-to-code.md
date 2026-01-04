# RFC: Import to Code (SVG/DXF → run_cad_code JS)

Status: draft

## 요약

외부 벡터 파일(SVG, DXF)을 편집 가능한 JavaScript 코드로 변환하는 기능 제안.

## 배경

### 현재 상태

```
Export만 지원:
  Scene → export_svg → SVG 파일 ✅
  Scene → export_json → JSON 파일 ✅

Import 미지원:
  SVG 파일 → Scene ❌
  DXF 파일 → Scene ❌
```

### 문제

1. **기존 자산 활용 불가**: AutoCAD, Illustrator, Figma에서 만든 도면을 가져올 수 없음
2. **협업 단절**: 디자이너가 만든 SVG를 엔지니어가 수정하려면 수작업 재생성 필요
3. **레퍼런스 활용 불가**: 기존 DXF 도면을 참고하여 수정 불가

### 두 가지 Import 접근법

```
접근 1: 데이터 Import (SVG → scene.json)
  - 결과물: Entity 데이터
  - 수정: 개별 도구로 조작
  - Source of Truth: ❌ 없음

접근 2: 코드 Import (SVG → run_cad_code JS) ⭐ 제안
  - 결과물: 읽을 수 있는 JS 코드
  - 수정: 코드 편집
  - Source of Truth: ✅ scene.code.js
```

### 핵심 인사이트

> **Import = 번역 (Translation)**
>
> SVG/DXF를 우리 코드로 "번역"하면, LLM이 이해하고 수정할 수 있다.

```
기존 도면          우리 코드              수정된 결과
┌─────────┐       ┌─────────────┐       ┌─────────┐
│  .svg   │ ───→  │ drawCircle()│ ───→  │  scene  │
│  .dxf   │ 번역  │ drawRect()  │ 편집  │  .json  │
└─────────┘       │ setFill()   │       └─────────┘
                  └─────────────┘
                      ↓
              save_module로 재사용
```

## 설계

### 아키텍처

```
                     ┌─────────────────────┐
    SVG ─────────────│                     │
         SvgParser   │   CodeGenerator     │───→ run_cad_code JS
                     │                     │
    DXF ─────────────│   - Entity 매핑     │
         DxfParser   │   - 코드 템플릿     │
                     │   - 네이밍 규칙     │
    (향후 AI2 등) ───│                     │
                     └─────────────────────┘
```

### CLI 인터페이스

```bash
# SVG → JS 코드 변환
npx tsx cad-cli.ts svg_to_code '{"file":"drawing.svg"}'
npx tsx cad-cli.ts svg_to_code '{"svg":"<svg>...</svg>"}'

# DXF → JS 코드 변환
npx tsx cad-cli.ts dxf_to_code '{"file":"drawing.dxf"}'

# 옵션
# - prefix: 엔티티 이름 접두사 (기본: 파일명)
# - flatten: 그룹 무시하고 플랫하게 변환
```

### 응답 형식

```json
{
  "success": true,
  "code": "// Imported from: drawing.svg\n\ndrawCircle(\"circle_1\", 50, 100, 30);\nsetFill(\"circle_1\", [1, 0, 0, 1]);\n...",
  "stats": {
    "entities": 15,
    "groups": 3,
    "pending_extensions": 3
  },
  "extensions_needed": [
    { "element": "text", "count": 2, "phase": 6 },
    { "element": "gradient", "count": 1, "phase": 5 }
  ],
  "notes": [
    "2 text elements → Phase 6 Text Entity 확장 후 지원",
    "1 gradient → Phase 5 Gradient Fill 확장 후 지원 (현재: 단색 변환)"
  ]
}
```

## SVG → JS 변환

### 요소별 변환

| SVG 요소 | 변환 결과 | 상태 | 확장 필요 |
|----------|-----------|------|-----------|
| `<circle>` | `drawCircle()` | ✅ 지원 | - |
| `<rect>` | `drawRect()` | ✅ 지원 | - |
| `<line>` | `drawLine()` | ✅ 지원 | - |
| `<polyline>` | `drawLine()` | ✅ 지원 | - |
| `<polygon>` | `drawPolygon()` | ✅ 지원 | - |
| `<path>` C/S | `drawBezier()` | ✅ 지원 | - |
| `<path>` A | `drawArc()` | ✅ 지원 | 근사 변환 |
| `<g>` | `createGroup()` | ✅ 지원 | - |
| `<ellipse>` | `drawEllipse()` | 🔧 Phase 5 | **Ellipse Geometry** |
| `<text>` | `drawText()` | 🔧 Phase 6 | **Text Entity** |
| gradients | `setGradient()` | 🔧 Phase 5 | **Gradient Fill** |
| compound path | `drawPolygon()` | 🔧 Phase 5 | **Hole 지원** |

### 변환 예시

**Input SVG:**
```xml
<svg viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="50" fill="#ff0000"/>
  <rect x="20" y="20" width="60" height="40" stroke="#0000ff" fill="none"/>
  <g transform="translate(150, 50)">
    <circle cx="0" cy="0" r="20" fill="#00ff00"/>
    <circle cx="0" cy="40" r="20" fill="#00ff00"/>
  </g>
</svg>
```

**Output JS:**
```javascript
// Imported from: drawing.svg
// Generated: 2026-01-03

// === Main Elements ===
drawCircle("circle_1", 100, 100, 50);
setFill("circle_1", [1, 0, 0, 1]);

drawRect("rect_1", 20, 20, 60, 40);
setStroke("rect_1", [0, 0, 1, 1], 1);

// === Group: g_1 ===
drawCircle("g_1_circle_1", 0, 0, 20);
setFill("g_1_circle_1", [0, 1, 0, 1]);

drawCircle("g_1_circle_2", 0, 40, 20);
setFill("g_1_circle_2", [0, 1, 0, 1]);

createGroup("g_1", ["g_1_circle_1", "g_1_circle_2"]);
translate("g_1", 150, 50);
```

### SVG 파싱 전략

```typescript
// 브라우저 내장 DOMParser 활용 (Node.js는 jsdom 사용)
const parser = new DOMParser();
const doc = parser.parseFromString(svgString, "image/svg+xml");

// 재귀적 요소 탐색
function traverse(element: Element, parentId?: string) {
  for (const child of element.children) {
    switch (child.tagName) {
      case 'circle': convertCircle(child, parentId); break;
      case 'rect': convertRect(child, parentId); break;
      case 'g': convertGroup(child, parentId); break;
      // ...
    }
  }
}
```

## DXF → JS 변환

### 라이브러리 선택

| 라이브러리 | 장점 | 단점 |
|-----------|------|------|
| `dxf-parser` | 단순, 가벼움 | 4년 전 업데이트 |
| `dxf` | SVG 변환 내장, CLI | 중간 복잡도 |
| `dxf-viewer` | 최신, 성능 좋음 | WebGL 의존 |

**선택: `dxf`** - SVG 변환 로직 참고 가능, 활발한 유지보수

### 지원 Entity

| DXF Entity | 변환 결과 | 상태 | 확장 필요 |
|------------|-----------|------|-----------|
| LINE | `drawLine()` | ✅ 지원 | - |
| CIRCLE | `drawCircle()` | ✅ 지원 | - |
| ARC | `drawArc()` | ✅ 지원 | - |
| LWPOLYLINE | `drawLine/Polygon()` | ✅ 지원 | - |
| POLYLINE | `drawLine/Polygon()` | ✅ 지원 | 2D만 |
| SPLINE | `drawBezier()` | ✅ 지원 | 변환 알고리즘 |
| ELLIPSE | `drawEllipse()` | 🔧 Phase 5 | **Ellipse Geometry** |
| TEXT/MTEXT | `drawText()` | 🔧 Phase 6 | **Text Entity** |
| HATCH | `drawPolygon()` | 🔧 Phase 5 | **Hole 지원** |
| BLOCK/INSERT | 함수 패턴 | ✅ 지원 | 중첩 블록 |
| DIMENSION | `drawDimension()` | 🔧 Phase 7 | **Dimension Entity** |

### 변환 예시

**Input DXF (간략화):**
```
ENTITIES
0
LINE
8
Walls
10
0.0
20
0.0
11
100.0
21
0.0
0
CIRCLE
8
Fixtures
10
50.0
20
50.0
40
10.0
```

**Output JS:**
```javascript
// Imported from: floorplan.dxf
// Generated: 2026-01-03

// === Layer: Walls ===
drawLine("walls_line_1", [0, 0, 100, 0]);

// === Layer: Fixtures ===
drawCircle("fixtures_circle_1", 50, 50, 10);
```

### DXF 특수 처리

**ACI (AutoCAD Color Index) → RGBA:**
```typescript
const ACI_TO_RGB: Record<number, [number, number, number]> = {
  1: [1, 0, 0],       // Red
  2: [1, 1, 0],       // Yellow
  3: [0, 1, 0],       // Green
  4: [0, 1, 1],       // Cyan
  5: [0, 0, 1],       // Blue
  6: [1, 0, 1],       // Magenta
  7: [1, 1, 1],       // White (or Black)
  // ... 256 colors
};
```

**BLOCK/INSERT → Group 패턴:**
```javascript
// BLOCK 정의를 함수로 변환
function block_door(prefix) {
  drawRect(prefix + "_frame", 0, 0, 30, 80);
  drawCircle(prefix + "_handle", 25, 40, 3);
  createGroup(prefix, [prefix + "_frame", prefix + "_handle"]);
}

// INSERT를 함수 호출로 변환
block_door("door_1");
translate("door_1", 100, 0);
rotate("door_1", Math.PI / 2);
```

## 워크플로우

### 1. Import → Edit → Save

```bash
# 1. 기존 도면 import
$ npx tsx cad-cli.ts svg_to_code '{"file":"logo.svg"}'
# → 코드 출력

# 2. 코드 실행 (scene에 반영)
$ npx tsx cad-cli.ts run_cad_code '<imported_code>'

# 3. 수정 (LLM 또는 수동)
$ npx tsx cad-cli.ts run_cad_code '
  // 기존 코드...

  // 수정: 로고 색상 변경
  setFill("logo_main", [0.2, 0.4, 0.8, 1]);
'

# 4. 모듈로 저장
$ npx tsx cad-cli.ts save_module '{"name":"company-logo"}'
```

### 2. Reference Import (참고용)

```javascript
// DXF 도면을 참고하여 새로운 설계
// 기존 도면의 치수/배치를 참조

// --- 원본 DXF에서 추출한 치수 ---
const ROOM_WIDTH = 500;   // floorplan.dxf의 room_1 너비
const DOOR_WIDTH = 80;    // floorplan.dxf의 door 너비

// --- 새로운 설계 ---
drawRect("my_room", 0, 0, ROOM_WIDTH, ROOM_WIDTH * 0.8);
// ...
```

## 지능형 모듈 분해 (대용량 파일 처리)

### 문제: Raw 데이터의 한계

```
복잡한 DXF (5,000+ entities)
    ↓ 단순 변환
5,000줄 JS 코드
    ↓
LLM 컨텍스트 초과 ❌
수정할 위치 찾기 어려움 ❌
전체 구조 파악 불가 ❌
```

**핵심 인사이트**: Raw 데이터를 가져왔다고 해서 바로 사용할 수 없다. LLM이 이해할 수 있는 형태로 전처리가 필수.

### 해결: 분석 → 분해 → 계층화

```
복잡한 DXF
    ↓ 분석 (패턴 감지)
구조 파악 (레이어, 반복 블록, 영역)
    ↓ 분해 (모듈화)
계층적 모듈 구조
    ↓ 계층화 (Index 생성)
LLM 진입점 + 탐색 가능한 구조
```

### CLI 인터페이스

```bash
# 1. 분석만 (변환 없이 구조 파악)
npx tsx cad-cli.ts dxf_analyze '{"file":"building.dxf"}'

# 2. 단일 파일 변환 (소규모용, 기존)
npx tsx cad-cli.ts dxf_to_code '{"file":"simple.dxf"}'

# 3. 모듈로 분해 (대규모용, 신규)
npx tsx cad-cli.ts dxf_to_modules '{"file":"building.dxf"}'
npx tsx cad-cli.ts svg_to_modules '{"file":"complex.svg"}'
```

### 분석 응답

```json
{
  "file": "office-building.dxf",
  "total_entities": 5247,
  "analysis": {
    "by_layer": [
      { "name": "Walls", "count": 523, "suggested_module": "walls" },
      { "name": "Doors", "count": 89, "suggested_module": "doors" },
      { "name": "Furniture", "count": 1847, "suggested_module": "furniture" }
    ],
    "repeated_blocks": [
      { "name": "DESK", "instances": 45, "can_extract": true },
      { "name": "CHAIR", "instances": 120, "can_extract": true }
    ],
    "complexity": "high",
    "recommended_strategy": "by_layer + block_extraction"
  }
}
```

### 생성되는 모듈 구조

```
.cad-modules/
├── building-index.js       # 전체 구조 개요 (LLM 진입점)
├── building-walls.js       # 레이어별 모듈
├── building-doors.js
├── building-furniture.js
└── blocks/                 # 반복 패턴 추출
    ├── desk.js
    └── chair.js
```

### Index 모듈 (LLM 진입점)

```javascript
// building-index.js
/**
 * Office Building Layout
 * =====================
 * Source: office-building.dxf
 * Total: 5,247 entities → 4 modules + 2 blocks
 *
 * STRUCTURE:
 * ├── walls (523) - 외벽, 내벽, 파티션
 * ├── doors (89) - 출입문, 방화문
 * ├── furniture (1847) - 책상 45개, 의자 120개, 기타
 * └── electrical (632) - 콘센트, 스위치
 *
 * REUSABLE BLOCKS:
 * - desk (blocks/desk.js) - 45 instances
 * - chair (blocks/chair.js) - 120 instances
 *
 * QUICK ACTIONS:
 * - 전체 로드: loadAll()
 * - 구조만: loadStructure() // walls + doors
 * - 가구만: import * from 'building-furniture'
 */

function loadAll() {
  import * from 'building-walls';
  import * from 'building-doors';
  import * from 'building-furniture';
  import * from 'building-electrical';
}

function loadStructure() {
  import * from 'building-walls';
  import * from 'building-doors';
}

// 메타데이터 (LLM 조회용)
const BUILDING_META = {
  dimensions: { width: 5000, height: 3000 },
  rooms: ["lobby", "office_1", "office_2", "meeting_room"],
  doors: { count: 89, types: ["swing", "sliding", "fire"] }
};
```

### LLM 워크플로우

```
1. Index 읽기
   LLM: "building-index.js 확인 → 5,247개지만 4개 모듈로 구조화됨"

2. 필요한 모듈만 로드
   User: "가구 배치 수정해줘"
   LLM: "building-furniture.js만 로드 (1,847개, 대부분 desk/chair 참조)"

3. 블록 수정으로 일괄 변경
   User: "책상을 L자형으로 바꿔줘"
   LLM: "blocks/desk.js 수정 → 45개 인스턴스 모두 변경"
```

### 분해 전략

| 전략 | 적용 기준 | 장점 |
|------|-----------|------|
| `by_layer` | DXF 레이어 기반 | CAD 원본 구조 유지 |
| `by_block` | 반복 BLOCK 추출 | 재사용성 극대화 |
| `spatial` | 영역별 분할 | 대형 도면 (건축, 도시) |
| `hybrid` | 레이어 + 블록 조합 | 가장 효과적 (기본값) |

```bash
# 전략 지정
dxf_to_modules '{"file":"building.dxf", "strategy":"hybrid"}'
dxf_to_modules '{"file":"city-plan.dxf", "strategy":"spatial", "gridSize":10000}'
```

### 패턴 감지 알고리즘

```typescript
interface PatternDetector {
  // 반복 블록 감지 (DXF INSERT, SVG <use>)
  detectRepeatedBlocks(entities: Entity[]): Block[];

  // 유사 그룹 감지 (geometry 유사도 기반)
  detectSimilarGroups(entities: Entity[], threshold: number): Cluster[];

  // 레이어/그룹 분석
  analyzeHierarchy(entities: Entity[]): HierarchyNode;

  // 공간 분할 (대형 도면용)
  spatialPartition(entities: Entity[], gridSize: number): Zone[];
}
```

## 구현 계획

### Phase 1: SVG 기본 (1일)

```
- [ ] SVG 파서 구현 (DOMParser/jsdom)
- [ ] 기본 요소 변환 (circle, rect, line, polygon)
- [ ] 스타일 변환 (fill, stroke)
- [ ] svg_to_code CLI 명령어
- [ ] 테스트: Figma export SVG
```

### Phase 2: SVG 고급 (1일)

```
- [ ] Path 파싱 (M, L, C, Z)
- [ ] Group 처리 (<g>)
- [ ] Transform 파싱 (translate, rotate, scale)
- [ ] viewBox/좌표계 처리
- [ ] 테스트: Illustrator export SVG
```

### Phase 3: DXF 기본 (1일)

```
- [ ] dxf 라이브러리 통합
- [ ] 기본 Entity 변환 (LINE, CIRCLE, ARC)
- [ ] 레이어 → 주석 변환
- [ ] dxf_to_code CLI 명령어
- [ ] 테스트: AutoCAD 기본 도면
```

### Phase 4: DXF 고급 (1일)

```
- [ ] LWPOLYLINE, POLYLINE 변환
- [ ] SPLINE → Bezier 변환
- [ ] BLOCK/INSERT → 함수 패턴
- [ ] ACI → RGBA 변환
- [ ] 테스트: 실제 건축/기계 도면
```

### Phase 4.5: 지능형 모듈 분해 (2일)

```
- [ ] 분석 명령어 (dxf_analyze, svg_analyze)
- [ ] 패턴 감지: 레이어별 분류
- [ ] 패턴 감지: 반복 블록 추출 (DXF BLOCK/INSERT)
- [ ] 모듈 분해 명령어 (dxf_to_modules, svg_to_modules)
- [ ] Index 모듈 자동 생성 (LLM 진입점)
- [ ] 분해 전략 옵션 (by_layer, by_block, spatial, hybrid)
- [ ] 테스트: 5,000+ entity 대용량 파일
```

## Import 완전 지원을 위한 확장 로드맵

Import 기능이 더 많은 요소를 지원하려면 CAD 엔진 확장이 필요합니다.

### Phase 5: Geometry 확장 (Ellipse, Hole)

| 확장 | 구현 내용 | Import 효과 |
|------|-----------|-------------|
| **Ellipse** | `Ellipse { center, rx, ry }` | SVG `<ellipse>`, DXF ELLIPSE |
| **Hole** | `Polygon { outer, holes }` | SVG compound path, DXF HATCH |

```rust
// entity.rs
Geometry::Ellipse {
    center: [f64; 2],
    rx: f64,
    ry: f64,
}

Geometry::Polygon {
    points: Vec<[f64; 2]>,
    holes: Vec<Vec<[f64; 2]>>,  // 구멍들
}
```

### Phase 5: Style 확장 (Gradient)

| 확장 | 구현 내용 | Import 효과 |
|------|-----------|-------------|
| **Gradient** | `Fill { Solid \| Linear \| Radial }` | SVG gradients, 고급 스타일 |

```rust
// style.rs
pub enum Fill {
    Solid { color: [f64; 4] },
    Linear(LinearGradient),
    Radial(RadialGradient),
}
```

### Phase 6: Text Entity

| 확장 | 구현 내용 | Import 효과 |
|------|-----------|-------------|
| **Text** | `Text { position, content, font, size }` | SVG `<text>`, DXF TEXT/MTEXT |

```rust
// entity.rs
Geometry::Text {
    position: [f64; 2],
    content: String,
    font_size: f64,
    font_family: Option<String>,
}
```

### Phase 7: Dimension Entity (선택)

| 확장 | 구현 내용 | Import 효과 |
|------|-----------|-------------|
| **Dimension** | 치수선 표기 | DXF DIMENSION (CAD 전용) |

### 확장 전 임시 처리 전략

확장이 완료되기 전까지는 다음 전략으로 처리:

```javascript
// Imported from: complex-design.svg
//
// 📋 PENDING EXTENSIONS:
// - 2 text elements → Phase 6에서 지원 예정 (line 15, 23)
// - 1 gradient → Phase 5에서 지원 예정 (line 8)
// - 1 ellipse → Phase 5에서 지원 예정 (line 12)
//
// 💡 TIP: 현재는 단색으로 변환됨. 확장 후 재import 권장.

drawCircle("circle_1", ...);
// ... 변환된 코드 ...
```

### 추가 포맷 후보

| 포맷 | 전략 | 우선순위 |
|------|------|----------|
| AI (Illustrator) | SVG 변환 후 import | 낮음 (SVG로 충분) |
| PDF | 벡터 추출 라이브러리 필요 | 중간 |
| STEP/IGES | 3D CAD 포맷 | 범위 외 |

## 리스크 및 완화

| 리스크 | 영향 | 완화 방안 |
|--------|------|-----------|
| 복잡한 Path 파싱 실패 | 중 | 단순화 + 경고, 수동 수정 안내 |
| DXF 버전 호환성 | 중 | dxf 라이브러리의 지원 범위 명시 |
| 대용량 파일 성능 | 낮 | 10,000 엔티티 이상 경고 |
| 확장 전 요소 처리 | 낮 | 임시 변환 + 재import 안내 |

## 의존성

### NPM 패키지

```json
{
  "dependencies": {
    "dxf": "^5.0.0",      // DXF 파싱
    "jsdom": "^24.0.0"    // Node.js에서 SVG 파싱
  }
}
```

### 기존 시스템 연동

```
- run_cad_code: 생성된 코드 실행
- save_module: 변환된 코드 모듈로 저장
- scene.code.js: Source of Truth 유지
```

## 결론

SVG/DXF → JS 코드 변환은:

1. **기존 자산 활용**: 다른 도구에서 만든 도면 재사용
2. **LLM 친화적**: 코드로 변환되어 이해/수정 가능
3. **Source of Truth 유지**: scene.code.js 기반 워크플로우와 일관성
4. **CAD 엔진 성장 동력**: Import 요구사항이 Geometry/Style 확장을 이끔

### Phase별 완전 지원 로드맵

```
Phase 1-4: Import 파서 구현 (SVG/DXF 기본 요소)
Phase 5:   Ellipse, Hole, Gradient 확장 → 대부분의 SVG/DXF 지원
Phase 6:   Text Entity 추가 → 문서 도면 지원
Phase 7:   Dimension Entity (선택) → CAD 전문 기능
```

**핵심 가치**: Import는 "데이터 로딩"이 아니라 "코드로 번역"이다.
**부가 가치**: Import 요구사항 → CAD 엔진 확장 → 표현력 향상의 선순환.
