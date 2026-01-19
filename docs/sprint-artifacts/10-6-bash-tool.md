# Story 10.6: bash 도구 구현

Status: done

## Story

As a **LLM 에이전트**,
I want **bash 도구로 씬 조회/내보내기 명령을 실행할 수 있기를**,
so that **씬 상태 확인과 출력이 가능하다** (FR64).

## Acceptance Criteria

1. **AC1: 씬 정보 조회**
   - Given: 씬 정보를 요청할 때
   - When: `bash({ command: 'info' })` 호출하면
   - Then: 씬 요약 정보 (entityCount, groupCount, bounds) 반환

2. **AC2: 씬 트리 구조 조회**
   - Given: 씬 구조를 요청할 때
   - When: `bash({ command: 'tree' })` 호출하면
   - Then: 계층 구조 (그룹-엔티티 트리) 반환

3. **AC3: 그룹 목록 조회**
   - Given: 그룹 목록을 요청할 때
   - When: `bash({ command: 'groups' })` 호출하면
   - Then: 그룹 이름 배열 반환

4. **AC4: 드로우 오더 조회**
   - Given: z-order를 요청할 때
   - When: `bash({ command: 'draw_order' })` 또는 `bash({ command: 'draw_order', group: 'robot' })` 호출하면
   - Then: 그리기 순서 배열 반환 (뒤→앞)

5. **AC5: 씬 초기화**
   - Given: 씬 초기화를 요청할 때
   - When: `bash({ command: 'reset' })` 호출하면
   - Then: 씬이 초기화되고 확인 메시지 반환

6. **AC6: 스크린샷 캡처**
   - Given: 내보내기를 요청할 때
   - When: `bash({ command: 'capture' })` 호출하면
   - Then: PNG 스크린샷 반환 (base64 또는 파일 경로)

7. **AC7: SVG 내보내기**
   - Given: SVG를 요청할 때
   - When: `bash({ command: 'svg' })` 호출하면
   - Then: SVG 문자열 반환

8. **AC8: JSON 내보내기**
   - Given: JSON을 요청할 때
   - When: `bash({ command: 'json' })` 호출하면
   - Then: 씬 JSON 데이터 반환

9. **AC9: 선택 엔티티 조회**
   - Given: 선택 상태를 요청할 때
   - When: `bash({ command: 'selection' })` 호출하면
   - Then: 현재 선택된 엔티티 이름 배열 반환

10. **AC10: MCP 도구 등록**
    - Given: MCP 서버가 시작될 때
    - When: 도구 목록을 조회하면
    - Then: `bash` 도구가 등록되어 있음

11. **AC11: Description 전략**
    - Given: bash 도구가 등록될 때
    - When: description을 조회하면
    - Then: "명령 실행. 씬 조회(info/tree/groups), 내보내기(capture/svg/json)." 메시지 포함

## Tasks / Subtasks

