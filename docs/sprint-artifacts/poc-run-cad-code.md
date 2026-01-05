# PoC: run_cad_code

Status: Phase 1-9 완료 ✅ (Task 8.3 Electron 검증만 Epic 6 대기)

## Story

As a **Claude (LLM)**,
I want **JavaScript 코드를 작성하여 CAD 도형을 생성**할 수 있도록,
so that **반복 패턴, 수학적 계산, 재귀 구조를 효율적으로 표현**할 수 있다.

## Background

### 현재 문제

```
기어 8톱니 생성:
draw_circle → draw_rect → rotate → translate → ... (17번 호출)
```

LLM의 코드 작성 능력이 도구 호출 방식에 의해 억제됨.

### 핵심 인사이트

```javascript
for (let i = 0; i < 8; i++) {
  const angle = (i * Math.PI * 2) / 8;
  const x = Math.cos(angle) * 50;
  const y = Math.sin(angle) * 50;
  draw_rect("tooth_" + i, x - 5, y - 10, 10, 20);
}
```

**17번 → 1번 호출**, LLM이 기하학적 의도를 코드로 표현.

### LLM 친화적 설계 원칙

> **목표: 새 API를 가르치는 게 아니라, LLM이 이미 아는 JavaScript를 자연스럽게 쓰게 하는 것**

| LLM이 잘 하는 것 | LLM이 어려워하는 것 |
|-----------------|-------------------|
| `Math.sin/cos`로 좌표 계산 | 불투명 API 체이닝 |
| `for` 루프로 반복 생성 | 변환 누적 후 좌표 추론 |
| 변수로 상태 추적 | 결과를 조회할 수 없는 API |

**설계 방향:**
- 위치 지정 → **좌표 직접 계산** `draw_line([x1,y1,x2,y2])`
- 이미 그린 것 조정 → `translate`, `rotate`, `scale`, `set_pivot`
- 그룹 변환 → 그룹 생성 후 그룹 단위 변환

## Acceptance Criteria

### AC1: QuickJS 샌드박스 실행

- Given: JavaScript 코드 문자열
- When: `run_cad_code` 실행
- Then: QuickJS 샌드박스에서 안전하게 실행됨
- And: Node.js API 접근 불가 (보안)

### AC2: CAD 함수 바인딩

- Given: 샌드박스 내 코드
- When: `drawCircle("test", 0, 0, 50)` 호출
- Then: 실제 CAD 엔진에 도형 생성됨
- And: 20개 함수 바인딩 (primitives 6 + transforms 4 + groups 2 + style 3 + query 3 + utility 2)

### AC3: 기어 예제 검증

- Given: 기어 생성 코드
- When: `run_cad_code` 실행
- Then: 9개 엔티티 생성 (body + 8 teeth)
- And: 도구 호출 17번 → 1번 감소 확인

### AC4: 스노우플레이크 예제 검증

- Given: 프랙탈 스노우플레이크 코드
- When: `run_cad_code` 실행
- Then: 재귀적 6방향 대칭 패턴 생성
- And: 복잡한 구조를 단일 호출로 생성

### AC5: Code as Source of Truth

- Given: `run_cad_code` 실행 완료
- When: `get_scene_code` 호출
- Then: 실행된 코드 반환
- And: 코드 수정 후 재실행으로 씬 업데이트 가능

## File Structure

```
cad-tools/
├── package.json              # + quickjs-emscripten 의존성
└── src/
    ├── sandbox/
    │   └── index.ts          # QuickJS 초기화, 바인딩, 코드 실행
    ├── executor.ts           # CAD 명령어 실행 (WASM 래퍼)
    └── cli.ts                # CLI 명령어 등록 + run_cad_code, 모듈 시스템

viewer/
├── scene.code.js             # 실행된 코드 저장 (런타임 생성)
└── .cad-modules/             # 저장된 모듈 (런타임 생성)
    ├── snowflake.js
    └── gear-lib.js
```

> 예제 코드는 PoC Task 5, 6에 인라인으로 포함됨

## Tasks / Subtasks

### Task 1: 의존성 및 기본 구조 (AC: 1) ✅

