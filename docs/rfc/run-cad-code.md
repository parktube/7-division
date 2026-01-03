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
  const angle = (i * Math.PI * 2) / 8;
  const x = Math.cos(angle) * 50;
  const y = Math.sin(angle) * 50;
  draw_rect("tooth_" + i, x - 5, y - 10, 10, 20);
}
```

**도구 호출 17번 → 1번**

### LLM 친화적 설계 원칙

> **목표: 새 API를 가르치는 게 아니라, LLM이 이미 아는 JavaScript를 자연스럽게 쓰게 하는 것**

LLM이 자연스럽게 잘 하는 것:
- `Math.sin/cos`로 좌표 계산 ✓
- `for` 루프로 반복 생성 ✓
- 변수로 상태 추적 ✓

LLM이 어려워하는 것:
- 불투명 API 체이닝 (결과를 조회할 수 없음)
- 변환 누적 후 최종 좌표 추론

**설계 방향:**
| 용도 | 권장 방식 |
|------|----------|
| 위치 지정 | **좌표 직접 계산** `draw_line([x1,y1,x2,y2])` |
| 이미 그린 것 조정 | `translate`, `rotate`, `scale` |
| 그룹 변환 | 그룹 생성 후 그룹 단위 변환 |

## 설계

### 샌드박스 실행

- **QuickJS** (quickjs-emscripten): 경량, WASM 호환, 보안
- JavaScript ES2020 지원
- Node.js API 접근 불가 (보안)

### 바인딩할 CAD 함수

```typescript
// primitives (7)
draw_circle(name, x, y, radius)
draw_rect(name, x, y, width, height)
draw_line(name, points)  // [x1, y1, x2, y2, ...]
draw_arc(name, cx, cy, radius, start_angle, end_angle)
draw_polygon(name, points)  // 닫힌 다각형 (fill 지원)
draw_bezier(name, points, closed)  // 베지어 커브

// transforms (4) - 이미 그린 도형 조정용
translate(name, dx, dy)
rotate(name, angle)      // 라디안
scale(name, sx, sy)
set_pivot(name, px, py)  // 회전/스케일 중심점

// groups (2)
create_group(name, children)
add_to_group(group_name, entity_name)

// style (2)
set_fill(name, color)         // color: [r, g, b, a]
set_stroke(name, color, width)

// utility (2)
delete_entity(name)
exists(name)
```

**총 17개 함수** (primitives 7 + transforms 4 + groups 2 + style 2 + utility 2)

### Code as Source of Truth

```
run_cad_code 실행 → scene.code.js 저장
get_scene_code → 저장된 코드 조회
코드 수정 후 재실행 → 씬 업데이트
```

LLM이 코드를 수정하고 재실행하여 씬을 업데이트.

## PoC 계획

### 예제 1: 기어 (Gear)

반복 패턴 + 좌표 계산 + pivot 기반 회전

```javascript
// 기어 본체
draw_circle("gear_body", 0, 0, 50);
set_fill("gear_body", [0.7, 0.7, 0.8, 1]);

// 8개 톱니 - 좌표 계산 후 pivot 설정
for (let i = 0; i < 8; i++) {
  const angle = (i * Math.PI * 2) / 8;
  const name = "tooth_" + i;

  // 톱니를 기어 상단에 그림
  draw_rect(name, -5, 50, 10, 20);

  // pivot을 기어 중심(0,0)으로 설정 후 회전
  set_pivot(name, 0, 0);
  rotate(name, angle);
}
```

**검증:** 9개 엔티티 생성 (body + 8 teeth)

### 예제 2: 스노우플레이크 (Snowflake)

프랙탈 패턴 + **좌표 직접 계산** (LLM 친화적)

```javascript
// 선 그리기 헬퍼: 시작점 + 각도 + 길이 → 끝점 계산
function drawBranch(name, startX, startY, angle, length, color, width) {
  const endX = startX + Math.sin(angle) * length;
  const endY = startY + Math.cos(angle) * length;
  draw_line(name, [startX, startY, endX, endY]);
  set_stroke(name, color, width);
  return { endX, endY };
}

const branches = 6;
const mainLen = 80;
let id = 0;

