# Story 10.2: read 도구 구현

Status: ready-for-dev

## Story

As a **LLM 에이전트**,
I want **read 도구로 파일 내용을 읽을 수 있기를**,
so that **edit/write 전에 기존 코드를 확인할 수 있다** (FR60).

## Acceptance Criteria

1. **AC1: main 파일 읽기**
   - Given: main 파일이 존재할 때
   - When: `read({ file: 'main' })` 호출하면
   - Then: main 코드 내용이 반환된다

2. **AC2: 모듈 파일 읽기**
   - Given: 모듈이 존재할 때
   - When: `read({ file: 'iso_lib' })` 호출하면
   - Then: 해당 모듈 코드가 반환된다

3. **AC3: 존재하지 않는 파일 처리**
   - Given: 존재하지 않는 파일일 때
   - When: `read({ file: 'nonexistent' })` 호출하면
   - Then: 에러 메시지 반환 ("File not found: nonexistent")

4. **AC4: 빈 파일 처리**
   - Given: 파일이 존재하지만 비어있을 때
   - When: `read({ file: 'empty_module' })` 호출하면
   - Then: 빈 문자열 반환 (에러 아님)

5. **AC5: MCP 도구 등록**
   - Given: MCP 서버가 시작될 때
   - When: 도구 목록을 조회하면
   - Then: `read` 도구가 등록되어 있음

6. **AC6: Read-first 패턴 Description**
   - Given: read 도구가 등록될 때
   - When: description을 조회하면
   - Then: "파일 읽기. edit/write 전에 반드시 먼저 확인." 메시지 포함

## Tasks / Subtasks

