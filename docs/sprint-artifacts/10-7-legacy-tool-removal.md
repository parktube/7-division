# Story 10.7: 레거시 도구 제거

Status: ready-for-dev

## Story

As a **개발자**,
I want **기존 도구(cad_code, discovery, scene, export, module)를 제거하기를**,
so that **중복 없이 새 도구만 유지한다** (FR65).

## Acceptance Criteria

1. **AC1: 레거시 도구 MCP 등록 제거**
   - Given: 새 도구(glob, read, edit, write, lsp, bash)가 구현되었을 때
   - When: 레거시 도구를 제거하면
   - Then: MCP 서버에서 더 이상 등록되지 않는다

2. **AC2: DOMAIN_TOOLS 정리**
   - Given: schema.ts의 DOMAIN_TOOLS 객체
   - When: 레거시 도구 정의를 제거하면
   - Then: cad_code, discovery, scene, export, module이 제거됨

3. **AC3: CAD_TOOLS 정리**
   - Given: schema.ts의 CAD_TOOLS 객체
   - When: 레거시 도구 정의를 제거하면
   - Then: run_cad_code, describe, list_domains 등 모든 레거시 도구 제거됨

4. **AC4: 핸들러 코드 정리**
   - Given: mcp-server.ts의 핸들러 로직
   - When: 레거시 핸들러를 제거하면
   - Then: 새 도구(glob, read, edit, write, lsp, bash) 핸들러만 남음

5. **AC5: 테스트 통과**
   - Given: 레거시 도구가 제거되었을 때
   - When: 전체 테스트를 실행하면
   - Then: 모든 테스트가 통과함 (레거시 테스트 제거/수정 포함)

6. **AC6: CLAUDE.md 업데이트**
   - Given: 새 도구 패턴으로 전환되었을 때
   - When: CLAUDE.md를 업데이트하면
   - Then: glob, read, edit, write, lsp, bash 사용법 문서화
   - And: 기존 cad_code, discovery 등 가이드 제거

## Tasks / Subtasks

