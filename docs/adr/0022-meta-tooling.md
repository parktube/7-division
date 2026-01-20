# ADR-0022: run_cad_code - LLM이 JavaScript로 CAD 도구 조합

## Status

**Revised** (2026-01-01)

> JSON DSL 폐기, JavaScript 코드 실행(run_cad_code)으로 대체

## Date

2025-12-31 (원안: Meta-Tooling)
2026-01-01 (1차 수정: JSON DSL)
2026-01-01 (2차 수정: run_cad_code)

## Context

에이전트가 도구의 단순 사용자를 넘어 창조자가 되어야 한다. 반복 작업을 도구로 캡슐화하는 능력.

### 폐기된 접근법들

**Meta-Tooling (Builder - TypeScript 코드 작성):**

- Claude Code가 이미 코드를 작성할 수 있음 → 별도 시스템 불필요
- 샌드박스 보안 복잡성

**Tool Composition (Consumer - JSON 매크로):**

- 매크로 = 명령 시퀀스 반복 → LLM을 프로그램 실행기로 만듦
- "비슷하지만 다른" 상황 처리 못함

**JSON DSL:**

- LLM에게 새로운 문법을 강요
- 제어흐름(for_each, if) 추가 시 결국 프로그래밍 언어화
- "새 언어 발명"보다 "있는 언어 활용"이 단순

### 핵심 통찰

1. **LLM은 JavaScript에 능숙**: 학습 데이터에 풍부, 추가 학습 최소화
2. **기하학적 사고 = 코드**: 패턴, 수식, 반복을 자연스럽게 표현
3. **코드 일관성 ≠ 목표**: 매번 다른 코드여도 괜찮음
4. **의도 일관성 = MAMA가 담당**: 결정/맥락을 저장하여 의도 유지

## Decision

### 1. 기존 역할 구분 폐기

| 기존 역할                       | 결정                                   |
| ------------------------------- | -------------------------------------- |
| **Builder (Meta-Tooling)**      | 삭제 - Claude Code가 이미 수행         |
| **Consumer (Tool Composition)** | **run_cad_code (JS Execution)**로 대체 |

### 2. run_cad_code (JavaScript Execution)

LLM이 필요할 때 직접 JavaScript 코드를 작성하여 도구를 조립하고, 실패 시 피드백을 받아 수정:

- **환경**: `quickjs-emscripten` (WASM 기반 샌드박스)
- **보안**: 파일/네트워크 차단, 메모리/타임아웃 제한
- **트랜잭션**: WASM 엔진의 Undo 스택을 활용한 원자적 실행 보장
- **피드백**: 스택트레이스를 LLM에게 전달하여 자가 수정 유도

### 2. 노출되는 CAD 함수

```javascript
// Primitives
draw_line({ name, points: [x1,y1,x2,y2,...] })
draw_circle({ name, x, y, radius })
draw_rect({ name, x, y, width, height })
draw_arc({ name, cx, cy, radius, start_angle, end_angle })

// Transforms
translate({ name, dx, dy })
rotate({ name, angle })  // 라디안
scale({ name, sx, sy })
set_pivot({ name, px, py })

// Styles
set_fill({ name, fill: { color: [r,g,b,a] } })
set_stroke({ name, stroke: { color, width } })

// Groups
create_group({ name, children: [...] })
ungroup({ name })

// Query
list_entities()  // → string[]
get_entity({ name })  // → Entity

// Delete
delete_entity({ name })
```

### 3. 예시: 기어 톱니 그리기

예시 1: 제어 흐름과 수식 사용 (기어 톱니)

```javascript
run_cad_code(`
  const teeth = 12;
  for (let i = 0; i < teeth; i++) {
    const angle = (i / teeth) * Math.PI * 2;
    draw_circle({
      name: `tooth_${i}`,
      x: Math.cos(angle) * 50,
      y: Math.sin(angle) * 50,
      radius: 5
    });
  }
`);
```

예시 2: 시멘틱 쿼리와 참조 기반 조작 (코너 다듬기)