for (let i = 0; i < branches; i++) {
  const mainAngle = (i * Math.PI * 2) / branches;

  // 메인 브랜치
  const main = drawBranch("m" + i, 0, 0, mainAngle, mainLen, [0.15, 0.35, 0.65, 1], 3);

  // 서브 브랜치 - 중간 지점에서 분기
  const midX = Math.sin(mainAngle) * mainLen * 0.5;
  const midY = Math.cos(mainAngle) * mainLen * 0.5;

  for (let j = -1; j <= 1; j += 2) {
    const subAngle = mainAngle + j * Math.PI / 4;
    drawBranch("s" + (id++), midX, midY, subAngle, 30, [0.25, 0.5, 0.8, 1], 2);
  }
}

draw_circle("center", 0, 0, 6);
set_fill("center", [0.85, 0.92, 1.0, 1]);
```

**핵심:** 변환 체이닝 대신 좌표를 미리 계산. LLM이 Math.sin/cos로 자연스럽게 처리.

**검증:** 6-fold 대칭, 브랜치 연결 정확성

## 구현 단계

### Phase 1: 기본 구현 ✅
1. [x] QuickJS 통합 (`quickjs-emscripten` v0.31.0 설치)
2. [x] CAD 함수 바인딩 (15개)
3. [x] `run_cad_code` 명령어 구현
4. [x] `get_scene_code` 명령어 구현
5. [x] 기어 예제 검증 (9개 엔티티)
6. [x] 스노우플레이크 예제 검증 (55개 엔티티)
7. [ ] CLI help 통합
8. [ ] Electron 앱 통합 (도메인 분류, 배포 검증)
9. [ ] 문서화 및 PR

### Phase 2: 그룹 변환 상속 ✅
10. [x] 월드 변환 계산 (`get_world_transform`)
11. [x] 좌표 조회 API (`get_world_point`, `get_world_bounds`)
12. [x] Bounds 계산에 월드 변환 적용
13. [x] 스노우플레이크 재검증 (변환 기반 코드)

### Phase 3: 모듈 시스템 ✅
14. [x] `save_module` 명령어 구현
15. [x] `list_modules` 명령어 구현
16. [x] `get_module` 명령어 구현
17. [x] `delete_module` 명령어 구현
18. [x] `run_module` 명령어 구현
19. [x] `import` 전처리 구현 (ES modules 문법 지원)
20. [x] 모듈 시스템 테스트 및 검증

### Phase 4: LLM 친화적 씬 탐색 ✅
21. [x] `overview` - 계층적 씬 요약
22. [x] `list_groups`, `describe_group` - 그룹 단위 탐색
23. [x] `where` - 간결한 위치 조회
24. [x] `translate_scene`, `center_scene` - 전체 씬 조작

### Phase 5: Z-Order / 레이어 ✅
25. [x] `set_z_order` - 렌더링 순서 설정
26. [x] `get_z_order` - 렌더링 순서 조회
27. [x] `bring_to_front`, `send_to_back` - 편의 명령어
28. [x] SVG 렌더링에 z_index 정렬 적용

### Phase 6: Polygon Primitive ✅
29. [x] Rust 엔진에 `Polygon` 타입 추가 (entity.rs, mod.rs)
30. [x] `draw_polygon(name, points)` 명령어 구현
31. [x] SVG `<polygon>` 렌더링 (fill 지원)
32. [x] Viewer Canvas 렌더링 지원 (renderer.js)
33. [x] CLI replay 로직에 Polygon 추가

### Phase 7: Bezier Curve + CLI Docs ✅
34. [x] Rust 엔진에 `Bezier` 타입 추가
35. [x] `draw_bezier(name, points, closed)` 명령어 구현
36. [x] SVG `<path>` 렌더링 (cubic bezier)
37. [x] Viewer Canvas 렌더링 지원
38. [x] CLI `describe sandbox` 도메인 추가 (LLM이 함수 목록 조회 가능)
39. [x] CLAUDE.md에 draw_bezier 사용법 문서화

**Bezier 포맷:**
```javascript
// points = [startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY, ...]
// 시작점 (2개) + 세그먼트당 6개 (cp1, cp2, end)
drawBezier("curve", [
  0, 0,           // 시작점
  10, 50,         // control point 1
  40, 50,         // control point 2
  50, 0           // 끝점
], false);        // closed: true면 닫힌 커브
```

## 기대 효과

| 지표 | 현재 | run_cad_code |
|------|------|--------------|
| 기어 8톱니 | 17번 호출 | 1번 호출 |
| 스노우플레이크 | 수백번 호출 | 1번 호출 |
| LLM 코드 능력 | 억제됨 | 활용됨 |

## MAMA Metrics

| 메트릭 | 목적 | 연계 Task | 성공 기준 |
|--------|------|----------|----------|
| `cad:run_cad_code_poc_success` | PoC 완료 추적 | Task 1-6 | 기어/스노우플레이크 예제 동작 |
| `cad:code_as_source_of_truth` | Code-as-Truth 검증 | Task 7 | get_scene_code 워크플로우 완료 |
| `cad:run_cad_code_final` | 최종 성공 | Task 8-9 | Electron 통합 및 문서화 완료 |
| `cad:llm_friendly_coordinate_pattern` | LLM 친화적 패턴 검증 | Task 10-13 | 그룹 변환 상속으로 자연스러운 코딩 |

---

## Phase 2: 그룹 변환 상속 (Scene Graph)

### 발견된 갭

PoC 진행 중 발견된 문제:

| 기능 | 일반 JS (Canvas/SVG/Three.js) | 우리 Sandbox |
|------|------------------------------|--------------|
| 좌표 공간 | 변환된 공간에서 작업 가능 | 항상 월드 좌표만 |
| 계층 상속 | 자식이 부모 변환 상속 | ❌ 없음 |
| 연속 그리기 | 현재 위치에서 계속 | 매번 절대 좌표 지정 |

**결과:** LLM이 일반 JS 지식으로 코딩 → 실패 → 우회법 학습 필요

### 현재 엔진 상태

```
SVG 렌더링: ✅ <g transform="">으로 계층 지원 (브라우저가 처리)
Bounds 계산: ❌ transform 무시, 원본 좌표만 사용
그룹 구조: ✅ parent_id, children 존재
변환 상속: ❌ 구현 안 됨
좌표 조회: ❌ API 없음
```

### 해결 방안: 그룹 변환 상속

이미 `parent_id`, `children` 구조가 있으므로, 변환 상속만 구현하면 됨.

**목표 패턴 (일반 JS와 동일):**
```javascript
create_group("branch", []);
translate("branch", 0, 50);
rotate("branch", angle);

