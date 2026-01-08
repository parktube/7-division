# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**7-division (도화지)**: AI-Native CAD 프로젝트

현재 단계: MVP (Epic 1~3 완료, Epic 4~6 진행 중)

## Key Documents

- `docs/ax-design-guide.md` - AX (Agent eXperience) 설계 가이드. LLM이 잘 일하는 환경 설계 원칙
- `docs/ai-native-cad-proposal.md` - AI-Native CAD 제안서. "AI가 만들고 AI가 사용하는" CAD 비전

## Architecture Decisions (MAMA에 저장됨)

### Direct-First Architecture

- MCP 없이 Claude Code CLI → WASM 직접 실행
- 브라우저는 순수 뷰어 역할만 (검증 UI)
- 향후 채팅 UI 추가 시 Gateway → Claude Code CLI 호출

### Extensibility

- LLM 교체 가능: 보안 클라이언트에 로컬 LLM(Ollama 등) 제공 가능
- MCP 추가 가능: 코어는 그대로, MCP Server 래퍼만 추가

## AX Design Principles (핵심)

1. **LLM의 추론을 막지 않는다** - 도구 100개 나열 대신 도메인 6개 + description
2. **협업은 자동화가 아니다** - 인간 검증/피드백 필수
3. **반복/정밀 작업은 LLM + 도구가 강하다**
4. **도구는 LLM의 언어다** - 이름만 봐도 의도가 보이게
5. **블랙박스를 만들지 않는다** - 진행상황 투명성
6. **진입점 무결성 (Entry Point Integrity)** - `package.json` 스크립트와 `CLAUDE.md`가 실제 도구 경로와 항상 일치해야 에이전트가 헤매지 않는다.

## BMAD Integration

`.bmad/` 디렉토리에 BMAD(Business Model Agile Development) 프레임워크 포함:

- `bmm/` - 워크플로우, 문서 템플릿, 테스트 아키텍처 지식
- `core/` - 에이전트 설정, 브레인스토밍/파티모드 워크플로우

## CAD Tools (코드 에디터)

**run_cad_code = JavaScript IDE for CAD**

스케치가 주어지면:
1. **구조 분석** - 몇 개의 면? 어떤 관계?
2. **클래스 설계** - 재사용 가능한 구조
3. **프로그램 작성** - 모듈로 저장

```
❌ 실행 사고: "drawRect 호출해서 사각형 그리기"
✅ 구현 사고: "Cube 클래스 설계 → 3면 구현 → 인스턴스 생성"
```

### run_cad_code

```bash
cd cad-tools
```

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

### 엔티티 수정 (reset 금지!)

**씬은 영속적입니다.** 기존 엔티티는 직접 수정하세요:

```bash
# ❌ 잘못된 패턴: 리셋 후 재생성
run_cad_code reset
run_cad_code main "... 전체 다시 그리기 ..."

# ✅ 올바른 패턴: 기존 엔티티 직접 수정
run_cad_code main "+drawOrder('arm_r', 'back')"    # z-order 변경
run_cad_code main "+setFill('head', [1,0,0,1])"    # 색상 변경
run_cad_code main "+translate('robot', 10, 0)"     # 위치 이동
run_cad_code main "+rotate('arm', 0.5)"            # 회전
run_cad_code main "+scale('body', 1.5, 1.5)"       # 크기 조정
```

`reset`은 **새 프로젝트 시작**할 때만 사용합니다.

### Sandbox 함수 목록

