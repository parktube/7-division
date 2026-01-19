# Story 10.10: HMR 스타일 코드 실행

Status: done

## Story

As a **LLM 에이전트**,
I want **코드 수정 시 매번 clean 상태에서 재실행되기를**,
So that **translate() 등 누적 변환이 발생하지 않는다** (FR66).

## Background

### 문제

현재 아키텍처에서 edit/write 도구 사용 시:

```
edit → main.js 저장 → 실행 → scene.json에 누적 저장
                              ↑ translate()가 누적됨
```

- 코드에 `translate('entity', 10, 0)`가 있으면
- 매 edit마다 translate가 추가 적용됨
- 결과: 의도치 않은 위치 이동

### 해결

HMR (Hot Module Replacement) 스타일 실행:

```
edit → main.js 저장 → reset() + 실행 → 브로드캐스트 + scene.json 저장
                      ↑ 매번 clean 상태
```

- 매번 reset() 후 main.js 재실행
- scene.json은 계속 동기화 (뷰어 복원용)
- main.js가 실행의 진실의 원천 (Single Source of Truth)

## Acceptance Criteria

1. **AC1: 누적 변환 방지**
   - Given: main.js에 `translate('entity', 10, 0)` 코드가 있을 때
   - When: edit 도구로 코드를 수정하면
   - Then: 씬이 먼저 reset되고 main.js가 재실행된다
   - And: translate는 한 번만 적용된다 (누적 아님)

2. **AC2: MCP 재시작 시 복원 전략**
   - Given: MCP 서버가 재시작될 때
   - When: main.js 파일이 존재하면
   - Then: main.js를 실행하여 씬을 복원한다
   - When: main.js가 없거나 실행 실패 시
   - Then: scene.json에서 폴백 복원한다

3. **AC3: 수동 reset 동작 유지**
   - Given: bash reset 명령을 실행할 때
   - When: 씬이 초기화되면
   - Then: main.js는 재실행되지 않는다 (수동 reset 의도 존중)
   - And: scene.json은 빈 씬으로 업데이트된다

4. **AC4: scene.json 동기화 유지**
   - Given: edit/write 도구 실행 후
   - When: 코드 실행이 성공하면
   - Then: scene.json에도 저장한다 (뷰어 복원용)
   - And: WebSocket 브로드캐스트도 수행한다

5. **AC5: 롤백 시 씬 복원**
   - Given: edit/write 후 코드 실행이 실패할 때
   - When: 파일이 롤백되면
   - Then: 원본 코드가 재실행되어 씬이 복원된다
   - And: 사용자는 실패 전 상태를 본다

## Tasks / Subtasks

- [ ] **Task 1: executeRunCadCode 수정**
  - [ ] 1.1 실행 전 reset() 호출 추가
  - [ ] 1.2 saveScene() 유지 (scene.json 동기화)

- [ ] **Task 2: MCP 서버 시작 로직 수정**
  - [ ] 2.1 main.js 존재 시 실행으로 복원
  - [ ] 2.2 main.js 실패/없음 시 scene.json 폴백

- [ ] **Task 3: 롤백 시 씬 복원**
  - [ ] 3.1 코드 실행 실패 시 원본 재실행
  - [ ] 3.2 롤백 후 broadcastScene() + saveScene() 호출

- [ ] **Task 4: bash reset 동작 확인**
  - [ ] 4.1 수동 reset은 main.js 재실행 안 함 (기존 동작 유지)

- [ ] **Task 5: 테스트**
  - [ ] 5.1 translate 누적 테스트
  - [ ] 5.2 MCP 재시작 복원 테스트 (main.js 우선)
  - [ ] 5.3 롤백 후 씬 복원 테스트
  - [ ] 5.4 bash reset 동작 테스트

## Dev Notes

### 핵심 변경 사항

