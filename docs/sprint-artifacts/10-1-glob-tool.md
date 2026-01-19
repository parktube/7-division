# Story 10.1: glob 도구 구현

Status: done

## Story

As a **LLM 에이전트**,
I want **glob 도구로 파일 목록을 조회할 수 있기를**,
so that **작업 전 기존 파일(모듈)을 확인할 수 있다** (FR59).

## Acceptance Criteria

1. **AC1: 전체 파일 목록 조회**
   - Given: CAD 프로젝트에 main과 모듈들이 있을 때
   - When: `glob({})` 호출하면
   - Then: `['main', 'iso_lib', 'city_lib']` 형태로 파일 목록 반환

2. **AC2: 패턴 매칭 지원**
   - Given: 패턴을 지정했을 때
   - When: `glob({ pattern: '*_lib' })` 호출하면
   - Then: `['iso_lib', 'city_lib']` 처럼 패턴 매칭된 목록 반환

3. **AC3: main 파일 특수 처리**
   - Given: 패턴이 main을 매칭하지 않더라도
   - When: 패턴 없이 호출하면
   - Then: main은 항상 목록에 포함됨

4. **AC4: 빈 결과 처리**
   - Given: 매칭되는 파일이 없을 때
   - When: `glob({ pattern: 'nonexistent*' })` 호출하면
   - Then: 빈 배열 `[]` 반환 (에러 아님)

5. **AC5: MCP 도구 등록**
   - Given: MCP 서버가 시작될 때
   - When: 도구 목록을 조회하면
   - Then: `glob` 도구가 등록되어 있음

## Tasks / Subtasks