```javascript
// 도형 - 모든 좌표는 중심 기준
drawCircle(name, x, y, radius); // (x, y) = 원의 중심
drawRect(name, x, y, width, height); // (x, y) = 사각형의 중심
drawLine(name, points); // [x1, y1, x2, y2, ...]
drawPolygon(name, points); // 닫힌 다각형, 좌표 배열
drawArc(name, cx, cy, radius, startAngle, endAngle); // (cx, cy) = 호의 중심
drawBezier(name, path);  // SVG path: 'M x,y C cp1x,cp1y cp2x,cp2y x,y S cp2x,cp2y x,y Z'

// 스타일
setFill(name, [r, g, b, a]); // 색상 0~1
setStroke(name, [r, g, b, a], width);

// Z-Order (drawOrder 단일 API)
// 스코프별 z_index 자동 할당 (root: max+1, 그룹 내부: 0,1,2...)
// drawOrder 후 자동 정규화 (갭/중복 없이 연속적)
drawOrder(name, 'front');       // 맨 앞으로
drawOrder(name, 'back');        // 맨 뒤로
drawOrder(name, 1);             // 한 단계 앞으로 (+N 또는 숫자)
drawOrder(name, -1);            // 한 단계 뒤로 (-N 또는 음수)
drawOrder(name, 'above:target');// target 바로 위로
drawOrder(name, 'below:target');// target 바로 아래로
getDrawOrder(groupName?);       // 드로우 오더 조회 (Progressive Disclosure)

// 변환 (space 옵션: 'world' | 'local', 기본값 'world')
translate(name, dx, dy, options?);       // options: { space: 'world' | 'local' }
rotate(name, angle, options?);           // 라디안 (space 옵션 허용되나 회전은 스칼라값이라 효과 없음)
scale(name, sx, sy, options?);           // options: { space: 'world' | 'local' }
setPivot(name, px, py);

// 그룹
createGroup(name, [children]);
addToGroup(group, entity);

// 조회
exists(name);
getWorldBounds(name);
getEntity(name);  // local/world 좌표 모두 반환 (아래 형식 참조)

// 삭제
deleteEntity(name);
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

### Dual Coordinate API (FR42)

**getEntity 응답 형식** - local/world 좌표 모두 반환:

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

**변환 API space 옵션**:

```javascript
// 스케치 위치에 맞춰 이동 (world 기준, 기본값)
translate('window', 10, 0);
translate('window', 10, 0, { space: 'world' });

// 벽 기준 상대 이동 (local 기준 - 부모 좌표계)
translate('window', 5, 0, { space: 'local' });

// 회전/스케일도 동일
scale('icon', 2, 2);  // world 기준
scale('icon', 2, 2, { space: 'local' });  // 부모 기준
```

**주의**: 기본값이 `'world'`이므로 그룹 내 상대적 배치 시 `{ space: 'local' }` 명시 필요.

### Z-Order 관리 (drawOrder)

**스코프 기반 할당**:
- **Root level**: 엔티티 생성 시 `max(root_z) + 1`로 할당
- **그룹 내부**: `createGroup`/`addToGroup` 시 0, 1, 2...로 정규화
- **정규화**: `drawOrder` 후 해당 스코프의 z-index가 자동으로 연속 정렬 (갭/중복 없음)
- **스코프 독립**: 그룹 내부 z-order는 root level에 영향 없음

LLM은 숫자를 알 필요 없이 상대적 명령어만 사용합니다.

**drawOrder** - 통합 Z-Order API:
```javascript
drawOrder('circle', 'front');       // 맨 앞으로
drawOrder('circle', 'back');        // 맨 뒤로
drawOrder('circle', 1);             // 한 단계 앞으로
drawOrder('circle', -2);            // 두 단계 뒤로
drawOrder('circle', 'above:rect');  // rect 위로
drawOrder('circle', 'below:rect');  // rect 아래로
```

**getDrawOrder** - 순서 조회 (z_index 숫자 노출 안함):
```javascript
// Root level
getDrawOrder();  // { "level": "root", "order": ["bg", "robot", "fg"], "details": {...} }

// 그룹 drill-down
getDrawOrder('robot');  // { "level": "group:robot", "order": ["body", "arm_l", "arm_r"], "details": {...} }
```

**Convention**: `order` 배열에서 왼쪽 = 뒤(먼저 그림), 오른쪽 = 앞(나중 그림)

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
    drawRect(this.name+'_body', -10, 0, 20, 40);  // 로컬 좌표 (0,0 기준)
    createGroup(this.name, [...]);
    translate(this.name, this.x, this.y);  // 그룹 전체를 최종 위치로
  }
}
```

### 씬 관리

```bash
npx tsx cad-cli.ts status     # 현재 상태
npx tsx cad-cli.ts reset      # 새 씬 시작
npx tsx cad-cli.ts overview   # 전체 구조
```

