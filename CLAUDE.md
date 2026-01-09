# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**7-division (도화지)**: AI-Native CAD 프로젝트

- **비전**: "AI가 만들고, AI가 사용한다" - LLM이 도구를 조작하고, 인간은 의도/검증
- **현재 단계**: Epic 1~8 완료 (MVP + Manifold 기하 엔진)
- **아키텍처**: Direct-First (MCP 없이 WASM 직접 호출, < 1ms)

## Key Documents

| 문서 | 내용 |
|------|------|
| `docs/ax-design-guide.md` | AX (Agent eXperience) 설계 원칙 |
| `docs/architecture.md` | 기술 아키텍처 |
| `docs/adr/006-geometry-engine.md` | Manifold 기하 엔진 결정 |

## CAD Tools (코드 에디터)

**run_cad_code = JavaScript IDE for CAD**

```bash
cd cad-tools
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

### run_cad_code 명령어

**기본 (읽기/쓰기)**
```bash
run_cad_code                              # 프로젝트 구조
run_cad_code main                         # main 읽기
run_cad_code main "drawCircle('c', 0, 0, 50)"  # 덮어쓰기
run_cad_code main "+drawRect('r', 0, 0, 30, 30)" # 추가 (+ prefix)
echo "code" | run_cad_code main -         # stdin 멀티라인
```

**탐색**
```bash
run_cad_code --status                     # 프로젝트 요약
run_cad_code --info house_lib             # 모듈 상세
run_cad_code --search drawCircle          # 패턴 검색
run_cad_code --capture                    # 뷰어 스크린샷
run_cad_code --capture --clear-sketch     # 캡처 후 스케치 클리어
run_cad_code --selection                  # 선택된 도형
```

**관리**
```bash
run_cad_code --deps                       # 의존성 그래프
run_cad_code --delete my_module           # 모듈 삭제
```

> `run_cad_code` = `npx tsx cad-cli.ts run_cad_code`

**규칙**: 문자열은 작은따옴표(`'`) 사용

### 트랜잭션 동작

코드 실행 실패 시 **파일이 변경되지 않습니다** (자동 롤백):

```bash
# 기존 코드에 const x = 10;이 있을 때
run_cad_code main "+const x = 20;"  # 실패 - 변수 재정의
# → 파일 변경 없음

# 추가 모드에서는 기존 변수 직접 참조 가능
run_cad_code main "+drawCircle('c', x, 0, 30);"  # 성공
```

### 엔티티 수정 (reset 금지!)

**씬은 영속적입니다.** 기존 엔티티는 직접 수정하세요:

```bash
# ❌ 잘못된 패턴: 리셋 후 재생성
run_cad_code reset
run_cad_code main "... 전체 다시 그리기 ..."

# ✅ 올바른 패턴: 기존 엔티티 직접 수정
run_cad_code main "+drawOrder('arm_r', 'back')"
run_cad_code main "+setFill('head', [1,0,0,1])"
run_cad_code main "+translate('robot', 10, 0)"
```

## 함수 목록

### primitives - 도형 생성
```javascript
drawCircle(name, x, y, radius)
drawRect(name, x, y, width, height)
drawLine(name, [x1,y1, x2,y2, ...])
drawPolygon(name, [x1,y1, x2,y2, ...])  // 닫힌 도형
drawArc(name, cx, cy, radius, startAngle, endAngle)
drawBezier(name, path)  // SVG path: 'M x,y C cp1 cp2 end Z'
```

### text - 텍스트 렌더링
```javascript
drawText(name, text, x, y, fontSize, options?)
// options: { fontPath?, align?: 'left'|'center'|'right', color?: [r,g,b,a] }
getTextMetrics(text, fontSize, fontPath?)  // { width, height }
```

### transforms - 변환
```javascript
translate(name, dx, dy, options?)  // options: { space: 'world'|'local' }
rotate(name, angle, options?)      // 라디안
scale(name, sx, sy, options?)
setPivot(name, px, py)
deleteEntity(name)
duplicate(source, newName)         // 엔티티 복제
mirror(source, newName, axis)      // 미러 복제 ('x'|'y')
```

### boolean - Boolean 연산 (Manifold)
```javascript
booleanUnion(a, b, result)         // 합집합
booleanDifference(a, b, result)    // 차집합 (A - B)
booleanIntersect(a, b, result)     // 교집합
// 지원 도형: Circle, Rect, Polygon, Arc
```

### geometry - 기하 분석 (Manifold)
```javascript
offsetPolygon(name, delta, result, joinType?)  // 확장/축소
getArea(name)                      // 면적 계산
convexHull(name, result)           // 볼록 껍질
decompose(name, prefix)            // 분리된 컴포넌트 추출
```

### style - 스타일
```javascript
setFill(name, [r,g,b,a])           // 색상 0~1
setStroke(name, [r,g,b,a], width?)
drawOrder(name, 'front'|'back'|N|'above:target')
getDrawOrder(groupName?)
```

