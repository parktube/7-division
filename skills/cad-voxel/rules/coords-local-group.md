# coords-local-group: 그룹 로컬 좌표 패턴

## 규칙

그룹 내 파츠는 **로컬 좌표 (0,0 기준)**로 배치하고, 최종 위치는 **그룹 translate**로 결정한다.

## 이유

- 월드 좌표로 파츠를 배치하면 그룹 이동 시 계산 복잡
- 로컬 좌표 사용 시 재사용/복제가 쉬움
- 캐릭터/오브젝트의 원점 기준이 명확해짐

## 패턴

```javascript
function makeCharacter(name, worldX, worldY) {
  // 1. 모든 파츠는 로컬 좌표 (0,0 기준)
  box3d(name + '_body', 0, 0, 20, 30, 15, ...);      // 몸통 중심
  box3d(name + '_head', 0, 0, 15, 15, 12, ...);      // 머리 (body 위)
  box3d(name + '_leg_l', -8, 5, 6, 10, 6, ...);      // 왼쪽 다리
  box3d(name + '_leg_r', 8, 5, 6, 10, 6, ...);       // 오른쪽 다리

  // 2. 그룹화
  createGroup(name, [
    name + '_body', name + '_head',
    name + '_leg_l', name + '_leg_r'
  ]);

  // 3. 그룹을 월드 좌표로 이동
  translate(name, worldX, worldY);
}

// 사용
makeCharacter('player', 100, 50);  // (100, 50)에 배치
makeCharacter('enemy', -50, 100);  // (-50, 100)에 배치
```

## 안티패턴

```javascript
// ❌ 월드 좌표로 직접 파츠 배치
function makeCharacter(name, x, y) {
  box3d(name + '_body', x, y, ...);           // 월드 좌표
  box3d(name + '_head', x, y - 20, ...);      // 상대 계산 복잡
  box3d(name + '_leg_l', x - 8, y + 15, ...); // 실수 발생 쉬움
  createGroup(name, [...]);
  // translate 없음 - 이미 월드 좌표라서
}
```

## 그룹 내 자식에 scale 적용 시

```javascript
// ⚠️ 그룹 자식에 scale 적용 시 반드시 space: 'local'
scale(name + '_head', 1.2, 1.2, { space: 'local' });

// ❌ 기본값 'world'는 부모 변환 영향받아 의도와 다른 결과
scale(name + '_head', 1.2, 1.2);  // 위치도 같이 변함!
```

## 관련 MAMA Decision

- `cad:scale_world_vs_local_gotcha`
