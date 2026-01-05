# AGENTS.md

AI 에이전트(Claude, Gemini, Cursor, Copilot 등)를 위한 개발 규칙.

## CAD CLI 사용법

```bash
cd cad-tools
npx tsx cad-cli.ts <command> [args]
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
```

**관리**
```bash
run_cad_code --deps                       # 의존성 그래프
run_cad_code --delete my_module           # 모듈 삭제
```

> `run_cad_code` = `npx tsx cad-cli.ts run_cad_code`

**규칙**: JavaScript 문자열은 작은따옴표(`'`) 사용

### Sandbox 함수 목록

```javascript
// 도형 - 좌표 기준 주의!
drawCircle(name, x, y, radius)            // (x, y) = 원의 중심
drawRect(name, x, y, width, height)       // (x, y) = 좌하단 코너 (업계 표준)
drawLine(name, points)                    // [x1, y1, x2, y2, ...]
drawPolygon(name, points)                 // 닫힌 다각형, 좌표 배열
drawArc(name, cx, cy, radius, startAngle, endAngle)  // (cx, cy) = 호의 중심
drawBezier(name, points, closed)

// 스타일
setFill(name, [r, g, b, a])      // 색상 0~1
setStroke(name, [r, g, b, a], width)
setZOrder(name, z)               // 높을수록 앞

// 변환
translate(name, dx, dy)
rotate(name, angle)              // 라디안
scale(name, sx, sy)
setPivot(name, px, py)

// 그룹
createGroup(name, [children])
addToGroup(group, entity)

// 조회
exists(name)
getWorldBounds(name)

// 삭제
deleteEntity(name)
```

**색상**: RGBA 배열 `[r, g, b, a]` (각 0.0~1.0)
- 빨강: `[1, 0, 0, 1]`
- 반투명 파랑: `[0, 0, 1, 0.5]`

**Bezier 포맷**: `[startX, startY, cp1x,cp1y,cp2x,cp2y,endX,endY, ...]` (시작점 2개 + 세그먼트 6개씩)

### 모듈 시스템

```bash
# house_lib 모듈 생성
npx tsx cad-cli.ts run_cad_code house_lib "
class House {
  constructor(name, x, y) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.parts = [];
  }
  // ⚠️ 로컬 좌표 (0,0) 기준으로 부품 생성!
  drawWall() {
    drawRect(this.name+'_wall', -20, 0, 40, 30);  // 로컬 좌표
    this.parts.push(this.name+'_wall');
  }
  drawRoof() {
    drawPolygon(this.name+'_roof', [-25, 30, 0, 50, 25, 30]);  // 로컬 좌표
    this.parts.push(this.name+'_roof');
  }
  build() {
    this.drawWall();
    this.drawRoof();
    createGroup(this.name, this.parts);
    translate(this.name, this.x, this.y);  // 그룹 전체를 최종 위치로 이동
    return this;
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
  constructor(name, x, y) { this.name = name; this.x = x; this.y = y; }
  build() {
    drawRect(this.name+'_body', this.x-10, this.y, 20, 40);  // 절대 좌표
    createGroup(this.name, [...]);
    translate(this.name, this.x, this.y);  // 이동 또 적용 → 2배 이동!
  }
}

// ✅ 올바른 패턴 - 로컬 좌표 + 그룹 이동
class Robot {
  constructor(name, x, y) { this.name = name; this.x = x; this.y = y; }
  build() {
    drawRect(this.name+'_body', -10, 0, 20, 40);  // 로컬 좌표 (0,0 기준)
    drawCircle(this.name+'_head', 0, 50, 10);     // 로컬 좌표
    createGroup(this.name, [...]);
    translate(this.name, this.x, this.y);  // 그룹 전체를 최종 위치로
  }
}
```

**왜?**
- `createGroup` 후 `translate`하면 자식 좌표 + 그룹 이동이 합산됨
- 부품에 `this.x`, `this.y`를 직접 더하면 이중 적용

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

### 레거시 명령어 (JSON 파라미터)

개별 도형 조작 시 사용 (run_cad_code 권장):

