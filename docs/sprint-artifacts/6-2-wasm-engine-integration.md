# Story 6.2: WASM 엔진 통합

Status: backlog

## Story

As a **개발자**,
I want **WASM CAD 엔진을 Electron Renderer에서 직접 로드하도록**,
so that **채팅에서 CAD 명령을 실행할 수 있다**.

## Acceptance Criteria

1. **AC1: WASM 로딩**
   - Given: Electron 앱이 시작된 상태
   - When: Renderer 프로세스 초기화
   - Then: cad-engine WASM 모듈이 정상적으로 로드된다
   - And: Scene 클래스를 인스턴스화할 수 있다

2. **AC2: 앱 시작 시간 (NFR16)**
   - Given: Electron 앱 실행
   - When: 앱 시작부터 UI 표시까지
   - Then: 5초 이내에 앱이 시작된다

3. **AC3: CAD 명령 실행**
   - Given: WASM 로드 완료
   - When: draw_circle, translate 등 CAD 명령 실행
   - Then: 정상적으로 도형이 생성/수정된다
   - And: scene.json이 업데이트된다

4. **AC4: cad-cli.ts 재사용**
   - Given: 기존 cad-tools/cad-cli.ts 존재
   - When: Electron에서 CAD 명령 실행
   - Then: 기존 CLI 로직을 재사용한다
   - Note: 또는 동일한 WASM 바인딩 직접 호출

5. **AC5: 메모리 기반 렌더링**
   - Given: CAD 명령 실행
   - When: Scene 상태 변경
   - Then: 메모리에서 직접 Canvas에 렌더링된다
   - And: 파일 폴링 불필요

6. **AC6: 오프라인 동작 (NFR17)**
   - Given: 네트워크 연결 없음
   - When: CAD 명령 실행
   - Then: 도형 생성/편집이 정상 동작한다
   - And: API 키가 없어도 CAD 기능은 작동한다

7. **AC7: 에러 핸들링**
   - Given: WASM 로드 중 오류 발생
   - When: 모듈 로드 실패
   - Then: 사용자에게 오류 메시지가 표시된다
   - And: 앱이 크래시하지 않는다

## Tasks / Subtasks