- [x] **Task 1: bash 도구 스키마 정의** (AC: #10, #11)
  - [x] 1.1 `apps/cad-mcp/src/schema.ts`에 BASH_TOOL 스키마 추가
  - [x] 1.2 inputSchema 정의 (command: required, group: optional, clearSketch: optional)
  - [x] 1.3 description 작성: "명령 실행. 씬 조회(info/tree/groups), 내보내기(capture/svg/json)."

- [x] **Task 2: bash 핸들러 구현** (AC: #1~#9)
  - [x] 2.1 `apps/cad-mcp/src/tools/bash.ts` 파일 생성
  - [x] 2.2 'info' command 구현 (기존 get_scene_info 로직)
  - [x] 2.3 'tree' command 구현 (기존 overview 로직)
  - [x] 2.4 'groups' command 구현 (기존 list_groups 로직)
  - [x] 2.5 'draw_order' command 구현 (기존 scene draw_order 로직)
  - [x] 2.6 'reset' command 구현 (기존 reset 로직)
  - [x] 2.7 'capture' command 구현 (기존 capture 로직)
  - [x] 2.8 'svg' command 구현 (기존 export_svg 로직)
  - [x] 2.9 'json' command 구현 (기존 export_json 로직)
  - [x] 2.10 'selection' command 구현 (기존 get_selection 로직)

- [x] **Task 3: MCP 서버 통합** (AC: #10)
  - [x] 3.1 `apps/cad-mcp/src/mcp-server.ts`에 bash 핸들러 등록
  - [x] 3.2 CAD_TOOLS에 bash 추가

- [x] **Task 4: 테스트 작성** (AC: #1~#9)
  - [x] 4.1 `apps/cad-mcp/src/__tests__/bash.test.ts` 생성
  - [x] 4.2 각 command별 테스트
  - [x] 4.3 존재하지 않는 command 에러 테스트

## Dev Notes

### Architecture Patterns

- **Claude Code Bash 영감**: 명령 실행 컨셉을 차용하되 CAD 맥락에 맞게 조정
- **기존 도구 통합**: scene, export 도구를 하나의 bash로 통합
- **command 파라미터**: 실행할 명령을 문자열로 지정

### Source Tree Components

```
apps/cad-mcp/src/
├── tools/
│   ├── glob.ts          # 10-1
│   ├── read.ts          # 10-2
│   ├── edit.ts          # 10-3
│   ├── write.ts         # 10-4
│   ├── lsp.ts           # 10-5
│   └── bash.ts          # 신규: bash 핸들러
├── schema.ts            # 수정: BASH_TOOL 스키마 추가
├── capture.ts           # 참고: 기존 capture 로직
└── mcp-server.ts        # 수정: bash 핸들러 등록
```

### API 설계

```typescript
// bash 도구 입력 스키마
interface BashInput {
  command: 'info' | 'tree' | 'groups' | 'draw_order' | 'reset' |
           'capture' | 'svg' | 'json' | 'selection';
  group?: string;       // draw_order용: 그룹명
  clearSketch?: boolean; // capture용: 캡처 후 스케치 클리어
}

// bash 도구 출력 (command별)
interface BashOutput {
  success: boolean;
  data: {
    // info
    entityCount?: number;
    groupCount?: number;
    bounds?: { min_x, min_y, max_x, max_y };

    // tree
    tree?: string;  // 트리 구조 텍스트

    // groups
    groups?: string[];

    // draw_order
    order?: string[];

    // capture
    image?: string;  // base64 또는 파일 경로

    // svg
    svg?: string;

    // json
    scene?: object;

    // selection
    selected?: string[];

    // reset
    message?: string;
  };
  error?: string;
}
```

### Description 전략

```typescript
const BASH_DESCRIPTION = '명령 실행. 씬 조회(info/tree/groups), 내보내기(capture/svg/json).';
```

**중요**:
- Claude Code Bash와 비슷한 "명령 실행" 컨셉
- 주요 command를 괄호로 그룹화하여 나열
- 간결하지만 기능 범위가 명확

### 기존 코드 재활용

**1. scene 도구 (schema.ts):**
```typescript
// scene의 액션들
- info → bash info
- overview → bash tree
- groups → bash groups
- selection → bash selection
- draw_order → bash draw_order
- reset → bash reset
```

**2. export 도구 (schema.ts):**
```typescript
// export의 액션들
- json → bash json
- svg → bash svg
- capture → bash capture
```

**3. 실제 구현 위치:**
- `capture.ts`: capture 로직
- `mcp-server.ts`: scene/export 핸들러 로직

### Command 매핑 테이블

| command | 기존 도구 | 기존 액션 |
|---------|----------|-----------|
| info | scene | info |
| tree | scene | overview |
| groups | scene | groups |
| selection | scene | selection |
| draw_order | scene | draw_order |
| reset | scene | reset |
| json | export | json |
| svg | export | svg |
| capture | export | capture |

### Testing Standards

- Vitest 사용
- sandbox/capture mock 필요
- 각 command별 독립 테스트
- 에러 케이스 (잘못된 command)

### References

- [Source: docs/architecture.md#Part 3: AX Improvement (Epic 10)]
- [Source: docs/epics.md#Story 10.6: bash 도구 구현]
- [Source: apps/cad-mcp/src/schema.ts#scene] - 기존 scene 도구
- [Source: apps/cad-mcp/src/schema.ts#export] - 기존 export 도구
- [Source: apps/cad-mcp/src/capture.ts] - capture 로직

### Previous Story Intelligence

- 10-1~10-4: 파일 관리 도구 패턴
- 10-5 lsp: operation 파라미터 패턴 → bash의 command 패턴과 유사

### 의존성

- **기존 mcp-server.ts**: scene, export 핸들러 로직
- **capture.ts**: capture 기능
- **sandbox**: 씬 상태 조회 기능

### 리스크 및 주의사항

1. **command 이름 충돌**: 실제 bash 명령과 혼동 가능 - CAD 맥락임을 명확히
2. **capture 의존성**: Puppeteer/뷰어 연결 필요 - 뷰어 미실행 시 에러 처리
3. **reset 위험성**: 되돌릴 수 없음 - 경고 메시지 강화 고려
4. **draw_order 최근 추가**: 4731e83 커밋에서 추가된 기능 - 안정성 확인 필요

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List

- `apps/cad-mcp/src/tools/bash.ts` (신규)
- `apps/cad-mcp/src/schema.ts` (수정)
- `apps/cad-mcp/src/mcp-server.ts` (수정)
- `apps/cad-mcp/tests/bash.test.ts` (신규)

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-15
**Outcome:** Approved

**Summary:**
- 모든 AC (11개) 구현 완료 확인 ✅
- 모든 Tasks 완료 표시됨 ✅
- scene + export 통합된 bash 도구 ✅
- 이슈 없음

### Code Quality Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-15
**Scope:** Source code deep analysis

**Issues Fixed:**

1. ~~**[HIGH] 하드코딩된 상대 경로**~~ → ✅ **해결됨**
   - `resolveSelectionFile()` 함수 사용 (sandbox/index.ts)
   - 환경변수 `CAD_SELECTION_PATH` 지원
   - 개발/프로덕션 환경 자동 감지

2. ~~**[MEDIUM] Empty Catch Blocks**~~ → ✅ **해결됨**
   - `logger.warn`으로 변경됨 (lines 124, 147)
