# Story 10.4: write 도구 구현

Status: ready-for-dev

## Story

As a **LLM 에이전트**,
I want **write 도구로 파일을 전체 작성할 수 있기를**,
so that **새 파일 생성 또는 전체 교체가 가능하다** (FR62).

## Acceptance Criteria

1. **AC1: 파일 전체 작성 및 자동 실행**
   - Given: 파일 이름과 코드가 있을 때
   - When: `write({ file: 'main', code: '...' })` 호출하면
   - Then: 파일이 작성되고 자동 실행된다
   - And: 실행 결과(씬 상태)가 반환된다

2. **AC2: 새 모듈 생성**
   - Given: 새 모듈을 생성할 때
   - When: `write({ file: 'new_lib', code: '...' })` 호출하면
   - Then: 새 모듈 파일이 생성된다
   - And: 모듈 디렉토리에 저장됨 (`~/.ai-native-cad/modules/new_lib.js`)

3. **AC3: 기존 파일 덮어쓰기 경고**
   - Given: 기존 파일이 있는데 read 없이 write할 때
   - When: 덮어쓰기가 발생하면
   - Then: 경고 메시지 포함 ("Warning: Overwriting existing file. Consider using read first")
   - And: 실행은 정상 진행

4. **AC4: 새 파일 생성 시 경고 없음**
   - Given: 존재하지 않는 파일에 write할 때
   - When: `write({ file: 'brand_new', code: '...' })` 호출하면
   - Then: 파일이 생성되고 경고 없음

5. **AC5: 실행 실패 시 롤백**
   - Given: 작성된 코드에 문법 오류가 있을 때
   - When: write 실행이 실패하면
   - Then: 파일 변경이 롤백되고 에러 메시지 반환
   - And: 원본 파일 내용 유지 (기존 파일인 경우)

6. **AC6: MCP 도구 등록**
   - Given: MCP 서버가 시작될 때
   - When: 도구 목록을 조회하면
   - Then: `write` 도구가 등록되어 있음

7. **AC7: Read-first Description**
   - Given: write 도구가 등록될 때
   - When: description을 조회하면
   - Then: "파일 전체 작성 → 자동 실행. ⚠️ 기존 파일은 read로 먼저 확인." 메시지 포함

## Tasks / Subtasks