- [ ] **Task 1: read 도구 스키마 정의** (AC: #5, #6)
  - [ ] 1.1 `apps/cad-mcp/src/schema.ts`에 READ_TOOL 스키마 추가
  - [ ] 1.2 inputSchema 정의 (file: required string)
  - [ ] 1.3 description 작성: "파일 읽기. edit/write 전에 반드시 먼저 확인."

- [ ] **Task 2: read 핸들러 구현** (AC: #1, #2, #3, #4)
  - [ ] 2.1 `apps/cad-mcp/src/tools/read.ts` 파일 생성
  - [ ] 2.2 main 파일 읽기 로직 구현 (`~/.ai-native-cad/scene.code.js`)
  - [ ] 2.3 모듈 파일 읽기 로직 구현 (`~/.ai-native-cad/modules/{name}.js`)
  - [ ] 2.4 파일 존재 여부 확인 및 에러 처리
  - [ ] 2.5 빈 파일 처리 (빈 문자열 반환)

- [ ] **Task 3: MCP 서버 통합** (AC: #5)
  - [ ] 3.1 `apps/cad-mcp/src/mcp-server.ts`에 read 핸들러 등록
  - [ ] 3.2 CAD_TOOLS에 read 추가 (10-1 glob 패턴 따름)

- [ ] **Task 4: 테스트 작성** (AC: #1, #2, #3, #4)
  - [ ] 4.1 `apps/cad-mcp/src/__tests__/read.test.ts` 생성
  - [ ] 4.2 main 파일 읽기 테스트
  - [ ] 4.3 모듈 파일 읽기 테스트
  - [ ] 4.4 존재하지 않는 파일 에러 테스트
  - [ ] 4.5 빈 파일 테스트

## Dev Notes

### Architecture Patterns

- **Claude Code 패턴 준수**: Claude Code Read 도구와 동일한 API 형태 유지
- **Description 전략**: "파일 읽기. edit/write 전에 반드시 먼저 확인." - Read-first 패턴 강제 유도
- **Read-first 핵심 역할**: 이 도구가 Epic 10의 핵심 목표인 Read-first 패턴 준수율 > 95% 달성의 열쇠

### Source Tree Components

```
apps/cad-mcp/src/
├── tools/
│   ├── glob.ts          # 10-1에서 구현 (패턴 참고)
│   └── read.ts          # 신규: read 핸들러
├── schema.ts            # 수정: READ_TOOL 스키마 추가
└── mcp-server.ts        # 수정: read 핸들러 등록
```

### Data Paths

| 경로 | 용도 |
|------|------|
| `~/.ai-native-cad/scene.code.js` | main 파일 |
| `~/.ai-native-cad/modules/{name}.js` | 모듈 파일들 |

### API 설계

```typescript
// read 도구 입력 스키마
interface ReadInput {
  file: string;  // 'main' 또는 모듈명
}

// read 도구 출력
interface ReadOutput {
  success: boolean;
  data: {
    file: string;    // 파일명
    content: string; // 파일 내용
  };
  error?: string;    // 실패 시 에러 메시지
}
```

### Description 전략 (Critical!)

```typescript
const READ_DESCRIPTION = '파일 읽기. edit/write 전에 반드시 먼저 확인.';
```

**중요**: 이 description이 LLM의 Read-first 행동을 유도하는 핵심!
- Claude Code Read 도구와 유사한 톤
- edit/write 사용 전 read 호출을 명시적으로 권장
- 간결하지만 명확한 지시

### 기존 코드 재활용

`apps/cad-mcp/src/run-cad-code/handlers.ts`의 파일 읽기 로직 참고:

```typescript
// 기존 run_cad_code의 파일 읽기 모드
if (file && !code && !old_code && !new_code) {
  const content = readFile(file);
  return { success: true, data: { file, content } };
}
```

→ 이 로직을 `read.ts`로 분리/재활용

### Testing Standards

- Vitest 사용
- 파일 시스템 mock 필요 (`fs.readFileSync` mock)
- 엣지 케이스:
  - 빈 파일
  - 존재하지 않는 파일
  - 특수 문자가 포함된 모듈명
  - 한글 내용이 포함된 파일 (UTF-8 인코딩)

### Project Structure Notes

- `apps/cad-mcp/src/tools/` 디렉토리는 10-1에서 생성됨
- 기존 `apps/cad-mcp/src/mcp-server.ts`의 핸들러 패턴 따름
- 10-1 glob 도구와 동일한 패턴으로 통합

### References

- [Source: docs/architecture.md#Part 3: AX Improvement (Epic 10)]
- [Source: docs/epics.md#Story 10.2: read 도구 구현]
- [Source: docs/adr/008-tool-pattern-alignment.md]
- [Source: apps/cad-mcp/src/run-cad-code/handlers.ts] - 기존 파일 읽기 로직
- [Source: apps/cad-mcp/src/schema.ts] - 기존 MCP 도구 스키마 패턴

### Previous Story Intelligence (10-1)

10-1-glob-tool에서 확립된 패턴:
- `apps/cad-mcp/src/tools/` 디렉토리 구조
- DOMAIN_TOOLS에 새 도구 추가 패턴
- 테스트 파일 구조 (`__tests__/*.test.ts`)
- description 작성 톤 (간결하고 명확)

### Git Intelligence

최근 커밋에서 확인된 패턴:
- `tool-registry.ts`: Map을 사용한 도구 중복 제거 로직 존재
- `scene.ts`: action 파라미터 패턴 (draw_order 추가)
- 새 도구 추가 시 `listTools`에서 자동 노출됨

### 의존성

- **10-1 glob 도구**: `tools/` 디렉토리 생성, MCP 통합 패턴 확립
- **기존 run_cad_code**: 파일 읽기 로직 재활용 가능

### 리스크 및 주의사항

1. **파일 경로 하드코딩**: `~/.ai-native-cad/` 경로가 여러 곳에서 사용됨 → 상수로 관리 권장
2. **인코딩**: UTF-8 명시적 지정 필요 (한글 지원)
3. **에러 메시지 일관성**: "File not found: {name}" 형식 유지

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List

- `apps/cad-mcp/src/tools/read.ts` (신규)
- `apps/cad-mcp/src/schema.ts` (수정)
- `apps/cad-mcp/src/mcp-server.ts` (수정)
- `apps/cad-mcp/src/__tests__/read.test.ts` (신규)
