# zorder-isometric: 이소메트릭 그룹간 Z-Order 알고리즘

## 규칙

이소메트릭 뷰에서 그룹간 z-order는 `depth = x + y` 공식으로 계산하고, **내림차순** 정렬 후 `drawOrder('front')`를 적용한다.

## 이유

- 이소메트릭 뷰에서 (x, y)가 클수록 화면 아래쪽 (더 앞)
- depth가 큰 오브젝트가 앞에 와야 함
- 수동으로 관리하면 오브젝트 추가 시마다 오류 발생

## 패턴

```javascript
// 전역 배열
var isoGroups = [];

// 그룹 생성 시 등록
function registerIsoGroup(name, x, y) {
  isoGroups.push({ name: name, depth: x + y });
}

// 모든 오브젝트 생성 후 정렬
function sortIsoGroups() {
  // 내림차순: depth 큰 것(앞) → 작은 것(뒤)
  isoGroups.sort(function(a, b) {
    return b.depth - a.depth;
  });

  // 순서대로 front로 올리면 마지막이 맨 앞
  for (var i = 0; i < isoGroups.length; i++) {
    drawOrder(isoGroups[i].name, 'front');
  }
}
```

## 사용 예시

```javascript
// main.js
import 'crossy_bg'

// 오브젝트 생성 + 등록 (순서 상관없음)
var x1 = -240, y1 = -150;
tree('tree_0', x1, y1, 1.2);
registerIsoGroup('tree_0', x1, y1);  // 그룹 생성 직후 등록

var x2 = -160, y2 = -100;
car('car_0', x2, y2, 'blue');
registerIsoGroup('car_0', x2, y2);

var x3 = 0, y3 = 0;
makeChicken('chicken_0', x3, y3, 6);
registerIsoGroup('chicken_0', x3, y3);

// 마지막에 정렬 호출
sortIsoGroups();
```

또는 헬퍼 함수 내부에서 자동 등록:

```javascript
// crossy_bg.js
function tree(name, x, y, scale) {
  // ... 트리 그리기
  createGroup(name, [...]);
  registerIsoGroup(name, x, y);  // 내부에서 자동 등록
}
```

## 주의사항

- `registerIsoGroup()`은 그룹 생성 직후 호출
- `sortIsoGroups()`는 모든 오브젝트 생성 완료 후 **한 번만** 호출
- 동적으로 오브젝트 추가 시 다시 호출 필요

## 관련 MAMA Decision

- `cad:isometric_group_zorder_algorithm`
