# AGENTS.md

AI 에이전트(Claude, Gemini, Cursor, Copilot 등)를 위한 개발 규칙.

## 아키텍처 개요

```
GitHub Pages (Viewer)          Local MCP Server
       │                              │
       │ WebSocket (ws://127.0.0.1:3001)
       └──────────────────────────────┘
                     │
               Claude Code CLI
                     │ WASM 직접 호출
               Rust CAD 엔진
```

**데이터 저장**: `~/.ai-native-cad/`
```
~/.ai-native-cad/
├── scene.json       # 씬 상태 (자동 저장/복원)
├── scene.code.js    # main 코드 파일
└── modules/         # 저장된 모듈
```

## MCP 도메인 도구 (5개)

MCP 서버는 5개의 도메인 도구를 제공합니다:

| 도구 | 설명 | 주요 액션 |
|------|------|----------|
| `cad_code` | JavaScript 코드 실행/편집 | 파일 읽기, 쓰기, 추가, 부분 수정 |
| `discovery` | 함수 탐색 | list_domains, describe, list_tools, get_schema |
| `scene` | 씬 상태 조회 | info, overview, groups, selection, reset |
| `export` | 내보내기 | json, svg, capture |
| `module` | 모듈 관리 | save, list, get, delete |

### cad_code (핵심 도구)

CAD JavaScript 실행 환경. 함수/클래스/재귀 모두 가능.

```javascript
// 기본 실행
cad_code({ code: "drawCircle('c', 0, 0, 50)" })

// 파일 읽기
cad_code({ file: 'main' })

// 파일에 쓰기
cad_code({ file: 'main', code: "drawCircle('c', 0, 0, 50)" })

// 추가 모드 (+ prefix)
cad_code({ file: 'main', code: "+setFill('c', [1, 0, 0, 1])" })

// 부분 수정
cad_code({ file: 'main', old_code: 'radius: 50', new_code: 'radius: 100' })
```

### discovery (탐색 도구)

```javascript
// 도메인 목록
discovery({ action: 'list_domains' })

// 도메인별 함수 시그니처
discovery({ action: 'describe', domain: 'primitives' })

// 특정 함수 상세
discovery({ action: 'get_schema', name: 'drawCircle' })
```

### scene (씬 조회)

```javascript
scene({ action: 'info' })       // 씬 요약 (entityCount, bounds)
scene({ action: 'overview' })   // 트리 구조 (groups, hierarchy)
scene({ action: 'selection' })  // 선택된 엔티티
scene({ action: 'reset' })      // 씬 초기화 (⚠️ 되돌릴 수 없음)
```

### export (내보내기)

```javascript
export({ action: 'json' })      // 전체 씬 JSON
export({ action: 'svg' })       // SVG 벡터
export({ action: 'capture' })   // PNG 스크린샷
export({ action: 'capture', clearSketch: true })  // 캡처 후 스케치 클리어
```

### module (모듈 관리)

```javascript
// 모듈 저장
module({ action: 'save', name: 'house_lib', code: 'class House {...}' })

// 모듈 목록
module({ action: 'list' })

// 모듈 조회
module({ action: 'get', name: 'house_lib' })

// 모듈 삭제
module({ action: 'delete', name: 'house_lib' })
```

## 도메인 목록 (Sandbox 함수)

`discovery(action='describe', domain='...')`으로 상세 확인

```
📦 도형 생성
  primitives  - 기본 도형 (circle, rect, line, arc, polygon, bezier)
  text        - 텍스트 렌더링 (drawText, getTextMetrics)

🔄 도형 조작
  transforms  - 변환 (translate, rotate, scale, pivot, duplicate, mirror)
  boolean     - 합치기/빼기 (union, difference, intersect)
  geometry    - 기하 분석 (offset, area, convexHull, decompose)

🎨 스타일 & 구조
  style       - 색상/z-order (fill, stroke, drawOrder)
  groups      - 그룹화 (createGroup, addToGroup)

🔍 조회
  query       - 씬 조회 (getEntity, exists, fitToViewport)
  utility     - 유틸리티 (duplicate, mirror)
```

## 함수 목록 (도메인별)

### primitives - 도형 생성
```javascript
drawCircle(name, x, y, radius)            // (x, y) = 원의 중심
drawRect(name, x, y, width, height)       // (x, y) = 사각형의 중심
drawLine(name, points)                    // [x1, y1, x2, y2, ...]
drawPolygon(name, points)                 // 닫힌 다각형
drawArc(name, cx, cy, radius, startAngle, endAngle)
drawBezier(name, path)                    // SVG path: 'M x,y C cp1 cp2 end Z'
```

### text - 텍스트 렌더링
```javascript
drawText(name, text, x, y, fontSize, options?)
// options: { fontPath?, align?: 'left'|'center'|'right', color?: [r,g,b,a] }
getTextMetrics(text, fontSize, fontPath?)  // { width, height }
```

### transforms - 변환
```javascript
translate(name, dx, dy, options?)         // options: { space: 'world'|'local' }
rotate(name, angle, options?)             // 라디안
scale(name, sx, sy, options?)
setPivot(name, px, py)
deleteEntity(name)
duplicate(source, newName)                // 엔티티 복제
mirror(source, newName, axis)             // 미러 복제 ('x'|'y')
```

### boolean - Boolean 연산 (Manifold)
```javascript
booleanUnion(a, b, result)                // 합집합
booleanDifference(a, b, result)           // 차집합 (A - B)
booleanIntersect(a, b, result)            // 교집합
// 지원 도형: Circle, Rect, Polygon, Arc
```

### geometry - 기하 분석 (Manifold)
```javascript
offsetPolygon(name, delta, result, joinType?)  // joinType: 'round'|'square'|'miter'
getArea(name)                             // 면적 계산
convexHull(name, result)                  // 볼록 껍질
decompose(name, prefix)                   // 분리된 컴포넌트 추출
```

