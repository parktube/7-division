# Story 3.0-a: Scene Query Tools (씬 상태 조회)

Status: ready-for-dev

## Story

As an **LLM (CAD 도구 사용자)**,
I want **씬의 현재 상태를 조회할 수 있도록**,
So that **내가 그린 것을 기억에 의존하지 않고 확인하고, 다음 작업을 계획할 수 있다**.

## Background

### 현재 문제

```
LLM이 방을 그린 후:
─────────────────────────────────────────────────────────
LLM: draw_rect({ name: 'wall', ... })
LLM: draw_rect({ name: 'bed', ... })
LLM: draw_circle({ name: 'table', ... })

유저: "가구 좀 더 추가해줘"

LLM: (내 기억으로는 wall, bed, table이 있는데... 맞나?)
     (어디에 공간이 있지? 바운딩 박스가 뭐지?)
     → 기억에 의존 = 불확실
─────────────────────────────────────────────────────────
```

### 목표 상태

```
LLM이 방을 그린 후:
─────────────────────────────────────────────────────────
유저: "가구 좀 더 추가해줘"

LLM: list_entities()
     → ['wall', 'bed', 'table']

LLM: get_entity({ name: 'wall' })
     → { type: 'rect', x: 0, y: 0, width: 400, height: 300 }

LLM: "wall이 400x300이고, bed가 오른쪽에 있으니
      왼쪽 공간에 소파를 추가할게요"
     → 확실한 판단 기반
─────────────────────────────────────────────────────────
```

## Acceptance Criteria

### AC1: 엔티티 목록 조회
**Given** 씬에 엔티티들이 존재할 때
**When** `list_entities` 도구 호출
**Then** 모든 엔티티의 이름과 타입이 배열로 반환된다

```typescript
// 입력
executor.exec('list_entities', {})

// 출력
{
  success: true,
  data: [
    { name: 'wall', type: 'rect' },
    { name: 'bed', type: 'rect' },
    { name: 'table', type: 'circle' }
  ]
}
```

### AC2: 개별 엔티티 조회
**Given** 특정 이름의 엔티티가 존재할 때
**When** `get_entity({ name })` 도구 호출
**Then** 해당 엔티티의 전체 정보가 반환된다 (geometry, style, transform)

```typescript
// 입력
executor.exec('get_entity', { name: 'bed' })

// 출력
{
  success: true,
  data: {
    name: 'bed',
    type: 'rect',
    geometry: { x: 280, y: 20, width: 100, height: 150 },
    style: { stroke: {...}, fill: {...} },
    transform: { translate: [0, 0], rotate: 0, scale: [1, 1] }
  }
}
```

### AC3: 존재하지 않는 엔티티 조회
**Given** 존재하지 않는 엔티티 이름
**When** `get_entity({ name })` 도구 호출
**Then** `success: false`와 에러 메시지 반환

```typescript
// 입력
executor.exec('get_entity', { name: 'unknown' })

// 출력
{
  success: false,
  error: "Entity 'unknown' not found"
}
```

### AC4: 씬 메타데이터 조회
**Given** 씬이 생성된 상태
**When** `get_scene_info` 도구 호출
**Then** 씬 이름, 엔티티 수, 바운딩 박스 등 메타 정보 반환

```typescript
// 입력
executor.exec('get_scene_info', {})

// 출력
{
  success: true,
  data: {
    name: 'my-room',
    entity_count: 8,
    bounds: { min: [-200, -150], max: [200, 150] }
  }
}
```

### AC5: 빈 씬 조회
**Given** 엔티티가 없는 빈 씬
**When** `list_entities` 또는 `get_scene_info` 호출
**Then** 빈 배열 또는 null bounds 반환

```typescript
// list_entities on empty scene
executor.exec('list_entities', {})
// 출력: { success: true, data: [] }

// get_scene_info on empty scene
executor.exec('get_scene_info', {})
// 출력: { success: true, data: { name: 'empty', entity_count: 0, bounds: null } }
```

## Tasks / Subtasks