| 항목 | Before | After |
|------|--------|-------|
| 실행 전 상태 | 이전 씬 유지 (누적) | reset() (clean) |
| 실행 후 저장 | scene.json 저장 | scene.json 저장 (유지) |
| 진실의 원천 | scene.json | main.js (실행), scene.json (폴백) |
| MCP 재시작 시 | scene.json 로드 | main.js 실행 → scene.json 폴백 |
| 롤백 시 | 파일만 복원 | 파일 복원 + 원본 재실행 |

### 구현 위치

**1. executeRunCadCode 수정 (mcp-server.ts:183)**

```typescript
async function executeRunCadCode(code: string) {
  const exec = getExecutor();

  // HMR 스타일: 매번 clean 상태에서 시작
  exec.exec('reset', {});

  const preprocessed = preprocessCode(code);
  if (preprocessed.errors.length > 0) {
    return { success: false, error: preprocessed.errors[0] };
  }

  const result = await runCadCode(exec, preprocessed.code, 'warn');

  if (result.success) {
    const sceneJson = exec.exportScene();
    const scene = JSON.parse(sceneJson);
    wsServer.broadcastScene(scene);
    saveScene(exec);  // scene.json 동기화 유지
  }

  return result;
}
```

**2. MCP 서버 시작 로직 (mcp-server.ts:231)**

```typescript
export async function createMCPServer(): Promise<Server> {
  const exec = getExecutor();
  let restored = false;

  // 1차: main.js 실행으로 복원 시도
  if (existsSync(SCENE_CODE_FILE)) {
    const mainCode = readFileSync(SCENE_CODE_FILE, 'utf-8');
    const preprocessed = preprocessCode(mainCode);
    if (preprocessed.errors.length === 0) {
      const result = await runCadCode(exec, preprocessed.code, 'warn');
      if (result.success) {
        restored = true;
        logger.info('Scene restored from main.js');
      }
    }
  }

  // 2차: main.js 실패 시 scene.json 폴백
  if (!restored) {
    restored = loadScene(exec);
    if (restored) {
      logger.info('Scene restored from scene.json (fallback)');
    }
  }

  // ... rest of the code
}
```

**3. edit/write 롤백 로직 (mcp-server.ts)**

```typescript
// edit 핸들러 내부
if (!execResult.success) {
  // 파일 롤백
  rollbackEdit(file, originalContent);

  // 원본 코드 재실행으로 씬 복원
  exec.exec('reset', {});
  const origCode = readMainCode();
  const origPreprocessed = preprocessCode(origCode);
  if (origPreprocessed.errors.length === 0) {
    const restoreResult = await runCadCode(exec, origPreprocessed.code, 'warn');
    if (restoreResult.success) {
      const sceneJson = exec.exportScene();
      const scene = JSON.parse(sceneJson);
      wsServer.broadcastScene(scene);
      saveScene(exec);
    }
  }

  return {
    success: false,
    error: execResult.error,
    hint: '코드 실행 실패로 변경이 롤백되었습니다. 씬은 이전 상태로 복원됨.',
  };
}
```

### 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `mcp-server.ts` | executeRunCadCode에 reset() 추가 |
| `mcp-server.ts` | createMCPServer에서 main.js 우선 복원 |
| `mcp-server.ts` | edit/write 롤백 시 원본 재실행 |

### 예상 효과

1. **누적 문제 완전 해결**: 매번 clean 상태에서 시작
2. **안정성 유지**: scene.json 폴백으로 복원 보장
3. **롤백 UX 개선**: 실패해도 이전 씬 상태 유지
4. **HMR 패러다임**: 웹 개발자에게 익숙한 패턴

### 주의 사항

- bash reset: 수동 의도 존중, main.js 재실행 안 함
- 모듈 시스템: import 'module' 방식은 유지됨
- scene.json: 동기화 유지 (뷰어 복원, 폴백용)

## References

- [Architecture - HMR 스타일 실행](../architecture.md#38-hmr-스타일-코드-실행-story-1010)
- [Epics - Story 10.10](../epics.md#story-1010-hmr-스타일-코드-실행)
