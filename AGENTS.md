# AGENTS.md

AI 에이전트(Claude, Gemini, Cursor, Copilot 등)를 위한 개발 규칙.

## CAD CLI 사용법

```bash
cd cad-tools
npx tsx cad-cli.ts <command> [args]
```

### 도메인 목록 (`describe <domain>`으로 상세 확인)

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
  group       - 그룹화 (createGroup, addToGroup)

🔍 조회 & 내보내기
  query       - 씬 조회 (getEntity, exists, fitToViewport)
  export      - 내보내기 (capture, json, svg)
  session     - 세션 관리 (reset, --clear-sketch)
```

### run_cad_code (메인 인터페이스)

JavaScript 코드로 CAD 도형을 생성하는 **코드 에디터**입니다.

**기본 (읽기/쓰기)**
```bash
run_cad_code                              # 프로젝트 구조 보기
run_cad_code main                         # main 읽기
run_cad_code my_module                    # 모듈 읽기
run_cad_code main "drawCircle('c', 0, 0, 50)"  # 덮어쓰기
run_cad_code main "+drawRect('r', 0, 0, 30, 30)" # 추가 (+ prefix)
echo "code" | run_cad_code main -         # stdin 멀티라인
```

**탐색 (Progressive Disclosure)**
```bash
run_cad_code --status                     # 프로젝트 요약 (파일/클래스/함수 수)
run_cad_code --info house_lib             # 모듈 상세 (클래스, 함수, imports)
run_cad_code --search drawCircle          # 패턴 검색 (모든 모듈)
run_cad_code --lines house_lib 50-70      # 부분 읽기 (라인 범위)
run_cad_code --capture                    # 뷰어 스크린샷
run_cad_code --capture --clear-sketch     # 캡처 후 스케치 클리어
run_cad_code --selection                  # 선택된 도형
```

**관리**
```bash
run_cad_code --deps                       # 의존성 그래프
run_cad_code --delete my_module           # 모듈 삭제
run_cad_code --clear-sketch               # 스케치만 클리어
```

> `run_cad_code` = `npx tsx cad-cli.ts run_cad_code`

**규칙**: JavaScript 문자열은 작은따옴표(`'`) 사용

### 트랜잭션 동작

코드 실행 실패 시 **파일이 변경되지 않습니다** (자동 롤백):

```bash
# 기존 코드에 const x = 10;이 있을 때
run_cad_code main "+const x = 20;"  # 실패 - 변수 재정의
# → 파일 변경 없음

# 추가 모드에서는 기존 변수 직접 참조 가능
run_cad_code main "+drawCircle('c', x, 0, 30);"  # 성공
```

### 함수 목록 (도메인별)

#### primitives - 도형 생성
```javascript
drawCircle(name, x, y, radius)            // (x, y) = 원의 중심
drawRect(name, x, y, width, height)       // (x, y) = 사각형의 중심
drawLine(name, points)                    // [x1, y1, x2, y2, ...]
drawPolygon(name, points)                 // 닫힌 다각형, 좌표 배열
drawArc(name, cx, cy, radius, startAngle, endAngle)  // (cx, cy) = 호의 중심
drawBezier(name, path)                    // SVG path: 'M x,y C cp1 cp2 end Z'
```

#### text - 텍스트 렌더링 (opentype.js 기반)
```javascript
drawText(name, text, x, y, fontSize, options?)
// options: { fontPath?, align?: 'left'|'center'|'right', color?: [r,g,b,a] }
getTextMetrics(text, fontSize, fontPath?)  // { width, height }
```

#### transforms - 변환
```javascript
translate(name, dx, dy, options?)         // options: { space: 'world'|'local' }
rotate(name, angle, options?)             // 라디안
scale(name, sx, sy, options?)
setPivot(name, px, py)
deleteEntity(name)
duplicate(source, newName)                // 엔티티 복제 (지오메트리, 스타일, 변환 모두)
mirror(source, newName, axis)             // 미러 복제 ('x'|'y')
```

#### boolean - Boolean 연산 (Manifold 기반)
```javascript
booleanUnion(a, b, result)                // 합집합
booleanDifference(a, b, result)           // 차집합 (A - B)
booleanIntersect(a, b, result)            // 교집합
// 지원 도형: Circle, Rect, Polygon, Arc
```

#### geometry - 기하 분석 (Manifold 기반)
```javascript
offsetPolygon(name, delta, result, joinType?)  // 확장(+)/축소(-), joinType: 'round'|'square'|'miter'
getArea(name)                             // 면적 계산 (닫힌 도형만)
convexHull(name, result)                  // 볼록 껍질 생성
decompose(name, prefix)                   // 분리된 컴포넌트 추출 → [prefix_0, prefix_1, ...]
```