- [x] 1.1: `quickjs-emscripten` 의존성 추가
  ```bash
  cd cad-tools && npm install quickjs-emscripten
  ```
- [x] 1.2: `src/sandbox/` 디렉토리 생성
- [x] 1.3: 타입 정의
  ```typescript
  interface RunCodeResult {
    success: boolean;
    entitiesCreated: string[];
    error?: string;
    logs: string[];
  }
  ```

### Task 2: QuickJS 샌드박스 구현 (AC: 1) ✅

- [x] 2.1: `runCadCode()` 함수 구현
  ```typescript
  async function runCadCode(code: string): Promise<RunCodeResult>
  ```
- [x] 2.2: 코드 실행 및 에러 핸들링
- [x] 2.3: `console.log` 바인딩

### Task 3: CAD 함수 바인딩 (AC: 2) ✅

- [x] 3.1: Primitives 바인딩 (6개)
  - `drawCircle(name, x, y, radius)`
  - `drawRect(name, x, y, width, height)`
  - `drawLine(name, points)`  // [x1, y1, x2, y2, ...]
  - `drawArc(name, cx, cy, radius, start_angle, end_angle)`
  - `drawPolygon(name, points)`
  - `drawBezier(name, points, closed)`  // Phase 7에서 추가
- [x] 3.2: Transforms 바인딩 (4개)
  - `translate(name, dx, dy)`
  - `rotate(name, angle)`  // 라디안
  - `scale(name, sx, sy)`
  - `set_pivot(name, px, py)`  // 회전/스케일 중심점
- [x] 3.3: Groups 바인딩 (2개)
  - `create_group(name, children)`
  - `add_to_group(group_name, entity_name)`
- [x] 3.4: Style 바인딩 (3개)
  - `setFill(name, color)`  // color: [r, g, b, a]
  - `setStroke(name, color, width)`
  - `setZOrder(name, zIndex)`  // Phase 5에서 추가
- [x] 3.5: 유틸리티 바인딩 (2개)
  - `deleteEntity(name)`
  - `exists(name)`
- [x] 3.6: Query 바인딩 (3개) - Phase 2에서 추가
  - `getWorldTransform(name)`
  - `getWorldPoint(name, x, y)`
  - `getWorldBounds(name)`

### Task 4: CLI 통합 (AC: 1, 2) ✅

> 기본 명령어 구현 및 help 통합

- [x] 4.1: `run_cad_code` 명령어 추가
- [x] 4.2: `get_scene_code` 명령어 추가
- [x] 4.3: 기본 help 통합 (명령어명, 설명, 사용 예시)
  ```
  run_cad_code   Execute JavaScript code in sandbox
  get_scene_code Get the last executed code
  ```

### Task 5: 기어 예제 구현 및 검증 (AC: 3)

- [x] 5.1: `examples/gear.js` 작성 (좌표 계산 + pivot 방식)
  ```javascript
  // 기어 본체
  draw_circle("gear_body", 0, 0, 50);
  set_fill("gear_body", [0.7, 0.7, 0.8, 1]);

  // 8개 톱니 - 기어 상단에 그림 → pivot 설정 → 회전
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const name = "tooth_" + i;
    draw_rect(name, -5, 50, 10, 20);
    set_pivot(name, 0, 0);  // 기어 중심 기준 회전
    rotate(name, angle);
  }
  ```
- [x] 5.2: 실행 및 9개 엔티티 확인
- [x] 5.3: 뷰어에서 시각적 검증

### Task 6: 스노우플레이크 예제 구현 및 검증 (AC: 4)

- [x] 6.1: `examples/snowflake.js` 작성 (**좌표 직접 계산** - LLM 친화적)
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
    drawBranch("m" + i, 0, 0, mainAngle, mainLen, [0.15, 0.35, 0.65, 1], 3);

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
- [x] 6.2: 프랙탈 패턴 확인 (55개 엔티티)
- [x] 6.3: 뷰어에서 시각적 검증

### Task 7: Code as Source of Truth (AC: 5) ✅

> `run_cad_code` 실행 직후 코드를 파일로 저장, 이후 조회/수정 가능