### style - 스타일
```javascript
setFill(name, [r, g, b, a])               // 색상 0~1
setStroke(name, [r, g, b, a], width?)
drawOrder(name, mode)                     // 'front', 'back', +N, 'above:target'
getDrawOrder(groupName?)                  // 드로우 오더 조회
```

### groups - 그룹화
```javascript
createGroup(name, [children])
addToGroup(group, entity)                 // 월드 위치 자동 유지
```

### query - 조회
```javascript
exists(name)                              // boolean
getWorldBounds(name)                      // { min: [x1, y1], max: [x2, y2] }
getEntity(name)                           // local/world 좌표 모두 반환
fitToViewport(width, height, options?)    // 자동 스케일 계산
```

## 좌표계 & 색상 & 각도

| 항목 | 규칙 |
|------|------|
| 좌표계 | Y+ 위쪽, 원점 (0,0) 중심 |
| 색상 | RGBA `[0~1, 0~1, 0~1, 0~1]` (예: 빨강 `[1,0,0,1]`) |
| 각도 | 라디안 |
| 문자열 | 작은따옴표(`'`) 사용 |

## 모듈 시스템

```javascript
// 모듈 저장
module({ action: 'save', name: 'house_lib', code: `
class House {
  constructor(name, x, y) {
    this.name = name;
    this.x = x;
    this.y = y;
  }
  build() {
    drawRect(this.name+'_wall', 0, 15, 40, 30);  // 로컬 좌표
    drawPolygon(this.name+'_roof', [-25,30, 0,50, 25,30]);
    createGroup(this.name, [this.name+'_wall', this.name+'_roof']);
    translate(this.name, this.x, this.y);
  }
}
`})

// main에서 사용
cad_code({ file: 'main', code: `
import 'house_lib';
new House('h1', 0, 0).build();
new House('h2', 100, 0).build();
`})
```

## 그룹 로컬 좌표 패턴 (필수!)

**핵심**: 부품은 (0,0) 기준 로컬 좌표로 생성 → 그룹 후 translate로 이동

```javascript
// ❌ 잘못: 절대 좌표 사용 → 2배 이동!
drawRect(this.name+'_body', this.x, this.y, 20, 40);
translate(this.name, this.x, this.y);

// ✅ 올바른: 로컬 좌표 사용
drawRect(this.name+'_body', 0, 20, 20, 40);  // (0,0) 기준
createGroup(this.name, [...]);
translate(this.name, this.x, this.y);         // 그룹 전체 이동
```

## getEntity 응답 형식

```json
{
  "name": "house1_wall",
  "type": "Rect",
  "parent": "house1",
  "local": {
    "geometry": { "Rect": { "center": [0, 20], "width": 50, "height": 40 } },
    "transform": { "translate": [0, 0], "rotate": 0, "scale": [1, 1] },
    "bounds": { "min": [-25, 0], "max": [25, 40] }
  },
  "world": {
    "bounds": { "min_x": -145, "min_y": 10, "max_x": -95, "max_y": 50 },
    "center": [-120, 30]
  }
}
```

## Z-Order 가이드

```javascript
drawOrder('entity', 'front');       // 맨 앞으로
drawOrder('entity', 'back');        // 맨 뒤로
drawOrder('entity', 1);             // 한 단계 앞으로
drawOrder('entity', 'above:other'); // other 바로 위로

getDrawOrder();           // root level 순서
getDrawOrder('group_a');  // 그룹 내부 순서
```

## 트랜잭션 동작

코드 실행 실패 시 **파일이 변경되지 않습니다** (자동 롤백):

```javascript
// 기존 코드에 const x = 10;이 있을 때
cad_code({ file: 'main', code: '+const x = 20;' })  // 실패 - 변수 재정의
// → 파일 변경 없음, 안전하게 실험 가능
```

## 에이전트 주의사항

1. **cad_code가 메인**: 모든 도형 조작은 `cad_code`로 JavaScript 실행
2. **reset 금지**: 기존 엔티티는 직접 수정 (추가 모드 `+` 사용)
3. **씬은 영속적**: MCP 재시작 후에도 scene.json에서 자동 복원
4. **discovery 먼저**: 함수 사용법이 불확실하면 `discovery`로 확인
5. **로컬 좌표 패턴**: 그룹 내 부품은 (0,0) 기준 생성 후 그룹 이동

## 빠른 시작

```bash
# MCP 서버 시작
npx @ai-native-cad/mcp start

# 뷰어 열기
# → https://parktube.github.io/7-division/
```

## 로컬 개발

```bash
# 의존성 설치
pnpm install

# MCP 서버 + Viewer 개발 모드 (각각 별도 터미널)
pnpm --filter @ai-native-cad/mcp start
pnpm --filter @ai-native-cad/viewer dev
# → http://localhost:5173/
```

## 프로젝트 구조

```
7-division/
├── apps/
│   ├── viewer/        # React 웹 뷰어 (GitHub Pages)
│   └── cad-mcp/       # MCP 서버
├── packages/
│   └── shared/        # 공유 타입 (Zod 스키마)
└── cad-engine/        # Rust CAD 엔진 (WASM)
```

## TypeScript 규칙

**Console 금지** - `logger` 사용:

```typescript
import { logger } from "./logger.js";
logger.debug("dev only");
logger.error("always");
```

## CI/Pre-commit

| Rust | TypeScript |
|------|------------|
| `cargo fmt --check` | `eslint` |
| `cargo clippy -D warnings` | `tsc --noEmit` |
| `cargo test` | `vitest run` |

---

*최종 업데이트: 2026-01-15*
