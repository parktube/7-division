# CAD MCP 도구 가이드

CAD MCP 서버 사용법, 도메인, 함수 목록

> **워크플로우 먼저!** 코딩 전에 [cad-sandbox-workflow.md](cad-sandbox-workflow.md) 확인

## MCP 도구 (6개)

| 도구 | 설명 | 주요 파라미터 |
|------|------|--------------|
| `glob` | 파일 목록 조회 | `pattern?` (기본: main + 모듈 전체) |
| `read` | 파일 읽기 | `file` (main 또는 모듈명) |
| `edit` | 파일 부분 수정 | `file`, `old_code`, `new_code` |
| `write` | 파일 전체 작성 | `file`, `code` |
| `lsp` | 코드 탐색 (도메인/함수 스키마) | `operation`, `domain?`, `name?`, `file?` |
| `bash` | 명령 실행 (씬 조회/내보내기/초기화) | `command`, `group?`, `clearSketch?` |

### glob / read / edit / write

```javascript
glob()                                    // 파일 목록
glob({ pattern: 'house_*' })              // 패턴 매칭

read({ file: 'main' })                    // main 코드 읽기
read({ file: 'house_lib' })               // 모듈 읽기

write({ file: 'main', code: "drawCircle('c', 0, 0, 50)" })  // 전체 작성

edit({ file: 'main', old_code: 'radius: 50', new_code: 'radius: 100' })  // 부분 수정
```

### lsp

```javascript
lsp({ operation: 'domains' })                              // 도메인 목록
lsp({ operation: 'describe', domain: 'primitives' })       // 함수 시그니처
lsp({ operation: 'schema', name: 'drawCircle' })           // 상세 스키마
lsp({ operation: 'symbols', file: 'main' })                // 파일 심볼 (class, function)
```

### bash

```javascript
// 씬 조회
bash({ command: 'info' })                // 씬 요약 (entity_count, bounds)
bash({ command: 'tree' })                // 트리 구조
bash({ command: 'groups' })              // 그룹 목록
bash({ command: 'draw_order' })          // z-order (root level)
bash({ command: 'draw_order', group: 'robot' })  // 그룹 내부 z-order
bash({ command: 'selection' })           // 뷰어 선택 상태

// 엔티티 좌표 조회 (로컬 + 월드)
bash({ command: 'entity', name: 'pig_tail' })
// → { local: { geometry, transform, bounds }, world: { bounds, center } }
// 💡 스케치 좌표와 비교하여 translate()로 위치 조정

// 내보내기
bash({ command: 'svg' })                 // SVG 벡터 내보내기
bash({ command: 'json' })                // JSON 내보내기
bash({ command: 'capture' })             // PNG 스크린샷

// 초기화
bash({ command: 'reset' })               // 씬 초기화 (주의!)
```

## 도메인 목록

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
  utility     - 유틸리티 (duplicate, mirror)
```

## 함수 목록

### primitives
```javascript
drawCircle(name, x, y, radius)
drawRect(name, x, y, width, height)
drawLine(name, [x1,y1, x2,y2, ...])
drawPolygon(name, [x1,y1, x2,y2, ...])  // 닫힌 도형
drawArc(name, cx, cy, radius, startAngle, endAngle)
drawBezier(name, path)  // SVG path: 'M x,y C cp1 cp2 end Z'
```

### text
```javascript
drawText(name, text, x, y, fontSize, options?)
// y는 텍스트 기준선(baseline)
// options: { fontPath?, align?: 'left'|'center'|'right', color?: [r,g,b,a] }