- [x] 7.1: `run_cad_code` 실행 시 `viewer/scene.code.js` 저장
  - `cli.ts`에서 코드 실행 성공 후 즉시 저장
  - `viewer/` 디렉토리 없으면 생성
- [x] 7.2: `get_scene_code` 명령어로 코드 조회
- [x] 7.3: 코드 수정 → 재실행 워크플로우 검증

### Task 8: Electron 앱 통합 (Epic 6으로 이관)

> Story 6-6에서 처리: Electron 패키징 및 CLI 번들링
> **상태**: Epic 6 완료 후 검증 예정

- [x] 8.1: CLI 도메인 분류 구조
  ```
  describe sandbox   # run_cad_code 샌드박스 함수 목록
  describe code      # (향후) 코드 실행 도메인 설명
  ```
- [x] 8.2: `cad-cli describe sandbox` 도메인 추가 (Phase 7에서 구현)
- [ ] 8.3: Electron 앱에서 동작 검증 → Epic 6 참조
  ```bash
  # Epic 6 완료 후 검증
  # macOS: /Applications/CADViewer.app/Contents/Resources/cad-cli.sh
  # Windows: %LOCALAPPDATA%\Programs\CADViewer\resources\cad-cli.cmd
  ```

### Task 9: 문서 및 PR ✅

- [x] 9.1: CLAUDE.md에 run_cad_code 사용법 추가
  - Sandbox 바인딩 20개 함수 문서화
  - Bezier 커브 포맷 상세 설명
  - Query 함수 (getWorld*) 추가
- [x] 9.2: RFC 문서 완성 (`docs/rfc/run-cad-code.md`)
- [ ] 9.3: PR 생성 및 main 머지

## Dev Notes

### QuickJS 선택 이유

- 경량 (WASM 호환)
- ES2020 지원
- 완전한 샌드박스 (Node.js API 차단)
- `quickjs-emscripten`: TypeScript 지원

### 함수 시그니처 (총 20개)

```typescript
// Primitives (6)
drawCircle(name: string, x: number, y: number, radius: number): boolean
drawRect(name: string, x: number, y: number, width: number, height: number): boolean
drawLine(name: string, points: number[]): boolean  // [x1, y1, x2, y2, ...]
drawArc(name: string, cx: number, cy: number, radius: number, startAngle: number, endAngle: number): boolean
drawPolygon(name: string, points: number[]): boolean
drawBezier(name: string, points: number[], closed?: boolean): boolean  // Cubic Bezier

// Transforms (4) - 이미 그린 도형 조정용
translate(name: string, dx: number, dy: number): boolean
rotate(name: string, angle: number): boolean  // 라디안
scale(name: string, sx: number, sy: number): boolean
setPivot(name: string, px: number, py: number): boolean  // 회전/스케일 중심점

// Groups (2)
createGroup(name: string, children: string[]): boolean
addToGroup(groupName: string, entityName: string): boolean

// Style (3) - color: RGBA (각 0.0~1.0 범위)
setFill(name: string, color: [number, number, number, number]): boolean
setStroke(name: string, color: [number, number, number, number], width?: number): boolean
setZOrder(name: string, zIndex: number): boolean  // 렌더링 순서 (높을수록 앞)

// Query (3) - Phase 2 월드 변환 조회
getWorldTransform(name: string): { translate: [number, number], rotate: number, scale: [number, number] } | null
getWorldPoint(name: string, x: number, y: number): [number, number] | null
getWorldBounds(name: string): { min: [number, number], max: [number, number] } | null

// Utility (2)
deleteEntity(name: string): boolean
exists(name: string): boolean
```

### 에러 처리

```javascript
// 샌드박스 내 에러 → 사용자에게 명확한 피드백 (QuickJS 기본 포맷 + 라인 번호 파싱)
{
  "success": false,
  "error": "ReferenceError: draw_circl is not defined (line 3)"
}
```

## Success Metrics