#### style - 스타일
```javascript
setFill(name, [r, g, b, a])               // 색상 0~1
setStroke(name, [r, g, b, a], width?)
drawOrder(name, mode)                     // 'front', 'back', +N, -N, 'above:target', 'below:target'
getDrawOrder(groupName?)                  // 드로우 오더 조회
```

#### group - 그룹화
```javascript
createGroup(name, [children])
addToGroup(group, entity)                 // 월드 위치 자동 유지
```

#### query - 조회
```javascript
exists(name)                              // boolean
getWorldBounds(name)                      // { min: [x1, y1], max: [x2, y2] }
getEntity(name)                           // local/world 좌표 모두 반환
fitToViewport(width, height, options?)    // 자동 스케일 계산
```

### getEntity 응답 형식

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

### 색상 & 좌표계

**색상**: RGBA 배열 `[r, g, b, a]` (각 0.0~1.0)
- 빨강: `[1, 0, 0, 1]`
- 반투명 파랑: `[0, 0, 1, 0.5]`

**좌표계**: Y+ 위쪽, 원점 (0,0) 중심

**각도**: 라디안

### Bezier 포맷 (SVG path)

```javascript
// drawBezier(name, path) - SVG path 문자열 사용
//
// 명령어:
//   M x,y     - 시작점 (Move to)
//   C cp1x,cp1y cp2x,cp2y x,y - 큐빅 베지어 (Cubic)
//   S cp2x,cp2y x,y - 부드러운 연결 (Smooth)
//   Q cpx,cpy x,y - 쿼드라틱 베지어
//   L x,y     - 직선 (Line)
//   Z         - 경로 닫기 (Close)

drawBezier('wave', 'M 0,0 C 30,50 70,50 100,0');
drawBezier('s_curve', 'M 0,0 C 20,50 40,-50 60,0 S 100,-50 120,0');
```

### 모듈 시스템

```bash
# house_lib 모듈 생성
npx tsx cad-cli.ts run_cad_code house_lib "
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
"

# main에서 사용
npx tsx cad-cli.ts run_cad_code main "
import 'house_lib';
new House('h1', 0, 0).build();
new House('h2', 100, 0).build();
"
```

**주의**: `import 'module'`은 단순 코드 치환 방식입니다. 모듈과 메인 스크립트 간에 `const`, `let` 식별자가 중복되면 오류가 발생하므로 전역 변수명에 주의하세요. (Class 사용 권장)

### 그룹 로컬 좌표 패턴 (필수!)

**핵심 원칙**: 클래스/모듈 내에서 부품은 **(0,0) 로컬 원점** 기준으로 생성하고, 그룹을 만든 후 `translate`로 최종 위치 이동.

```javascript
// ❌ 잘못된 패턴 - 좌표 중첩 발생
class Robot {
  build() {
    drawRect(this.name+'_body', this.x-10, this.y, 20, 40);  // 절대 좌표
    createGroup(this.name, [...]);
    translate(this.name, this.x, this.y);  // 이동 또 적용 → 2배 이동!
  }
}

// ✅ 올바른 패턴 - 로컬 좌표 + 그룹 이동
class Robot {
  build() {
    drawRect(this.name+'_body', 0, 20, 20, 40);  // 로컬 좌표 (0,0 기준)
    createGroup(this.name, [...]);
    translate(this.name, this.x, this.y);  // 그룹 전체를 최종 위치로
  }
}
```

### Dual Coordinate API

**변환 API space 옵션**:
```javascript
// 월드 좌표 기준 이동 (기본값)
translate('window', 10, 0);
translate('window', 10, 0, { space: 'world' });

// 로컬 좌표 기준 이동 (부모 좌표계)
translate('window', 5, 0, { space: 'local' });

// 스케일도 동일
scale('icon', 2, 2);                    // world 기준
scale('icon', 2, 2, { space: 'local' }); // 부모 기준
```

### 씬 관리

```bash
npx tsx cad-cli.ts status     # 현재 상태
npx tsx cad-cli.ts reset      # 새 씬 시작
npx tsx cad-cli.ts overview   # 전체 구조
```

### Query & Export

```bash
npx tsx cad-cli.ts list_entities
npx tsx cad-cli.ts get_entity '{"name":"head"}'
npx tsx cad-cli.ts get_scene_info
npx tsx cad-cli.ts get_selection     # 뷰어에서 선택된 도형 조회
npx tsx cad-cli.ts export_json
npx tsx cad-cli.ts export_svg
npx tsx cad-cli.ts capture_viewport  # 뷰어 스크린샷 캡처 (PNG)
```

