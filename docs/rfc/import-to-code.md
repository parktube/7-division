# RFC: Import to Code (SVG/DXF → Sandbox JS)

Status: draft (updated: 2026-01-20)

## 요약

외부 벡터 파일(SVG, DXF)을 편집 가능한 JavaScript 코드로 변환하는 기능 제안.
**AI-Native 접근**: LLM이 시각적으로 분석하여 의미 있는 코드로 변환.

## 배경

### 현재 상태

```
Export 지원:
  bash({ command: 'svg' })   → SVG 출력 ✅
  bash({ command: 'json' })  → JSON 출력 ✅

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

접근 2: 코드 Import (SVG → Sandbox JS) ⭐ 제안
  - 결과물: 읽을 수 있는 JS 코드
  - 수정: edit/write 도구로 편집
  - Source of Truth: ✅ main 코드 파일
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
              write({ file: 'module' })로 재사용
```

## 설계

### 아키텍처

```
                     ┌─────────────────────┐
    SVG ─────────────│                     │
         SvgParser   │   CodeGenerator     │───→ Sandbox JS 코드
                     │                     │
    DXF ─────────────│   - Entity 매핑     │
         DxfParser   │   - 코드 템플릿     │
                     │   - 네이밍 규칙     │
    (향후 AI2 등) ───│                     │
                     └─────────────────────┘
```

### MCP 도구 인터페이스

```javascript
// SVG Import
bash({ command: 'import_svg', path: '/path/to/drawing.svg' })
bash({ command: 'import_svg', content: '<svg>...</svg>' })

// DXF Import
bash({ command: 'import_dxf', path: '/path/to/drawing.dxf' })

// 옵션
bash({ command: 'import_svg', path: '...', prefix: 'logo' })  // 엔티티 이름 접두사
bash({ command: 'import_svg', path: '...', flatten: true })   // 그룹 무시
```

### 응답 형식

```json
{
  "success": true,
  "code": "// Imported from: drawing.svg\n\ndrawCircle('circle_1', 50, 100, 30);\nsetFill('circle_1', [1, 0, 0, 1]);\n...",
  "screenshot": "<base64 PNG>",
  "stats": {
    "entities": 15,
    "groups": 3,
    "unsupported": 3
  },
  "unsupported_elements": [
    { "element": "text", "count": 2, "note": "drawText로 대체 가능" },
    { "element": "gradient", "count": 1, "note": "단색으로 변환됨" }
  ]
}
```

## LLM 우선 분석 워크플로우 (AI-Native 핵심!)

### 핵심 문제: 의미 없는 이름

```javascript
// Raw Import 결과 - LLM이 이해할 수 없음
drawRect('rect_001', 10, 20, 50, 40);
drawPolygon('polygon_002', [10, 20, 35, 0, 60, 20]);

// 원하는 결과 - 의미 있는 코드
drawRect('house_wall', 10, 20, 50, 40);
drawPolygon('house_roof', [10, 20, 35, 0, 60, 20]);
createGroup('house', ['house_wall', 'house_roof']);
```

SVG/DXF 파일은 **시각적 형태만** 저장하고, **의미 정보**는 없음.

### 해결: LLM 우선 분석 → 의미 부여 → 코드 생성

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Raw Import (기계적 변환)                               │
│  bash({ command: 'import_svg', path: '...' })                    │
│  → 임시 코드 (rect_001, polygon_002...) + 스크린샷               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: LLM 시각 분석                                          │
│  스크린샷 분석 → "왼쪽 위에 삼각형+사각형 조합 = 집으로 보임"      │
│                "오른쪽 원형 = 나무로 보임"                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: 의미 부여 + 구조화                                     │
│  rect_001 → house_wall                                           │
│  polygon_002 → house_roof                                        │
│  createGroup('house', ['house_wall', 'house_roof'])              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 4: 사용자 검증 (선택)                                     │
│  "집, 나무로 분류했는데 맞나요?"                                  │
│  사용자: "나무 아니고 해바라기야" → 수정                          │
└─────────────────────────────────────────────────────────────────┘
```

### 예시: LLM 분석 워크플로우

```
User: "이 SVG 파일 가져와줘"

Claude:
1. bash({ command: 'import_svg', path: 'scene.svg' })
   → raw_code + screenshot 반환