| 지표 | 현재 | PoC 목표 | 측정 방법 |
|------|------|----------|----------|
| 기어 8톱니 | 17번 호출 | 1번 호출 | CLI 명령어 횟수 카운트 |
| 스노우플레이크 | 수백번 호출 | 1번 호출 | CLI 명령어 횟수 카운트 |
| 코드 재사용 | 불가능 | get_scene_code로 가능 | 워크플로우 테스트 |

### Definition of Done (Phase 1)

- **기어 예제**: 9개 엔티티 생성 + 1번 호출 ✅
- **스노우플레이크 예제**: 재귀적 패턴 생성 + 1번 호출 ✅ (좌표 계산 방식)
- **Code as Source of Truth**: 코드 수정 → 재실행 → 씬 업데이트 확인 ✅

---

## Phase 2: 그룹 변환 상속 (Scene Graph)

### 발견된 갭

PoC 진행 중 발견: LLM이 일반 JS 패턴으로 코딩 → 실패 → 우회법 학습 필요

| 기능 | 일반 JS | 우리 Sandbox |
|------|---------|--------------|
| 좌표 공간 | 변환된 공간에서 작업 | 항상 월드 좌표만 |
| 계층 상속 | 자식이 부모 변환 상속 | ❌ 없음 |
| 좌표 조회 | 변환 결과 조회 가능 | ❌ 없음 |

### 현재 엔진 상태

- SVG 렌더링: ✅ `<g transform="">` 지원
- Bounds 계산: ❌ transform 무시
- 그룹 구조: ✅ `parent_id`, `children` 존재
- 변환 상속: ❌ 미구현

### Task 10: 월드 변환 계산 (AC: 6) ✅

> Rust 엔진에서 부모 체인을 따라 변환 누적

- [x] 10.1: `get_world_transform(entity_name)` 함수 구현
  ```rust
  fn get_world_transform(&self, name: &str) -> Transform {
      let entity = self.find_by_name(name)?;
      if let Some(parent_name) = &entity.parent_id {
          let parent_transform = self.get_world_transform(parent_name);
          parent_transform.compose(&entity.transform)
      } else {
          entity.transform.clone()
      }
  }
  ```
- [x] 10.2: Transform 행렬 연산 헬퍼 (compose, apply_point)
- [x] 10.3: 단위 테스트 (단일, 부모-자식, 중첩 그룹)

### Task 11: 좌표 조회 API (AC: 6) ✅

> LLM이 변환 적용된 좌표를 조회

- [x] 11.1: `get_world_point` 명령어
  ```typescript
  get_world_point(name, x, y) → [world_x, world_y]
  ```
- [x] 11.2: `get_world_bounds` 명령어
  ```typescript
  get_world_bounds(name) → {min: [x,y], max: [x,y]}
  ```
- [x] 11.3: Sandbox 바인딩
  ```javascript
  const [wx, wy] = get_world_point("child", 0, 50);
  ```

### Task 12: Bounds 계산 수정 (AC: 6) ✅

- [x] 12.1: `calculate_bounds`에 월드 변환 적용
- [x] 12.2: `get_scene_info` 결과에 변환 반영

### Task 13: 스노우플레이크 재검증 (AC: 4) ✅

> 변환 기반 코드로 자연스럽게 생성

- [x] 13.1: 그룹 + 변환 상속 패턴 코드 작성
  ```javascript
  create_group("branch", []);
  translate("branch", 0, 50);
  rotate("branch", angle);

  draw_line("stem", [0, 0, 0, 30]);
  add_to_group("branch", "stem");
  // stem이 branch 변환 상속!
  ```
- [x] 13.2: 일반 JS 패턴과 동일 동작 확인

### Definition of Done (Phase 2) ✅

- **변환 상속**: 그룹 자식이 부모 변환 상속 ✅
- **좌표 조회**: `get_world_point`로 변환된 좌표 조회 가능 ✅
- **스노우플레이크**: 변환 기반 코드로 자연스럽게 생성 ✅

---

## Phase 3: 모듈 시스템 ✅

### 배경

LLM이 코드를 작성할 때 재사용 가능한 모듈로 저장/로드 필요.

### Task 14-18: 모듈 관리 명령어 ✅

