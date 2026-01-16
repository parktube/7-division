# functions-transforms: 변환 함수

## 도메인 조회

```javascript
lsp({ operation: 'describe', domain: 'transforms' })
```

## translate

이동

```javascript
translate(name, dx, dy, options?)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| name | string | 엔티티/그룹 이름 |
| dx | number | X 이동량 |
| dy | number | Y 이동량 |
| options | object | `{ space: 'world' | 'local' }` |

```javascript
translate('box', 100, 50);              // 월드 좌표로 이동
translate('box', 10, 0, { space: 'local' });  // 로컬 좌표로 이동
```

## rotate

회전

```javascript
rotate(name, angle, options?)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| name | string | 엔티티/그룹 이름 |
| angle | number | 회전 각도 (**라디안**) |
| options | object | `{ space: 'world' | 'local' }` |

```javascript
rotate('box', Math.PI / 4);     // 45도 회전
rotate('box', Math.PI / 2);     // 90도 회전
rotate('box', Math.PI);         // 180도 회전
```

**각도 변환:**
- 45° = `Math.PI / 4`
- 90° = `Math.PI / 2`
- 180° = `Math.PI`
- 360° = `Math.PI * 2`

## scale

크기 조절

```javascript
scale(name, sx, sy, options?)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| name | string | 엔티티/그룹 이름 |
| sx | number | X 스케일 (1.0 = 원본) |
| sy | number | Y 스케일 (1.0 = 원본) |
| options | object | `{ space: 'world' | 'local' }` |

```javascript
scale('box', 2, 2);             // 2배 확대
scale('box', 0.5, 0.5);         // 절반 축소
scale('box', 1, 2);             // Y만 2배 (늘리기)
```

**⚠️ 그룹 자식에 scale 적용 시:**

```javascript
// ✅ 반드시 space: 'local' 사용
scale('child_entity', 1.2, 1.2, { space: 'local' });

// ❌ 기본값 'world'는 부모 변환 영향받아 위치도 변함
scale('child_entity', 1.2, 1.2);  // 의도와 다른 결과!
```

## setPivot

피벗(회전 중심) 설정

```javascript
setPivot(name, px, py)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| name | string | 엔티티 이름 |
| px | number | 피벗 X (로컬 좌표) |
| py | number | 피벗 Y (로컬 좌표) |

```javascript
// 왼쪽 아래를 중심으로 회전
setPivot('door', -10, -20);
rotate('door', Math.PI / 4);
```

## deleteEntity

엔티티 삭제

```javascript
deleteEntity(name)
```

```javascript
deleteEntity('old_box');
```

## duplicate

복제

```javascript
duplicate(source, newName)
```

```javascript
duplicate('tree', 'tree_copy');
translate('tree_copy', 50, 0);
```

## mirror

미러 복제

```javascript
mirror(source, newName, axis)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| source | string | 원본 엔티티 |
| newName | string | 새 엔티티 이름 |
| axis | string | `'x'` 또는 `'y'` |

```javascript
// Y축 기준 미러 (좌우 반전)
mirror('left_arm', 'right_arm', 'y');

// X축 기준 미러 (상하 반전)
mirror('top_half', 'bottom_half', 'x');
```