2. [스크린샷 분석]
   "이미지를 분석한 결과:
   - 왼쪽: 빨간 지붕 + 베이지 벽 = 집 (3개)
   - 중앙: 초록 원 + 갈색 막대 = 나무 (2개)
   - 오른쪽: 파란 사각형 = 자동차

   다음과 같이 구조화하겠습니다..."

3. write({ file: 'main', code: `
   // === 집 1 ===
   drawRect('house1_wall', 0, 0, 40, 30);
   setFill('house1_wall', [0.9, 0.85, 0.7, 1]);
   drawPolygon('house1_roof', [-5, 30, 20, 50, 45, 30]);
   setFill('house1_roof', [0.8, 0.2, 0.1, 1]);
   createGroup('house1', ['house1_wall', 'house1_roof']);

   // === 나무 1 ===
   drawCircle('tree1_crown', 100, 40, 20);
   setFill('tree1_crown', [0.2, 0.6, 0.2, 1]);
   drawRect('tree1_trunk', 97, 0, 6, 20);
   setFill('tree1_trunk', [0.4, 0.25, 0.1, 1]);
   createGroup('tree1', ['tree1_crown', 'tree1_trunk']);

   // ... 나머지 요소들
`})

User: "나무를 소나무로 바꿔줘"
Claude: edit({ file: 'main', old_code: '...', new_code: '...' })
        → LLM이 의미를 알기 때문에 가능!
```

### 컨텍스트 제약 및 해결책

**중요**: LLM 의미 분석은 컨텍스트 윈도우 제약이 있음.

| 단계 | LLM 필요 | 컨텍스트 이슈 |
|------|----------|---------------|
| Phase 1: 기계적 변환 | ❌ 불필요 | 없음 (순수 파싱) |
| Phase 2~4: 의미 분석 | ✅ 필요 | **있음** |

**문제**: 대용량 SVG/DXF (5,000+ 엔티티) → raw_code가 수만 줄 → 컨텍스트 초과

**해결책**:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. 청크 기반 처리                                               │
│     - 레이어별 분할: "Walls 레이어 먼저 분석할게요"               │
│     - 영역별 분할: "왼쪽 위 영역 (x<200) 먼저 처리"               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. 요약 전달 (전체 코드 대신)                                    │
│     - 스크린샷 + "총 847개 엔티티 (circle: 23, rect: 156...)"    │
│     - 엔티티 목록만 전달, 좌표 상세는 파일에 저장                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. 점진적 의미 부여                                              │
│     - 사용자가 뷰어에서 선택한 엔티티만 의미 부여                  │
│     - "이 5개 선택했는데, 뭘로 보이세요?" → "자동차네요"           │
│     - 전체 분석 불필요, 필요한 부분만 점진적 처리                  │
└─────────────────────────────────────────────────────────────────┘
```

**현실적 워크플로우 (대용량 파일)**:

```javascript
// 1. 기계적 Import (즉시, LLM 불필요)
bash({ command: 'import_svg', path: 'large_drawing.svg' })
// → raw_code 파일로 저장 (~/.ai-native-cad/imported.code.js)
// → 스크린샷 + 통계만 반환

// 2. 요약 정보로 전체 파악
// "847개 엔티티: 건물로 보이는 영역(좌상단), 조경 영역(우측)..."

// 3. 사용자 선택 기반 점진적 명명
// 뷰어에서 rect_001~rect_005 선택 → "이건 house_wall로 이름 붙여줘"
edit({ file: 'imported', old_code: 'rect_001', new_code: 'house1_wall', replace_all: true })
```

### 레이어/그룹 힌트 활용

SVG `<g id="...">`나 DXF 레이어명이 있으면 힌트로 활용:

```xml
<!-- SVG with meaningful groups -->
<g id="buildings">
  <g id="house-1">...</g>
  <g id="house-2">...</g>
</g>
<g id="trees">...</g>
```

```
// DXF with layers
Layer: "Walls" → walls_* 접두사
Layer: "Doors" → doors_* 접두사
Layer: "Furniture" → furniture_* 접두사
```

## SVG → JS 변환

### 요소별 변환

| SVG 요소 | 변환 결과 | 상태 |
|----------|-----------|------|
| `<circle>` | `drawCircle()` | ✅ 지원 |
| `<rect>` | `drawRect()` | ✅ 지원 |
| `<line>` | `drawLine()` | ✅ 지원 |
| `<polyline>` | `drawLine()` | ✅ 지원 |
| `<polygon>` | `drawPolygon()` | ✅ 지원 |
| `<path>` C/S/Q/L | `drawBezier()` | ✅ 지원 |
| `<path>` A (arc) | `drawArc()` | ✅ 지원 (근사 변환) |
| `<g>` | `createGroup()` | ✅ 지원 |
| `<ellipse>` | - | ⚠️ 미지원 (원으로 근사) |
| `<text>` | `drawText()` | ✅ 지원 |
| gradients | - | ⚠️ 단색으로 변환 |

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
// Generated: 2026-01-20

