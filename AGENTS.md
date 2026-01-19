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

## MCP 도구 (6개)

Claude Code 패턴과 일치하도록 설계된 도구입니다:

| 도구 | 설명 | Claude Code 대응 |
|------|------|------------------|
| `glob` | 파일 목록 조회 | Glob |
| `read` | 파일 읽기 | Read |
| `edit` | 파일 부분 수정 → 자동 실행 | Edit |
| `write` | 파일 전체 작성 → 자동 실행 | Write |
| `lsp` | 코드 인텔리전스 (함수 탐색) | LSP |
| `bash` | 명령 실행 (씬 조회, 내보내기) | Bash |

### 파일 관리 (glob, read, edit, write)

**파일명 규칙**: 확장자 없이 논리적 이름 사용
- `'main'` → `~/.ai-native-cad/scene.code.js`
- `'iso_lib'` → `~/.ai-native-cad/modules/iso_lib.js`

```javascript
// 파일 목록
glob({})                              // ['main', 'iso_lib', 'city_lib']
glob({ pattern: '*_lib' })            // ['iso_lib', 'city_lib']

// 파일 읽기 (⚠️ edit/write 전에 반드시!)
read({ file: 'main' })                // main 코드 반환
read({ file: 'iso_lib' })             // 모듈 코드 반환

// 파일 수정 (부분) → 자동 실행 → 실패 시 자동 롤백
edit({
  file: 'main',
  old_code: 'drawCircle(...)',
  new_code: 'drawRect(...)'
})

// 파일 작성 (전체) → 자동 실행 → 실패 시 자동 롤백
write({ file: 'main', code: '...' })
write({ file: 'new_lib', code: '...' })  // 새 모듈 생성
```

### 코드 인텔리전스 (lsp)

```javascript
// 도메인 목록
lsp({ operation: 'domains' })

// 도메인별 함수 시그니처
lsp({ operation: 'describe', domain: 'primitives' })

// 특정 함수 상세 스키마
lsp({ operation: 'schema', name: 'drawCircle' })

// 파일 내 심볼 조회
lsp({ operation: 'symbols', file: 'main' })
```

### 명령 실행 (bash)

```javascript
// 씬 조회
bash({ command: 'info' })             // 씬 정보
bash({ command: 'tree' })             // 씬 트리 구조
bash({ command: 'groups' })           // 그룹 목록
bash({ command: 'draw_order' })       // z-order
bash({ command: 'entity', name: 'box' })  // 엔티티 좌표 조회

// 씬 조작
bash({ command: 'reset' })            // 씬 초기화

// 내보내기
bash({ command: 'capture' })          // 스크린샷 (PNG)
bash({ command: 'svg' })              // SVG 출력
bash({ command: 'json' })             // JSON 출력

// 스냅샷 (undo/redo)
bash({ command: 'snapshot' })         // 스냅샷 저장
bash({ command: 'undo' })             // 이전 스냅샷 복원
bash({ command: 'redo' })             // 다음 스냅샷 복원
```

## 도메인 목록 (Sandbox 함수)

`lsp({ operation: 'describe', domain: '...' })`으로 상세 확인

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

**폰트 검색 순서** (fontPath 생략 시):
1. 프로젝트 `apps/cad-mcp/fonts/` 디렉터리
2. 시스템 폰트 디렉터리

**권장 폰트**: NanumGothic.ttf, NanumMyeongjo.ttf, D2Coding.ttf, NotoSansKR-Regular.otf

