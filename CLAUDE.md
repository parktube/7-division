# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**7-division (도화지)**: AI-Native CAD 프로젝트

- **비전**: "AI가 만들고, AI가 사용한다" - LLM이 도구를 조작하고, 인간은 의도/검증
- **현재 단계**: Epic 1~9 완료 (MVP + 웹 아키텍처)
- **아키텍처**: Web + Local MCP (GitHub Pages 뷰어 + 로컬 MCP 서버)
- **구조**: pnpm workspace 모노레포
  - `apps/viewer` - React 뷰어 (GitHub Pages)
  - `apps/cad-mcp` - MCP 서버
  - `packages/shared` - 공유 타입 (Zod 스키마)

## Key Documents

| 문서 | 내용 |
|------|------|
| `docs/ax-design-guide.md` | AX (Agent eXperience) 설계 원칙 |
| `docs/architecture.md` | 기술 아키텍처 |
| `docs/adr/006-geometry-engine.md` | Manifold 기하 엔진 결정 |

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

```javascript
// 기본 실행
cad_code({ code: "drawCircle('c', 0, 0, 50)" })

// 파일 읽기/쓰기
cad_code({ file: 'main' })                    // 읽기
cad_code({ file: 'main', code: "..." })       // 쓰기
cad_code({ file: 'main', code: "+..." })      // 추가 (+ prefix)

// 부분 수정
cad_code({ file: 'main', old_code: '...', new_code: '...' })
```

### discovery (탐색)

```javascript
discovery({ action: 'list_domains' })                    // 도메인 목록
discovery({ action: 'describe', domain: 'primitives' })  // 함수 시그니처
discovery({ action: 'get_schema', name: 'drawCircle' })  // 상세 스키마
```

### scene / export / module

```javascript
scene({ action: 'info' })        // 씬 요약
scene({ action: 'overview' })    // 트리 구조
export({ action: 'capture' })    // PNG 스크린샷
module({ action: 'save', name: 'lib', code: '...' })  // 모듈 저장
```

## 도메인 목록 (Sandbox 함수)

`discovery({ action: 'describe', domain: '...' })`으로 상세 확인

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

### 트랜잭션 동작

코드 실행 실패 시 **파일이 변경되지 않습니다** (자동 롤백):

```javascript
// 기존 코드에 const x = 10;이 있을 때
cad_code({ file: 'main', code: '+const x = 20;' })  // 실패 - 변수 재정의
// → 파일 변경 없음, 안전하게 실험 가능
```

### 엔티티 수정 (reset 금지!)

**씬은 영속적입니다.** 기존 엔티티는 직접 수정하세요:

```javascript
// ❌ 잘못된 패턴: 리셋 후 재생성
scene({ action: 'reset' })
cad_code({ file: 'main', code: '... 전체 다시 그리기 ...' })

// ✅ 올바른 패턴: 기존 엔티티 직접 수정
cad_code({ file: 'main', code: "+drawOrder('arm_r', 'back')" })
cad_code({ file: 'main', code: "+setFill('head', [1,0,0,1])" })
cad_code({ file: 'main', code: "+translate('robot', 10, 0)" })
```

**규칙**: 문자열은 작은따옴표(`'`) 사용

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
// y는 텍스트 기준선(baseline). options: { fontPath?, align?: 'left'|'center'|'right', color?: [r,g,b,a] }
getTextMetrics(text, fontSize, fontPath?)  // { width, height }
```

**폰트 검색 순서** (fontPath 생략 시):
1. 프로젝트 `apps/cad-mcp/fonts/` 디렉터리 (로컬 폰트)
2. 시스템 폰트 디렉터리:
   - Linux: `/usr/share/fonts/truetype`, `/usr/share/fonts/opentype`
   - macOS: `/System/Library/Fonts`, `/Library/Fonts`
   - Windows: `C:\Windows\Fonts`

**권장 폰트** (로컬 설치 시 `apps/cad-mcp/fonts/`에 배치):

| 폰트 | fontPath 예시 | 용도 |
|-----|-------------|------|
| 나눔고딕 | `NanumGothic.ttf` | 기본 고딕 |
| 나눔명조 | `NanumMyeongjo.ttf` | 명조체 |
| D2Coding | `D2Coding.ttf` | 코딩용 고정폭 |
| Noto Sans KR | `NotoSansKR-Regular.otf` | 구글 한글 |

> Note: `fonts/` 디렉터리는 `.gitignore`에 포함됨. 필요한 폰트는 직접 다운로드하거나 시스템 폰트 사용.

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

```javascript
// house_lib 모듈 저장
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

**⚠️ 이미지에서 좌표 추출 금지** - 구조화된 데이터 사용!

```
1. export({ action: 'capture' }) → 이미지로 "의도 파악"
2. 의도 확인 질문 (모호하면 반드시 물어보기)
3. scene({ action: 'overview' }) → 씬 구조 파악
4. cad_code 내 getEntity() → 정확한 좌표 획득
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

## Data Storage

모든 CAD 데이터는 `~/.ai-native-cad/` 디렉토리에 저장됩니다:

```
~/.ai-native-cad/
├── scene.json       # 씬 상태 (엔티티, 변환 등)
├── scene.code.js    # main 코드 파일
└── modules/         # 저장된 모듈 (.js 파일)
```

MCP 서버 재시작 시 scene.json에서 자동 복원됩니다.

## Quick Start

```bash
# 1. MCP 서버 시작
npx @ai-native-cad/mcp start

# 2. Viewer 열기
# → https://parktube.github.io/7-division/
```

### 로컬 개발

```bash
# 의존성 설치
pnpm install

# MCP 서버 + Viewer 개발 모드 (각각 별도 터미널)
pnpm --filter @ai-native-cad/mcp start
pnpm --filter @ai-native-cad/viewer dev
# → http://localhost:5173/
```

## Development Rules

- **Console 금지**: `logger` 사용 (`apps/cad-mcp/src/logger.ts`)
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

### MCP-First Architecture
- Claude Code → MCP 서버 → WASM 실행
- 브라우저는 순수 뷰어 역할 (검증 UI)
- WebSocket으로 실시간 씬 동기화

### Extensibility
- LLM 교체 가능: 로컬 LLM(Ollama 등) 제공 가능
- 씬 영속성: scene.json으로 상태 자동 저장/복원

## 현재 시스템의 한계

| 규모 | 관리 방식 | 상태 |
|------|----------|------|
| ~500 엔티티 | 플랫 + 네이밍 | 현재 지원 |
| ~5,000 | 계층적 그룹 | 탐색 어려움 |
| ~50,000 | - | 미지원 |

**개선 방향**: Scoped Context, Query Language, Progressive Disclosure 강화
