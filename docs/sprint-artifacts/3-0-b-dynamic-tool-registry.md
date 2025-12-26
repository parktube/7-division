# Story 3.0-b: Dynamic Tool Registry (도구 동적 등록)

Status: ready-for-dev

## Story

As an **LLM (CAD 도구 사용자)**,
I want **필요한 도구가 없을 때 요청하거나 등록할 수 있도록**,
So that **고정된 도구셋에 제한되지 않고 작업에 맞는 도구를 확보할 수 있다**.

## Background

### 현재 문제

```
LLM이 복잡한 가구를 그리려 할 때:
─────────────────────────────────────────────────────────────
LLM: "둥근 소파를 그려야 하는데... arc + line 조합으로 해볼까"
     (복잡한 좌표 계산 필요)
     (10줄짜리 코드 작성)
     (오류 발생, 디버깅 필요)

유저: "왜 이렇게 오래 걸려?"

LLM: "도구가 없어서 직접 계산하고 있어요..."
─────────────────────────────────────────────────────────────
```

### 목표 상태

```
LLM이 복잡한 가구를 그리려 할 때:
─────────────────────────────────────────────────────────────
LLM: list_tools({ domain: 'furniture' })
     → ['draw_chair', 'draw_table', 'draw_sofa']

LLM: "draw_sofa가 있네? 근데 curved 옵션이 없네..."

LLM: request_tool({
       name: 'draw_curved_sofa',
       description: '호 형태의 곡선 소파',
       needed_params: ['cx', 'cy', 'radius', 'angle_span', 'depth']
     })
     → { queued: true, message: '인간 개발자 검토 대기 중' }

LLM: "요청 완료! 지금은 arc+line으로 대체할게요"
     → 투명성 + 개선 요청 경로 확보
─────────────────────────────────────────────────────────────
```

## Acceptance Criteria

### AC1: 도메인별 도구 목록 조회
**Given** 등록된 도구들이 도메인별로 분류되어 있을 때
**When** `list_tools({ domain })` 호출
**Then** 해당 도메인의 도구 목록과 description 반환

```typescript
// 특정 도메인 조회
executor.exec('list_tools', { domain: 'primitives' })

// 출력
{
  success: true,
  data: {
    domain: 'primitives',
    tools: [
      { name: 'draw_rect', description: '직사각형을 그립니다' },
      { name: 'draw_circle', description: '원을 그립니다' },
      { name: 'draw_line', description: '선분/폴리라인을 그립니다' },
      { name: 'draw_arc', description: '호를 그립니다' }
    ]
  }
}

// 도메인 생략 시 전체 도구 목록 반환
executor.exec('list_tools', {})
// 출력: { success: true, data: { domain: null, tools: [...모든 도구...] } }
```

### AC2: 전체 도메인 목록 조회
**Given** 도메인들이 정의되어 있을 때
**When** `list_domains` 호출
**Then** 모든 도메인과 각 도메인의 도구 개수 반환

```typescript
// 입력
executor.exec('list_domains', {})

// 출력
{
  success: true,
  data: [
    { domain: 'primitives', count: 4, description: '기본 도형 그리기' },
    { domain: 'style', count: 4, description: '스타일 설정' },
    { domain: 'export', count: 1, description: '씬 내보내기' },
    { domain: 'query', count: 3, description: '씬 상태 조회' }
  ]
}
```

### AC3: 도구 상세 스키마 조회
**Given** 특정 도구가 존재할 때
**When** `get_tool_schema({ name })` 호출
**Then** 해당 도구의 전체 JSON Schema 반환

```typescript
// 입력
executor.exec('get_tool_schema', { name: 'draw_rect' })

// 출력
{
  success: true,
  data: {
    name: 'draw_rect',
    description: '직사각형을 그립니다',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '엔티티 이름' },
        x: { type: 'number', description: 'X 좌표' },
        // ... 전체 스키마
      },
      required: ['name', 'x', 'y', 'width', 'height']
    }
  }
}
```

### AC4: 도구 요청 (Request Queue)
**Given** 필요한 도구가 없을 때
**When** `request_tool` 호출
**Then** 요청이 큐에 저장되고 확인 메시지 반환

```typescript
// 입력
executor.exec('request_tool', {
  name: 'draw_rounded_rect',
  description: '모서리가 둥근 직사각형',
  rationale: '가구 모서리 표현에 필요',
  suggested_params: ['x', 'y', 'width', 'height', 'corner_radius']
})

// 출력
{
  success: true,
  data: {
    request_id: 'req_001',
    status: 'queued',
    message: '도구 요청이 등록되었습니다. 개발자 검토 후 추가됩니다.'
  }
}
```

### AC5: 존재하지 않는 도구 조회
**Given** 존재하지 않는 도구 이름
**When** `get_tool_schema({ name })` 호출
**Then** `success: false`와 유사 도구 제안 반환

```typescript
// 입력
executor.exec('get_tool_schema', { name: 'draw_rectangle' })

// 출력
{
  success: false,
  error: "Tool 'draw_rectangle' not found",
  suggestions: ['draw_rect']  // 유사 이름 제안
}
```

## Tasks / Subtasks