### Bezier 경로 형식
```javascript
// SVG path 문법 사용
drawBezier('wave', 'M 0,0 C 30,50 70,50 100,0')
drawBezier('s_curve', 'M 0,0 C 20,50 40,-50 60,0 S 100,-50 120,0')

// 명령어: M(시작), C(큐빅 베지어), S(부드러운 연결), Q(쿼드라틱), L(직선), Z(닫기)
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
drawOrder(name, mode)                     // 'front', 'back', +N, -N, 'above:target', 'below:target'
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
// 모듈 저장 - 구조적인 클래스 패턴
write({ file: 'house_lib', code: `
class House {
  constructor(name, x, y) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.parts = [];
  }

  drawWall() {
    const n = this.name + '_wall';
    drawRect(n, 0, 15, 40, 30);  // 로컬 좌표 (0,0) 기준
    setFill(n, [0.9, 0.85, 0.7, 1]);
    this.parts.push(n);
  }

  drawRoof() {
    const n = this.name + '_roof';
    drawPolygon(n, [-25, 30, 0, 50, 25, 30]);
    setFill(n, [0.6, 0.3, 0.1, 1]);
    this.parts.push(n);
  }

  build() {
    this.drawWall();
    this.drawRoof();
    createGroup(this.name, this.parts);
    translate(this.name, this.x, this.y);  // 그룹 전체 이동
    return this;
  }
}
`})

// main에서 사용
write({ file: 'main', code: `
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

## 클래스 간 배치 패턴

서로 다른 클래스의 엔티티를 상대적으로 배치할 때:

```javascript
// Robot 클래스가 이미 존재할 때, Hat을 로봇 머리 위에 배치
class Hat {
  constructor(name, targetRobotName) {
    this.name = name;
    this.targetRobotName = targetRobotName;
  }
  build() {
    // 1. 타겟 엔티티의 월드 좌표 조회
    const robot = getEntity(this.targetRobotName);
    const headBounds = getWorldBounds(this.targetRobotName + '_head');

    // 2. 로컬 좌표 (0,0) 기준으로 부품 생성
    drawPolygon(this.name, [-15, 0, 15, 0, 10, 20, -10, 20]);
    setFill(this.name, [0.2, 0.2, 0.8, 1]);

    // 3. 타겟의 월드 좌표로 이동
    const hatX = (headBounds.min[0] + headBounds.max[0]) / 2;
    const hatY = headBounds.max[1];  // 머리 위
    translate(this.name, hatX, hatY);
  }
}
```

**핵심**: `getWorldBounds()` → 로컬 생성 → `translate()`로 월드 위치 이동

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

## HMR 스타일 코드 실행

`edit`/`write` 도구는 **HMR (Hot Module Reload)** 스타일로 동작합니다:

1. 코드 검증 (preprocess)
2. 검증 성공 시 씬 reset
3. 전체 코드 재실행
4. 실패 시 파일 + 씬 자동 롤백

```javascript
// 기존 코드에 const x = 10;이 있을 때
edit({ file: 'main', old_code: 'const x = 10;', new_code: 'const x = 20;' })
// → 성공: 씬 reset 후 전체 코드 재실행

write({ file: 'main', code: 'invalid syntax {{' })
// → 실패: 파일 원본 복원, 씬 이전 상태 복원
```

## 에이전트 주의사항

1. **read-first 패턴**: `edit`/`write` 전에 반드시 `read`로 파일 확인
2. **reset 자동 처리**: `edit`/`write` 실행 시 자동으로 reset + 재실행
3. **씬은 영속적**: MCP 재시작 후에도 main.js에서 자동 복원
4. **lsp로 먼저 탐색**: 함수 사용법이 불확실하면 `lsp`로 확인
5. **로컬 좌표 패턴**: 그룹 내 부품은 (0,0) 기준 생성 후 그룹 이동

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `CAD_VIEWER_URL` | `https://parktube.github.io/7-division/` | Puppeteer 캡처 시 사용할 뷰어 URL |

```bash
# 로컬 뷰어로 캡처
CAD_VIEWER_URL=http://localhost:5173 npx @ai-native-cad/mcp start
```

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
import { logger } from './logger.js';
logger.debug('dev only');
logger.error('always');
```

## CI/Pre-commit

| Rust | TypeScript |
|------|------------|
| `cargo fmt --check` | `eslint` |
| `cargo clippy -D warnings` | `tsc --noEmit` |
| `cargo test` | `vitest run` |

---

*최종 업데이트: 2026-01-19*