- [ ] **Task 1: WASM 모듈 복사** (AC: 1)
  - [ ] 1.1: cad-engine/pkg/*.wasm 파일을 electron-app/에 복사
  - [ ] 1.2: 빌드 스크립트에 복사 단계 추가
  - [ ] 1.3: package.json postbuild 스크립트 설정

- [ ] **Task 2: Node.js에서 WASM 로드** (AC: 1, 7)
  - [ ] 2.1: @aspect-build/rules_js 또는 직접 fs.readFile 사용
  - [ ] 2.2: WebAssembly.instantiate로 모듈 초기화
  - [ ] 2.3: wasm-bindgen glue 코드 로드
  - [ ] 2.4: 에러 핸들링 (try-catch)

- [ ] **Task 3: CAD 엔진 래퍼** (AC: 3, 4)
  - [ ] 3.1: src/main/cad-engine.ts 생성
  - [ ] 3.2: Scene 인스턴스 관리
  - [ ] 3.3: draw_*, translate, rotate 등 래퍼 함수
  - [ ] 3.4: cad-cli.ts 로직 재사용 또는 직접 구현

- [ ] **Task 4: 메모리 직접 렌더링** (AC: 5)
  - [ ] 4.1: Scene 상태 변경 시 Canvas 직접 업데이트
  - [ ] 4.2: 파일 I/O 불필요 (메모리에서 직접)
  - [ ] 4.3: Export는 필요 시에만 (다운로드용)

- [ ] **Task 5: Renderer 통합** (AC: 3)
  - [ ] 5.1: WASM + Claude API + Canvas 모두 Renderer에서 실행
  - [ ] 5.2: IPC 불필요 (웹 버전과 코드 100% 동일)
  - [ ] 5.3: Main Process는 창 생성만 담당

- [ ] **Task 6: 시작 시간 최적화** (AC: 2)
  - [ ] 6.1: WASM 로드 비동기 처리
  - [ ] 6.2: UI 먼저 표시, WASM은 백그라운드 로드
  - [ ] 6.3: 로딩 인디케이터 표시

- [ ] **Task 7: 테스트** (AC: 1, 2, 3, 5, 6, 7)
  - [ ] 7.1: WASM 로드 성공 테스트
  - [ ] 7.2: Scene 인스턴스화 테스트
  - [ ] 7.3: draw_circle 실행 테스트
  - [ ] 7.4: scene.json 생성 확인
  - [ ] 7.5: 앱 시작 시간 측정 (< 5초)
  - [ ] 7.6: 오프라인 모드 테스트

## Dev Notes

### Architecture Compliance

**Client-Direct Architecture:**

- Renderer 프로세스: WASM 로드, Claude API 호출, Canvas 렌더링 - 전부 직접 처리
- Main 프로세스: 창 생성, 파일 다이얼로그 (Export 시) - 최소 역할만
- IPC 불필요: 웹 버전과 코드 100% 동일

**오프라인 우선:**

- CAD 기능은 완전히 로컬에서 동작
- API 키는 채팅 기능에만 필요

### Technical Requirements

1. **WASM 로드 방식 (Renderer/Browser)**:

   ```typescript
   // src/renderer/cad-engine.ts
   import init, { Scene } from '../wasm/cad_engine.js';

   let scene: Scene | null = null;

   export async function initCADEngine() {
       await init();  // WASM 초기화
       scene = new Scene('default');
       return true;
   }

   export function drawCircle(name: string, x: number, y: number, radius: number) {
       return scene?.add_circle(name, x, y, radius);
   }

   export function getSceneData() {
       return scene?.export_json();  // 메모리에서 직접
   }
   ```

2. **Client-Direct Architecture**:

   ```
   ┌─ Electron Renderer (= 브라우저) ─────────────────────────┐
   │                                                          │
   │  WASM CAD Engine (브라우저에서 직접 로드)                │
   │         ↓                                                │
   │  Scene 상태 (메모리)                                     │
   │         ↓                                                │
   │  Canvas 렌더링 (메모리에서 직접)                         │
   │                                                          │
   │  ※ Main Process 경유 안 함                              │
   │  ※ 파일 폴링 불필요                                     │
   │  ※ 웹 버전과 코드 100% 동일                             │
   └──────────────────────────────────────────────────────────┘
   ```

3. **채팅 → CAD 명령 흐름**:
   - Renderer에서 Claude API 직접 호출 (fetch)
   - Claude 응답에서 tool_use 추출
   - Renderer에서 WASM 직접 실행
   - 메모리에서 Canvas 직접 렌더링 (파일 I/O 없음)

4. **시작 시간 최적화**:
   - 창 먼저 표시 (빈 상태)
   - WASM 로드는 비동기로 진행
   - 로딩 완료 후 CAD 기능 활성화
   - 로딩 중 인디케이터 표시

### File Structure Notes

수정 대상 파일:

- `electron-app/src/renderer/cad-engine.ts` - CAD 엔진 래퍼 (새 파일)
- `electron-app/src/renderer/app.ts` - WASM 초기화 로직
- `electron-app/src/main/index.ts` - 창 생성만 (최소 역할)
- Note: preload.ts 불필요 (IPC 미사용)

복사 대상:

- `cad-engine/pkg/*` → `electron-app/src/renderer/wasm/` (Renderer에서 로드)

### References

- [Source: docs/architecture.md#Direct-First Architecture]
- [Source: docs/epics.md#Story 6.2: WASM 엔진 통합]
- [Source: cad-engine/pkg/ - WASM 빌드 결과물]

## Dev Agent Record

### Context Reference

- docs/architecture.md (Direct-First)
- docs/epics.md (Epic 6, Story 6.2)
- cad-engine/pkg/

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