- [ ] **Task 1: WASM 조회 함수 추가** (AC: #1, #2, #4, #5)
  - [ ] 1.1: `list_entities() -> String` (JSON 배열)
  - [ ] 1.2: `get_entity(name: &str) -> Option<String>` (JSON 객체)
  - [ ] 1.3: `get_scene_info() -> String` (이름, 개수, bounds JSON)
  - [ ] 1.4: Geometry별 bounds 계산 구현
    - Line: min/max of all points
    - Circle: center ± radius
    - Rect: origin to origin + size
    - Arc: 각도 범위에 따른 극값 계산 (0°, 90°, 180°, 270° 포함 여부)
  - [ ] 1.5: 빈 씬 처리 (bounds = null)
  - [ ] 1.6: Rust 테스트 작성

- [ ] **Task 2: Schema 정의** (AC: #1, #2, #3, #4)
  - [ ] 2.1: schema.ts에 query 도메인 추가
  - [ ] 2.2: list_entities 스키마 정의
  - [ ] 2.3: get_entity 스키마 정의
  - [ ] 2.4: get_scene_info 스키마 정의

- [ ] **Task 3: Executor 구현** (AC: #1, #2, #3, #4)
  - [ ] 3.1: executor.ts에 조회 핸들러 추가
  - [ ] 3.2: 에러 처리 (존재하지 않는 엔티티)
  - [ ] 3.3: 결과 파싱 및 ToolResult 변환

- [ ] **Task 4: 테스트** (AC: #1~#5)
  - [ ] 4.1: executor.test.ts에 조회 테스트 추가
  - [ ] 4.2: 빈 씬 조회 테스트 (list_entities → [], get_scene_info → bounds: null)
  - [ ] 4.3: 존재하지 않는 엔티티 조회 테스트
  - [ ] 4.4: 각 Geometry 타입별 bounds 계산 테스트

## Dev Notes

### 왜 이 스토리가 필요한가?

AX 원칙: **LLM은 도구의 주체적 사용자**

현재 LLM은 씬 상태를 "기억"에 의존합니다:
- 세션이 끊기면 상태를 잃음
- 다른 LLM이 이어받으면 상태를 모름
- 복잡한 씬에서 실수 가능성 증가

조회 도구가 있으면:
- LLM이 언제든 씬 상태 확인 가능
- 확실한 정보 기반 판단
- 세션 간 연속성 확보 (MAMA와 결합 시)

### 구현 방향

기존 `export_json`은 전체 씬을 덤프합니다. 하지만:
- 대규모 씬에서는 비효율적
- 특정 엔티티만 필요할 때 과도한 데이터

새 조회 도구는:
- 목적별 최적화된 응답
- 필요한 정보만 반환

### WASM 인터페이스 예시

```rust
// cad-engine/src/scene.rs

impl Scene {
    /// 엔티티 목록 반환 (이름, 타입만)
    pub fn list_entities(&self) -> String {
        let list: Vec<EntitySummary> = self.entities.iter()
            .map(|e| EntitySummary {
                name: e.metadata.name.clone(),
                entity_type: e.entity_type.to_string(),
            })
            .collect();
        serde_json::to_string(&list).unwrap()
    }

    /// 특정 엔티티 상세 정보
    pub fn get_entity(&self, name: &str) -> Option<String> {
        self.entities.iter()
            .find(|e| e.metadata.name == name)
            .map(|e| serde_json::to_string(e).unwrap())
    }

    /// 씬 바운딩 박스
    pub fn get_bounds(&self) -> String {
        // 모든 엔티티의 바운딩 박스 합산
        let bounds = self.calculate_bounds();
        serde_json::to_string(&bounds).unwrap()
    }
}
```

### 스키마 예시

```typescript
// schema.ts 추가

export const DOMAINS = {
  primitives: [...],
  style: [...],
  export: [...],
  query: ['list_entities', 'get_entity', 'get_scene_info'],  // 새 도메인
};

export const CAD_TOOLS = {
  // ... 기존 도구들 ...

  list_entities: {
    name: 'list_entities',
    description: '씬의 모든 엔티티 목록을 조회합니다',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },

  get_entity: {
    name: 'get_entity',
    description: '특정 엔티티의 상세 정보를 조회합니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '조회할 엔티티 이름' }
      },
      required: ['name']
    }
  },

  get_scene_info: {
    name: 'get_scene_info',
    description: '씬의 메타 정보(이름, 엔티티 수, 바운딩 박스)를 조회합니다',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
};
```

## Dependencies

- Story 3.0 (Tool Use Foundation) - 완료됨
- Story 1.2 (Scene 클래스) - 완료됨

## References

- [AX Design Guide - LLM 주체성](docs/ax-design-guide.md)
- [Story 3.0 - Tool Use Foundation](docs/sprint-artifacts/3-0-tool-use-foundation.md)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Completion Notes List
- LLM 주체성 확보를 위한 핵심 스토리
- 3.0-b (Dynamic Tool Registry)의 전제조건
