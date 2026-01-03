# PoC: run_cad_code

Status: planning

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
  draw_rect("tooth_" + i, 0, 50, 10, 20);
  rotate("tooth_" + i, (i * 45) * Math.PI / 180);
}
```

**17번 → 1번 호출**, LLM이 기하학적 의도를 코드로 표현.

## Acceptance Criteria

### AC1: QuickJS 샌드박스 실행

- Given: JavaScript 코드 문자열
- When: `run_cad_code` 실행
- Then: QuickJS 샌드박스에서 안전하게 실행됨
- And: Node.js API 접근 불가 (보안)

### AC2: CAD 함수 바인딩

- Given: 샌드박스 내 코드
- When: `draw_circle("test", 0, 0, 50)` 호출
- Then: 실제 CAD 엔진에 도형 생성됨
- And: 10개 함수 바인딩 (primitives 5 + transforms 3 + style 2)

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
    │   ├── index.ts          # QuickJS 초기화, 코드 실행
    │   ├── bindings.ts       # CAD 함수 → QuickJS 바인딩
    │   └── types.ts          # 타입 정의
    ├── executor.ts           # + run_cad_code, get_scene_code 명령어
    └── cli.ts                # + CLI 명령어 등록

viewer/
└── scene.code.js             # 실행된 코드 저장 (런타임 생성)

examples/
├── gear.js                   # 기어 예제 코드
└── snowflake.js              # 스노우플레이크 예제 코드
```

## Tasks / Subtasks

### Task 1: 의존성 및 기본 구조 (AC: 1)

- [ ] 1.1: `quickjs-emscripten` 의존성 추가
  ```bash
  cd cad-tools && npm install quickjs-emscripten
  ```
- [ ] 1.2: `src/sandbox/` 디렉토리 생성
- [ ] 1.3: 타입 정의
  ```typescript
  interface RunCodeResult {
    success: boolean;
    entitiesCreated: string[];
    error?: string;
    logs: string[];
  }
  ```

### Task 2: QuickJS 샌드박스 구현 (AC: 1)

- [ ] 2.1: `runCadCode()` 함수 구현
  ```typescript
  async function runCadCode(code: string): Promise<RunCodeResult>
  ```
- [ ] 2.2: 코드 실행 및 에러 핸들링
- [ ] 2.3: `console.log` 바인딩

### Task 3: CAD 함수 바인딩 (AC: 2)

- [ ] 3.1: Primitives 바인딩 (5개)
  - `draw_circle(name, x, y, radius)`
  - `draw_rect(name, x, y, width, height)`
  - `draw_line(name, points)`
  - `draw_arc(name, cx, cy, radius, start_angle, end_angle)`
  - `draw_polygon(name, points)`
- [ ] 3.2: Transforms 바인딩 (3개)
  - `translate(name, dx, dy)`
  - `rotate(name, angle)`
  - `scale(name, sx, sy)`
- [ ] 3.3: Style 바인딩 (2개)
  - `set_fill(name, color)`
  - `set_stroke(name, color, width)`
- [ ] 3.4: 유틸리티 바인딩
  - `delete_entity(name)`
  - `exists(name)`

### Task 4: CLI 통합 (AC: 1, 2)

- [ ] 4.1: `run_cad_code` 명령어 추가
- [ ] 4.2: `get_scene_code` 명령어 추가
- [ ] 4.3: CLI help에 명령어 설명 추가

### Task 5: 기어 예제 구현 및 검증 (AC: 3)

- [ ] 5.1: `examples/gear.js` 작성
  ```javascript
  draw_circle("gear_body", 0, 0, 40);
  set_fill("gear_body", [0.7, 0.7, 0.7, 1]);

  for (let i = 0; i < 8; i++) {
    const angle = (i * 45) * Math.PI / 180;
    draw_rect("tooth_" + i, -4, 40, 8, 15);
    rotate("tooth_" + i, angle);
  }
  ```
- [ ] 5.2: 실행 및 9개 엔티티 확인
- [ ] 5.3: 뷰어에서 시각적 검증

