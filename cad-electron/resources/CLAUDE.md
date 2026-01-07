# CADViewer CLI

CAD 도형을 JavaScript 코드로 생성합니다.

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
cad-cli.cmd run_cad_code --lines house_lib 50-70  # 부분 읽기
```

**관리**
```powershell
cad-cli.cmd run_cad_code --deps           # 의존성 그래프
cad-cli.cmd run_cad_code --delete my_module  # 모듈 삭제
```

**규칙**: 문자열은 작은따옴표(`'`) 사용

## 함수 목록

**도형 - 모든 좌표는 중심 기준**
- `drawCircle(name, x, y, radius)` - (x, y) = 원의 중심
- `drawRect(name, x, y, width, height)` - (x, y) = 사각형의 중심
- `drawLine(name, [x1,y1, x2,y2, ...])`
- `drawPolygon(name, [x1,y1, x2,y2, ...])` - 닫힌 도형
- `drawArc(name, cx, cy, radius, startAngle, endAngle)` - (cx, cy) = 호의 중심
- `drawBezier(name, points[], closed)`

**스타일**
- `setFill(name, [r,g,b,a])` - 색상 0~1
- `setStroke(name, [r,g,b,a], width)`

**Z-Order** (스코프별 자동 할당, 상대적 조정)
- `drawOrder(name, 'front')` - 맨 앞으로
- `drawOrder(name, 'back')` - 맨 뒤로
- `drawOrder(name, 1)` or `drawOrder(name, -1)` - 단계 이동
- `drawOrder(name, 'above:target')` - target 위로
- `getDrawOrder(groupName?)` - 순서 조회

**변환 (space 옵션: 'world' | 'local', 기본값 'world')**
- `translate(name, dx, dy, options?)` - options: { space: 'world' | 'local' }
- `rotate(name, angle, options?)` - 라디안
- `scale(name, sx, sy, options?)`
- `setPivot(name, px, py)`

**그룹**
- `createGroup(name, [children])`
- `addToGroup(group, entity)` - 월드 위치 자동 유지

**조회**
- `exists(name)` - boolean
- `getWorldBounds(name)` - 월드 좌표 바운딩 박스
- `get_entity(name)` - local/world 좌표 모두 반환

**삭제**
- `deleteEntity(name)`

## get_entity 응답 형식

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

## 클래스 기반 모듈 예시

```powershell
# house_lib 모듈 생성
cad-cli.cmd run_cad_code house_lib "
class House {
  constructor(name, x, y) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.parts = [];
  }
  // 로컬 좌표 (0,0) 기준으로 부품 생성!
  drawWall() {
    drawRect(this.name+'_wall', 0, 15, 40, 30);  // 중심 기준
    this.parts.push(this.name+'_wall');
  }
  drawRoof() {
    drawPolygon(this.name+'_roof', [-25, 30, 0, 50, 25, 30]);
    this.parts.push(this.name+'_roof');
  }
  build() {
    this.drawWall();
    this.drawRoof();
    createGroup(this.name, this.parts);
    translate(this.name, this.x, this.y);  // 그룹 이동
    return this;
  }
}
"

# main에서 사용
cad-cli.cmd run_cad_code main "
import 'house_lib';
new House('h1', 0, 0).build();
new House('h2', 100, 0).build();
"
```

## 그룹 로컬 좌표 패턴 (필수!)

**핵심**: 부품은 (0,0) 기준 로컬 좌표로 생성 → 그룹 후 translate로 이동

```javascript
// ❌ 잘못: this.x, this.y를 부품에 직접 더함 → 그룹 이동 시 2배 이동
drawRect(name+'_body', this.x, this.y, 20, 40);

// ✅ 올바른: 로컬 좌표 사용 → 그룹 이동으로 최종 위치
drawRect(name+'_body', 0, 20, 20, 40);  // 중심 기준
translate(name, this.x, this.y);
```

## addToGroup 월드 위치 유지

`addToGroup` 호출 시 엔티티의 월드 위치가 자동으로 유지됩니다:

```javascript
// 스케치 위치에 창문 생성
drawRect('window', 100, 50, 20, 30);  // world (100, 50)

// 그룹에 추가 - 월드 위치 자동 유지!
addToGroup('house', 'window');
// 결과: 로컬 좌표 자동 계산, 월드 위치 동일
```

## 씬 관리

```bash
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
