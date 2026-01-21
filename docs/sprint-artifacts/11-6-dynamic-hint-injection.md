# Story 11.6: Dynamic Hint Injection (preToolList)

Status: Done

## Story

As a **LLM 에이전트**,
I want **Tool Definition에 DB 힌트가 자동 주입되기를**,
So that **몰랐던 규칙도 자연스럽게 적용한다** (FR72).

## Acceptance Criteria

### AC1: tools/list 요청 시 힌트 주입
**Given** `tools/list` 요청이 들어올 때
**When** `preToolList` Hook이 실행되면
**Then** 각 도구별로 DB에서 힌트가 조회된다
**And** 기본 description + 동적 힌트가 조합되어 반환된다

### AC2: hints 테이블 기반 동적 힌트
**Given** `hints` 테이블에 `edit` 도구에 대한 힌트가 있을 때
**When** 도구 목록이 반환되면
**Then** edit 도구의 description에 "💡 rect의 x,y는 CENTER 좌표입니다" 포함

### AC3: 힌트 없는 도구
**Given** 힌트가 없는 도구일 때
**When** 도구 목록이 반환되면
**Then** 기본 description만 포함된다

### AC4: 힌트 우선순위
**Given** 같은 도구에 여러 힌트가 있을 때
**When** 도구 목록이 반환되면
**Then** priority가 높은 순서로 최대 3개까지 포함된다

### AC5: edit_hint 도구 제공
**Given** 힌트가 부적절할 때
**When** `edit_hint` 도구를 호출하면
**Then** 기존 힌트를 수정하거나 새 힌트를 추가할 수 있다

### AC6: 힌트 캐싱
**Given** 도구 목록이 자주 요청될 때
**When** 동일한 세션 내에서 요청되면
**Then** 캐시된 힌트가 사용되어 DB 조회가 최소화된다

## Tasks / Subtasks

