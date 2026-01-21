# Story 11.1: MAMA Core 4 Tools MCP 통합

Status: Done

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
**Then** 임베딩 기반 시맨틱 검색 결과가 유사도 순으로 반환된다 (similarity 0.0~1.0)
**And** sqlite-vec 벡터 검색을 사용한다 (multilingual-e5-small, 384-dim)

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

- [x] Task 1: DB 스키마 및 초기화 구현 (AC: #8)
  - [x] 1.1 `apps/cad-mcp/src/mama/db.ts` 생성
  - [x] 1.2 decisions 테이블 생성 (id, topic, decision, reasoning, outcome, confidence, created_at, updated_at)
  - [x] 1.3 checkpoints 테이블 생성 (id, summary, next_steps, open_files, timestamp, status)
  - [x] 1.4 vss_memories 가상 테이블 생성 (sqlite-vec, float[384])
  - [x] 1.5 DB 디렉토리 자동 생성 (`~/.ai-native-cad/data/`)
  - [x] 1.6 마이그레이션 시스템 구현

- [x] Task 2: 임베딩 시스템 구현 (AC: #4)
  - [x] 2.1 `apps/cad-mcp/src/mama/embeddings.ts` 생성
  - [x] 2.2 @huggingface/transformers 통합 (multilingual-e5-small)
  - [x] 2.3 임베딩 캐시 구현 (LRU) - embeddings.ts에 통합
  - [x] 2.4 generateEmbedding(), generateEnhancedEmbedding() 함수
  - [x] 2.5 better-sqlite3 + sqlite-vec 어댑터 구현 - db.ts에 통합

- [x] Task 3: MAMA 모듈 클래스 구현 (AC: #1)
  - [x] 3.1 `apps/cad-mcp/src/mama/index.ts` 생성
  - [x] 3.2 MAMAModule 함수 기반 구현 (initMAMA, saveDecision, searchDecisions 등)
  - [x] 3.3 MCP 서버 시작 시 MAMAModule 초기화 연동
  - [x] 3.4 `apps/cad-mcp/src/mama/config.ts` 설정 로더 (모델명, 임베딩 차원)

- [x] Task 4: mama_save 도구 구현 (AC: #2, #3)
  - [x] 4.1 `apps/cad-mcp/src/mama/tools/handlers.ts`에 통합 구현
  - [x] 4.2 TypeScript 인터페이스로 정의 (Zod 대체)
  - [x] 4.3 Decision 저장 로직 구현 (type='decision') + 임베딩 생성
  - [x] 4.4 Checkpoint 저장 로직 구현 (type='checkpoint')
  - [x] 4.5 mcp-server.ts에 mama_save 핸들러 등록

- [x] Task 5: mama_search 도구 구현 (AC: #4, #5)
  - [x] 5.1 `apps/cad-mcp/src/mama/tools/handlers.ts`에 통합 구현
  - [x] 5.2 TypeScript 인터페이스로 정의 (Zod 대체)
  - [x] 5.3 시맨틱 검색 로직 구현 (query 있을 때 - sqlite-vec)
  - [x] 5.4 최근 항목 조회 로직 구현 (query 없을 때)
  - [x] 5.5 mcp-server.ts에 mama_search 핸들러 등록

- [x] Task 6: mama_update 도구 구현 (AC: #6)
  - [x] 6.1 `apps/cad-mcp/src/mama/tools/handlers.ts`에 통합 구현
  - [x] 6.2 TypeScript 인터페이스로 정의 (Zod 대체)
  - [x] 6.3 outcome 업데이트 로직 구현
  - [x] 6.4 mcp-server.ts에 mama_update 핸들러 등록

- [x] Task 7: mama_checkpoint 도구 구현 (AC: #7)
  - [x] 7.1 `apps/cad-mcp/src/mama/tools/handlers.ts`에 통합 구현
  - [x] 7.2 TypeScript 인터페이스로 정의 (Zod 대체)
  - [x] 7.3 최근 체크포인트 로드 로직 구현
  - [x] 7.4 mcp-server.ts에 mama_checkpoint 핸들러 등록

- [x] Task 8: 테스트 작성
  - [x] 8.1 DB 초기화 + 마이그레이션 테스트
  - [x] 8.2 임베딩 생성 테스트
  - [x] 8.3 mama_save 테스트 (Decision + 임베딩, Checkpoint)
  - [x] 8.4 mama_search 테스트 (시맨틱 검색, 최근 항목)
  - [x] 8.5 mama_update 테스트
  - [x] 8.6 mama_checkpoint 테스트

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

**의존성 (package.json 추가):**

```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "sqlite-vec": "^0.1.6",
    "@huggingface/transformers": "^3.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

**DB Schema (architecture.md 4.6.1):**

```sql
-- decisions: 설계 결정 저장
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  decision TEXT NOT NULL,
  reasoning TEXT,
  outcome TEXT,              -- 'SUCCESS', 'FAILED', 'PARTIAL', NULL(pending)
  outcome_reason TEXT,
  confidence REAL DEFAULT 0.5,
  user_involvement TEXT,     -- 'requested', 'approved', 'rejected'
  session_id TEXT,
  supersedes TEXT,
  superseded_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX idx_decisions_topic ON decisions(topic);
CREATE INDEX idx_decisions_outcome ON decisions(outcome);
CREATE INDEX idx_decisions_created ON decisions(created_at DESC);

-- checkpoints: 세션 체크포인트
CREATE TABLE checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  summary TEXT NOT NULL,
  open_files TEXT,           -- JSON array
  next_steps TEXT,
  status TEXT DEFAULT 'active'  -- 'active', 'archived'
);

-- vss_memories: 벡터 검색 (sqlite-vec)
-- 프로그래밍 방식으로 생성 (sqlite-vec 확장 로드 후)
CREATE VIRTUAL TABLE vss_memories USING vec0(
  embedding float[384]       -- multilingual-e5-small
);

-- schema_version: 마이그레이션 추적
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER DEFAULT (unixepoch()),
  description TEXT
);
```

**임베딩 설정 (config.json):**

```json
{
  "modelName": "Xenova/multilingual-e5-small",
  "embeddingDim": 384,
  "cacheDir": "~/.cache/huggingface/transformers"
}
```

### Project Structure Notes

**파일 구조:**
```
apps/cad-mcp/src/
├── mama/
│   ├── index.ts           # MAMAModule 싱글톤 클래스
│   ├── db.ts              # SQLite + sqlite-vec 초기화
│   ├── db-adapter.ts      # better-sqlite3 어댑터
│   ├── embeddings.ts      # HuggingFace 임베딩 생성
│   ├── embedding-cache.ts # 임베딩 LRU 캐시
│   ├── config.ts          # 설정 로더
│   ├── migrations/
│   │   └── 001-initial.sql
│   └── tools/
│       ├── save.ts        # mama_save 핸들러
│       ├── search.ts      # mama_search 핸들러
│       ├── update.ts      # mama_update 핸들러
│       └── checkpoint.ts  # mama_checkpoint 핸들러
├── schema.ts              # MCP 도구 스키마 (MAMA 도구 추가)
└── mcp-server.ts          # MCP 서버 (MAMA 핸들러 연결)

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
- [Source: docs/adr/0026-semantic-search-infra.md] - 시맨틱 검색 인프라 (신규)
- [Source: docs/epics.md#story-11.1.1] - Story 상세
- [Source: ~/MAMA/packages/claude-code-plugin/] - MAMA 원본 코드 참조

### Dependencies

- **선행 없음**: 첫 번째 스토리
- **후속 스토리**: 11.2 (Reasoning Graph)가 이 스토리의 DB 스키마에 `decision_edges` 테이블 추가

### Scope Clarification

**이 스토리에서 하는 것:**
- 4개 MCP 도구 구현 및 등록 (mama_save, mama_search, mama_update, mama_checkpoint)
- SQLite DB 초기화 및 테이블 (decisions, checkpoints, vss_memories)
- 임베딩 시스템 (@huggingface/transformers, multilingual-e5-small, 384-dim)
- sqlite-vec 기반 시맨틱 검색
- 임베딩 캐시 (LRU)

**이 스토리에서 하지 않는 것:**
- `decision_edges` 테이블 (Story 11.2 - Reasoning Graph)
- Reasoning 필드 파싱 (builds_on, debates, synthesizes) (Story 11.2)
- Hook 시스템 (Story 11.5-11.8)
- Topic Prefix 파싱/검증 (Story 11.3)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

- Story created: 2026-01-20
- Ultimate context engine analysis completed - comprehensive developer guide created
- Implementation completed: 2026-01-21
- Note: Zod schemas replaced with TypeScript interfaces in handlers.ts
- Note: Individual tool files (save.ts, search.ts, etc.) consolidated into handlers.ts

### File List (Actual Implementation)

- `apps/cad-mcp/src/mama/index.ts` - MAMA 모듈 진입점 (함수 기반 API)
- `apps/cad-mcp/src/mama/db.ts` - DB 초기화 + 마이그레이션 + sqlite-vec
- `apps/cad-mcp/src/mama/embeddings.ts` - HuggingFace 임베딩 + LRU 캐시
- `apps/cad-mcp/src/mama/config.ts` - 설정 로더
- `apps/cad-mcp/src/mama/migrations/001-initial.sql` - 초기 스키마
- `apps/cad-mcp/src/mama/tools/handlers.ts` - 4개 도구 핸들러 통합
- `apps/cad-mcp/src/mama/tools/schema.ts` - MAMA MCP 도구 스키마
- `apps/cad-mcp/src/mcp-server.ts` (수정) - MAMA 핸들러 연결
- `apps/cad-mcp/tests/mama.test.ts` - 테스트
