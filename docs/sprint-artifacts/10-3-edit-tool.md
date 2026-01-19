# Story 10.3: edit 도구 구현

Status: done

## Story

As a **LLM 에이전트**,
I want **edit 도구로 파일을 부분 수정할 수 있기를**,
so that **기존 코드의 일부만 변경할 수 있다** (FR61).

## Acceptance Criteria

1. **AC1: 파일 부분 수정 및 자동 실행**
   - Given: 파일에 특정 코드가 있을 때
   - When: `edit({ file: 'main', old_code: 'drawCircle(...)', new_code: 'drawRect(...)' })` 호출하면
   - Then: 해당 부분이 교체되고 자동 실행된다
   - And: 실행 결과(씬 상태)가 반환된다

2. **AC2: old_code 미발견 에러 처리**
   - Given: old_code가 파일에 없을 때
   - When: edit 호출하면
   - Then: 에러 반환 ("old_code not found in file")

3. **AC3: Read-first 경고 메시지**
   - Given: read 없이 edit를 시도할 때
   - When: 해당 파일을 이전에 read하지 않았으면
   - Then: 경고 메시지 포함 ("Warning: Consider using read first")
   - And: 실행은 정상 진행 (경고만)

4. **AC4: 모듈 파일 수정**
   - Given: 모듈 파일이 존재할 때
   - When: `edit({ file: 'iso_lib', old_code: '...', new_code: '...' })` 호출하면
   - Then: 모듈 파일이 수정되고 자동 실행된다

5. **AC5: 실행 실패 시 롤백**
   - Given: 수정된 코드에 문법 오류가 있을 때
   - When: edit 실행이 실패하면
   - Then: 파일 변경이 롤백되고 에러 메시지 반환
   - And: 원본 파일 내용 유지

6. **AC6: MCP 도구 등록**
   - Given: MCP 서버가 시작될 때
   - When: 도구 목록을 조회하면
   - Then: `edit` 도구가 등록되어 있음

7. **AC7: Read-first Description**
   - Given: edit 도구가 등록될 때
   - When: description을 조회하면
   - Then: "파일 부분 수정 → 자동 실행. ⚠️ read로 먼저 확인 필수." 메시지 포함

## Tasks / Subtasks