- [x] Task 1: hints 테이블 구현 (AC: #2)
  - [x] 1.1 `apps/cad-mcp/src/mama/migrations/003-hints.sql` 생성
  - [x] 1.2 인덱스 추가 (tool_name, priority)
  - [x] 1.3 시드 데이터: 기본 CAD 힌트 삽입

- [x] Task 2: preToolList Hook 구현 (AC: #1, #3, #4)
  - [x] 2.1 `apps/cad-mcp/src/mama/hooks/pre-tool-list.ts` 생성
  - [x] 2.2 도구별 힌트 DB 조회 로직
  - [x] 2.3 description + 힌트 조합 로직
  - [x] 2.4 priority 순 정렬, 최대 3개 제한
  - [x] 2.5 HookRegistry에 preToolList 등록

- [x] Task 3: mama_edit_hint 도구 구현 (AC: #5)
  - [x] 3.1 `apps/cad-mcp/src/mama/hooks/pre-tool-list.ts`에 CRUD 함수
  - [x] 3.2 TypeScript 인터페이스로 정의
  - [x] 3.3 힌트 추가/수정/삭제 로직
  - [x] 3.4 tools/handlers.ts에 mama_edit_hint 핸들러 등록

- [x] Task 4: MCP 서버 통합 (AC: #1)
  - [x] 4.1 orchestrator를 통해 통합
  - [x] 4.2 tools/list 핸들러에서 preToolList Hook 호출
  - [x] 4.3 힌트가 주입된 도구 목록 반환

- [x] Task 5: 힌트 캐싱 (AC: #6)
  - [x] 5.1 세션 내 힌트 캐시 구현 (hintCache Map)
  - [x] 5.2 edit_hint 호출 시 캐시 무효화

- [x] Task 6: 테스트 작성
  - [x] 6.1 힌트 있는 도구 테스트
  - [x] 6.2 힌트 없는 도구 테스트
  - [x] 6.3 우선순위 정렬 테스트
  - [x] 6.4 edit_hint CRUD 테스트
  - [x] 6.5 캐싱 테스트

## Dev Notes

### Architecture Compliance

- **Dynamic Hint Injection**: Tool Definition에 DB 힌트 자동 주입 (ADR-0015)
- **핵심 통찰**: Claude가 "이 힌트가 필요해"라고 알면 이미 알고 있는 것
- **preToolList Hook**: tools/list 요청 시 자동 실행

### Technical Requirements

**hints 테이블 (architecture.md 4.6.1):**
```sql
CREATE TABLE hints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,       -- 'edit', 'write', 'lsp' 등
  hint_text TEXT NOT NULL,       -- "rect의 x,y는 CENTER 좌표입니다"
  priority INTEGER DEFAULT 5,    -- 1(낮음) ~ 10(높음)
  tags TEXT,                     -- JSON: ["rect", "coordinate", "center"]
  source TEXT DEFAULT 'system',  -- 'user', 'system', 'learned'
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_hints_tool ON hints(tool_name);
```

**preToolList Hook:**
```typescript
async function preToolList(tools: ToolDefinition[]): Promise<ToolDefinition[]> {
  return Promise.all(tools.map(async (tool) => {
    const hints = await db.query(
      `SELECT hint_text FROM hints
       WHERE tool_name = ?
       ORDER BY priority DESC LIMIT 3`,
      [tool.name]
    );

    if (hints.length === 0) return tool;

    const hintSection = hints.map(h => `💡 ${h.hint_text}`).join('\n');
    return {
      ...tool,
      description: `${tool.description}\n\n${hintSection}`
    };
  }));
}
```

**edit_hint 도구:**
```typescript
interface EditHintInput {
  action: 'add' | 'update' | 'delete';
  tool_name: string;
  hint_text?: string;         // add, update
  hint_id?: number;           // update, delete
  priority?: number;          // add, update
  tags?: string[];            // add, update
}
```

**기본 CAD 힌트 시드 데이터:**
```typescript
const DEFAULT_HINTS = [
  { tool_name: 'edit', hint_text: 'rect의 x,y는 CENTER 좌표입니다', priority: 8 },
  { tool_name: 'edit', hint_text: '회전 각도는 라디안 단위입니다', priority: 7 },
  { tool_name: 'write', hint_text: '새 파일 작성 전 glob으로 기존 파일 확인', priority: 6 },
  { tool_name: 'lsp', hint_text: 'domains → describe → schema 순서로 탐색', priority: 8 },
];
```

### Project Structure Notes

**파일 구조:**
```
apps/cad-mcp/src/mama/
├── db.ts                      # hints 테이블 (수정)
├── hooks/
│   ├── registry.ts            # preToolList 등록 (수정)
│   └── pre-tool-list.ts       # preToolList Hook (신규)
└── tools/
    └── edit-hint.ts           # edit_hint 도구 (신규)

apps/cad-mcp/src/
└── server.ts                  # tools/list 핸들러 (수정)
```

### References

- [Source: docs/architecture.md#4.4.2] - preToolList Hook
- [Source: docs/adr/0015-dynamic-hint-injection.md] - Dynamic Hint 결정
- [Source: docs/epics.md#story-11.2.2] - Story 상세

### Dependencies

- **선행**: Story 11.5 (SessionStart Hook) - HookRegistry
- **후속**: Story 11.7 (ActionHints) - postExecute Hook

### Completion Notes List

- Implementation completed: 2026-01-21

### File List (Actual Implementation)

- `apps/cad-mcp/src/mama/migrations/003-hints.sql` - hints 테이블 + 시드 데이터
- `apps/cad-mcp/src/mama/hooks/pre-tool-list.ts` - preToolList Hook + CRUD
- `apps/cad-mcp/src/mama/hooks/registry.ts` (수정)
- `apps/cad-mcp/src/mama/tools/handlers.ts` (수정 - mama_edit_hint)
- `apps/cad-mcp/src/mama/tools/schema.ts` (수정 - mama_edit_hint 스키마)
- `apps/cad-mcp/tests/mama.test.ts` - hint 테스트