// === Main Elements ===
drawCircle('circle_1', 100, 100, 50);
setFill('circle_1', [1, 0, 0, 1]);

drawRect('rect_1', 50, 40, 60, 40);  // center 좌표로 변환
setStroke('rect_1', [0, 0, 1, 1], 1);

// === Group: g_1 ===
drawCircle('g_1_circle_1', 0, 0, 20);
setFill('g_1_circle_1', [0, 1, 0, 1]);

drawCircle('g_1_circle_2', 0, 40, 20);
setFill('g_1_circle_2', [0, 1, 0, 1]);

createGroup('g_1', ['g_1_circle_1', 'g_1_circle_2']);
translate('g_1', 150, 50);
```

## DXF → JS 변환

### 라이브러리 선택

| 라이브러리 | 장점 | 단점 | 적합성 |
|-----------|------|------|--------|
| [`dxf-parser`](https://www.npmjs.com/package/dxf-parser) | 단순, 가벼움 | 업데이트 빈도 낮음 | 중간 |
| [`dxf`](https://www.npmjs.com/package/dxf) | SVG 변환 내장, 활발한 유지보수 | 중간 복잡도 | **높음** |
| [`@jscad/dxf-deserializer`](https://www.npmjs.com/package/@jscad/dxf-deserializer) | JSCAD 스크립트 출력, ACI 색상 지원 | JSCAD 형식 | 참고용 |

**선택: `dxf`** - SVG 변환 로직 참고 가능, 활발한 유지보수

### 지원 Entity

| DXF Entity | 변환 결과 | 상태 |
|------------|-----------|------|
| LINE | `drawLine()` | ✅ 지원 |
| CIRCLE | `drawCircle()` | ✅ 지원 |
| ARC | `drawArc()` | ✅ 지원 |
| LWPOLYLINE | `drawLine/Polygon()` | ✅ 지원 |
| POLYLINE | `drawLine/Polygon()` | ✅ 지원 (2D) |
| SPLINE | `drawBezier()` | ✅ 지원 (변환 필요) |
| ELLIPSE | - | ⚠️ 미지원 |
| TEXT/MTEXT | `drawText()` | ✅ 지원 |
| BLOCK/INSERT | 모듈 패턴 | ✅ 지원 |

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

**BLOCK/INSERT → 모듈 패턴:**
```javascript
// BLOCK 정의를 모듈로 변환
// write({ file: 'block_door', code: `...` })

class Door {
  constructor(name, x, y) {
    this.name = name;
    drawRect(name + '_frame', 0, 0, 30, 80);
    drawCircle(name + '_handle', 25, 40, 3);
    createGroup(name, [name + '_frame', name + '_handle']);
    translate(name, x, y);
  }
}

// INSERT를 인스턴스 생성으로 변환
new Door('door_1', 100, 0);
new Door('door_2', 200, 0);
```

## 워크플로우

### 1. 기본 Import → Edit → Save

```javascript
// 1. SVG Import
bash({ command: 'import_svg', path: 'logo.svg' })
// → raw_code + screenshot 반환

// 2. LLM이 분석 후 의미 있는 코드로 재작성
write({ file: 'main', code: `
  // 분석된 로고 코드
  drawCircle('logo_circle', ...);
  drawPolygon('logo_arrow', ...);
  createGroup('logo', ['logo_circle', 'logo_arrow']);
`})

// 3. 수정
edit({
  file: 'main',
  old_code: "setFill('logo_circle', [1, 0, 0, 1])",
  new_code: "setFill('logo_circle', [0.2, 0.4, 0.8, 1])"
})

// 4. 모듈로 저장 (재사용)
// read → write({ file: 'company_logo', code: '...' })
```

### 2. 대용량 파일: 모듈 분해

```javascript
// 1. 분석
bash({ command: 'import_dxf', path: 'building.dxf', analyze: true })
// → 레이어별 엔티티 수, 반복 블록, 권장 전략