- [ ] **Task 1: schema.ts 레거시 도구 제거** (AC: #2, #3)
  - [ ] 1.1 DOMAIN_TOOLS에서 cad_code, discovery, scene, export, module 제거
  - [ ] 1.2 CAD_TOOLS에서 run_cad_code, describe, list_domains, list_tools, get_tool_schema, request_tool 제거
  - [ ] 1.3 CAD_TOOLS에서 get_scene_info, export_json, export_svg, reset, capture, get_selection 제거
  - [ ] 1.4 CAD_TOOLS에서 save_module, list_modules, get_module, delete_module 제거
  - [ ] 1.5 CAD_TOOLS에서 list_groups, overview 제거

- [ ] **Task 2: mcp-server.ts 핸들러 정리** (AC: #1, #4)
  - [ ] 2.1 레거시 도구 핸들러 로직 제거
  - [ ] 2.2 새 도구(glob, read, edit, write, lsp, bash) 핸들러만 유지
  - [ ] 2.3 도구 목록 반환 로직 업데이트

- [ ] **Task 3: 관련 파일 정리** (AC: #4)
  - [ ] 3.1 discovery.ts 파일 제거 (lsp로 대체됨)
  - [ ] 3.2 run-cad-code/handlers.ts에서 레거시 로직 제거 또는 파일 삭제
  - [ ] 3.3 불필요한 import 문 정리

- [ ] **Task 4: 테스트 정리** (AC: #5)
  - [ ] 4.1 레거시 도구 관련 테스트 파일 제거
  - [ ] 4.2 새 도구 테스트만 유지
  - [ ] 4.3 전체 테스트 실행 및 통과 확인

- [ ] **Task 5: CLAUDE.md 업데이트** (AC: #6)
  - [ ] 5.1 MCP 도메인 도구 섹션 전면 개편
  - [ ] 5.2 glob, read, edit, write, lsp, bash 사용법 문서화
  - [ ] 5.3 기존 cad_code, discovery, scene, export, module 가이드 제거
  - [ ] 5.4 예제 코드 업데이트

## Dev Notes

### Architecture Patterns

- **깔끔한 제거**: 레거시 코드 완전 제거 (주석 처리가 아닌 삭제)
- **테스트 우선**: 제거 전 새 도구 테스트가 모두 통과해야 함
- **문서 동기화**: 코드 변경과 CLAUDE.md 업데이트 동시 진행

### 제거 대상 목록

**DOMAIN_TOOLS (5개):**
- `cad_code` → glob, read, edit, write로 분리됨
- `discovery` → lsp로 대체됨
- `scene` → bash로 통합됨
- `export` → bash로 통합됨
- `module` → glob, read, edit, write로 통합됨

**CAD_TOOLS (18개):**
```typescript
// 실행/편집 (→ glob, read, edit, write)
- run_cad_code

// 탐색 (→ lsp)
- describe
- list_domains
- list_tools
- get_tool_schema
- request_tool

// 씬 조회 (→ bash)
- get_scene_info
- list_groups
- overview
- get_selection

// 내보내기 (→ bash)
- export_json
- export_svg
- capture

// 세션 (→ bash)
- reset

// 모듈 (→ glob, read, edit, write)
- save_module
- list_modules
- get_module
- delete_module
```

### Source Tree 변경사항

```
apps/cad-mcp/src/
├── tools/
│   ├── glob.ts          # 유지 (10-1)
│   ├── read.ts          # 유지 (10-2)
│   ├── edit.ts          # 유지 (10-3)
│   ├── write.ts         # 유지 (10-4)
│   ├── lsp.ts           # 유지 (10-5)
│   └── bash.ts          # 유지 (10-6)
├── schema.ts            # 수정: 레거시 도구 제거
├── mcp-server.ts        # 수정: 레거시 핸들러 제거
├── discovery.ts         # 삭제 (lsp로 대체)
└── run-cad-code/
    └── handlers.ts      # 수정/삭제: 레거시 로직 제거
```

### CLAUDE.md 업데이트 계획

**Before (현재):**
```markdown
## MCP 도메인 도구 (5개)
| 도구 | 설명 |
| cad_code | JavaScript 코드 실행/편집 |
| discovery | 함수 탐색 |
| scene | 씬 상태 조회 |
| export | 내보내기 |
| module | 모듈 관리 |
```

**After (변경 후):**
```markdown
## MCP 도구 (6개)
| 도구 | 설명 |
| glob | 파일 목록 조회 |
| read | 파일 읽기 |
| edit | 파일 부분 수정 |
| write | 파일 전체 작성 |
| lsp | CAD 함수 탐색 |
| bash | 씬 조회/내보내기 명령 |
```

### Testing Standards

- 전체 테스트 통과 필수 (`pnpm test`)
- 새 도구 테스트가 먼저 작성되어 있어야 함 (10-1 ~ 10-6)
- 레거시 테스트는 완전 제거 (유지하지 않음)

### References

- [Source: docs/architecture.md#Part 3: AX Improvement (Epic 10)]
- [Source: docs/epics.md#Story 10.7: 레거시 도구 제거]
- [Source: apps/cad-mcp/src/schema.ts] - 제거 대상 도구 정의
- [Source: CLAUDE.md] - 업데이트 필요

### Previous Story Intelligence (10-1 ~ 10-6)

- 모든 새 도구가 구현되어 있어야 이 스토리 진행 가능
- 10-1~10-6 완료 후 10-7 진행

### 의존성

- **10-1 glob** (완료 필수)
- **10-2 read** (완료 필수)
- **10-3 edit** (완료 필수)
- **10-4 write** (완료 필수)
- **10-5 lsp** (완료 필수)
- **10-6 bash** (완료 필수)

### 리스크 및 주의사항

1. **순서 중요**: 10-1~10-6이 모두 완료된 후 진행해야 함
2. **테스트 누락**: 새 도구 테스트가 충분히 작성되어 있어야 함
3. **CLAUDE.md 동기화**: 코드와 문서가 일치해야 함 (진입점 무결성)
4. **기존 사용자 영향**: Breaking change - 기존 사용자에게 마이그레이션 가이드 필요할 수 있음

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List

- `apps/cad-mcp/src/schema.ts` (수정: 레거시 제거)
- `apps/cad-mcp/src/mcp-server.ts` (수정: 레거시 핸들러 제거)
- `apps/cad-mcp/src/discovery.ts` (삭제)
- `apps/cad-mcp/src/run-cad-code/handlers.ts` (수정/삭제)
- `CLAUDE.md` (수정: 새 도구 가이드)
- `apps/cad-mcp/src/__tests__/*.test.ts` (레거시 테스트 제거)