### group - 그룹화
```javascript
createGroup(name, [children])
addToGroup(groupName, entityName)  // 월드 위치 자동 유지
```

### query - 조회
```javascript
exists(name)                       // boolean
getWorldBounds(name)
getEntity(name)                    // local/world 좌표 모두 반환
fitToViewport(width, height, opts?)  // 자동 스케일 계산
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

## 그룹 로컬 좌표 패턴 (필수!)

**핵심**: 부품은 (0,0) 기준 로컬 좌표로 생성 → 그룹 후 translate로 이동

```javascript
// ❌ 잘못: this.x, this.y를 부품에 직접 더함
drawRect(name+'_body', this.x, this.y, 20, 40);

// ✅ 올바른: 로컬 좌표 사용 → 그룹 이동으로 최종 위치
drawRect(name+'_body', 0, 20, 20, 40);
createGroup(name, [name+'_body']);
translate(name, this.x, this.y);
```

## 모듈 시스템

```bash
# house_lib 모듈 생성
run_cad_code house_lib "
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
run_cad_code main "
import 'house_lib';
new House('h1', 0, 0).build();
new House('h2', 100, 0).build();
"
```

## Z-Order 관리 (drawOrder)

```javascript
drawOrder('circle', 'front');       // 맨 앞으로
drawOrder('circle', 'back');        // 맨 뒤로
drawOrder('circle', 1);             // 한 단계 앞으로
drawOrder('circle', 'above:rect');  // rect 위로

getDrawOrder();        // root level 순서
getDrawOrder('robot'); // 그룹 내부 순서
```

**Convention**: `order` 배열에서 왼쪽 = 뒤(먼저 그림), 오른쪽 = 앞(나중 그림)

## 스케치 기반 협업 워크플로우

**⚠️ 이미지에서 좌표 추출 금지** - 구조화된 데이터(sketch.json) 사용!

```
1. capture_viewport → 이미지로 "의도 파악" (대략적 이해)
2. 의도 확인 질문 (모호하면 반드시 물어보기)
3. sketch.json 읽기 → 정확한 좌표 획득
4. getEntity로 현재 상태 획득
5. 계산 후 한 번에 실행
```

**눈금자의 역할:**
- ❌ LLM이 정밀 좌표 추출 (Vision 정밀 측정 어려움)
- ✅ 사람이 결과 검증
- ✅ LLM이 대략적 방향/위치 이해

## Lock 가드 (FR37)

뷰어에서 엔티티를 잠그면(🔒) 수정 시 경고 발생:
- 경고 포맷: `Warning: "entity_name" is locked by user`
- 잠긴 엔티티 수정 전 사용자에게 확인 요청 권장

## 좌표계 & 색상

- **좌표**: Y+ 위쪽, 원점 (0,0) 중심
- **색상**: RGBA `[0~1, 0~1, 0~1, 0~1]` - 예: 빨강 `[1,0,0,1]`
- **각도**: 라디안

## Development Rules

- **Console 금지**: `logger` 사용 (`cad-tools/src/logger.ts`)
- **Pre-commit**: `npm install` 후 자동 실행 (fmt, eslint --fix)
- **CI**: fmt → clippy → test → build (Rust), eslint → tsc → vitest (TS)
- **Git**: `main` 브랜치, SSH 키 `github.com-jungjaehoon`

## AX Design Principles

1. **LLM의 추론을 막지 않는다** - 도메인 10개 + describe로 Progressive Disclosure
2. **협업은 자동화가 아니다** - 인간 검증/피드백 필수
3. **반복/정밀 작업은 LLM + 도구가 강하다**
4. **도구는 LLM의 언어다** - 이름만 봐도 의도가 보이게
5. **블랙박스를 만들지 않는다** - 진행상황 투명성
6. **진입점 무결성** - `CLAUDE.md`가 실제 도구 경로와 항상 일치

## Architecture Decisions

### Direct-First Architecture
- MCP 없이 Claude Code CLI → WASM 직접 실행
- 브라우저는 순수 뷰어 역할만 (검증 UI)
- 향후 채팅 UI 추가 시 Gateway → CLI 호출

### Extensibility
- LLM 교체 가능: 보안 클라이언트에 로컬 LLM(Ollama 등) 제공 가능
- MCP 추가 가능: 코어는 그대로, MCP Server 래퍼만 추가

## 현재 시스템의 한계

| 규모 | 관리 방식 | 상태 |
|------|----------|------|
| ~500 엔티티 | 플랫 + 네이밍 | 현재 지원 |
| ~5,000 | 계층적 그룹 | 탐색 어려움 |
| ~50,000 | - | 미지원 |

**개선 방향**: Scoped Context, Query Language, Progressive Disclosure 강화