// 2. 영역별 분석 후 모듈 분리
write({ file: 'walls', code: '// 벽 관련 엔티티...' })
write({ file: 'doors', code: '// 문 관련 엔티티...' })
write({ file: 'furniture', code: '// 가구 관련 엔티티...' })

// 3. Index 모듈
write({ file: 'main', code: `
  import 'walls';
  import 'doors';
  import 'furniture';
`})
```

## 구현 계획

### Phase 1: SVG 기본 파싱

```
- [ ] SVG 파서 구현 (svg-parser 라이브러리)
- [ ] 기본 요소 변환 (circle, rect, line, polygon)
- [ ] 스타일 변환 (fill, stroke → setFill, setStroke)
- [ ] bash({ command: 'import_svg' }) 명령어
- [ ] 테스트: Figma export SVG
```

### Phase 2: SVG 고급 + Path

```
- [ ] Path 파싱 (M, L, C, S, Q, Z) → drawBezier
- [ ] Group 처리 (<g>) → createGroup
- [ ] Transform 파싱 (translate, rotate, scale)
- [ ] viewBox/좌표계 처리
- [ ] 테스트: Illustrator export SVG
```

### Phase 3: DXF 기본 파싱

```
- [ ] dxf 라이브러리 통합
- [ ] 기본 Entity 변환 (LINE, CIRCLE, ARC)
- [ ] 레이어 → 그룹/주석 변환
- [ ] bash({ command: 'import_dxf' }) 명령어
- [ ] 테스트: AutoCAD 기본 도면
```

### Phase 4: DXF 고급

```
- [ ] LWPOLYLINE, POLYLINE 변환
- [ ] SPLINE → Bezier 변환 알고리즘
- [ ] BLOCK/INSERT → 모듈 패턴
- [ ] ACI → RGBA 색상 변환
- [ ] 테스트: 실제 건축/기계 도면
```

### Phase 5: LLM 분석 통합 (AI-Native 핵심!)

```
- [ ] import_svg/dxf → raw_code + screenshot 반환
- [ ] LLM 분석 프롬프트 템플릿 작성
- [ ] 의미 부여 워크플로우 가이드 (SKILL 추가)
- [ ] 레이어/그룹 힌트 활용 로직
- [ ] 사용자 검증 인터랙션 패턴
```

### Phase 6: 대용량 파일 처리

```
- [ ] 분석 모드 (analyze: true 옵션)
- [ ] 레이어별 분류 + 통계
- [ ] 반복 블록 추출 (DXF BLOCK/INSERT)
- [ ] 모듈 분해 권장 전략 출력
- [ ] 테스트: 5,000+ entity 파일
```

## 의존성

### NPM 패키지

```json
{
  "dependencies": {
    "svg-parser": "^2.0.0",      // SVG → AST
    "svg-path-parser": "^1.1.0", // Path d 속성 파싱
    "dxf": "^5.0.0"              // DXF 파싱
  }
}
```

### 기존 MCP 도구 연동

| 도구 | 용도 |
|------|------|
| `bash({ command: 'import_svg/dxf' })` | Import 실행, raw_code + screenshot 반환 |
| `write({ file: '...', code: '...' })` | 변환된 코드 저장 → 자동 실행 |
| `edit({ file: '...', ... })` | 부분 수정 → 자동 실행 |
| `bash({ command: 'capture' })` | Import 후 시각적 확인 |
| `glob()`, `read()` | 모듈 관리 |

## 리스크 및 완화

| 리스크 | 영향 | 완화 방안 |
|--------|------|-----------|
| 복잡한 Path 파싱 실패 | 중 | 단순화 + 경고, 수동 수정 안내 |
| DXF 버전 호환성 | 중 | dxf 라이브러리의 지원 범위 명시 |
| 대용량 파일 성능 | 낮 | 10,000 엔티티 이상 경고, 모듈 분해 권장 |
| LLM 의미 분석 오류 | 중 | 사용자 검증 단계 포함 |

## 결론

SVG/DXF → JS 코드 변환의 핵심 가치:

1. **기존 자산 활용**: 다른 도구에서 만든 도면 재사용
2. **AI-Native**: LLM이 시각적 분석으로 의미 부여
3. **Source of Truth 유지**: main 코드 파일 기반 워크플로우와 일관성
4. **편집 가능**: edit/write로 즉시 수정 가능

**핵심 철학**: Import는 "데이터 로딩"이 아니라 **"코드로 번역"** + **"LLM 의미 부여"**이다.
