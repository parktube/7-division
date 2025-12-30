# Story 3.0-c: Angle Unit Support (각도 단위 지원)

Status: done

## Story

As an **LLM (CAD 도구 사용자)**,
I want **도(degree) 단위로 각도를 지정할 수 있도록**,
So that **라디안 변환 없이 직관적으로 호와 회전을 표현할 수 있다**.

## Background

### 현재 문제

```typescript
// 문 열림 표시 (90도 호)
executor.exec('draw_arc', {
  name: 'door_swing',
  cx: 50, cy: 50,
  radius: 80,
  start_angle: 0,
  end_angle: Math.PI / 2,  // 90도 = π/2 ???
});

// LLM 입장에서:
// - "90도"라고 생각했는데 → Math.PI / 2로 변환 필요
// - 30도는? → Math.PI / 6? 아니 Math.PI * 30 / 180?
// - 매번 변환 공식 기억해야 함
// - 실수 가능성 높음
```

### 목표 상태

```typescript
// 문 열림 표시 (90도 호) - degree 사용
executor.exec('draw_arc', {
  name: 'door_swing',
  cx: 50, cy: 50,
  radius: 80,
  start_angle: 0,
  end_angle: 90,       // 직관적!
  angle_unit: 'degree',   // 명시적 단위
});

// LLM 입장에서:
// - "90도" 그대로 입력
// - angle_unit: 'degree' 한 번만 추가
// - 변환 공식 필요 없음
```

## Acceptance Criteria

### AC1: degree 단위 지원
**Given** `angle_unit: 'degree'`가 지정되었을 때
**When** `draw_arc` 호출
**Then** 각도가 도(degree) 단위로 해석된다

```typescript
// 입력
executor.exec('draw_arc', {
  name: 'quarter_arc',
  cx: 0, cy: 0,
  radius: 50,
  start_angle: 0,
  end_angle: 90,
  angle_unit: 'degree'
})

// 결과: 0° ~ 90° 호 (= 0 ~ π/2 라디안)
```

### AC2: radian 단위 명시적 지원
**Given** `angle_unit: 'radian'`가 지정되었을 때
**When** `draw_arc` 호출
**Then** 각도가 라디안 단위로 해석된다 (기존 동작과 동일)

```typescript
// 입력
executor.exec('draw_arc', {
  name: 'quarter_arc',
  cx: 0, cy: 0,
  radius: 50,
  start_angle: 0,
  end_angle: 1.5708,  // π/2
  angle_unit: 'radian'
})
```

### AC3: 기본 단위 = 라디안 (하위 호환)
**Given** `angle_unit`이 생략되었을 때
**When** `draw_arc` 호출
**Then** 기본 단위(radian)로 해석된다 (기존 동작 유지)

```typescript
// 입력 - angle_unit 생략 = 라디안 (하위 호환)
executor.exec('draw_arc', {
  name: 'door',
  cx: 0, cy: 0,
  radius: 50,
  start_angle: 0,
  end_angle: Math.PI / 2  // 기존 코드 그대로 작동
})

// 새 코드에서 degree 사용 시 명시적으로 지정
executor.exec('draw_arc', {
  name: 'door2',
  cx: 0, cy: 0,
  radius: 50,
  start_angle: 0,
  end_angle: 90,
  angle_unit: 'degree'  // 명시적 지정
})
```

### AC4: 조회 결과는 항상 라디안
**Given** Arc 엔티티가 존재할 때
**When** `get_entity({ name })` 호출 (Story 3.0-a)
**Then** 각도는 항상 라디안으로 반환된다 (내부 저장 형식)

```typescript
// Arc를 degree로 생성해도
executor.exec('draw_arc', { ..., end_angle: 90, angle_unit: 'degree' })

// 조회 시에는 라디안으로 반환
executor.exec('get_entity', { name: 'arc1' })
// → { geometry: { ..., end_angle: 1.5708 } }  // π/2 라디안
```

> **참고**: 조회 결과에 단위 변환 옵션은 P2에서 고려

### AC5: 하위 호환성
**Given** 기존 코드가 라디안을 사용 중일 때
**When** `angle_unit: 'radian'`를 명시하거나 생략
**Then** 기존 동작과 동일하게 작동

## Tasks / Subtasks

