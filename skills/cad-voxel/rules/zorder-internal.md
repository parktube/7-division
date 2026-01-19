# zorder-internal: 오브젝트 내부 Z-Order 패턴

## 규칙

복셀 오브젝트(차량, 캐릭터 등) 내부의 파츠는 **뒤→앞 순서**로 생성하고, 명시적으로 `drawOrder()`를 적용해야 한다.

## 이유

- 생성 순서만으로는 z-order가 보장되지 않음
- 특히 기차처럼 Y축으로 나열된 파츠는 순서가 뒤바뀔 수 있음
- 자동차 뒷바퀴가 보이는 등의 버그 방지

## 패턴

```javascript
function car(id, x, y, color) {
  var n = 'car_' + id;

  // 1. 뒤쪽 파츠 먼저 (화면에서 가려질 부분)
  box3d(n + '_wheel_back1', x - 14, y + 12, ...);
  box3d(n + '_wheel_back2', x + 14, y + 12, ...);

  // 2. 중간 파츠 (몸체)
  box3d(n + '_body', x, y, ...);
  box3d(n + '_cabin', x + 5, y, ...);

  // 3. 앞쪽 파츠 (화면에 보일 부분)
  box3d(n + '_wheel_front1', x - 14, y - 12, ...);
  box3d(n + '_wheel_front2', x + 14, y - 12, ...);

  // 4. 명시적 z-order 적용 (필수!)
  var zOrder = [
    n + '_wheel_back1', n + '_wheel_back2',
    n + '_body', n + '_cabin',
    n + '_wheel_front1', n + '_wheel_front2'
  ];
  for (var i = 0; i < zOrder.length; i++) {
    drawOrder(zOrder[i], 'front');
  }

  // 5. 그룹화
  createGroup(n, zOrder);
}
```

## 안티패턴

```javascript
// ❌ drawOrder 없이 생성 순서만 의존
box3d(n + '_back', ...);
box3d(n + '_front', ...);
createGroup(n, [n + '_back', n + '_front']);
// → 순서 보장 안 됨!
```

## 관련 MAMA Decision

- `cad:object_internal_zorder_pattern`
