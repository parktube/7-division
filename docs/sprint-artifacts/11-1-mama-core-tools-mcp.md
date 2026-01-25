# Story 11.1: MAMA Core 4 Tools MCP 통합

Status: ready-for-dev

## Story

As a **LLM 에이전트**,
I want **MAMA Core 4 Tools가 MCP로 통합되기를**,
So that **설계 결정을 저장하고 검색할 수 있다** (FR67).

## Acceptance Criteria

### AC1: MCP 서버 시작 시 MAMA 모듈 초기화
**Given** MCP 서버가 시작될 때
**When** MAMA 모듈이 초기화되면
**Then** 4개 도구 (`mama_save`, `mama_search`, `mama_update`, `mama_checkpoint`)가 MCP에 등록된다

### AC2: mama_save 도구 - Decision 저장
**Given** `mama_save` 도구를 호출할 때
**When** `type='decision'`, `topic`, `decision`, `reasoning`을 전달하면
**Then** 결정이 DB에 저장되고 ID가 반환된다 (예: `decision_abc123`)

### AC3: mama_save 도구 - Checkpoint 저장
**Given** `mama_save` 도구를 호출할 때
**When** `type='checkpoint'`, `summary`, `next_steps`, `open_files`를 전달하면
**Then** 체크포인트가 DB에 저장되고 ID가 반환된다

### AC4: mama_search 도구 - 시맨틱 검색
**Given** `mama_search` 도구를 호출할 때
**When** `query`를 전달하면
**Then** 시맨틱 검색 결과가 유사도 순으로 반환된다 (similarity 0.0~1.0)

### AC5: mama_search 도구 - 최근 항목 조회
**Given** `mama_search` 도구를 호출할 때
**When** `query`가 없으면
**Then** 최근 항목이 시간순(created_at DESC)으로 반환된다

### AC6: mama_update 도구
**Given** `mama_update` 도구를 호출할 때
**When** `id`와 `outcome` (success/failed/partial)을 전달하면
**Then** 해당 결정의 `outcome` 필드가 업데이트된다

### AC7: mama_checkpoint 도구
**Given** `mama_checkpoint` 도구를 호출할 때
**When** 이전 체크포인트가 존재하면
**Then** `summary`, `next_steps`, `open_files`, `created_at`이 반환된다

### AC8: DB 자동 생성
**Given** `~/.ai-native-cad/data/mama.db`가 없을 때
**When** MCP 서버가 시작되면
**Then** SQLite DB가 자동 생성되고 필요한 테이블이 생성된다

## Tasks / Subtasks