- [x] **Task 1: 타입 정의** (AC: #1, #2)
  - [x] 1.1: AngleUnit 타입 정의 (angle-utils.ts:6)
  - [x] 1.2: Schema에 angle_unit 프로퍼티 추가 (schema.ts:126-127)
  - [x] 1.3: 회전 도구에도 적용 (schema.ts:249-250, executor.ts:346-347)

- [x] **Task 2: 변환 유틸리티** (AC: #1, #2)
  - [x] 2.1: degToRad 함수 구현 (angle-utils.ts:11-13)
  - [x] 2.2: radToDeg 함수 (angle-utils.ts:18-20)
  - [x] 2.3: normalizeAngle 함수 (angle-utils.ts:28-33)

- [x] **Task 3: Executor 수정** (AC: #1, #2, #3)
  - [x] 3.1: draw_arc 핸들러에서 angle_unit 처리 (executor.ts:245-247)
  - [x] 3.2: 기본값 'radian' 유지 (angle-utils.ts:30)
  - [x] 3.3: angle_unit='degree' 시 라디안 변환 (executor.ts:246-247)

- [x] **Task 4: 테스트** (AC: #1~#5)
  - [x] 4.1: degree 입력 테스트 (angle-utils.test.ts, executor.test.ts:80-98)
  - [x] 4.2: radian 명시 테스트 (executor.test.ts:100-116)
  - [x] 4.3: 기본값 테스트 (angle-utils.test.ts)
  - [x] 4.4: 하위 호환성 테스트 (executor.test.ts:65-78)

- [ ] **Task 5: 예제에 degree 사용 예시 추가** (선택)
  - [ ] 5.1: 새 예제에서 angle_unit: 'degree' 사용 시연
  - [ ] 5.2: 기존 예제는 수정하지 않음 (하위 호환 증명)

## Dev Notes

### 왜 이 스토리가 필요한가?

AX 원칙: **도구는 LLM의 언어다**

라디안은 수학적으로 정확하지만:
- LLM은 "90도"로 생각한다
- 라디안 변환은 인지 부하 증가
- `Math.PI / 2` 같은 표현은 오류 가능성

degree 지원하면:
- 직관적 표현 가능
- 변환 실수 감소
- 코드 가독성 향상

### 구현 방향

**변환 레이어 위치: Executor (TypeScript)**

```
[LLM] → degree 입력
         ↓
[Executor] → 라디안 변환
         ↓
[WASM] → 내부적으로 라디안 사용 (수학 연산 정확성)
```

WASM 내부는 라디안 유지 (수학 라이브러리 호환성)

### 변환 유틸리티

```typescript
// angle-utils.ts

export type AngleUnit = 'degree' | 'radian';

export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

export function normalizeAngle(
  value: number,
  unit: AngleUnit = 'radian'
): number {
  // 항상 라디안으로 반환 (WASM용)
  return unit === 'degree' ? degToRad(value) : value;
}
```

### Schema 변경

```typescript
// schema.ts 수정

draw_arc: {
  name: 'draw_arc',
  description: '호(원의 일부)를 그립니다',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '엔티티 이름' },
      cx: { type: 'number', description: '중심 X 좌표' },
      cy: { type: 'number', description: '중심 Y 좌표' },
      radius: { type: 'number', description: '반지름' },
      start_angle: { type: 'number', description: '시작 각도 (기본: 라디안)' },
      end_angle: { type: 'number', description: '끝 각도 (기본: 라디안)' },
      angle_unit: {
        type: 'string',
        enum: ['degree', 'radian'],
        description: '각도 단위. degree=도, radian=라디안(기본)'
      },
      style: { ... }
    },
    required: ['name', 'cx', 'cy', 'radius', 'start_angle', 'end_angle']
  }
}
```

### 예제 변환

**Before (라디안):**
```typescript
executor.exec('draw_arc', {
  name: 'door_swing',
  cx: 50, cy: 50,
  radius: 80,
  start_angle: 0,
  end_angle: Math.PI / 2,  // 90도
});
```

**After (degree):**
```typescript
executor.exec('draw_arc', {
  name: 'door_swing',
  cx: 50, cy: 50,
  radius: 80,
  start_angle: 0,
  end_angle: 90,  // 직관적!
});
```

### Breaking Change 고려

**옵션 1: 기본값 'radian' 유지 (채택)**
- 기존 코드 100% 호환
- 새 코드에서 `angle_unit: 'degree'` 명시 필요
- LLM은 도구 호출 시 한 번만 추가하면 됨

**옵션 2: 기본값 'degree' 변경 (기각)**
- 기존 예제 코드가 모두 깨짐
- 마이그레이션 비용 발생
- 사용자 혼란 가능

→ **옵션 1 채택**: 하위 호환성 유지가 더 중요

### Query 결과와 단위

Story 3.0-a `get_entity`가 Arc 반환 시:
- 내부 저장은 항상 **라디안**
- 조회 결과도 **라디안**으로 반환
- 단위 변환 옵션은 향후 P2에서 검토

```typescript
// 생성 시 degree 사용
executor.exec('draw_arc', { end_angle: 90, angle_unit: 'degree' })

// 조회 시 라디안으로 반환
get_entity → { end_angle: 1.5708 }  // π/2
```

이렇게 하면:
- WASM 내부 일관성 유지
- 변환 로직 단순화
- 조회 결과로 다시 그릴 때 angle_unit 생략 가능

### 확장성

향후 rotate 도구에도 동일 패턴 적용:

```typescript
executor.exec('rotate', {
  name: 'chair',
  angle: 45,
  angle_unit: 'degree'  // 명시적 지정
});
```

## Dependencies

- Story 3.0 (Tool Use Foundation) - 완료됨
- Story 1.3 (Arc) - 완료됨

## References

- [AX Design Guide](../ax-design-guide.md)
- [Story 3.0 - Tool Use Foundation](./3-0-tool-use-foundation.md)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Completion Notes List
- LLM의 인지 부하 감소가 핵심 목표
- 기본값 'radian' 유지 (하위 호환성 우선)
- 새 코드에서 `angle_unit: 'degree'` 명시로 degree 사용
- 자연어 단위명 사용: 'degree'/'radian' (약어 'deg'/'rad' 대신)
- 조회 결과(get_entity)는 항상 라디안 반환
- 씬 레벨 기본 단위 설정은 P2로 미룸
- 향후 rotate 등 각도 관련 도구에 동일 패턴 적용
