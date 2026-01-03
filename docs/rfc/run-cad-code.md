# RFC: run_cad_code

Status: draft

## 요약

LLM이 JavaScript 코드를 작성하여 CAD 도형을 생성하는 `run_cad_code` 명령어 제안.

## 배경

### 현재 문제

개별 도구 호출 방식의 한계:

```
# 기어 8톱니 생성 시
draw_circle → draw_rect → rotate → translate → ... (17번 호출)
```

LLM은 코드 작성 능력이 뛰어나지만, 현재 도구 구조는 이를 억제함.

### 핵심 인사이트

```javascript
// LLM이 이렇게 작성할 수 있다면?
for (let i = 0; i < 8; i++) {
  const angle = (i * 360) / 8;
  draw_rect("tooth_" + i, 0, 50, 10, 20);
  rotate("tooth_" + i, angle * Math.PI / 180);
}
```

**도구 호출 17번 → 1번**

## 설계

### 샌드박스 실행

- **QuickJS** (quickjs-emscripten): 경량, WASM 호환, 보안
- JavaScript ES2020 지원
- Node.js API 접근 불가 (보안)

### 바인딩할 CAD 함수

```typescript
// primitives (5)
draw_circle(name, x, y, radius)
draw_rect(name, x, y, width, height)
draw_line(name, points)
draw_arc(name, cx, cy, radius, start_angle, end_angle)
draw_polygon(name, points)

// transforms (3)
translate(name, dx, dy)
rotate(name, angle)
scale(name, sx, sy)

// groups (2)
create_group(name, children)
add_to_group(group_name, entity_name)

// style (2)
set_fill(name, color)
set_stroke(name, color, width)

// utility (2)
delete_entity(name)
exists(name)
```

### Code as Source of Truth

```
run_cad_code 실행 → scene.code.js 저장
get_scene_code → 저장된 코드 조회
코드 수정 후 재실행 → 씬 업데이트
```

LLM이 코드를 수정하고 재실행하여 씬을 업데이트.

## PoC 계획

### 예제 1: 기어 (Gear)

반복 패턴 + 회전 변환

```javascript
// 기어 본체
draw_circle("gear_body", 0, 0, 40);

// 8개 톱니
for (let i = 0; i < 8; i++) {
  const angle = (i * 360) / 8;
  const name = "tooth_" + i;
  draw_rect(name, -4, 40, 8, 15);
  rotate(name, angle * Math.PI / 180);
}
```

**검증:** 9개 엔티티 생성 (body + 8 teeth)

### 예제 2: 스노우플레이크 (Snowflake)

프랙탈 패턴 + 재귀 구조

```javascript
function drawBranch(name, length, depth) {
  if (depth <= 0) return;

  // 각 가지를 그룹으로 관리하여 변환을 계층적으로 적용
  create_group(name, []);

  const lineName = name + "_line";
  draw_line(lineName, [0, 0, 0, length]);
  add_to_group(name, lineName);

  // 6개의 하위 가지 생성
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60) * Math.PI / 180;
    const childName = name + "_" + i;

    // 하위 가지를 재귀적으로 그림
    drawBranch(childName, length * 0.5, depth - 1);

    // 하위 가지 그룹 변환 후 현재 그룹에 추가
    rotate(childName, angle);
    translate(childName, 0, length);
    add_to_group(name, childName);
  }
}

drawBranch("snow", 50, 3);
```

**검증:** 재귀적 패턴, 수학적 대칭

## 구현 단계

1. [ ] QuickJS 통합 (`quickjs-emscripten` 설치)
2. [ ] CAD 함수 바인딩 (14개)
3. [ ] `run_cad_code` 명령어 구현
4. [ ] CLI 기본 help 통합
5. [ ] 기어 예제 검증
6. [ ] 스노우플레이크 예제 검증
7. [ ] Code as Source of Truth (`get_scene_code`, `scene.code.js`)
8. [ ] Electron 앱 통합 (도메인 분류, 배포 검증)
9. [ ] 문서화 및 PR

## 기대 효과

| 지표 | 현재 | run_cad_code |
|------|------|--------------|
| 기어 8톱니 | 17번 호출 | 1번 호출 |
| 스노우플레이크 | 수백번 호출 | 1번 호출 |
| LLM 코드 능력 | 억제됨 | 활용됨 |

## MAMA Metrics

| 메트릭 | 목적 | 성공 기준 |
|--------|------|----------|
| `cad:run_cad_code_poc_success` | PoC 완료 추적 | 기어/스노우플레이크 예제 동작 |
| `cad:code_as_source_of_truth` | Code-as-Truth 검증 | get_scene_code 워크플로우 완료 |
| `cad:run_cad_code_final` | 최종 성공 | Electron 통합 및 문서화 완료 |

## References

- QuickJS: https://bellard.org/quickjs/
- quickjs-emscripten: https://github.com/aspect-sh/aspect-quick
