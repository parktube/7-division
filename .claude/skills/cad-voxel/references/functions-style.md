# functions-style: 스타일 및 그룹 함수

## style 도메인

```javascript
lsp({ operation: 'describe', domain: 'style' })
```

### setFill

채우기 색상

```javascript
setFill(name, color)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| name | string | 엔티티 이름 |
| color | number[] | `[r, g, b, a]` (0~1 범위) |

```javascript
setFill('box', [1, 0, 0, 1]);       // 빨강 (불투명)
setFill('box', [0, 0.5, 1, 0.5]);   // 파랑 (반투명)
setFill('box', [1, 1, 1, 0]);       // 투명
```

**색상 예시:**
- 빨강: `[1, 0, 0, 1]`
- 녹색: `[0, 1, 0, 1]`
- 파랑: `[0, 0, 1, 1]`
- 노랑: `[1, 1, 0, 1]`
- 흰색: `[1, 1, 1, 1]`
- 검정: `[0, 0, 0, 1]`

### setStroke

테두리 색상 및 두께

```javascript
setStroke(name, color, width?)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| name | string | 엔티티 이름 |
| color | number[] | `[r, g, b, a]` |
| width | number | 선 두께 (기본: 1) |

```javascript
setStroke('box', [0, 0, 0, 1], 2);  // 검정 테두리, 두께 2
setStroke('box', [0, 0, 0, 0]);     // 테두리 없음
```

### drawOrder

Z-order 설정

```javascript
drawOrder(name, order)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| name | string | 엔티티 이름 |
| order | string/number | `'front'`, `'back'`, 숫자, `'above:target'` |

```javascript
drawOrder('circle', 'front');       // 맨 앞으로
drawOrder('circle', 'back');        // 맨 뒤로
drawOrder('circle', 5);             // 특정 순서로
drawOrder('circle', 'above:rect');  // rect 바로 위로
```

### getDrawOrder

Z-order 조회

```javascript
getDrawOrder(groupName?)
```

```javascript
getDrawOrder();           // root level 순서
getDrawOrder('robot');    // 그룹 내부 순서
// → { order: ['bg', 'body', 'head'] }
```

**Convention**: 배열에서 왼쪽 = 뒤(먼저 그림), 오른쪽 = 앞(나중 그림)

---

## groups 도메인

```javascript
lsp({ operation: 'describe', domain: 'groups' })
```

### createGroup

그룹 생성

```javascript
createGroup(name, children)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| name | string | 그룹 이름 |
| children | string[] | 자식 엔티티 이름 배열 |

```javascript
drawRect('body', 0, 0, 20, 30);
drawCircle('head', 0, 20, 10);
createGroup('robot', ['body', 'head']);

// 그룹 전체 이동
translate('robot', 100, 50);
```

### addToGroup

기존 그룹에 엔티티 추가

```javascript
addToGroup(groupName, entityName)
```

```javascript
drawCircle('antenna', 0, 35, 3);
addToGroup('robot', 'antenna');
// 월드 위치 자동 유지됨
```

---

## query 도메인

```javascript
lsp({ operation: 'describe', domain: 'query' })
```

### exists

엔티티 존재 확인

```javascript
exists(name)  // → boolean
```

```javascript
if (exists('player')) {
  deleteEntity('player');
}
```

### getEntity

엔티티 정보 조회

```javascript
getEntity(name)
```

```javascript
var info = getEntity('robot_head');
// → {
//   name: 'robot_head',
//   type: 'Circle',
//   parent: 'robot',
//   local: { geometry: {...}, transform: {...}, bounds: {...} },
//   world: { bounds: {...}, center: [x, y] }
// }
```

### getWorldBounds

월드 바운딩 박스

```javascript
getWorldBounds(name)
// → { min_x, min_y, max_x, max_y }
```

### fitToViewport

뷰포트에 맞추기

```javascript
fitToViewport(width, height, options?)
```

```javascript
fitToViewport(800, 600);
fitToViewport(800, 600, { padding: 20 });
```