draw_line("stem", [0, 0, 0, 30]);
add_to_group("branch", "stem");
// stem이 branch 변환 상속 → 자연스럽게 위치됨
```

### 구현 단계 (Phase 2)

10. [ ] 월드 변환 계산 함수 (`get_world_transform`)
11. [ ] 좌표 조회 API (`get_world_point`, `get_world_bounds`)
12. [ ] Bounds 계산에 월드 변환 적용
13. [ ] 스노우플레이크 재검증 (변환 기반 코드)

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `cad-engine/src/scene/mod.rs` | `get_world_transform`, `get_world_bounds` |
| `cad-engine/src/scene/entity.rs` | 변환 행렬 연산 헬퍼 |
| `cad-tools/src/sandbox/index.ts` | 새 API 바인딩 |
| `cad-tools/src/cli.ts` | 새 명령어 등록 |

---

## Phase 3: 모듈 시스템

### 배경

LLM이 코드를 작성할 때:
- `Write` 도구로 파일 직접 생성 → 도구 역할 침범
- `run_cad_code`가 파일 관리까지 담당해야 함
- 재사용 가능한 코드를 모듈로 저장/로드

### 설계

**저장 위치:** `viewer/.cad-modules/`

```
viewer/
├── scene.json          # 현재 씬 (엔티티 상태)
├── scene.code.js       # 현재 씬의 소스 코드
└── .cad-modules/       # 재사용 가능한 모듈
    ├── snowflake.js
    ├── gear.js
    └── fractal-tree.js
```

### 명령어

```bash
# 현재 코드를 모듈로 저장
save_module '{"name":"snowflake"}'
# → .cad-modules/snowflake.js 생성

# 저장된 모듈 목록 조회
list_modules
# → ["snowflake", "gear", "fractal-tree"]

# 모듈 코드 조회
get_module '{"name":"snowflake"}'
# → 저장된 코드 반환

# 모듈 삭제
delete_module '{"name":"snowflake"}'