- [x] 14: `save_module <name>` - 현재 코드를 모듈로 저장
- [x] 15: `list_modules` - 저장된 모듈 목록 조회
- [x] 16: `get_module <name>` - 모듈 코드 조회
- [x] 17: `delete_module <name>` - 모듈 삭제
- [x] 18: `run_module <name>` - 모듈 실행

### Task 19: Import 전처리 ✅

ES modules 스타일 문법 지원:

```javascript
import * from 'gear-lib';        // 전체 import
import { createGear } from 'gear-lib';  // 명시적 (전체 삽입)
import 'utils';                  // 사이드 이펙트
```

- [x] 19.1: import 문 정규식 파싱
- [x] 19.2: 모듈 코드 치환 로직
- [x] 19.3: 순환 참조 방지
- [x] 19.4: 중첩 import 지원

### Task 20: 모듈 시스템 테스트 ✅

- [x] 20.1: gear-lib + snowflake-lib 모듈 생성
- [x] 20.2: import로 두 모듈 조합 테스트 (648개 엔티티 생성)
- [x] 20.3: snowy-village 복합 씬 생성

### Definition of Done (Phase 3) ✅

- **모듈 저장/로드**: save_module, run_module 정상 동작 ✅
- **Import 문법**: ES modules 스타일 전처리 ✅
- **복합 테스트**: gear + snowflake 모듈 조합 성공 ✅

---

## Phase 4: LLM 친화적 씬 탐색 ✅

### 핵심 원칙

> **모든 정보를 한번에 다 인지하게 하는 시스템은 반드시 실패함**
> LLM이 복잡한 코드를 모듈화해서 이해하듯, 복잡한 씬도 그룹 단위로 분리해서 이해해야 함

### 발견된 문제

| 문제 | 현재 | 해결 |
|------|------|------|
| 복잡한 JSON 응답 | 중첩 JSON 문자열 | `overview` - 계층 구조 요약 |
| 상태 추적 어려움 | 매번 get_entity 호출 | `list_groups`, `describe_group` |
| 개별 위치 파악 | JSON 파싱 필요 | `where` - 간결한 위치 정보 |
| 전체 씬 조작 번거로움 | 루트 그룹 수동 생성 | `translate_scene`, `center_scene` |

### Task 21: 계층적 씬 요약 ✅

- [x] 21.1: `overview` 명령어 구현
  ```
  📊 Scene Overview (12 entities)

  📁 Groups:
    └─ scene (3 children, 3 subgroups)
       └─ house (5 children)
       └─ tree (2 children)
       └─ sun (1 children)

  📐 Bounds: (-75, 0) → (85, 85)
     Size: 160 x 85
  ```
- [x] 21.2: 그룹 계층 표시 (root → subgroups)
- [x] 21.3: 씬 bounds 요약 포함

### Task 22: 그룹 단위 조회 ✅

- [x] 22.1: `list_groups` 명령어
  ```
  📁 Groups (4):
    • house: 5 children (in scene)
    • tree: 2 children (in scene)
    • sun: 1 children (in scene)
    • scene: 3 children (root)
  ```
- [x] 22.2: `describe_group <name>` 명령어
  ```
  📁 Group: house
     Children: 5
     Rects (2): house_body, door
     Lines (1): roof
     Circles (2): window_left, window_right
     Bounds: (-30, 0) → (30, 60)
  ```

### Task 23: 간단한 위치 조회 ✅

- [x] 23.1: `where <entity>` 명령어
  ```
  📍 window_left [Circle] (in group: house)
     Center: (-18.0, 28.0)
     Size: 12.0 x 12.0
  ```

### Task 24: 전체 씬 조작 ✅

- [x] 24.1: `translate_scene <dx> <dy>` - 전체 루트 엔티티 이동
  ```
  ✓ Moved 12 root entities by (100, 50)
  ```
- [x] 24.2: `center_scene` - 씬 중심을 원점으로
  ```
  ✓ Centered scene. Moved 12 entities by (-5.0, -42.5)
  ```
- [x] 24.3: `scale_scene <factor>` - 전체 루트 엔티티 스케일
  ```
  ✓ Scaled 12 root entities by 1.5x
  ```

