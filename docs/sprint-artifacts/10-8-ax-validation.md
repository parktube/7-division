# Story 10.8: AX 검증 및 문서화

Status: ready-for-dev

## Story

As a **개발자**,
I want **새 도구 패턴이 LLM에서 올바르게 동작하는지 검증하기를**,
so that **Read-first 패턴 준수율이 향상됨을 확인한다** (NFR24).

## Acceptance Criteria

1. **AC1: Read-first 패턴 검증**
   - Given: 새 도구가 배포되었을 때
   - When: Claude Code에서 CAD 작업을 요청하면
   - Then: read → edit/write 순서로 호출된다

2. **AC2: Glob-first 패턴 검증**
   - Given: 기존 모듈이 있을 때
   - When: 새 작업을 요청하면
   - Then: glob → read → 기존 모듈 활용 패턴 확인

3. **AC3: CLAUDE.md 도구 섹션 업데이트**
   - Given: CLAUDE.md를 업데이트할 때
   - When: 새 도구 가이드를 작성하면
   - Then: glob, read, edit, write, lsp, bash 사용법 문서화
   - And: 기존 cad_code, discovery, scene, export, module 가이드 제거

4. **AC4: 도구 Description 검증**
   - Given: MCP 서버에서 도구 목록을 조회할 때
   - When: 각 도구의 description을 확인하면
   - Then: Read-first 유도 메시지가 포함됨 (edit/write)

5. **AC5: 통합 시나리오 테스트**
   - Given: 로봇 캐릭터 생성 시나리오를 실행할 때
   - When: LLM이 도구를 호출하면
   - Then: glob → read (기존 확인) → write/edit (작업) 순서 확인

6. **AC6: 에러 시나리오 검증**
   - Given: read 없이 edit를 시도할 때
   - When: edit 도구가 호출되면
   - Then: 경고 메시지가 반환됨

7. **AC7: DoD 체크리스트 확인**
   - Given: Epic 10 DoD를 확인할 때
   - When: 모든 항목을 검증하면
   - Then: 5개 항목 모두 통과:
     - 6개 신규 도구 구현 완료
     - 레거시 도구 제거
     - CLAUDE.md 업데이트
     - 테스트 100% 통과
     - Read-first 패턴 검증

## Tasks / Subtasks