- [x] **Task 1: glob 도구 스키마 정의** (AC: #5)
  - [x] 1.1 `apps/cad-mcp/src/schema.ts`에 GLOB_TOOL 스키마 추가
  - [x] 1.2 inputSchema 정의 (pattern: optional string)
  - [x] 1.3 description 작성: "CAD 파일 목록 조회. main과 모듈 파일들."

- [x] **Task 2: glob 핸들러 구현** (AC: #1, #2, #3, #4)
  - [x] 2.1 `apps/cad-mcp/src/tools/glob.ts` 파일 생성
  - [x] 2.2 모듈 디렉토리 스캔 로직 구현 (`~/.ai-native-cad/modules/`)
  - [x] 2.3 main 파일 포함 로직 구현 (항상 첫 번째)
  - [x] 2.4 glob 패턴 매칭 구현 (minimatch 또는 유사 라이브러리)
  - [x] 2.5 빈 결과 처리 (빈 배열 반환)

- [x] **Task 3: MCP 서버 통합** (AC: #5)
  - [x] 3.1 `apps/cad-mcp/src/mcp-server.ts`에 glob 핸들러 등록
  - [x] 3.2 CAD_TOOLS에 glob 추가

- [x] **Task 4: 테스트 작성** (AC: #1, #2, #3, #4)
  - [x] 4.1 `apps/cad-mcp/tests/glob.test.ts` 생성
  - [x] 4.2 전체 목록 조회 테스트
  - [x] 4.3 패턴 매칭 테스트
  - [x] 4.4 빈 결과 테스트
  - [x] 4.5 main 포함 테스트

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] 테스트 품질 개선: 조건부 assertion을 deterministic assertion으로 변경 [glob.test.ts:35-40, 70-73]
- [x] [AI-Review][MEDIUM] 테스트 Dead Code 제거: 미사용 변수 TEST_DIR, MODULES_DIR, SCENE_CODE_FILE 삭제 [glob.test.ts:17-20]
- [x] [AI-Review][MEDIUM] Empty catch block 개선: 에러 로깅 추가 또는 의도 주석 [glob.ts:47-48]
- [x] [AI-Review][LOW] File List 문서 오류 수정: src/__tests__ → tests 경로 수정 완료

## Dev Notes

### Architecture Patterns

- **Claude Code 패턴 준수**: Claude Code Glob 도구와 동일한 API 형태 유지
- **Description 전략**: LLM이 올바른 사용 패턴을 학습하도록 명확한 description 제공
- **Read-first 유도**: glob은 파일 목록 조회 도구로, read/edit/write 전에 호출되도록 유도

### Source Tree Components

```
apps/cad-mcp/src/
├── tools/
│   └── glob.ts          # 신규: glob 핸들러
├── schema.ts            # 수정: GLOB_TOOL 스키마 추가
└── mcp-server.ts        # 수정: glob 핸들러 등록
```

### Data Paths

| 경로 | 용도 |
|------|------|
| `~/.ai-native-cad/scene.code.js` | main 파일 (항상 포함) |
| `~/.ai-native-cad/modules/*.js` | 모듈 파일들 |

### API 설계

```typescript
// glob 도구 입력 스키마
interface GlobInput {
  pattern?: string;  // glob 패턴 (예: '*_lib', 'house*')
}

// glob 도구 출력
interface GlobOutput {
  success: boolean;
  data: {
    files: string[];  // ['main', 'iso_lib', 'city_lib']
  };
}
```

### Description 전략

```typescript
const GLOB_DESCRIPTION = 'CAD 파일 목록 조회. main과 모듈 파일들.';
```

- 간결하고 명확한 설명
- Claude Code Glob과 유사한 톤
- 추가 지시 없이도 올바른 사용 유도

### 패턴 매칭 구현 옵션

1. **minimatch** (npm): glob 패턴 표준 구현
2. **micromatch** (npm): 더 빠른 대안
3. **직접 구현**: 간단한 와일드카드만 지원 (`*`, `?`)

**권장**: 간단한 와일드카드만 필요하므로 직접 구현 선호 (의존성 최소화)

```typescript
function matchGlob(pattern: string, filename: string): boolean {
  const regex = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`).test(filename);
}
```

### Testing Standards

- Vitest 사용
- 모듈 디렉토리 mock 필요 (실제 파일 시스템 의존 최소화)
- 엣지 케이스: 빈 디렉토리, 특수 문자 파일명

### Project Structure Notes

- `apps/cad-mcp/src/tools/` 디렉토리는 신규 생성 필요
- 기존 `apps/cad-mcp/src/mcp-server.ts`의 핸들러 패턴 따름

### References

- [Source: docs/architecture.md#Part 3: AX Improvement (Epic 10)]
- [Source: docs/epics.md#Story 10.1: glob 도구 구현]
- [Source: docs/adr/008-tool-pattern-alignment.md]
- [Source: apps/cad-mcp/src/mcp-server.ts] - 기존 MCP 도구 핸들러 패턴

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List

- `apps/cad-mcp/src/tools/glob.ts` (신규)
- `apps/cad-mcp/src/schema.ts` (수정)
- `apps/cad-mcp/src/mcp-server.ts` (수정)
- `apps/cad-mcp/tests/glob.test.ts` (신규)

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-15
**Outcome:** Changes Requested

**Summary:**
- 모든 AC 구현 완료 확인 ✅
- 모든 Tasks 구현 완료 확인 ✅
- 3개 품질 이슈 발견 (1 High, 2 Medium)

**Issues Found:**
1. **[HIGH]** 테스트 조건부 assertion - 실제 검증 없이 통과 가능
2. **[MEDIUM]** 테스트 파일 Dead Code (미사용 변수)
3. **[MEDIUM]** Empty catch block (에러 무시)

### Code Quality Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-15
**Scope:** Source code deep analysis

**Issues Fixed:**

1. ~~**[MEDIUM] ReDoS 취약점**~~ → ✅ **해결됨**
   - iterative 알고리즘으로 변경 + MAX_PATTERN_LENGTH 제한

2. ~~**[MEDIUM] DRY 위반**~~ → ✅ **해결됨**
   - `utils/paths.ts`로 추출됨

3. ~~**[MEDIUM] Empty catch block**~~ → ✅ **해결됨**
   - 의도 설명 주석 추가됨