- [ ] **Task 1: Schema Registry 구현** (AC: #1, #2, #3, #5)
  - [ ] 1.1: ToolRegistry 싱글톤 클래스 생성 (tool-registry.ts)
  - [ ] 1.2: 도메인 메타데이터 추가 (description 포함)
  - [ ] 1.3: 도구 검색/필터링 메서드 구현
  - [ ] 1.4: 유사 이름 검색 (prefix/contains 단순 매칭)

- [ ] **Task 2: Registry Query 도구 구현** (AC: #1, #2, #3)
  - [ ] 2.1: list_domains 도구 추가
  - [ ] 2.2: list_tools 도구 추가 (domain 필터)
  - [ ] 2.3: get_tool_schema 도구 추가
  - [ ] 2.4: Executor에 핸들러 연결

- [ ] **Task 3: Tool Request Queue** (AC: #4)
  - [ ] 3.1: ToolRequest 인터페이스 정의
  - [ ] 3.2: request_tool 도구 구현
  - [ ] 3.3: 요청을 파일로 영속화 (`tool-requests.json`)
  - [ ] 3.4: 요청 목록 조회 도구 (list_tool_requests)
  - [ ] 3.5: 기존 요청 파일 로드 (프로세스 재시작 시)

- [ ] **Task 4: 테스트** (AC: #1~#5)
  - [ ] 4.1: Registry 단위 테스트
  - [ ] 4.2: Query 도구 통합 테스트
  - [ ] 4.3: Request Queue 테스트
  - [ ] 4.4: 유사 이름 제안 테스트

## Dev Notes

### 왜 이 스토리가 필요한가?

AX 원칙: **LLM은 도구의 주체적 사용자**

현재 LLM은 고정된 도구셋만 사용 가능:
- 새 도구가 필요하면 → 무력
- 도구 존재 여부 확인 불가
- 개선 요청 경로 없음

Dynamic Registry가 있으면:
- 도메인별 도구 탐색 가능
- 필요한 도구 요청 가능
- 도구 부재 시 대안 탐색 가능
- 시스템 진화에 LLM 기여 가능

### 아키텍처 결정

**1. 왜 WASM 레벨이 아닌 TypeScript 레벨?**

```
[LLM] → [Executor/Registry (TS)] → [WASM]
              ↓
         도구 메타데이터
         (스키마, 도메인, 설명)
```

- 도구 메타데이터는 LLM 인터페이스 관심사
- WASM은 실행 엔진만 담당
- TypeScript에서 메타데이터 관리가 자연스러움

**2. Registry 위치: 전역 싱글톤**

```typescript
// 모든 Executor가 동일한 Registry 공유
const registry = ToolRegistry.getInstance();

// Executor 내부에서 registry 참조
class CADExecutor {
  private registry = ToolRegistry.getInstance();
}
```

- 도구 스키마는 씬과 무관한 전역 정보
- Tool Request도 전역으로 관리 (프로젝트 단위)

**3. 유사 이름 검색: 단순 매칭**

```typescript
// MVP: prefix/contains 매칭 (Levenshtein 불필요)
findSimilar(name: string): string[] {
  return this.toolNames.filter(t =>
    t.startsWith(name.slice(0, 4)) ||  // prefix
    t.includes(name.slice(0, -1))      // contains (오타 1자 허용)
  );
}
```

### Registry 구조 예시

```typescript
// tool-registry.ts

interface ToolDomain {
  name: string;
  description: string;
  tools: string[];
}

interface ToolRequest {
  id: string;
  name: string;
  description: string;
  rationale: string;
  suggested_params?: string[];
  status: 'queued' | 'approved' | 'rejected';
  created_at: Date;
}

class ToolRegistry {
  private domains: Map<string, ToolDomain>;
  private tools: Map<string, ToolSchema>;
  private requests: ToolRequest[];

  listDomains(): ToolDomain[] { ... }
  listTools(domain?: string): ToolSchema[] { ... }
  getToolSchema(name: string): ToolSchema | null { ... }
  findSimilar(name: string): string[] { ... }
  requestTool(request: Omit<ToolRequest, 'id' | 'status' | 'created_at'>): ToolRequest { ... }
}
```

### 도메인 분류 (현재)

```typescript
const DOMAINS = {
  primitives: {
    description: '기본 도형 그리기',
    tools: ['draw_rect', 'draw_circle', 'draw_line', 'draw_arc']
  },
  style: {
    description: '스타일 설정',
    tools: ['set_stroke', 'set_fill', 'remove_stroke', 'remove_fill']
  },
  export: {
    description: '씬 내보내기',
    tools: ['export_json']
  },
  query: {
    description: '씬 상태 조회',
    tools: ['list_entities', 'get_entity', 'get_scene_info']
  },
  registry: {
    description: '도구 탐색 및 요청',
    tools: ['list_domains', 'list_tools', 'get_tool_schema', 'request_tool']
  }
};
```

### 확장 가능성

**Phase 2: 커스텀 도구 등록**

```typescript
// 미래 기능 (이 스토리 범위 아님)
executor.exec('register_tool', {
  name: 'draw_my_chair',
  description: '내 스타일 의자',
  implementation: 'macro',  // 매크로 = 기존 도구 조합
  steps: [
    { tool: 'draw_rect', params: { ... } },
    { tool: 'draw_circle', params: { ... } }
  ]
})
```

이 스토리는 **읽기** 기능에 집중합니다. 도구 등록은 별도 스토리로.

## Dependencies

- Story 3.0 (Tool Use Foundation) - 완료됨
- Story 3.0-a (Scene Query Tools) - 동시 진행 가능

## References

- [AX Design Guide - 도구 탐색](docs/ax-design-guide.md)
- [Story 3.0 - Tool Use Foundation](docs/sprint-artifacts/3-0-tool-use-foundation.md)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Completion Notes List
- Schema Registry 패턴으로 도구 메타데이터 관리
- LLM이 시스템 진화에 기여할 수 있는 경로 제공
- 3.0-c (Angle Unit Support)와 독립적으로 구현 가능
