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

## BMAD Integration

`.bmad/` 디렉토리에 BMAD(Business Model Agile Development) 프레임워크 포함:
- `bmm/` - 워크플로우, 문서 템플릿, 테스트 아키텍처 지식
- `core/` - 에이전트 설정, 브레인스토밍/파티모드 워크플로우

## CAD Tools (run_cad_code)

CAD 도형을 JavaScript 코드로 생성합니다. `run_cad_code`가 메인 인터페이스입니다.

### run_cad_code (코드 에디터)

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

### Sandbox 함수 목록

```javascript
// 도형
drawCircle(name, x, y, radius)
drawRect(name, x, y, width, height)
drawLine(name, points)           // [x1, y1, x2, y2, ...]
drawPolygon(name, points)        // 닫힌 다각형
drawArc(name, cx, cy, radius, startAngle, endAngle)
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

### 모듈 시스템

```bash
# house_lib 모듈 생성
npx tsx cad-cli.ts run_cad_code house_lib "
class House {
  constructor(name, x, y) { this.name = name; this.x = x; this.y = y; this.parts = []; }
  drawWall() { drawRect(this.name+'_wall', this.x-20, this.y, 40, 30); this.parts.push(this.name+'_wall'); }
  drawRoof() { drawPolygon(this.name+'_roof', [this.x-25, this.y+30, this.x, this.y+50, this.x+25, this.y+30]); this.parts.push(this.name+'_roof'); }
  build() { this.drawWall(); this.drawRoof(); createGroup(this.name, this.parts); return this; }
}
"

# main에서 사용
npx tsx cad-cli.ts run_cad_code main "
import 'house_lib';
new House('h1', 0, 0).build();
new House('h2', 100, 0).build();
"
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
npx tsx cad-cli.ts list_entities
npx tsx cad-cli.ts export_json
npx tsx cad-cli.ts export_svg
npx tsx cad-cli.ts capture_viewport  # 뷰어 스크린샷 (PNG)
```

**Bezier 커브 포맷 (중요!):**
```javascript
// drawBezier(name, points, closed)
// points 배열 구조: [startX, startY, cp1x, cp1y, cp2x, cp2y, endX, endY, ...]
//   - 첫 2개: 시작점 (startX, startY)
//   - 이후 6개씩: 세그먼트 (cp1, cp2, end)

// 예: 부드러운 S 커브
drawBezier("wave", [
  0, 0,           // 시작점
  20, 50,         // 제어점1
  40, -50,        // 제어점2
  60, 0,          // 끝점 (= 다음 세그먼트 시작점)
  80, 50,         // 제어점1
  100, -50,       // 제어점2
  120, 0          // 끝점
], false);

// 예: 닫힌 유기적 형태 (구름, 눈덩이 등)
drawBezier("cloud", [
  0, 0,           // 시작점
  30, 20, -10, 30, 20, 40,  // 세그먼트 1
  50, 45, 40, 20, 30, 10,   // 세그먼트 2
  10, 5, -5, -10, 0, 0      // 마지막 세그먼트 (시작점으로 돌아옴)
], true);  // closed=true
```

### 결과 확인

- Scene은 `viewer/scene.json`에 자동 저장됩니다
- 뷰어 실행:
  - `node server.cjs` (권장) - selection.json 저장 지원
  - `python -m http.server 8000` - 기본 뷰어만 (선택 저장 안됨)
- 사용자가 도형을 클릭하면 선택 상태가 UI에 표시되고 selection.json에 저장
- `get_selection` 명령어로 선택된 도형 조회 가능

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

| 규모 | 관리 방식 | 한계 |
|------|-----------|------|
| ~500 엔티티 | 플랫 + 네이밍 컨벤션 | 현재 지원 |
| ~5,000 | 계층적 그룹 | 탐색 어려움 |
| ~50,000 | - | 미지원 |

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
overview();           // → "buildings: 3, entities: 12,847"
listChildren("b1");   // → ["floor_1", "floor_2", ...]
// LLM이 필요한 만큼만 drill-down
```

4. **Batch Operations** - 일괄 처리
```javascript
batch([
  { target: "chair_*", op: "setFill", args: [red] }
]);
```

### Phase별 진화 로드맵

```
Phase 1 (현재): 플랫 + 네이밍       → ~500 엔티티
Phase 2: Scoped Context            → ~5,000 엔티티
Phase 3: Query + Batch             → ~50,000 엔티티
Phase 4: LOD + Lazy Loading        → 무제한
```

자세한 내용: MAMA 결정 `cad:llm_native_abstraction` 참조