- [ ] Task 1: DB 스키마 및 초기화 구현 (AC: #8)
  - [ ] 1.1 `apps/cad-mcp/src/mama/db.ts` 생성
  - [ ] 1.2 decisions 테이블 생성 (id, topic, decision, reasoning, outcome, confidence, embedding, created_at, updated_at)
  - [ ] 1.3 sessions 테이블 생성 (id, summary, next_steps, open_files, created_at)
  - [ ] 1.4 DB 디렉토리 자동 생성 (`~/.ai-native-cad/data/`)

- [ ] Task 2: MAMA 모듈 클래스 구현 (AC: #1)
  - [ ] 2.1 `apps/cad-mcp/src/mama/index.ts` 생성
  - [ ] 2.2 MAMAModule 클래스 구현 (DB 초기화, 4개 메서드)
  - [ ] 2.3 MCP 서버 시작 시 MAMAModule 초기화 연동

- [ ] Task 3: mama_save 도구 구현 (AC: #2, #3)
  - [ ] 3.1 `apps/cad-mcp/src/mama/tools/save.ts` 생성
  - [ ] 3.2 MamaSaveInput Zod 스키마 정의 (packages/shared)
  - [ ] 3.3 Decision 저장 로직 구현 (type='decision')
  - [ ] 3.4 Checkpoint 저장 로직 구현 (type='checkpoint')
  - [ ] 3.5 tool-registry.ts에 mama_save 등록

- [ ] Task 4: mama_search 도구 구현 (AC: #4, #5)
  - [ ] 4.1 `apps/cad-mcp/src/mama/tools/search.ts` 생성
  - [ ] 4.2 MamaSearchInput Zod 스키마 정의
  - [ ] 4.3 시맨틱 검색 로직 구현 (query 있을 때)
  - [ ] 4.4 최근 항목 조회 로직 구현 (query 없을 때)
  - [ ] 4.5 tool-registry.ts에 mama_search 등록

- [ ] Task 5: mama_update 도구 구현 (AC: #6)
  - [ ] 5.1 `apps/cad-mcp/src/mama/tools/update.ts` 생성
  - [ ] 5.2 MamaUpdateInput Zod 스키마 정의
  - [ ] 5.3 outcome 업데이트 로직 구현
  - [ ] 5.4 tool-registry.ts에 mama_update 등록

- [ ] Task 6: mama_checkpoint 도구 구현 (AC: #7)
  - [ ] 6.1 `apps/cad-mcp/src/mama/tools/checkpoint.ts` 생성
  - [ ] 6.2 MamaCheckpointOutput Zod 스키마 정의
  - [ ] 6.3 최근 체크포인트 로드 로직 구현
  - [ ] 6.4 tool-registry.ts에 mama_checkpoint 등록

- [ ] Task 7: 테스트 작성
  - [ ] 7.1 DB 초기화 테스트
  - [ ] 7.2 mama_save 테스트 (Decision, Checkpoint)
  - [ ] 7.3 mama_search 테스트 (시맨틱, 최근)
  - [ ] 7.4 mama_update 테스트
  - [ ] 7.5 mama_checkpoint 테스트

## Dev Notes

### Architecture Compliance

- **MCP 서버 내부 통합**: 별도 플러그인 없이 `@ai-native-cad/mcp`에 포함
- **DB 위치**: `~/.ai-native-cad/data/mama.db` (ADR-0016)
- **MCP Tool Names**: `mcp__ai-native-cad__mama_save`, `mcp__ai-native-cad__mama_search`, `mcp__ai-native-cad__mama_update`, `mcp__ai-native-cad__mama_checkpoint`
- **기존 MAMA v1.5.0 패턴 재사용** (ADR-0011)

### Technical Requirements

**MCP Tool Interface (architecture.md 4.3):**

```typescript
// MCP Tool: mcp__ai-native-cad__mama_save (Discriminated Union)
type MamaSaveInput =
  | {
      type: 'decision';
      topic: string;           // 필수, 예: 'voxel:chicken_design'
      decision: string;        // 필수
      reasoning?: string;
      confidence?: number;     // 0.0~1.0
    }
  | {
      type: 'checkpoint';
      summary: string;         // 필수
      next_steps?: string[];
      open_files?: string[];
    };

// MCP Tool: mcp__ai-native-cad__mama_search
interface MamaSearchInput {
  query?: string;           // 검색어 (없으면 최근 항목)
  type?: 'decision' | 'checkpoint' | 'all';
  limit?: number;           // 기본 10
}

// MCP Tool: mcp__ai-native-cad__mama_update
interface MamaUpdateInput {
  id: string;               // decision ID
  outcome: 'success' | 'failed' | 'partial';
  reason?: string;
}

// MCP Tool: mcp__ai-native-cad__mama_checkpoint
interface MamaCheckpointInput {}  // 파라미터 없음
```

**DB Schema (architecture.md 4.6.1):**

```sql
-- decisions: 설계 결정 저장
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  decision TEXT NOT NULL,
  reasoning TEXT,
  outcome TEXT,              -- 'success', 'failed', 'partial', NULL(pending)
  confidence REAL DEFAULT 0.5,
  embedding BLOB,            -- Float32Array (시맨틱 검색용, Story 11.2 이후 구현)
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX idx_decisions_topic ON decisions(topic);
CREATE INDEX idx_decisions_created ON decisions(created_at DESC);

-- sessions: 세션/체크포인트
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  next_steps TEXT,           -- JSON array
  open_files TEXT,           -- JSON array
  created_at INTEGER NOT NULL
);
```

### Project Structure Notes

**파일 구조:**
```
apps/cad-mcp/src/
├── mama/
│   ├── index.ts           # MAMAModule 클래스
│   ├── db.ts              # SQLite 연결
│   └── tools/
│       ├── save.ts        # mama_save 도구
│       ├── search.ts      # mama_search 도구
│       ├── update.ts      # mama_update 도구
│       └── checkpoint.ts  # mama_checkpoint 도구
├── tools/
│   └── tool-registry.ts   # 도구 등록 (수정)
└── server.ts              # MCP 서버 (MAMAModule 초기화)

packages/shared/src/
└── schemas/
    └── mama.ts            # MAMA Zod 스키마
```

**기존 패턴 참조:**
- `apps/cad-mcp/src/tools/` - 기존 도구 구현 패턴 (glob, read, edit, write, lsp, bash)
- `apps/cad-mcp/src/tools/tool-registry.ts` - 도구 등록 패턴

### Testing Standards

- 테스트 위치: `apps/cad-mcp/src/mama/__tests__/`
- Vitest 사용 (기존 패턴)
- 모킹: SQLite in-memory DB 사용 (`:memory:`)

### References

- [Source: docs/architecture.md#4.3-mcp-tool-interface] - MCP Tool Interface 정의
- [Source: docs/architecture.md#4.6-data-architecture] - DB 스키마
- [Source: docs/adr/0011-mama-core-reuse.md] - 4 Core Tools 결정
- [Source: docs/adr/0016-project-specific-db.md] - 단일 DB + Topic Prefix
- [Source: docs/epics.md#story-11.1.1] - Story 상세

### Dependencies

- **선행 없음**: 첫 번째 스토리
- **후속 스토리**: 11.2 (Reasoning Graph)가 이 스토리의 DB 스키마에 `decision_edges` 테이블 추가

### Scope Clarification

**이 스토리에서 하는 것:**
- 4개 MCP 도구 구현 및 등록
- SQLite DB 초기화 및 기본 테이블
- 기본 검색 (시맨틱 검색은 query matching으로 단순 구현, 임베딩은 Phase 2)

**이 스토리에서 하지 않는 것:**
- `decision_edges` 테이블 (Story 11.2 - Reasoning Graph)
- 임베딩 생성 (Phase 2 - Intelligence)
- Hook 시스템 (Story 11.5-11.8)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

- Story created: 2026-01-20
- Ultimate context engine analysis completed - comprehensive developer guide created

### File List

- `apps/cad-mcp/src/mama/index.ts` (신규)
- `apps/cad-mcp/src/mama/db.ts` (신규)
- `apps/cad-mcp/src/mama/tools/save.ts` (신규)
- `apps/cad-mcp/src/mama/tools/search.ts` (신규)
- `apps/cad-mcp/src/mama/tools/update.ts` (신규)
- `apps/cad-mcp/src/mama/tools/checkpoint.ts` (신규)
- `apps/cad-mcp/src/tools/tool-registry.ts` (수정)
- `packages/shared/src/schemas/mama.ts` (신규)
- `apps/cad-mcp/src/mama/__tests__/` (신규)
