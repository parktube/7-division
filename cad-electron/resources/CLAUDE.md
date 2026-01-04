# CADViewer CLI

CAD 도형을 JavaScript 코드로 생성합니다.

## run_cad_code (코드 에디터)

```bash
# 프로젝트 구조 보기
cad-cli.cmd run_cad_code

# 파일 읽기
cad-cli.cmd run_cad_code main
cad-cli.cmd run_cad_code my_module

# 파일 쓰기 (덮어쓰기)
cad-cli.cmd run_cad_code main "drawCircle('c1', 0, 0, 50)"

# 파일에 코드 추가 (+ prefix)
cad-cli.cmd run_cad_code main "+drawRect('r1', 10, 10, 30, 30)"

# 멀티라인 코드 (stdin)
echo "for (let i = 0; i < 5; i++) { drawCircle('c'+i, i*30, 0, 15); }" | cad-cli.cmd run_cad_code main -

# PowerShell Here-String (복잡한 코드)
# $code = @"
# class MyClass { ... }
# "@
# $code | .\cad-cli.cmd run_cad_code main -

# 모듈 삭제
cad-cli.cmd run_cad_code --delete my_module

# 의존성 확인
cad-cli.cmd run_cad_code --deps
```

**규칙**: 문자열은 작은따옴표(`'`) 사용

## 함수 목록

**도형**
- `drawCircle(name, x, y, radius)`
- `drawRect(name, x, y, width, height)`
- `drawLine(name, [x1,y1, x2,y2, ...])`
- `drawPolygon(name, [x1,y1, x2,y2, ...])` - 닫힌 도형
- `drawArc(name, cx, cy, radius, startAngle, endAngle)`
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

```javascript
// house_lib 모듈
class House {
  constructor(name, x, y, config = {}) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.parts = [];
  }
  drawWall() { /* ... */ }
  drawRoof() { /* ... */ }
  build() {
    this.drawWall();
    this.drawRoof();
    createGroup(this.name, this.parts);
    return this;
  }
}

class Cottage extends House {
  drawRoof() { /* 다른 지붕 스타일 */ }
}
```

```javascript
// main에서 사용
import 'house_lib';
new House('h1', 0, 0).build();
new Cottage('h2', 100, 0).build();
```

## 씬 관리

```bash
cad-cli.cmd status     # 현재 상태
cad-cli.cmd reset      # 새 씬 시작
cad-cli.cmd overview   # 전체 구조
```