### Definition of Done (Phase 4) ✅

- **계층 요약**: `overview`로 그룹 구조 한눈에 파악 ✅
- **그룹 탐색**: `list_groups`, `describe_group`으로 drill-down ✅
- **위치 조회**: `where`로 JSON 파싱 없이 위치 확인 ✅
- **씬 조작**: `translate_scene`, `scale_scene`, `center_scene`으로 편리한 전체 조작 ✅

---

## Phase 5: Z-Order / 레이어 ✅

### 배경

복잡한 씬에서 도형 간 렌더링 순서 제어 필요. 특히 배경/전경 분리, 눈송이의 깊이감 표현 등.

### Task 25-28: Z-Order 기능 ✅

- [x] 25: `set_z_order(name, z_index)` - 렌더링 순서 설정 (높을수록 앞)
- [x] 26: `get_z_order(name)` - 현재 z_index 조회
- [x] 27: `bring_to_front`, `send_to_back` - 편의 명령어
- [x] 28: SVG 렌더링 시 z_index 기준 정렬

### Definition of Done (Phase 5) ✅

- **z_index 설정**: `set_z_order`로 렌더링 순서 변경 ✅
- **SVG 정렬**: z_index 오름차순 렌더링 ✅
- **Sandbox 바인딩**: `setZOrder()` 함수 제공 ✅

---

## Phase 6: Polygon Primitive ✅

### 배경

삼각형 산, 삼각형 지붕 등을 그릴 때 Line은 fill이 적용되지 않음 (SVG `<polyline>`은 열린 경로).
닫힌 다각형 `<polygon>`이 필요.

### Task 29-33: Polygon 구현 ✅

- [x] 29: Rust `entity.rs`에 `EntityType::Polygon`, `Geometry::Polygon` 추가
- [x] 30: `draw_polygon(name, points)` WASM 메서드 구현
- [x] 31: SVG serializer에 `<polygon>` 렌더링 추가
- [x] 32: Viewer `renderer.js`에 `renderPolygon()` 함수 추가
- [x] 33: CLI `cli.ts` replay 로직에 Polygon 케이스 추가

### 함수 시그니처

```typescript
draw_polygon(name: string, points: number[]): boolean  // [x1, y1, x2, y2, ...]
```

### 사용 예시

```javascript
// 삼각형 산
drawPolygon('mountain', [-100, 0, 0, 120, 100, 0]);
setFill('mountain', [0.5, 0.6, 0.7, 1]);

// 집 지붕
drawPolygon('roof', [-30, 50, 0, 80, 30, 50]);
setFill('roof', [0.6, 0.3, 0.2, 1]);

// 6각형 프랙탈 눈 결정 (메인 가지 + 브랜치)
for (let i = 0; i < 6; i++) {
  const angle = i * Math.PI / 3;
  drawLine('arm_' + i, [0, 0, Math.cos(angle) * 20, Math.sin(angle) * 20]);
  // 브랜치 추가...
}
```

### Definition of Done (Phase 6) ✅

- **Polygon 렌더링**: `draw_polygon`으로 닫힌 다각형 생성 ✅
- **Fill 지원**: Polygon에 `setFill()` 적용 가능 ✅
- **Viewer 지원**: Canvas 렌더러에서 Polygon 표시 ✅
- **예제 검증**: 눈내리는 마을 (186개 엔티티, 삼각형 산/지붕/나무) ✅

---

## Phase 7: Bezier Curve + CLI Docs ✅

### 배경

복잡한 곡선(연기, 산 능선, 부드러운 경로)을 표현하기 위해 베지어 커브 필요.
다른 LLM(Codex 등)이 도구를 이해하지 못하는 문제 발견 → CLI 문서화 개선 필요.

### Task 34-39: Bezier + Docs ✅

- [x] 34: Rust 엔진에 `Bezier` 타입 추가
- [x] 35: `draw_bezier(name, points, closed)` 명령어 구현
- [x] 36: SVG `<path>` 렌더링 (cubic bezier)
- [x] 37: Viewer Canvas 렌더링 지원
- [x] 38: CLI `describe sandbox` 도메인 추가
- [x] 39: CLAUDE.md에 draw_bezier 사용법 문서화

