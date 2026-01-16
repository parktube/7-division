# Story 10.10: HMR 스타일 코드 실행

Status: drafted

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
edit → main.js 저장 → reset() + 실행 → 브로드캐스트 (저장 안 함)
                      ↑ 매번 clean 상태
```

- 매번 reset() 후 main.js 재실행
- scene.json 저장 제거
- main.js가 유일한 진실의 원천 (Single Source of Truth)

## Acceptance Criteria

1. **AC1: 누적 변환 방지**
   - Given: main.js에 `translate('entity', 10, 0)` 코드가 있을 때
   - When: edit 도구로 코드를 수정하면
   - Then: 씬이 먼저 reset되고 main.js가 재실행된다
   - And: translate는 한 번만 적용된다 (누적 아님)

2. **AC2: MCP 재시작 시 main.js 실행**
   - Given: MCP 서버가 재시작될 때
   - When: main.js 파일이 존재하면
   - Then: main.js를 실행하여 씬을 복원한다
   - And: scene.json에서 복원하지 않는다

3. **AC3: 수동 reset 동작 유지**
   - Given: bash reset 명령을 실행할 때
   - When: 씬이 초기화되면
   - Then: main.js는 재실행되지 않는다 (수동 reset 의도 존중)

4. **AC4: scene.json 저장 제거**
   - Given: edit/write 도구 실행 후
   - When: 코드 실행이 성공하면
   - Then: scene.json 파일에 저장하지 않는다
   - And: WebSocket 브로드캐스트만 수행한다

## Tasks / Subtasks

- [ ] **Task 1: executeRunCadCode 수정**
  - [ ] 1.1 실행 전 reset() 호출 추가
  - [ ] 1.2 saveScene() 호출 제거

- [ ] **Task 2: MCP 서버 시작 로직 수정**
  - [ ] 2.1 loadScene() 호출 제거
  - [ ] 2.2 main.js 존재 시 실행으로 변경

- [ ] **Task 3: bash reset 동작 분리**
  - [ ] 3.1 수동 reset과 자동 reset 구분 (main.js 재실행 안 함)

- [ ] **Task 4: 테스트**
  - [ ] 4.1 translate 누적 테스트
  - [ ] 4.2 MCP 재시작 복원 테스트
  - [ ] 4.3 bash reset 동작 테스트

## Dev Notes

### 핵심 변경 사항

| 항목 | Before | After |
|------|--------|-------|
| 실행 전 상태 | scene.json 로드 (누적) | reset() (clean) |
| 실행 후 저장 | scene.json 저장 | 저장 안 함 |
| 진실의 원천 | scene.json | main.js |
| MCP 재시작 시 | scene.json 로드 | main.js 실행 |

### 구현 위치

**1. executeRunCadCode 수정 (mcp-server.ts:183)**

```typescript
async function executeRunCadCode(code: string) {
  const exec = getExecutor();

  // HMR 스타일: 매번 clean 상태에서 시작
  exec.exec('reset', {});

  const result = await runCadCode(exec, preprocessed.code, 'warn');

  if (result.success) {
    const sceneJson = exec.exportScene();
    const scene = JSON.parse(sceneJson);
    wsServer.broadcastScene(scene);
    // saveScene(exec);  // 제거!
  }

  return result;
}
```

**2. MCP 서버 시작 로직 (mcp-server.ts:231)**

```typescript
export async function createMCPServer(): Promise<Server> {
  const exec = getExecutor();

  // 기존: scene.json 로드
  // const restored = loadScene(exec);

  // 새로운: main.js 실행으로 복원
  if (existsSync(SCENE_CODE_FILE)) {
    const mainCode = readFileSync(SCENE_CODE_FILE, 'utf-8');
    const preprocessed = preprocessCode(mainCode);
    if (preprocessed.errors.length === 0) {
      await runCadCode(exec, preprocessed.code, 'warn');
    }
  }

  // ... rest of the code
}
```

### 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `mcp-server.ts` | executeRunCadCode에 reset 추가, saveScene 제거 |
| `mcp-server.ts` | createMCPServer에서 loadScene → main.js 실행 |

### 예상 효과

1. **누적 문제 완전 해결**: 매번 clean 상태에서 시작
2. **단일 진실의 원천**: main.js가 유일한 소스
3. **아키텍처 단순화**: scene.json 의존성 제거
4. **HMR 패러다임**: 웹 개발자에게 익숙한 패턴

### 주의 사항

- bash reset: 수동 의도 존중, main.js 재실행 안 함
- 모듈 시스템: import 'module' 방식은 유지됨
- 에러 시 롤백: 기존 트랜잭션 롤백 로직 유지

## References

- [Architecture - HMR 스타일 실행](../architecture.md#38-hmr-스타일-코드-실행-story-1010)
- [Epics - Story 10.10](../epics.md#story-1010-hmr-스타일-코드-실행)