# 모듈 실행 (load_module 대신 run_module)
run_module '{"name":"snowflake"}'
# → reset 후 모듈 코드 실행
```

### 워크플로우

```
1. run_cad_code '코드'     → 실행 + scene.code.js 저장
2. save_module 'name'      → scene.code.js를 모듈로 복사
3. run_module 'name'       → 모듈 로드 + 실행
4. get_scene_code          → 현재 코드 조회 + 수정 가능
```

### 명령어 (Phase 3) ✅

```bash
# 현재 코드를 모듈로 저장
save_module <name>

# 저장된 모듈 목록 조회
list_modules

# 모듈 코드 조회
get_module <name>

# 모듈 삭제
delete_module <name>

# 모듈 실행
run_module <name>
```

### Import 문법 ✅

ES modules 스타일 문법을 전처리로 지원:

```javascript
// 전체 import (권장)
import * from 'gear-lib';

// 명시적 import (실제로는 전체 코드 삽입)
import { createGear } from 'gear-lib';

// 사이드 이펙트 import
import 'utils';
```

**동작 방식:**
- 전처리 단계에서 import 문을 모듈 코드로 치환
- 순환 참조 방지 (이미 import된 모듈 스킵)
- 중첩 import 지원 (모듈이 다른 모듈 import 가능)

**예시:**
```javascript
// gear-lib 모듈의 createGear 함수 사용
import * from 'gear-lib';

createGear('g1', 0, 0, 50, 8, [0.7, 0.5, 0.3, 1]);
createGear('g2', 120, 0, 40, 6, [0.5, 0.7, 0.3, 1]);
```

### LLM 워크플로우 개선

**Before (파일 직접 조작):**
```
LLM: Write(fractal.js) → Bash("$(cat fractal.js)")
```

**After (도구 경유):**
```
LLM: run_cad_code '...' → save_module 'fractal' → run_module 'fractal'
```

LLM이 파일 시스템을 직접 조작하지 않고, CAD 도구가 모든 파일 관리를 담당.

---

## Phase 4: LLM 친화적 응답 설계 (예정)

### 발견된 문제

테스트 중 발견된 LLM 사용성 문제:

| 문제 | 현재 | 영향 |
|------|------|------|
| 복잡한 JSON 응답 | `{"data":"{\"bounds\":{...}}"` | LLM이 파싱 후 해석해야 함 |
| 상태 추적 어려움 | 매번 get_entity 호출 필요 | 여러 단계 추론 필요 |
| 뷰포트 인식 없음 | "화면에 뭐가 보이는지" 모름 | 시행착오 반복 |
| 전체 씬 조작 번거로움 | 루트 그룹 수동 생성 필요 | 추가 작업 부담 |

### 설계 방향

**원칙: 응답이 "해석된 정보"를 직접 제공**

현재:
```json
{"success":true,"data":"{\"bounds\":{\"max\":[500,400],\"min\":[-500,-80]},...}"}
```

개선:
```
✓ root moved by (0, -120)

State:
- World bounds: (-500, -140) → (500, 340)
- Viewport center: (0, 0)
- ⚠️ Village is 140px below viewport

Suggestion: translate root 0 140
```

### 구현 항목

21. **응답 형식 개선**
    - Raw JSON → 해석된 텍스트
    - 변경 사항 요약
    - 다음 행동 제안

22. **뷰포트 인식 정보**
    - 엔티티가 뷰포트 안/밖 여부
    - 뷰포트 기준 상대 위치
    - 경고 메시지 (화면 밖일 때)

23. **전체 씬 조작 명령어** (오브젝트 기준, 뷰포트 아님)
    - `translate_scene dx dy` - 전체 씬 이동 (암묵적 root)
    - `scale_scene sx sy` - 전체 씬 스케일
    - `center_scene` - 씬을 원점 중심으로 이동
    - `where entity` - 간단한 위치 조회

### 기대 효과

| 작업 | Before | After |
|------|--------|-------|
| 현재 위치 확인 | get_entity → JSON 파싱 | `where moon` → "(300, 320)" |
| 전체 씬 이동 | create_group → add_to_group × N → translate | `translate_scene 100 50` |
| 씬 원점 맞추기 | bounds 계산 → 수동 이동 | `center_scene` |

## References

- QuickJS: https://bellard.org/quickjs/
- quickjs-emscripten: https://github.com/justjake/quickjs-emscripten