### 결과 확인

- Scene은 `viewer/scene.json`에 자동 저장됩니다
- 뷰어: `node viewer/server.cjs` 실행 후 http://localhost:8000

### Z-Order 가이드

**스코프 기반 할당:**
- **Root level**: 엔티티 생성 시 `max(root_z) + 1`로 자동 할당
- **그룹 내부**: `createGroup`/`addToGroup` 시 0, 1, 2...로 정규화
- **정규화**: `drawOrder` 후 해당 스코프의 z-index가 자동으로 연속 정렬
- **스코프 독립**: 그룹 내부 z-order는 root level에 영향 없음

**drawOrder 사용:**
```javascript
drawOrder('entity', 'front');       // 맨 앞으로
drawOrder('entity', 'back');        // 맨 뒤로
drawOrder('entity', 1);             // 한 단계 앞으로
drawOrder('entity', -2);            // 두 단계 뒤로
drawOrder('entity', 'above:other'); // other 바로 위로
drawOrder('entity', 'below:other'); // other 바로 아래로

getDrawOrder();           // root level 순서
getDrawOrder('group_a');  // 그룹 내부 순서
```

### 크로스 클래스 배치 패턴

**문제**: 클래스 A가 생성한 엔티티 위에 클래스 B의 요소를 배치할 때

**해결**: `getWorldBounds()`로 실제 위치 확인 후 배치

```javascript
// ✅ 올바른 방식 - 실제 위치 확인
robot.build();
const headBounds = getWorldBounds('robot_head');
const bubbleY = headBounds.max[1] + 10;  // 머리 꼭대기 + 여백
drawRect('bubble', headBounds.max[0], bubbleY, 60, 30);
```

### 에이전트 주의사항 (AX Lessons Learned)

1. **run_cad_code가 메인**: 레거시 JSON 명령어보다 run_cad_code 사용 권장
2. **reset 금지**: 기존 엔티티는 직접 수정 (`+setFill`, `+translate`)
3. **Z-Order 조정**: 겹치는 도형이 있으면 `getDrawOrder()`로 순서 확인 후 `drawOrder` 조정
4. **Bezier 데이터 검증**: `drawBezier` 사용 시 좌표값에 `NaN`이나 `Infinity` 포함 금지
5. **Boundary 확인**: 복잡한 다각형이나 베지어는 `getWorldBounds(name)`로 실제 영역 확인
6. **트랜잭션 활용**: 실행 실패 시 파일이 롤백되므로 안전하게 실험 가능

### 레거시 명령어 (JSON 파라미터)

개별 도형 조작 시 사용 (run_cad_code 권장):

```bash
# 도형
npx tsx cad-cli.ts draw_circle '{"name":"head","x":0,"y":100,"radius":30}'
npx tsx cad-cli.ts draw_rect '{"name":"body","x":0,"y":40,"width":50,"height":80}'

# 스타일
npx tsx cad-cli.ts set_fill '{"name":"head","fill":{"color":[1,0.8,0.6,1]}}'
npx tsx cad-cli.ts set_stroke '{"name":"body","stroke":{"color":[0,0,1,1],"width":2}}'

# 변환
npx tsx cad-cli.ts translate '{"name":"head","dx":10,"dy":20}'
npx tsx cad-cli.ts rotate '{"name":"arm","angle":0.785}'
npx tsx cad-cli.ts scale '{"name":"body","sx":1.5,"sy":1.5}'
```

## TypeScript (`cad-tools/`)

**Console 금지** - `logger` 사용:

```typescript
import { logger } from "./logger.js";
logger.debug("dev only"); // production에서 미출력
logger.error("always"); // 항상 출력
```

**ESLint**: `no-console: error`, `no-unused-vars` (`_` prefix 허용)

## Rust (`cad-engine/`)

**Clippy** (`-D warnings`):

- `derivable_impls`: Default derive 사용
- `too_many_arguments`: 8개 이상 시 `#[allow]` 필요

**포맷**: `cargo fmt`

## 에러 메시지 형식

```
[function_name] error_type: detail
```

예: `[add_circle] invalid_input: NaN not allowed`

## CI/Pre-commit

```bash
npm install  # husky + lint-staged 설치
```

| Rust                        | TypeScript     |
| --------------------------- | -------------- |
| `cargo fmt --check`         | `eslint`       |
| `cargo clippy -D warnings`  | `tsc --noEmit` |
| `cargo test`                | `vitest run`   |
| `wasm-pack build --release` | `tsc`          |