### 레거시 명령어 (JSON 파라미터)

개별 도형 조작 시 사용:

```bash
npx tsx cad-cli.ts draw_circle '{"name":"c1","x":0,"y":0,"radius":50}'
npx tsx cad-cli.ts set_fill '{"name":"c1","fill":{"color":[1,0,0,1]}}'
npx tsx cad-cli.ts translate '{"name":"c1","dx":10,"dy":20}'
```

### Query & Export

```bash
run_cad_code --capture      # 뷰어 스크린샷 (PNG)
run_cad_code --selection    # 선택된 도형 조회
npx tsx cad-cli.ts list_entities
npx tsx cad-cli.ts export_json
npx tsx cad-cli.ts export_svg
```

**Bezier 커브 (SVG path 형식):**

```javascript
// drawBezier(name, path) - SVG path 문자열 사용
//
// 명령어:
//   M x,y     - 시작점 (Move to)
//   C cp1x,cp1y cp2x,cp2y x,y - 큐빅 베지어 (Cubic)
//   S cp2x,cp2y x,y - 부드러운 연결 (Smooth, cp1 자동 반영)
//   Q cpx,cpy x,y - 쿼드라틱 베지어 (자동으로 큐빅 변환)
//   L x,y     - 직선 (Line, 베지어로 변환)
//   Z         - 경로 닫기 (Close)
//
// 소문자 명령어 (m, c, s, l, z)는 상대 좌표

// 예: 단순 큐빅 베지어
drawBezier('wave', 'M 0,0 C 30,50 70,50 100,0');

// 예: 부드러운 S 커브 (S 명령어로 자동 연결)
drawBezier('s_curve', 'M 0,0 C 20,50 40,-50 60,0 S 100,-50 120,0');
// S는 이전 cp2를 반영하여 cp1 자동 계산 → 부드러운 연결

// 예: 닫힌 형태
drawBezier('blob', 'M 0,0 C 30,20 -10,30 20,40 C 50,45 40,20 30,10 C 10,5 -5,-10 0,0 Z');

// 예: 직선과 혼합
drawBezier('mixed', 'M 0,0 L 50,0 C 70,0 100,30 100,50 L 100,100 Z');
```

### 결과 확인

- Scene은 `viewer/scene.json`에 자동 저장됩니다
- 뷰어 실행:
  - `node server.cjs` (권장) - selection.json 저장 지원
  - `python -m http.server 8000` - 기본 뷰어만 (선택 저장 안됨)
- 사용자가 도형을 클릭하면 선택 상태가 UI에 표시되고 selection.json에 저장
- `get_selection` 명령어로 선택된 도형 조회 가능

### 스케치 기반 협업 워크플로우 (중요!)

사용자가 스케치로 의도를 표현하면, LLM은 **의도 확인 → 데이터 읽기 → 계산 → 실행** 순서로 작업합니다.

**⚠️ 이미지에서 좌표 추출 금지** - 구조화된 데이터(sketch.json) 사용!

```
1. capture_viewport → 이미지로 "의도 파악" (뭘 바꾸고 싶은지 대략적 이해)

2. 의도 확인 질문 (모호하면 반드시 물어보기):
   - "스케치 크기에 맞추기?" (match)
   - "스케치 안에 들어가게?" (fit inside)
   - "위치만 이동?" (position only)
   - "크기만 변경?" (size only)

3. sketch.json 읽기 → 정확한 좌표 획득:
   - 이미지/눈금자에서 추정하지 말 것!
   - points 배열에서 min/max 계산
   스케치_중심X = (minX + maxX) / 2
   스케치_중심Y = (minY + maxY) / 2

4. getEntity로 현재 상태 획득:
   현재_중심X = geometry.center.x + transform.translate.x
   현재_중심Y = geometry.center.y + transform.translate.y
   현재_반지름 = geometry.radius * transform.scale.x

5. 계산 후 한 번에 실행
```

**눈금자의 역할:**

- ❌ LLM이 정밀 좌표 추출 (이미지에서 픽셀 추정 = 오차 발생)
- ✅ 사람이 결과 검증
- ✅ LLM이 대략적 방향/위치 이해