### Task 6: 스노우플레이크 예제 구현 및 검증 (AC: 4)

- [ ] 6.1: `examples/snowflake.js` 작성
  ```javascript
  const branches = 6;
  const mainLength = 80;

  draw_circle("center", 0, 0, 8);
  set_fill("center", [0.2, 0.6, 1, 1]);

  for (let i = 0; i < branches; i++) {
    const angle = (i * 60) * Math.PI / 180;
    const endX = Math.cos(angle) * mainLength;
    const endY = Math.sin(angle) * mainLength;
    draw_line("branch_" + i, [0, 0, endX, endY]);
    set_stroke("branch_" + i, [0.1, 0.3, 0.8, 1], 3);
  }
  ```
- [ ] 6.2: 프랙탈 패턴 확인
- [ ] 6.3: 뷰어에서 시각적 검증

### Task 7: Code as Source of Truth (AC: 5)

- [ ] 7.1: `run_cad_code` 실행 시 `viewer/scene.code.js` 저장
- [ ] 7.2: `get_scene_code` 명령어로 코드 조회
- [ ] 7.3: 코드 수정 → 재실행 워크플로우 검증

### Task 8: Electron 앱 통합

> Story 6-6과 연계: Electron 배포 시 CLI에 run_cad_code 포함

- [ ] 8.1: `cad-cli --help`에 run_cad_code 도메인 추가
  ```
  Commands (code):
    run_cad_code   JavaScript 코드 실행
    get_scene_code 저장된 코드 조회
  ```
- [ ] 8.2: `cad-cli describe code` 도메인 설명 추가
- [ ] 8.3: Electron 앱에서 동작 검증
  ```bash
  # macOS
  /Applications/CADViewer.app/Contents/Resources/cad-cli.sh run_cad_code '{"code":"..."}'

  # Windows
  %LOCALAPPDATA%\Programs\CADViewer\resources\cad-cli.cmd run_cad_code '{"code":"..."}'
  ```

### Task 9: 문서 및 PR

- [ ] 9.1: CLAUDE.md에 run_cad_code 사용법 추가
- [ ] 9.2: PR 생성 및 리뷰
- [ ] 9.3: main 머지

## Dev Notes

### QuickJS 선택 이유

- 경량 (WASM 호환)
- ES2020 지원
- 완전한 샌드박스 (Node.js API 차단)
- `quickjs-emscripten`: TypeScript 지원

### 함수 시그니처

```typescript
// Primitives
draw_circle(name: string, x: number, y: number, radius: number): void
draw_rect(name: string, x: number, y: number, width: number, height: number): void
draw_line(name: string, points: number[]): void
draw_arc(name: string, cx: number, cy: number, radius: number, startAngle: number, endAngle: number): void
draw_polygon(name: string, points: number[]): void

// Transforms
translate(name: string, dx: number, dy: number): void
rotate(name: string, angle: number): void  // 라디안
scale(name: string, sx: number, sy: number): void

// Style
set_fill(name: string, color: [number, number, number, number]): void
set_stroke(name: string, color: [number, number, number, number], width: number): void
```

### 에러 처리

```javascript
// 샌드박스 내 에러 → 사용자에게 명확한 피드백
{
  "success": false,
  "error": "ReferenceError: draw_circl is not defined (line 3)"
}
```

## Success Metrics

| 지표 | 현재 | PoC 목표 |
|------|------|----------|
| 기어 8톱니 | 17번 호출 | 1번 호출 |
| 스노우플레이크 | 수백번 호출 | 1번 호출 |
| 코드 재사용 | 불가능 | get_scene_code로 가능 |

## References

- RFC: `docs/rfc/run-cad-code.md`
- MAMA: `cad:run_cad_code_poc_success`
- MAMA: `cad:code_as_source_of_truth`
- MAMA: `cad:run_cad_code_final`
- QuickJS: https://bellard.org/quickjs/
- quickjs-emscripten: https://github.com/aspect-sh/aspect-quick