```javascript
run_cad_code(`
  // 1. 교차점 조회
  const p1 = get_intersection({ a: "wall_1", b: "wall_2" });
  
  // 2. 교차점에서 특정 거리의 점 계산
  const p2 = get_point_at_distance({ entity: "wall_1", from: p1.points[0], distance: 20 });
  
  // 3. 해당 점을 기준으로 트리밍
  trim_at({ entity: "wall_1", point: p2.point, keep: "start" });
`);
```

### 3. 에러 피드백 기반 수정

```json
{
  "success": false,
  "error": {
    "message": "trim_at is not defined. Did you mean: trim_at_point?",
    "line": 4,
    "stack": "at <anonymous>:4:3"
  }
}
```

LLM이 에너지를 분석하고 코드를 수정하여 재시도 가능.

### 4. 샌드박스 설정

```typescript
const SANDBOX_LIMITS = {
  timeout_ms: 10000, // 10초
  memory_bytes: 33554432, // 32MB
  max_entities: 10000, // 최대 엔티티 수
};

const BLOCKED_GLOBALS = [
  "require",
  "import",
  "fetch",
  "XMLHttpRequest",
  "fs",
  "path",
  "process",
  "child_process",
];
```

### 5. MAMA Action Hints 흐름

패턴 저장 기능을 제공하지 않는다. 의도 일관성은 MAMA가 담당:

```
┌─────────────────────────────────────────────────────────────────┐
│                         MAMA                                     │
│   ┌─────────────┐         ┌──────────────────────────────────┐ │
│   │  Decisions  │────────▶│  Action Hints 생성               │ │
│   │  Outcomes   │         │  "기어는 원형 배열, cos/sin 사용" │ │
│   └─────────────┘         └──────────────┬───────────────────┘ │
└──────────────────────────────────────────┼──────────────────────┘
                                           │ Tool Description에 동적 주입
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              LLM (Claude/Ollama/OpenAI 등)                       │
│   Description + Hints 참조 → JavaScript 코드 작성               │
└──────────────────────────────────────────┬──────────────────────┘
                                           │ run_cad_code 실행
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              QuickJS Sandbox                                     │
│   draw_circle, translate, rotate 등 CAD 함수 실행              │
└──────────────────────────────────────────┬──────────────────────┘
                                           │
                                           ▼
                              MAMA에 결정/결과 기록 → 다음 힌트 반영
```

**핵심 원리:**

- MAMA가 Tool Description에 Action Hints를 동적 주입
- LLM은 힌트를 참고하여 코드 작성 (강제 아님, 설득 기반)
- 결과를 MAMA에 기록 → 다음 세션 힌트에 반영
- 코드 형태는 달라도 의도가 일관되면 OK

### 6. 저장 구조 변경

```
.cad/
├── memory.db        # 결정/힌트 (MAMA)
├── ~~tools/~~       # 삭제 - 패턴 저장 안함
└── assets/          # 재사용 가능한 디자인 조각
```

## Consequences

### Positive

- LLM이 기하학적 사고를 코드로 그대로 표현
- 1회 호출로 복잡한 작업 완료 (컨텍스트 효율)
- 에러 시 스택트레이스 + LLM 자체 수정
- JavaScript는 LLM의 "모국어" - 추가 학습 최소화
- QuickJS 샌드박스로 보안 확보

### Negative

- 시멘틱 도구(Epic 10.1~10.5)가 있으면 더 강력하지만, 기본 도구만으로도 동작
- 복잡한 코드에서 에러 디버깅 필요

### Neutral (변경)

- Meta-Tooling: 삭제 (Claude Code가 대신함)
- Tool Composition: 삭제 (run_cad_code로 대체)
- JSON DSL: 삭제 (JavaScript로 대체)

## Related Stories

- **Story 10.6**: run_cad_code (이 ADR 구현)
- ~~Story 9.6~~: Meta-Tooling → 폐기
- ~~Story 9.7~~: Tool Composition → 폐기

## References

- [ADR-0010: Partnership Philosophy](0010-partnership-philosophy.md)
- [ADR-0015: Dynamic Hint Injection](0015-dynamic-hint-injection.md)
- [Architecture Decision 14: run_cad_code](../architecture.md#decision-14-run_cad_code)
- [Story 10.6: run_cad_code](../stories/10-6-run-cad-code.md)
- [AX Design Guide](../ax-design-guide.md) - "LLM의 추론을 막지 않는다"