**안티패턴**:

- "이미지에서 좌표 읽기" (LLM 약점 - Vision 정밀 측정 어려움)
- "일단 해보고 조정" (인간의 마우스 드래그 방식)

**올바른 패턴**:

- "데이터 파일에서 좌표 읽기" (LLM 강점 - 구조화 데이터 처리)
- "의도 확인 → 계산 → 한 번에 실행"

### 협업 원칙

```
계산 → 검산 → 실행 → 확인 요청
"성공!" (X) → "결과입니다, 확인해주세요" (O)
```

### Lock 가드 (FR37)

사용자가 뷰어에서 엔티티를 잠그면(🔒) `selection.json`의 `locked_entities`에 저장됩니다.

**LLM 수정 시 경고**:

- 잠긴 엔티티를 수정(translate, rotate, scale, setFill, delete 등)하면 경고 발생
- 경고 포맷: `Warning: "entity_name" is locked by user`
- 기본 동작(warn): 경고 출력 후 실행 계속
- selection.json 예시:

```json
{
  "selected_entities": ["circle_1"],
  "locked_entities": ["important_ref"],
  "hidden_entities": ["debug_lines"],
  "timestamp": 1704499200000
}
```

**권장 동작**: 잠긴 엔티티 수정 전 사용자에게 확인 요청

### 색상 형식

RGBA 배열: `[r, g, b, a]` (각 0.0 ~ 1.0)

- 빨강: `[1, 0, 0, 1]`
- 반투명 파랑: `[0, 0, 1, 0.5]`

## Development Rules

- **Console 금지**: `logger` 사용 (`cad-tools/src/logger.ts`)
- **Pre-commit**: `npm install` 후 자동 실행 (fmt, eslint --fix)
- **CI**: fmt → clippy → test → build (Rust), eslint → tsc → vitest (TS)
- 상세: `AGENTS.md` 참조

## Git Workflow

- 메인 브랜치: `main`
- PR 리뷰 시 코멘트로 제안, 직접 수정은 승인 후에만
- SSH 키: `github.com-jungjaehoon` 사용

## 현재 시스템의 한계와 개선 방향

### 현재 한계

| 규모        | 관리 방식            | 한계        |
| ----------- | -------------------- | ----------- |
| ~500 엔티티 | 플랫 + 네이밍 컨벤션 | 현재 지원   |
| ~5,000      | 계층적 그룹          | 탐색 어려움 |
| ~50,000     | -                    | 미지원      |

**구체적 문제:**

- 네이밍 한계: `b1_f3_r12_chair_7_leg_2` 같은 긴 이름
- 컨텍스트 한계: LLM이 모든 엔티티 열거 불가
- 플랫 리스트: 탐색 비용 O(n)

### LLM에 필요한 추상화 (OOP가 아님!)

```
OOP 캡슐화 = 블랙박스 = LLM에 불리 (추론 부담)
LLM-Native = 명시적 범위 + 탐색 가능 + 점진적 상세화
```

**개선 방향:**

1. **Scoped Context** - 작업 범위 제한

```javascript
enterScope("building_1.floor_3.room_12");
setFill("chair_7.leg_2", ...);  // 상대 경로
exitScope();
```

2. **Query Language** - 조건 검색

```javascript
const chairs = find({ type: "chair", in: "room_12" });
```

3. **Progressive Disclosure** - 점진적 탐색

```javascript
overview(); // → "buildings: 3, entities: 12,847"
listChildren("b1"); // → ["floor_1", "floor_2", ...]
// LLM이 필요한 만큼만 drill-down
```

4. **Batch Operations** - 일괄 처리

```javascript
batch([{ target: "chair_*", op: "setFill", args: [red] }]);
```

### Phase별 진화 로드맵

```
Phase 1 (현재): 플랫 + 네이밍       → ~500 엔티티
Phase 2: Scoped Context            → ~5,000 엔티티
Phase 3: Query + Batch             → ~50,000 엔티티
Phase 4: LOD + Lazy Loading        → 무제한
```

자세한 내용: MAMA 결정 `cad:llm_native_abstraction` 참조