getTextMetrics(text, fontSize, fontPath?)  // { width, height }
```

**폰트 검색 순서** (fontPath 생략 시):
1. 프로젝트 `apps/cad-mcp/fonts/` 디렉터리
2. 시스템 폰트 디렉터리

### transforms
```javascript
translate(name, dx, dy, options?)  // options: { space: 'world'|'local' }
rotate(name, angle, options?)      // 라디안
scale(name, sx, sy, options?)
setPivot(name, px, py)
deleteEntity(name)
duplicate(source, newName)
mirror(source, newName, axis)      // 'x'|'y'
```

### boolean
```javascript
booleanUnion(a, b, result)         // 합집합
booleanDifference(a, b, result)    // 차집합 (A - B)
booleanIntersect(a, b, result)     // 교집합
```

### geometry
```javascript
offsetPolygon(name, delta, result, joinType?)
getArea(name)
convexHull(name, result)
decompose(name, prefix)
```

### style
```javascript
setFill(name, [r,g,b,a])           // 색상 0~1
setStroke(name, [r,g,b,a], width?)
drawOrder(name, 'front'|'back'|N|'above:target')
getDrawOrder(groupName?)
```

### groups
```javascript
createGroup(name, [children])
addToGroup(groupName, entityName)  // 월드 위치 자동 유지
```

### query
```javascript
exists(name)                       // boolean
getWorldBounds(name)
getEntity(name)                    // local/world 좌표 모두 반환
fitToViewport(width, height, opts?)
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

## 핵심 패턴

### 그룹 로컬 좌표 (필수!)

```javascript
// ❌ 잘못: this.x, this.y를 부품에 직접 더함
drawRect(name+'_body', this.x, this.y, 20, 40);

// ✅ 올바른: 로컬 좌표 사용 → 그룹 이동으로 최종 위치
drawRect(name+'_body', 0, 20, 20, 40);
createGroup(name, [name+'_body']);
translate(name, this.x, this.y);
```

### 모듈 시스템

```javascript
// house_lib 모듈 저장
write({ file: 'house_lib', code: `
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
write({ file: 'main', code: `
import 'house_lib';
new House('h1', 0, 0).build();
new House('h2', 100, 0).build();
`})
```

### Z-Order 관리

```javascript
drawOrder('circle', 'front');       // 맨 앞으로
drawOrder('circle', 'back');        // 맨 뒤로
drawOrder('circle', 'above:rect');  // rect 위로

getDrawOrder();        // root level 순서
getDrawOrder('robot'); // 그룹 내부 순서
```

**Convention**: `order` 배열에서 왼쪽 = 뒤(먼저 그림), 오른쪽 = 앞(나중 그림)

### 트랜잭션 동작

코드 실행 실패 시 **파일이 변경되지 않습니다** (자동 롤백):

```javascript
// 기존 코드에 const x = 10;이 있을 때
edit({ file: 'main', old_code: '', new_code: 'const x = 20;' })
// → 실패, 파일 변경 없음, 안전하게 실험 가능
```

## 스케치 기반 협업 워크플로우

**⚠️ 이미지에서 좌표 추출 금지** - 구조화된 데이터 사용!

```
1. bash({ command: 'capture' }) → 이미지로 "의도 파악"
2. 의도 확인 질문 (모호하면 반드시 물어보기)
3. bash({ command: 'tree' }) → 씬 구조 파악
4. read + getEntity() 코드 실행 → 정확한 좌표 획득
5. 계산 후 한 번에 실행
```

## Lock 가드

뷰어에서 엔티티를 잠그면(🔒) 수정 시 경고 발생:
- 경고 포맷: `Warning: "entity_name" is locked by user`
- 잠긴 엔티티 수정 전 사용자에게 확인 요청 권장

## 좌표계 & 색상

- **좌표**: Y+ 위쪽, 원점 (0,0) 중심
- **색상**: RGBA `[0~1, 0~1, 0~1, 0~1]` - 예: 빨강 `[1,0,0,1]`
- **각도**: 라디안
- **문자열**: 작은따옴표(`'`) 사용

## Data Storage

```
~/.ai-native-cad/
├── scene.json       # 씬 상태 (엔티티, 변환 등)
├── scene.code.js    # main 코드 파일
└── modules/         # 저장된 모듈 (.js 파일)
```