### Bezier 포맷

```javascript
// points = [startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY, ...]
// 시작점 (2개) + 세그먼트당 6개 (cp1, cp2, end)
drawBezier("smoke", [
  75, 95,           // 시작점 (굴뚝 위)
  80, 120,          // control point 1
  70, 140,          // control point 2
  75, 160           // 끝점
], false);
setStroke("smoke", [0.7, 0.7, 0.7, 0.5], 3);
```

### describe sandbox 도메인

LLM이 sandbox 함수 목록을 조회할 수 있도록 CLI에 도메인 추가:

```bash
npx tsx cad-cli.ts describe sandbox
```

출력:
```
🚀 SANDBOX - run_cad_code 샌드박스 함수

📋 PRIMITIVES (7개)
- drawCircle(name, x, y, radius)
- drawRect(name, x, y, width, height)
- drawLine(name, points[])
- drawArc(name, cx, cy, radius, startAngle, endAngle)
- drawPolygon(name, points[])
- drawBezier(name, points[], closed)

⭐ BEZIER 포맷 (중요!)
points = [startX, startY,           // 시작점 (2개)
          cp1X, cp1Y, cp2X, cp2Y, endX, endY,  // 세그먼트1 (6개)
          ...]
...
```

### Definition of Done (Phase 7) ✅

- **Bezier 렌더링**: `drawBezier`로 부드러운 곡선 생성 ✅
- **CLI 문서화**: `describe sandbox`로 함수 목록 조회 가능 ✅
- **CLAUDE.md 업데이트**: draw_bezier 사용법 문서화 ✅

---

## Phase 8: 코드 에디터 인터페이스 ✅

### 배경

기존 `run_cad_code '코드'` 방식의 LLM 사용성 문제:
- Windows 배치 파일에서 멀티라인 인자 전달 불가
- 모듈 수정 시 전체 재작성 필요 (append 없음)
- 모듈 삭제 기능 없음
- 의존성 추적 어려움

### Task 40-46: 코드 에디터 모드 ✅

- [x] 40: 프로젝트 구조 모드 (인자 없음) → files, main, entities 요약
- [x] 41: 파일 읽기 모드 (`run_cad_code <name>`)
- [x] 42: 파일 쓰기 모드 (`run_cad_code <name> "code"`)
- [x] 43: 코드 추가 모드 (`run_cad_code <name> +"code"`)
- [x] 44: stdin 멀티라인 모드 (`run_cad_code <name> -`)
- [x] 45: 파일 삭제 모드 (`run_cad_code --delete <name>`)
- [x] 46: 의존성 그래프 (`run_cad_code --deps`)

### 사용 예시

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
$code = @"
class House {
  constructor(name, x, y) { this.name = name; this.x = x; this.y = y; }
  build() {
    drawRect(this.name + '_wall', this.x, this.y, 60, 50);
    drawPolygon(this.name + '_roof', [this.x, this.y+50, this.x+30, this.y+80, this.x+60, this.y+50]);
  }
}
new House('h1', 0, 0).build();
"@
$code | .\cad-cli.cmd run_cad_code main -

# 모듈 삭제
cad-cli.cmd run_cad_code --delete my_module

# 의존성 확인
cad-cli.cmd run_cad_code --deps
```

### 출력 예시

**프로젝트 구조**
```
📁 Project Structure
==================
Files: house_lib, tree_lib, cloud_lib, main
Main: 5 lines
Entities: 42

Tip: run_cad_code <name> to read a file
```

**의존성 그래프**
```
📊 Dependencies
===============
main
  └─ house_lib
  └─ tree_lib
  └─ cloud_lib