- [ ] **Task 1: Read-first 패턴 수동 검증** (AC: #1, #2)
  - [ ] 1.1 Claude Code에서 기존 main 파일 수정 요청
  - [ ] 1.2 read → edit 호출 순서 확인
  - [ ] 1.3 새 모듈 생성 시 glob → write 순서 확인
  - [ ] 1.4 기존 모듈 수정 시 glob → read → edit 순서 확인

- [ ] **Task 2: CLAUDE.md 업데이트** (AC: #3)
  - [ ] 2.1 MCP 도메인 도구 섹션 전면 개편
  - [ ] 2.2 glob 도구 사용법 문서화
  - [ ] 2.3 read 도구 사용법 문서화
  - [ ] 2.4 edit 도구 사용법 문서화
  - [ ] 2.5 write 도구 사용법 문서화
  - [ ] 2.6 lsp 도구 사용법 문서화
  - [ ] 2.7 bash 도구 사용법 문서화
  - [ ] 2.8 기존 cad_code, discovery, scene, export, module 가이드 제거
  - [ ] 2.9 예제 코드 업데이트

- [ ] **Task 3: 통합 시나리오 검증** (AC: #5, #6)
  - [ ] 3.1 시나리오 1: 기존 로봇 캐릭터에 팔 추가
  - [ ] 3.2 시나리오 2: 새 집(house) 모듈 생성
  - [ ] 3.3 시나리오 3: 기존 모듈 수정 (색상 변경)
  - [ ] 3.4 에러 시나리오: read 없이 edit 시도

- [ ] **Task 4: DoD 최종 체크** (AC: #7)
  - [ ] 4.1 6개 신규 도구 구현 확인 (glob, read, edit, write, lsp, bash)
  - [ ] 4.2 레거시 도구 제거 확인 (cad_code, discovery, scene, export, module)
  - [ ] 4.3 CLAUDE.md 업데이트 확인
  - [ ] 4.4 전체 테스트 실행 및 통과 (`pnpm test`)
  - [ ] 4.5 Read-first 패턴 준수율 > 95% 관찰 확인

## Dev Notes

### Architecture Patterns

- **AX 검증**: Agent eXperience 품질 확인을 위한 수동 테스트 중심
- **CLAUDE.md 동기화**: 코드와 문서가 항상 일치해야 함 (진입점 무결성)
- **Description 전략**: LLM 행동 유도를 위한 도구 설명 전략 검증

### Source Tree Components

```
apps/cad-mcp/src/
├── tools/
│   ├── glob.ts          # 검증 대상 (10-1)
│   ├── read.ts          # 검증 대상 (10-2)
│   ├── edit.ts          # 검증 대상 (10-3)
│   ├── write.ts         # 검증 대상 (10-4)
│   ├── lsp.ts           # 검증 대상 (10-5)
│   └── bash.ts          # 검증 대상 (10-6)
├── schema.ts            # Description 검증
└── mcp-server.ts        # 도구 등록 검증

CLAUDE.md                # 업데이트 대상
```

### 검증 시나리오

**시나리오 1: 기존 로봇 캐릭터에 팔 추가**
```
예상 호출 순서:
1. glob({}) → ['main'] 확인
2. read({ file: 'main' }) → 기존 코드 확인
3. edit({ file: 'main', old_code: '...', new_code: '...' }) → 팔 추가
```

**시나리오 2: 새 집(house) 모듈 생성**
```
예상 호출 순서:
1. glob({}) → 기존 모듈 확인
2. write({ file: 'house_lib', code: '...' }) → 새 모듈 생성
```

**시나리오 3: 기존 모듈 수정**
```
예상 호출 순서:
1. glob({}) → ['main', 'robot_lib'] 확인
2. read({ file: 'robot_lib' }) → 기존 모듈 코드 확인
3. edit({ file: 'robot_lib', old_code: '...', new_code: '...' }) → 수정
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
| glob | 파일 목록 조회 (main + 모듈) |
| read | 파일 읽기. edit/write 전 먼저 확인 |
| edit | 파일 부분 수정 → 자동 실행 |
| write | 파일 전체 작성 → 자동 실행 |
| lsp | CAD 함수 탐색 (도메인/시그니처/스키마) |
| bash | 씬 조회/내보내기 명령 실행 |
```

### Description 검증 체크리스트

| 도구 | Description | Read-first 유도 |
|------|-------------|-----------------|
| glob | "파일 목록 조회. main + 모듈 디렉토리." | N/A (조회 도구) |
| read | "파일 읽기. edit/write 전에 반드시 먼저 확인." | ✅ "반드시 먼저" |
| edit | "파일 부분 수정 → 자동 실행. ⚠️ read로 먼저 확인 필수." | ✅ "먼저 확인 필수" |
| write | "파일 전체 작성 → 자동 실행. ⚠️ 기존 파일은 read로 먼저 확인." | ✅ "먼저 확인" |
| lsp | "CAD 함수 탐색. 도메인 목록, 함수 시그니처, 스키마 조회." | N/A (조회 도구) |
| bash | "명령 실행. 씬 조회(info/tree/groups), 내보내기(capture/svg/json)." | N/A (명령 도구) |

### Testing Standards

- **수동 테스트 중심**: 자동화 어려움 (LLM 행동 패턴 관찰)
- **성공 기준**: Read-first 패턴 > 95% 준수 (관찰)
- **실패 기준**: read 없이 edit/write 호출이 빈번하면 Description 조정 필요

### References

- [Source: docs/architecture.md#Part 3: AX Improvement (Epic 10)]
- [Source: docs/epics.md#Story 10.8: AX 검증 및 문서화]
- [Source: docs/ax-design-guide.md] - AX 설계 원칙
- [Source: CLAUDE.md] - 업데이트 대상

### Previous Story Intelligence (10-1 ~ 10-7)

- 10-1 glob: 파일 목록 조회 구현
- 10-2 read: Read-first 패턴 유도 핵심 도구
- 10-3 edit: Read-first 추적 시스템, 경고 메시지
- 10-4 write: 덮어쓰기 경고, Read-first 유도
- 10-5 lsp: 코드 인텔리전스 조회
- 10-6 bash: 씬 조회/내보내기 명령
- 10-7 legacy-tool-removal: 레거시 제거 완료

### 의존성

- **10-1 ~ 10-7 완료 필수**: 모든 신규 도구 구현 및 레거시 제거
- **CLAUDE.md**: 기존 문서 내용 파악 후 업데이트

### 리스크 및 주의사항

1. **수동 테스트 한계**: LLM 행동 패턴은 자동화 테스트 어려움
2. **Description 효과 불확실**: Description만으로 LLM 행동 100% 유도 불가
3. **환경 차이**: 다른 LLM 모델에서는 다른 행동 패턴 가능
4. **CLAUDE.md 누락**: 업데이트 누락 시 진입점 무결성 위반

### Epic 10 DoD 체크리스트

- [ ] 6개 신규 도구 (glob, read, edit, write, lsp, bash) 구현 완료
- [ ] 레거시 도구 (cad_code, discovery, scene, export, module) 제거
- [ ] CLAUDE.md 업데이트 완료
- [ ] 기존 테스트 100% 통과
- [ ] Read-first 패턴 검증 (수동 테스트)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List

- `CLAUDE.md` (수정: 새 도구 가이드)
- `docs/sprint-artifacts/sprint-status.yaml` (수정: Epic 10 완료 표시)
