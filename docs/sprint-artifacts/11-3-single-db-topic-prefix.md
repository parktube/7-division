# Story 11.3: 단일 DB + Topic Prefix 구조

Status: ready-for-dev

## Story

As a **개발자**,
I want **단일 DB에 topic prefix로 도메인을 구분하기를**,
So that **크로스 도메인 검색이 용이하다** (FR69).

## Acceptance Criteria

### AC1: DB 자동 생성
**Given** `~/.ai-native-cad/data/mama.db`가 없을 때
**When** MCP 서버가 시작되면
**Then** SQLite DB가 자동 생성된다
**And** 디렉토리 구조 `~/.ai-native-cad/data/`가 자동 생성된다

### AC2: Topic Prefix 형식 검증
**Given** 결정을 저장할 때
**When** topic이 `voxel:chicken:color`이면
**Then** 정상적으로 저장된다 (형식: `{domain}:{entity}:{aspect}`)

### AC3: Topic Prefix로 도메인 필터링
**Given** `mama_search` 도구를 호출할 때
**When** `domain` 파라미터로 `voxel`을 전달하면
**Then** `voxel:*` 패턴의 topic만 검색 결과에 포함된다

### AC4: 크로스 도메인 검색
**Given** 다른 도메인의 결정을 검색할 때
**When** 가구 설계 시 인테리어 결정을 참조하면
**Then** `domain` 파라미터 없이 전체 도메인에서 검색 가능하다

### AC5: Topic 기반 최근 결정 그룹화
**Given** `mama_search` 도구를 호출할 때
**When** `group_by_topic=true`로 전달하면
**Then** 같은 topic의 최신 결정만 반환된다 (supersedes 체인 중 최신)

### AC6: 도메인 목록 조회
**Given** `mama_search` 도구를 호출할 때
**When** `list_domains=true`로 전달하면
**Then** DB에 존재하는 고유 도메인 목록이 반환된다 (voxel, furniture, interior 등)

## Tasks / Subtasks