```bash
# 도형
npx tsx cad-cli.ts draw_circle '{"name":"head","x":0,"y":100,"radius":30}'
npx tsx cad-cli.ts draw_rect '{"name":"body","x":-25,"y":0,"width":50,"height":80}'
npx tsx cad-cli.ts draw_line '{"name":"arm","points":[0,50,50,30]}'
npx tsx cad-cli.ts draw_arc '{"name":"smile","cx":0,"cy":90,"radius":10,"start_angle":180,"end_angle":360}'
npx tsx cad-cli.ts draw_polygon '{"name":"roof","points":[-30,50, 0,80, 30,50]}'
npx tsx cad-cli.ts draw_bezier '{"name":"wave","points":[0,0, 20,50,40,-50,60,0],"closed":false}'

# 스타일
npx tsx cad-cli.ts set_fill '{"name":"head","fill":{"color":[1,0.8,0.6,1]}}'
npx tsx cad-cli.ts set_stroke '{"name":"body","stroke":{"color":[0,0,1,1],"width":2}}'

# 변환
npx tsx cad-cli.ts translate '{"name":"head","dx":10,"dy":20}'
npx tsx cad-cli.ts rotate '{"name":"arm","angle":0.785}'  # 라디안 (≈45°)
npx tsx cad-cli.ts scale '{"name":"body","sx":1.5,"sy":1.5}'
npx tsx cad-cli.ts set_pivot '{"name":"arm","px":0,"py":50}'
npx tsx cad-cli.ts delete '{"name":"temp"}'

# 그룹
npx tsx cad-cli.ts create_group '{"name":"arm_group","children":["upper_arm","forearm"]}'
npx tsx cad-cli.ts ungroup '{"name":"arm_group"}'
npx tsx cad-cli.ts add_to_group '{"group_name":"body_group","entity_name":"spine"}'
npx tsx cad-cli.ts remove_from_group '{"group_name":"body_group","entity_name":"spine"}'
```

### Entity Construction Pattern (예시)

복잡한 객체는 루프나 좌표 계산을 통해 명시적으로 생성:

```javascript
// run_cad_code main 예시
const s = 2; // 스케일

// 머리 & 얼굴
drawCircle('head', 0, 0, 55 * s);
setFill('head', [0.3, 0.55, 0.95, 1]);

// 눈 (반복 활용)
[-18, 18].forEach((x) => {
  drawCircle('eye_' + x, x * s, 5 * s, 10 * s);
  setFill('eye_' + x, [0.15, 0.15, 0.2, 1]);
});

// 미소
drawBezier(
  'smile',
  [-20 * s, -20 * s, -10 * s, -32 * s, 10 * s, -32 * s, 20 * s, -20 * s],
  false
);
```

### 계층적 그룹 설계 패턴

```javascript
// run_cad_code 내에서
// 1. 엔티티 네이밍: prefix_part (h1_wall, h1_roof, h1_door)
// 2. 개체 그룹: createGroup('house_1', ['h1_wall', 'h1_roof', 'h1_door'])
// 3. 카테고리 그룹: createGroup('houses', ['house_1', 'house_2'])
// 4. 씬 그룹: createGroup('village', ['houses', 'trees'])
// 5. Root z-order 필수: setZOrder('background', 0); setZOrder('village', 100);
```

**주의**: 그룹 내 children은 개별 z-order로 정렬됨

### 에이전트 주의사항 (AX Lessons Learned)

1. **run_cad_code가 메인**: 레거시 JSON 명령어보다 run_cad_code 사용 권장
2. **Z-Order 관리**: 도형이 겹칠 경우 `hitTest` 등에서 의도치 않은 결과 발생 가능. `setZOrder` 사용
3. **Bezier 데이터 검증**: `drawBezier` 사용 시 좌표값에 `NaN`이나 `Infinity` 포함 금지
4. **Boundary 확인**: 복잡한 다각형이나 베지어는 `getWorldBounds(name)`로 실제 영역 확인

### 크로스 클래스 배치 패턴 (Cross-Class Placement)

**문제**: 클래스 A가 생성한 엔티티 위에 클래스 B의 요소를 배치할 때, A 내부의 좌표 정보가 B에 전달되지 않음

**해결**: `getWorldBounds()`로 실제 위치 확인 후 배치

```javascript
// ❌ 잘못된 방식 - 내부 좌표를 추측
class Robot { ... }  // 머리가 y + 45*s에 있다고 "기억"
robot.build();
// 말풍선을 y + 50*s에 배치 → 위치가 틀릴 수 있음

// ✅ 올바른 방식 - 실제 위치 확인
robot.build();
const headBounds = getWorldBounds('robot_head');
const bubbleY = headBounds.max[1] + 10;  // 머리 꼭대기 + 여백
drawRect('bubble', headBounds.max[0], bubbleY, 60, 30);
```

**언제 사용?**
- 모듈/클래스가 생성한 엔티티에 외부 요소 연결 시
- 그룹 내부 엔티티 위치 기반으로 다른 엔티티 배치 시
- 복잡한 객체의 특정 부분(머리, 손 등)에 요소 추가 시

**반환값 형식**:
```javascript
getWorldBounds('entity_name')
// → { min: [x1, y1], max: [x2, y2] }
// min: 좌하단, max: 우상단
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