- [ ] **Task 1: write 도구 스키마 정의** (AC: #6, #7)
  - [ ] 1.1 `apps/cad-mcp/src/schema.ts`에 WRITE_TOOL 스키마 추가
  - [ ] 1.2 inputSchema 정의 (file: required, code: required)
  - [ ] 1.3 description 작성: "파일 전체 작성 → 자동 실행. ⚠️ 기존 파일은 read로 먼저 확인."

- [ ] **Task 2: write 핸들러 구현** (AC: #1, #2, #3, #4, #5)
  - [ ] 2.1 `apps/cad-mcp/src/tools/write.ts` 파일 생성
  - [ ] 2.2 main 파일 경로 결정 로직 (`~/.ai-native-cad/scene.code.js`)
  - [ ] 2.3 모듈 파일 경로 결정 로직 (`~/.ai-native-cad/modules/{name}.js`)
  - [ ] 2.4 파일 존재 여부 확인 및 덮어쓰기 경고 로직
  - [ ] 2.5 파일 작성 후 자동 실행 (sandbox 연동)
  - [ ] 2.6 실행 실패 시 롤백 로직 구현

- [ ] **Task 3: Read-first 경고 통합** (AC: #3)
  - [ ] 3.1 기존 파일 존재 시 read 여부 확인 (10-3에서 구현된 추적 시스템 활용)
  - [ ] 3.2 경고 메시지 생성 로직

- [ ] **Task 4: MCP 서버 통합** (AC: #6)
  - [ ] 4.1 `apps/cad-mcp/src/mcp-server.ts`에 write 핸들러 등록
  - [ ] 4.2 CAD_TOOLS에 write 추가

- [ ] **Task 5: 테스트 작성** (AC: #1, #2, #3, #4, #5)
  - [ ] 5.1 `apps/cad-mcp/src/__tests__/write.test.ts` 생성
  - [ ] 5.2 main 파일 작성 및 실행 테스트
  - [ ] 5.3 새 모듈 생성 테스트
  - [ ] 5.4 덮어쓰기 경고 테스트
  - [ ] 5.5 새 파일 경고 없음 테스트
  - [ ] 5.6 실행 실패 롤백 테스트

## Dev Notes

### Architecture Patterns

- **Claude Code 패턴 준수**: Claude Code Write 도구와 유사한 전체 파일 작성 패턴
- **Description 전략**: "파일 전체 작성 → 자동 실행. ⚠️ 기존 파일은 read로 먼저 확인."
- **자동 실행**: Claude Code와 달리 CAD 도구는 작성 후 자동 실행 (씬 업데이트)
- **모듈 시스템 통합**: 기존 `module({ action: 'save' })` 기능을 write로 통합

### Source Tree Components

```
apps/cad-mcp/src/
├── tools/
│   ├── glob.ts          # 10-1에서 구현
│   ├── read.ts          # 10-2에서 구현
│   ├── edit.ts          # 10-3에서 구현
│   └── write.ts         # 신규: write 핸들러
├── schema.ts            # 수정: WRITE_TOOL 스키마 추가
└── mcp-server.ts        # 수정: write 핸들러 등록
```

### Data Paths

| 경로 | 용도 |
|------|------|
| `~/.ai-native-cad/scene.code.js` | main 파일 |
| `~/.ai-native-cad/modules/{name}.js` | 모듈 파일들 |

### API 설계

```typescript
// write 도구 입력 스키마
interface WriteInput {
  file: string;  // 'main' 또는 모듈명
  code: string;  // 전체 코드
}

// write 도구 출력
interface WriteOutput {
  success: boolean;
  data: {
    file: string;
    created: boolean;  // 새 파일 생성 여부
    scene?: SceneInfo; // 실행 성공 시 씬 상태
  };
  warnings?: string[];  // 덮어쓰기 경고 등
  error?: string;       // 실패 시 에러 메시지
}
```

### Description 전략 (Critical!)

```typescript
const WRITE_DESCRIPTION = '파일 전체 작성 → 자동 실행. ⚠️ 기존 파일은 read로 먼저 확인.';
```

**중요**:
- "→ 자동 실행" 명시: Claude Code Write와 차이점
- "⚠️ 기존 파일은 read로 먼저 확인" 경고: Read-first 패턴 강제
- "기존 파일은" 조건부: 새 파일 생성 시에는 read 불필요 명시

### 기존 코드 재활용

**1. run_cad_code의 파일 쓰기 모드:**
```typescript
// 기존 run_cad_code의 파일 쓰기 모드
if (file && code && !old_code && !new_code) {
  writeFile(file, code);
  const result = execute(code);
  return { success: true, data: result };
}
```

**2. module의 save 액션:**
```typescript
// 기존 module의 save 액션
if (action === 'save') {
  const modulePath = `~/.ai-native-cad/modules/${name}.js`;
  writeFile(modulePath, code);
  return { success: true };
}
```

→ 두 로직을 `write.ts`로 통합

### Testing Standards

- Vitest 사용
- sandbox mock 필요
- 파일 시스템 mock 필요
- 엣지 케이스:
  - 빈 코드 작성 시도
  - 모듈 디렉토리 미존재 시 자동 생성
  - 실행 타임아웃

### References

- [Source: docs/architecture.md#Part 3: AX Improvement (Epic 10)]
- [Source: docs/epics.md#Story 10.4: write 도구 구현]
- [Source: apps/cad-mcp/src/run-cad-code/handlers.ts] - 기존 파일 쓰기 로직
- [Source: apps/cad-mcp/src/schema.ts#module] - 기존 모듈 저장 로직

### Previous Story Intelligence (10-1 ~ 10-3)

- 10-1 glob: tools/ 디렉토리 구조, MCP 통합 패턴
- 10-2 read: Read-first 패턴 기반
- 10-3 edit: Read-first 추적 시스템, 자동 실행 + 롤백 패턴
- write는 edit의 롤백 패턴 재활용

### 의존성

- **10-1 glob 도구**: `tools/` 디렉토리 생성
- **10-2 read 도구**: Read-first 패턴 기반
- **10-3 edit 도구**: Read-first 추적 시스템, 롤백 패턴 재활용
- **기존 run_cad_code/module**: 파일 쓰기 + 모듈 저장 로직 재활용

### 리스크 및 주의사항

1. **모듈 디렉토리 생성**: `~/.ai-native-cad/modules/` 미존재 시 자동 생성 필요
2. **main vs 모듈 경로 분기**: file === 'main' 체크 로직 명확히
3. **롤백 복잡도**: 새 파일 생성 시 롤백은 파일 삭제 필요
4. **빈 코드 정책**: 빈 코드 허용 여부 결정 필요 (권장: 허용, 파일 초기화 용도)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List

- `apps/cad-mcp/src/tools/write.ts` (신규)
- `apps/cad-mcp/src/schema.ts` (수정)
- `apps/cad-mcp/src/mcp-server.ts` (수정)
- `apps/cad-mcp/src/__tests__/write.test.ts` (신규)
