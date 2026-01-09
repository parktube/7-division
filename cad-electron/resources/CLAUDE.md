# CADViewer CLI

CAD 도형을 JavaScript 코드로 생성합니다.

## 도메인 목록 (cad-cli.cmd describe <domain>)

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

## run_cad_code (코드 에디터)

**기본 (읽기/쓰기)**
```powershell
cad-cli.cmd run_cad_code                  # 프로젝트 구조
cad-cli.cmd run_cad_code main             # main 읽기
cad-cli.cmd run_cad_code main "drawCircle('c', 0, 0, 50)"  # 덮어쓰기
cad-cli.cmd run_cad_code main "+drawRect('r', 0, 0, 30, 30)" # 추가
echo "code" | cad-cli.cmd run_cad_code main -  # stdin
```

**탐색**
```powershell
cad-cli.cmd run_cad_code --status         # 프로젝트 요약
cad-cli.cmd run_cad_code --info house_lib # 모듈 상세
cad-cli.cmd run_cad_code --search drawCircle  # 패턴 검색
cad-cli.cmd run_cad_code --capture        # 뷰어 스크린샷
cad-cli.cmd run_cad_code --selection      # 선택된 도형
```

**관리**
```powershell
cad-cli.cmd run_cad_code --deps           # 의존성 그래프
cad-cli.cmd run_cad_code --delete my_module  # 모듈 삭제
cad-cli.cmd run_cad_code --clear-sketch   # 스케치 클리어
```

**규칙**: 문자열은 작은따옴표(`'`) 사용

## 트랜잭션 동작

코드 실행 실패 시 **파일이 변경되지 않습니다** (자동 롤백):

```powershell
# 기존 코드에 const x = 10;이 있을 때
cad-cli.cmd run_cad_code main "+const x = 20;"  # 실패 - 변수 재정의
# → 파일 변경 없음

# 추가 모드에서는 기존 변수 직접 참조 가능
cad-cli.cmd run_cad_code main "+drawCircle('c', x, 0, 30);"  # 성공
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

## 씬 관리

```powershell
cad-cli.cmd status     # 현재 상태
cad-cli.cmd reset      # 새 씬 시작
cad-cli.cmd overview   # 전체 구조
```

## 엔티티 수정 (reset 금지!)

**씬은 영속적입니다.** 기존 엔티티는 직접 수정하세요:

```powershell
# ❌ 잘못된 패턴: 리셋 후 재생성
cad-cli.cmd reset
cad-cli.cmd run_cad_code main "... 전체 다시 그리기 ..."

# ✅ 올바른 패턴: 기존 엔티티 직접 수정
cad-cli.cmd run_cad_code main "+drawOrder('arm_r', 'back')"
cad-cli.cmd run_cad_code main "+setFill('head', [1,0,0,1])"
cad-cli.cmd run_cad_code main "+translate('robot', 10, 0)"
```