- [x] **Task 1: edit 도구 스키마 정의** (AC: #6, #7)
  - [x] 1.1 `apps/cad-mcp/src/schema.ts`에 EDIT_TOOL 스키마 추가
  - [x] 1.2 inputSchema 정의 (file: required, old_code: required, new_code: required)
  - [x] 1.3 description 작성: "파일 부분 수정 → 자동 실행. ⚠️ read로 먼저 확인 필수."

- [x] **Task 2: Read-first 추적 시스템 구현** (AC: #3)
  - [x] 2.1 세션 내 read 호출 기록 저장 메커니즘 구현 (read.ts의 readHistory Set)
  - [x] 2.2 파일별 read 여부 확인 함수 구현 (hasBeenRead)
  - [x] 2.3 경고 메시지 생성 로직 구현

- [x] **Task 3: edit 핸들러 구현** (AC: #1, #2, #4, #5)
  - [x] 3.1 `apps/cad-mcp/src/tools/edit.ts` 파일 생성
  - [x] 3.2 파일 읽기 및 old_code 검색 로직 구현
  - [x] 3.3 old_code → new_code 교체 로직 구현
  - [x] 3.4 수정된 코드 자동 실행 (MCP 서버에서 처리)
  - [x] 3.5 실행 실패 시 롤백 로직 구현 (rollbackEdit 함수)
  - [x] 3.6 Read-first 경고 메시지 포함 로직

- [x] **Task 4: MCP 서버 통합** (AC: #6)
  - [x] 4.1 `apps/cad-mcp/src/mcp-server.ts`에 edit 핸들러 등록
  - [x] 4.2 CAD_TOOLS에 edit 추가 (glob, read 패턴 따름)

- [x] **Task 5: 테스트 작성** (AC: #1, #2, #3, #4, #5)
  - [x] 5.1 `apps/cad-mcp/tests/edit.test.ts` 생성
  - [x] 5.2 정상 수정 및 실행 테스트
  - [x] 5.3 old_code 미발견 에러 테스트
  - [x] 5.4 Read-first 경고 테스트
  - [x] 5.5 실행 실패 롤백 테스트 (rollbackEdit)
  - [x] 5.6 모듈 파일 수정 테스트

### Review Follow-ups (AI)

- [x] [AI-Review][LOW] File List에 read.ts 수정 추가 필요

## Dev Notes

### Architecture Patterns

- **Claude Code 패턴 준수**: Claude Code Edit 도구와 동일한 old_code/new_code 패턴
- **Description 전략**: "파일 부분 수정 → 자동 실행. ⚠️ read로 먼저 확인 필수." - Read-first 강제
- **자동 실행**: Claude Code와 달리 CAD 도구는 수정 후 자동 실행 (씬 업데이트)
- **트랜잭션 패턴**: 기존 FR46 (실행 트랜잭션) 재활용 - 실패 시 자동 롤백

### Source Tree Components

```
apps/cad-mcp/src/
├── tools/
│   ├── glob.ts          # 10-1에서 구현
│   ├── read.ts          # 10-2에서 구현
│   └── edit.ts          # 신규: edit 핸들러
├── schema.ts            # 수정: EDIT_TOOL 스키마 추가
├── mcp-server.ts        # 수정: edit 핸들러 등록
└── run-cad-code/
    └── handlers.ts      # 참고: 기존 old_code/new_code 로직
```

### Data Paths

| 경로 | 용도 |
|------|------|
| `~/.ai-native-cad/scene.code.js` | main 파일 |
| `~/.ai-native-cad/modules/{name}.js` | 모듈 파일들 |

### API 설계

```typescript
// edit 도구 입력 스키마
interface EditInput {
  file: string;     // 'main' 또는 모듈명
  old_code: string; // 교체할 기존 코드
  new_code: string; // 새 코드 (빈 문자열 = 삭제)
}

// edit 도구 출력
interface EditOutput {
  success: boolean;
  data: {
    file: string;
    replaced: boolean;
    scene?: SceneInfo; // 실행 성공 시 씬 상태
  };
  warnings?: string[];  // Read-first 경고 등
  error?: string;       // 실패 시 에러 메시지
}
```

### Description 전략 (Critical!)

```typescript
const EDIT_DESCRIPTION = '파일 부분 수정 → 자동 실행. ⚠️ read로 먼저 확인 필수.';
```

**중요**:
- "→ 자동 실행" 명시: Claude Code Edit과 차이점 (CAD는 자동 실행)
- "⚠️ read로 먼저 확인 필수" 경고: Read-first 패턴 강제

### 기존 코드 재활용

`apps/cad-mcp/src/run-cad-code/handlers.ts`의 부분 수정 로직:

```typescript
// 기존 run_cad_code의 부분 수정 모드
if (file && old_code && new_code !== undefined) {
  const content = readFile(file);
  if (!content.includes(old_code)) {
    return { success: false, error: 'old_code not found in file' };
  }
  const newContent = content.replace(old_code, new_code);
  writeFile(file, newContent);
  const result = execute(newContent);
  return { success: true, data: result };
}
```

→ 이 로직을 `edit.ts`로 분리/확장 (Read-first 추적 추가)

### Read-first 추적 구현 옵션

**Option A: 세션 내 Map (권장)**
```typescript
// 세션별 read 기록 저장
const readHistory = new Map<string, Set<string>>(); // sessionId → Set<filename>

function trackRead(sessionId: string, file: string) {
  if (!readHistory.has(sessionId)) {
    readHistory.set(sessionId, new Set());
  }
  readHistory.get(sessionId)!.add(file);
}

function hasReadFile(sessionId: string, file: string): boolean {
  return readHistory.get(sessionId)?.has(file) ?? false;
}
```

**Option B: MCP Request Context**
- MCP SDK의 request context를 활용하여 세션 추적
- 더 정확하지만 구현 복잡도 높음

**권장**: Option A (세션 Map) - 간단하고 효과적

### Testing Standards

- Vitest 사용
- sandbox mock 필요 (실행 결과 mock)
- 파일 시스템 mock 필요
- 엣지 케이스:
  - old_code가 여러 번 등장하는 경우 (첫 번째만 교체)
  - new_code가 빈 문자열인 경우 (삭제)
  - 실행 실패 및 롤백
  - Read-first 경고 발생 조건

### Project Structure Notes

- `apps/cad-mcp/src/tools/` 디렉토리는 10-1, 10-2에서 생성됨
- 기존 `apps/cad-mcp/src/mcp-server.ts`의 핸들러 패턴 따름
- glob, read와 동일한 패턴으로 통합

### References

- [Source: docs/architecture.md#Part 3: AX Improvement (Epic 10)]
- [Source: docs/epics.md#Story 10.3: edit 도구 구현]
- [Source: docs/adr/008-tool-pattern-alignment.md]
- [Source: apps/cad-mcp/src/run-cad-code/handlers.ts] - 기존 부분 수정 로직
- [Source: apps/cad-mcp/src/executor.ts] - 트랜잭션/롤백 패턴

### Previous Story Intelligence (10-1, 10-2)

- 10-1 glob: tools/ 디렉토리 구조, MCP 통합 패턴
- 10-2 read: Read-first 패턴 기반, description 전략
- edit은 read와 연동되어야 함 (Read-first 추적)

### 의존성

- **10-1 glob 도구**: `tools/` 디렉토리 생성
- **10-2 read 도구**: Read-first 추적을 위한 연동 필요
- **기존 run_cad_code**: 부분 수정 + 실행 로직 재활용
- **executor.ts**: 트랜잭션 롤백 패턴

### 리스크 및 주의사항

1. **Read-first 추적 세션 관리**: MCP 세션과 동기화 필요
2. **old_code 중복 발생**: 첫 번째만 교체하는 정책 명확히 문서화
3. **롤백 무결성**: 파일 + 씬 상태 모두 롤백되어야 함
4. **실행 타임아웃**: 무한 루프 코드 방지 (기존 타임아웃 로직 재활용)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List

- `apps/cad-mcp/src/tools/edit.ts` (신규)
- `apps/cad-mcp/src/tools/read.ts` (수정 - hasBeenRead export 추가)
- `apps/cad-mcp/src/schema.ts` (수정)
- `apps/cad-mcp/src/mcp-server.ts` (수정)
- `apps/cad-mcp/tests/edit.test.ts` (신규)

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-15
**Outcome:** Approved (Minor Issues)

**Summary:**
- 모든 AC 구현 완료 확인 ✅
- 모든 Tasks 구현 완료 확인 ✅
- 테스트 품질 우수 - deterministic fixtures ✅
- Read-first 연동 정상 작동 ✅
- 1개 문서 이슈 발견 (1 Low)

**Issues Found:**
1. **[LOW]** File List에 read.ts 수정 누락 → 수정 완료

### Code Quality Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-15
**Scope:** Source code deep analysis

**Issues Fixed:**

1. ~~**[HIGH] Path Traversal 취약점**~~ → ✅ **해결됨**
   - `isValidFileName()` 검증 추가

2. ~~**[MEDIUM] Race Condition**~~ → ✅ **문서화됨** (허용 가능한 리스크)
   - CAD-MCP는 단일 사용자 로컬 도구로 동시 요청이 드물음
   - 실행 실패 시 rollbackEdit으로 복구
   - 코드에 설계 결정 주석 추가됨

3. ~~**[MEDIUM] DRY 위반**~~ → ✅ **해결됨**
   - `utils/paths.ts`로 추출됨
