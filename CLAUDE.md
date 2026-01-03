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

## CAD Tools (cad-cli.ts)

CAD 도형을 그리거나 수정할 때 `cad-tools/cad-cli.ts`를 Bash로 직접 호출합니다.

### 기본 사용법

```bash
cd cad-tools
npx tsx cad-cli.ts <command> '<json_params>'
```

### 주요 명령어

**Primitives (도형 그리기)**
```bash
npx tsx cad-cli.ts draw_circle '{"name":"head","x":0,"y":100,"radius":30}'
npx tsx cad-cli.ts draw_rect '{"name":"body","x":-25,"y":0,"width":50,"height":80}'
npx tsx cad-cli.ts draw_line '{"name":"arm","points":[0,50,50,30]}'
npx tsx cad-cli.ts draw_arc '{"name":"smile","cx":0,"cy":90,"radius":10,"start_angle":180,"end_angle":360}'
npx tsx cad-cli.ts draw_polygon '{"name":"roof","points":[-30,50, 0,80, 30,50]}'  # 닫힌 다각형 (fill 지원)
```

**Style (스타일 적용)**
```bash
npx tsx cad-cli.ts set_fill '{"name":"head","fill":{"color":[1,0.8,0.6,1]}}'
npx tsx cad-cli.ts set_stroke '{"name":"body","stroke":{"color":[0,0,1,1],"width":2}}'
```

**Transforms (변환)**
```bash
npx tsx cad-cli.ts translate '{"name":"head","dx":10,"dy":20}'
npx tsx cad-cli.ts rotate '{"name":"arm","angle":0.785}'  # 라디안 (≈45°)
npx tsx cad-cli.ts scale '{"name":"body","sx":1.5,"sy":1.5}'
npx tsx cad-cli.ts set_pivot '{"name":"arm","px":0,"py":50}'  # 회전 중심점
npx tsx cad-cli.ts delete '{"name":"temp"}'
```

**Z-Order (렌더링 순서)**
```bash
npx tsx cad-cli.ts set_z_order '{"name":"snow","z_index":100}'  # 높을수록 앞에 렌더링
npx tsx cad-cli.ts bring_to_front '{"name":"snow"}'             # 맨 앞으로
npx tsx cad-cli.ts send_to_back '{"name":"background"}'         # 맨 뒤로
```

**Groups (그룹화 - 객체지향 씬 설계)**
```bash
# 기본 그룹 생성
npx tsx cad-cli.ts create_group '{"name":"arm_group","children":["upper_arm","forearm"]}'
npx tsx cad-cli.ts ungroup '{"name":"arm_group"}'
npx tsx cad-cli.ts add_to_group '{"group_name":"body_group","entity_name":"spine"}'
npx tsx cad-cli.ts remove_from_group '{"group_name":"body_group","entity_name":"spine"}'
```

**그룹 계층 설계 패턴:**
```javascript
// 1. 개별 엔티티 생성 (네이밍 컨벤션: prefix_part)
drawRect("h1_wall", ...);
drawPolygon("h1_roof", ...);
drawRect("h1_door", ...);

// 2. 개체 단위로 그룹화
createGroup("house_1", ["h1_wall", "h1_roof", "h1_door"]);

// 3. 카테고리로 상위 그룹화
createGroup("houses", ["house_1", "house_2", "house_3"]);

// 4. 씬 레벨 그룹 (z-order 중요!)
createGroup("village", ["houses", "trees", "smokes"]);
createGroup("background", ["sky", "ground", "mountains"]);
createGroup("effects", ["snowflakes"]);

// 5. Root 그룹 z-order 설정 (필수!)
setZOrder("background", 0);   // 가장 뒤
setZOrder("village", 100);    // 중간
setZOrder("effects", 200);    // 가장 앞
```

**그룹 사용 시 주의사항:**
- 그룹 내 children도 개별 z-order로 정렬됨
- 그룹에 transform 적용 시 모든 children에 계층적 적용
- 그룹 이름 충돌 주의 (엔티티와 동일 네임스페이스)

**Query (조회)**
```bash
npx tsx cad-cli.ts list_entities
npx tsx cad-cli.ts get_entity '{"name":"head"}'
npx tsx cad-cli.ts get_scene_info
npx tsx cad-cli.ts get_selection     # 뷰어에서 선택된 도형 조회
```

**Export & Capture**
```bash
npx tsx cad-cli.ts export_json
npx tsx cad-cli.ts export_svg
npx tsx cad-cli.ts capture_viewport  # 뷰어 스크린샷 캡처 (PNG)
```

**Session**
```bash
npx tsx cad-cli.ts reset    # 새 scene 시작
npx tsx cad-cli.ts status   # 현재 상태 확인
```

**Code Execution (JavaScript로 복잡한 패턴 생성)**
```bash
# 반복 패턴, 수학적 계산을 JavaScript로 작성
npx tsx cad-cli.ts run_cad_code '
for (let i = 0; i < 6; i++) {
  const angle = i * Math.PI / 3;
  drawLine("arm_" + i, [0, 0, Math.cos(angle) * 50, Math.sin(angle) * 50]);
}
'

# 모듈 저장 및 재사용
npx tsx cad-cli.ts save_module '{"name":"snowflake"}'
npx tsx cad-cli.ts run_module '{"name":"snowflake"}'
npx tsx cad-cli.ts list_modules
```

**Sandbox 바인딩 (run_cad_code 내에서 사용)**
```javascript
// Primitives
drawCircle(name, x, y, radius)
drawRect(name, x, y, width, height)
drawLine(name, points)      // [x1, y1, x2, y2, ...]
drawArc(name, cx, cy, radius, startAngle, endAngle)
drawPolygon(name, points)   // 닫힌 다각형
drawBezier(name, points, closed)  // Cubic Bezier 커브

// Transforms
translate(name, dx, dy)
rotate(name, angle)         // 라디안
scale(name, sx, sy)
setPivot(name, px, py)

// Style
setFill(name, [r, g, b, a])
setStroke(name, [r, g, b, a], width)
setZOrder(name, zIndex)

// Groups
createGroup(name, children)
addToGroup(groupName, entityName)

// Query (월드 변환 조회)
getWorldTransform(name)   // 부모 체인 변환 누적
getWorldPoint(name, x, y) // 로컬→월드 좌표 변환
getWorldBounds(name)      // 월드 좌표 기준 bounds

// Utility
deleteEntity(name)
exists(name)
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