```

### Definition of Done (Phase 8) ✅

- **프로젝트 구조**: 인자 없이 실행 시 파일/엔티티 요약 ✅
- **Append 모드**: `+"code"`로 기존 코드에 추가 ✅
- **stdin 모드**: 멀티라인 코드 파이프 입력 ✅
- **모듈 삭제**: `--delete`로 불필요한 모듈 정리 ✅
- **의존성 추적**: `--deps`로 import 관계 시각화 ✅

---

## Phase 9: AX Cross-Class Placement ✅

### 배경

LLM(Claude)이 클래스/모듈 경계를 넘어 엔티티를 배치할 때 좌표 정보를 잃어버리는 문제 발견.
Robot 클래스로 캐릭터를 생성한 후 말풍선을 머리 위에 배치하려 했으나, 머리의 실제 위치를 알 수 없어 실패.

**근본 원인:**
- OOP 캡슐화가 내부 좌표 정보를 숨김
- LLM이 `getWorldBounds()` API 존재를 잊거나 사용하지 않음
- 정보 과잉은 오히려 중요 정보를 놓치게 만듦

### Task 47-50: AX Cross-Class Placement ✅

- [x] 47: 크로스 클래스 배치 문제 분석 (클래스 경계에서 좌표 손실)
- [x] 48: Action Hints 시스템 구현
  - `run_cad_code` 결과에 `getWorldBounds()` 사용 힌트 추가
  - AX 철학: 정보를 다 주는 게 아니라 능동적 행동 유도
- [x] 49: AGENTS.md에 크로스 클래스 배치 패턴 문서화
- [x] 50: 복합 씬 테스트 (124개 엔티티)

### 복합 씬 테스트

5개 모듈로 구성된 마을 씬:
- `building_lib`: Building, Shop 클래스
- `tree_lib`: Tree, PineTree, FruitTree 클래스
- `person_lib`: Person, Worker 클래스
- `nature_lib`: Cloud, FluffyCloud, Mountain, MountainRange 클래스
- `main`: 모든 모듈 조합 + 크로스 클래스 배치

**크로스 클래스 배치 예시:**
```javascript
// Person 생성 후 말풍선을 머리 위에 배치
const p = new Person('mayor', 0, 0).build();
const headBounds = getWorldBounds('mayor_head');
const bubbleY = headBounds.max[1] + 10;
drawRect('speech_bubble', headBounds.max[0] - 20, bubbleY, 50, 25);
```

### Definition of Done (Phase 9) ✅

- **문제 분석**: 클래스 경계에서 좌표 정보 손실 원인 파악 ✅
- **Action Hints**: 결과에 `getWorldBounds()` 사용 힌트 추가 ✅
- **문서화**: AGENTS.md에 크로스 클래스 배치 패턴 추가 ✅
- **복합 테스트**: 124개 엔티티 마을 씬 + 말풍선 배치 성공 ✅

---

## MAMA Metrics

| 메트릭 | 목적 | 연계 Task | 성공 기준 | 상태 |
|--------|------|----------|----------|------|
| `cad:run_cad_code_poc_success` | PoC 완료 추적 | Task 1-6 | 기어/스노우플레이크 예제 동작 | ✅ |
| `cad:code_as_source_of_truth` | Code-as-Truth 검증 | Task 7 | get_scene_code 워크플로우 완료 | ✅ |
| `cad:module_system` | 모듈 시스템 | Phase 3 | save/run_module + import 동작 | ✅ |
| `cad:llm_friendly_navigation` | LLM 친화적 탐색 | Phase 4 | overview, where, translate_scene | ✅ |
| `cad:polygon_primitive` | Polygon 지원 | Phase 6 | 삼각형 등 닫힌 도형 fill 가능 | ✅ |
| `cad:bezier_and_sandbox_docs` | Bezier + CLI 문서화 | Phase 7 | Bezier 커브 + describe sandbox | ✅ |
| `cad:run_cad_code_editor` | 코드 에디터 인터페이스 | Phase 8 | append, stdin, delete, deps | ✅ |
| `cad:ax_cross_class_placement_pattern` | 크로스 클래스 배치 | Phase 9 | Action Hints + getWorldBounds | ✅ |
| `cad:run_cad_code_final` | 최종 성공 | Task 8.3 | Electron 앱 통합 | ⏳ Epic 6 |

## References

- RFC: `docs/rfc/run-cad-code.md`
- QuickJS: https://bellard.org/quickjs/
- quickjs-emscripten: https://github.com/justjake/quickjs-emscripten
