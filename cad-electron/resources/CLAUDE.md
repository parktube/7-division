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

**도형 - 좌표 기준 주의!**
- `drawCircle(name, x, y, radius)` - (x, y) = 원의 중심
- `drawRect(name, x, y, width, height)` - (x, y) = 좌하단 코너
- `drawLine(name, [x1,y1, x2,y2, ...])`
- `drawPolygon(name, [x1,y1, x2,y2, ...])` - 닫힌 도형
- `drawArc(name, cx, cy, radius, startAngle, endAngle)` - (cx, cy) = 호의 중심
- `drawBezier(name, points[], closed)`

**스타일**
- `setFill(name, [r,g,b,a])` - 색상 0~1
- `setStroke(name, [r,g,b,a], width)`
- `setZOrder(name, z)` - 높을수록 앞

**변환**
- `translate(name, dx, dy)`
- `rotate(name, angle)` - 라디안
- `scale(name, sx, sy)`
- `setPivot(name, px, py)`

**그룹**
- `createGroup(name, [children])`
- `addToGroup(group, entity)`

**조회**
- `exists(name)` - boolean
- `getWorldBounds(name)`

**삭제**
- `deleteEntity(name)`

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
    drawRect(this.name+'_wall', -20, 0, 40, 30);
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
drawRect(name+'_body', this.x-10, this.y, 20, 40);

// ✅ 올바른: 로컬 좌표 사용 → 그룹 이동으로 최종 위치
drawRect(name+'_body', -10, 0, 20, 40);
translate(name, this.x, this.y);
```

## 씬 관리

```bash
cad-cli.cmd status     # 현재 상태
cad-cli.cmd reset      # 새 씬 시작
cad-cli.cmd overview   # 전체 구조
```