- [ ] Task 1: 설정 및 경로 관리 (AC: #1)
  - [ ] 1.1 `apps/cad-mcp/src/mama/config.ts` 생성
  - [ ] 1.2 DB 경로 상수 정의 (`~/.ai-native-cad/data/mama.db`)
  - [ ] 1.3 디렉토리 자동 생성 로직

- [ ] Task 2: Topic Prefix 유틸리티 (AC: #2)
  - [ ] 2.1 `apps/cad-mcp/src/mama/topic-utils.ts` 생성
  - [ ] 2.2 Topic 파싱 함수 (`parseTopic` → domain, entity, aspect)
  - [ ] 2.3 Topic 검증 함수 (`validateTopic`)
  - [ ] 2.4 도메인 추출 함수 (`extractDomain`)

- [ ] Task 3: mama_search 도메인 필터 확장 (AC: #3, #4)
  - [ ] 3.1 MamaSearchInput에 `domain?: string` 파라미터 추가
  - [ ] 3.2 SQL WHERE 절에 `topic LIKE '{domain}:%'` 조건 추가
  - [ ] 3.3 domain 없으면 전체 검색 (크로스 도메인)

- [ ] Task 4: Topic 그룹화 기능 (AC: #5)
  - [ ] 4.1 MamaSearchInput에 `group_by_topic?: boolean` 추가
  - [ ] 4.2 같은 topic 중 최신 결정만 필터링 로직
  - [ ] 4.3 supersedes 체인 고려한 최신 결정 조회

- [ ] Task 5: 도메인 목록 조회 (AC: #6)
  - [ ] 5.1 MamaSearchInput에 `list_domains?: boolean` 추가
  - [ ] 5.2 `SELECT DISTINCT` 쿼리로 도메인 추출
  - [ ] 5.3 MamaSearchOutput에 `domains?: string[]` 추가

- [ ] Task 6: 테스트 작성
  - [ ] 6.1 DB 자동 생성 테스트
  - [ ] 6.2 Topic 파싱/검증 테스트
  - [ ] 6.3 도메인 필터 검색 테스트
  - [ ] 6.4 크로스 도메인 검색 테스트
  - [ ] 6.5 Topic 그룹화 테스트
  - [ ] 6.6 도메인 목록 조회 테스트

## Dev Notes

### Architecture Compliance

- **단일 DB**: `~/.ai-native-cad/data/mama.db` (ADR-0016)
- **Topic Prefix**: `{domain}:{entity}:{aspect}` 형식
- **크로스 도메인**: 단일 DB로 도메인 간 검색 용이

### Technical Requirements

**DB 경로 (ADR-0016):**
```
~/.ai-native-cad/
├── data/
│   └── mama.db          # 단일 DB
└── domains/             # 도메인 지식 (읽기 전용, Phase 4)
    ├── voxel/
    ├── furniture/
    └── interior/
```

**Topic Prefix 규칙:**
```
{domain}:{entity}:{aspect}

예시:
- voxel:chicken:color_palette    (복셀 닭의 색상 팔레트)
- voxel:isometric:z_order        (이소메트릭 z-order 규칙)
- furniture:chair:dimensions     (의자 치수)
- interior:wall:thickness        (벽 두께 표준)
```

**확장된 Search Input:**
```typescript
interface MamaSearchInput {
  query?: string;
  type?: 'decision' | 'checkpoint' | 'all';
  limit?: number;
  // 추가
  domain?: string;           // 'voxel', 'furniture' 등
  group_by_topic?: boolean;  // true면 topic별 최신만
  list_domains?: boolean;    // true면 도메인 목록 반환
}
```

**확장된 Search Output:**
```typescript
interface MamaSearchOutput {
  results: Array<{...}>;
  // 추가
  domains?: string[];        // list_domains=true일 때
}
```

**Topic 파싱 유틸:**
```typescript
interface ParsedTopic {
  domain: string;    // 'voxel'
  entity: string;    // 'chicken'
  aspect: string;    // 'color_palette'
  raw: string;       // 'voxel:chicken:color_palette'
}

function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split(':');
  if (parts.length < 2) return null;
  return {
    domain: parts[0],
    entity: parts[1],
    aspect: parts.slice(2).join(':') || '',
    raw: topic,
  };
}

function extractDomain(topic: string): string {
  return topic.split(':')[0];
}
```

### Project Structure Notes

**파일 구조:**
```
apps/cad-mcp/src/mama/
├── config.ts              # DB 경로, 설정 (신규)
├── topic-utils.ts         # Topic 파싱/검증 (신규)
├── db.ts                  # DB 초기화 (수정 - 경로 사용)
└── tools/
    └── search.ts          # domain 필터, group_by_topic 등 (수정)

packages/shared/src/schemas/
└── mama.ts                # MamaSearchInput/Output 확장 (수정)
```

### Testing Standards

- topic-utils 단위 테스트 필수
- 다양한 topic 형식 테스트 (1단계, 2단계, 3단계+)
- 도메인 필터 + 크로스 도메인 통합 테스트

### References

- [Source: docs/architecture.md#4.3.4-single-db-topic-prefix] - Topic Prefix 아키텍처
- [Source: docs/adr/0016-project-specific-db.md] - 단일 DB 결정
- [Source: docs/epics.md#story-11.1.3] - Story 상세

### Dependencies

- **선행**: Story 11.1 (MAMA Core 4 Tools) - DB 기본 구조
- **선행**: Story 11.2 (Reasoning Graph) - supersedes 관계 (group_by_topic에 필요)

### Scope Clarification

**이 스토리에서 하는 것:**
- DB 경로 설정 및 자동 생성
- Topic prefix 파싱/검증 유틸리티
- 도메인 필터링 검색
- Topic 그룹화 (최신 결정만)
- 도메인 목록 조회

**이 스토리에서 하지 않는 것:**
- domains/ 폴더 구조 (Phase 4 - Platform)
- 도메인별 기본 힌트 로드
- Topic 자동 제안

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

- Story created: 2026-01-20
- Dependencies: Story 11.1, 11.2

### File List

- `apps/cad-mcp/src/mama/config.ts` (신규)
- `apps/cad-mcp/src/mama/topic-utils.ts` (신규)
- `apps/cad-mcp/src/mama/db.ts` (수정)
- `apps/cad-mcp/src/mama/tools/search.ts` (수정)
- `packages/shared/src/schemas/mama.ts` (수정)
- `apps/cad-mcp/src/mama/__tests__/topic-utils.test.ts` (신규)
