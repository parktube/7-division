# Story 9.2: WebSocket Hook 구현

Status: done

## Story

As a **Viewer 개발자**,
I want **useWebSocket 커스텀 훅을 구현하기를**,
so that **MCP 서버와 실시간 통신이 가능하다** (FR52).

## Acceptance Criteria

1. **Given** MCP 서버가 ws://localhost:3001에서 실행 중일 때
   **When** Viewer가 useWebSocket 훅으로 연결하면
   **Then** scene/selection 업데이트가 실시간으로 수신된다
   **And** 연결 상태(connecting, connected, disconnected)가 추적된다

2. **Given** MCP 서버와 연결이 끊어졌을 때
   **When** 자동 재연결이 시도되면
   **Then** 지수 백오프(1s→2s→4s→8s→16s, max 5회)가 적용된다
   **And** 연결 복구 시 최신 상태가 동기화된다

3. **Given** 메시지가 수신될 때
   **When** scene_update 타입이면
   **Then** SceneStore가 업데이트된다
   **And** useWebSocket이 반환하는 scene 상태가 갱신된다

## Tasks / Subtasks

- [x] Task 1: WebSocket 연결 관리 구현 (AC: #1, #2)
  - [x] 1.1 useWebSocket 훅 내 연결 관리 로직 구현 (클래스 대신 훅 패턴 선택)
  - [x] 1.2 연결 상태 타입 정의 (connecting, connected, disconnected)
  - [x] 1.3 connect/reconnect/sendPing 메서드 구현
  - [x] 1.4 자동 재연결 로직 구현 (지수 백오프 1s→2s→4s→8s→16s, max 5회)
  - [x] 1.5 cleanup (useEffect return) 구현

- [x] Task 2: Zod 메시지 스키마 연동 (AC: #3)
  - [x] 2.1 packages/shared에서 스키마 import 설정
  - [x] 2.2 WSMessage 타입 사용 (scene_update, selection, connection, error, ping, pong)
  - [x] 2.3 safeValidateMessage 함수 사용

- [x] Task 3: useWebSocket 훅 구현 (AC: #1, #3)
  - [x] 3.1 useWebSocket 커스텀 훅 생성 (apps/viewer/src/hooks/useWebSocket.ts)
  - [x] 3.2 연결 상태(connectionState) 반환
  - [x] 3.3 scene 데이터 반환
  - [x] 3.4 selection 데이터 반환
  - [x] 3.5 sendPing 함수 반환
  - [x] 3.6 useSyncExternalStore 패턴 적용 (React 19 호환)

- [x] Task 4: App.tsx 연동 (AC: #3)
  - [x] 4.1 App.tsx에서 useWebSocket 훅 사용
  - [x] 4.2 WebSocket 메시지 → 컴포넌트 상태 업데이트
  - [x] 4.3 Onboarding UI 연동 (maxRetriesReached 시 표시)

- [x] Task 5: 테스트 (AC: #1, #2, #3)
  - [x] 5.1 useWebSocket 훅 테스트
    - ✅ tests/hooks/useWebSocket.test.ts 추가 (19개 테스트)
  - [x] 5.2 재연결 시나리오 테스트
    - ✅ exponential backoff, maxRetriesReached, manual reconnect 테스트 포함

### Review Follow-ups (AI)

> 코드 리뷰 날짜: 2026-01-14 | 리뷰어: Claude Opus 4.5

**🔴 HIGH (반드시 수정)**
- [x] [AI-Review][HIGH] Status를 "done"으로 업데이트 필요 [9-2-websocket-hook.md:3]
- [x] [AI-Review][HIGH] 모든 Tasks/Subtasks를 [x]로 마킹 필요 [9-2-websocket-hook.md:30-59]
- [x] [AI-Review][HIGH] File List에 변경된 3개 파일 추가 필요 [9-2-websocket-hook.md:238]

**🟡 MEDIUM (권장 수정) - 코드 품질**
- [x] [AI-Review][MEDIUM] AC #2 불일치: 스토리는 "max 5회" 요구, 구현은 무한 재시도(30s cap) [useWebSocket.ts:16-17]
  - ✅ MAX_RETRY_ATTEMPTS=5 추가, 지수 백오프 1s→2s→4s→8s→16s 구현
- [x] [AI-Review][MEDIUM] useWebSocket 테스트 파일 없음 - apps/viewer 테스트 0개 [apps/viewer/src/hooks/]
  - ✅ tests/hooks/useWebSocket.test.ts 추가 (19개 테스트)
- [x] [AI-Review][MEDIUM] `as Scene` 타입 단언 - Zod 검증 후에도 추가 캐스팅 [useWebSocket.ts:108]
  - ✅ 주석 추가: shared SceneSchema가 geometry: z.unknown() 사용하므로 필요

**🟢 LOW (개선 권장)**
- [x] [AI-Review][LOW] console.warn/error 대신 logger 사용 권장 (브라우저 환경이라 허용 가능) [useWebSocket.ts:102,132]
  - ✅ 브라우저 환경에서 console이 표준 - 현재 구현 유지
- [x] [AI-Review][LOW] WebSocketManager 클래스 분리 - 현재 훅 내 직접 구현 (복잡도 높음)
  - ✅ 현재 구조로 테스트 가능, 리팩토링은 필요 시 진행

---

> 2차 코드 리뷰 날짜: 2026-01-14 | 리뷰어: Claude Opus 4.5

**🟢 LOW (개선 권장)**
- [ ] [AI-Review][LOW] WS_URL 환경변수 분리 권장 - 현재 하드코딩 [useWebSocket.ts:14]
- [ ] [AI-Review][LOW] Heartbeat 응답 타임아웃 미구현 - pong 미수신 시 연결 상태 감지 불가 [useWebSocket.ts]
- [ ] [AI-Review][LOW] Module-level store singleton - 병렬 테스트에 불리 (__resetStoreForTesting으로 완화됨) [useWebSocket.ts:43-46]

## Dev Notes

### Architecture Compliance

**Source:** [docs/architecture.md Part 2.6]

useWebSocket 훅은 MCP 서버와의 실시간 통신을 담당합니다. Story 9.3 (MCP WebSocket 서버)과 함께 동작하며, packages/shared의 Zod 스키마를 공유합니다.

### Technical Requirements

**WebSocket 메시지 포맷:**

```typescript
type WSMessageType = 'scene_update' | 'selection' | 'connection' | 'error' | 'ping' | 'pong';

interface WSMessage {
  type: WSMessageType;
  data: Record<string, unknown>;
  timestamp: number;
}
```

**Zod 스키마 (packages/shared에서 import):**

```typescript
import { z } from 'zod';

const SceneUpdateDataSchema = z.object({
  entities: z.array(z.record(z.unknown())),
});

const SelectionDataSchema = z.object({
  selected: z.array(z.string()),
});

const WSMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('scene_update'),
    data: SceneUpdateDataSchema,
    timestamp: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('selection'),
    data: SelectionDataSchema,
    timestamp: z.number().int().positive(),
  }),
  // ... connection, error, ping, pong
]);

type WSMessage = z.infer<typeof WSMessageSchema>;
```

**재연결 정책 (Exponential Backoff):**

```typescript
class WebSocketManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000; // 1초

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showOnboardingUI();
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    // 1초 → 2초 → 4초 → 8초 → 16초

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
}
```

| 시도 | 대기시간 | 총 경과 |
|------|---------|---------|
| 1 | 1초 | 1초 |
| 2 | 2초 | 3초 |
| 3 | 4초 | 7초 |
| 4 | 8초 | 15초 |
| 5 | 16초 | 31초 |
| 실패 | - | Onboarding UI |

**useWebSocket 훅 인터페이스:**

```typescript
interface UseWebSocketReturn {
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  scene: Entity[] | null;
  selection: string[];
  send: (message: WSMessage) => void;
  reconnect: () => void;
}

function useWebSocket(url: string): UseWebSocketReturn {
  // useSyncExternalStore 패턴으로 React 19 호환
}
```

### File Structure

```
apps/viewer/src/
├── hooks/
│   └── useWebSocket.ts         # 커스텀 훅
├── lib/
│   └── websocket-manager.ts    # WebSocket 연결 관리
└── stores/
    └── scene-store.ts          # 기존 SceneStore (WebSocket 연동 추가)
```

### Dependencies

- **선행 스토리**: Story 9.1 (모노레포 설정 - packages/shared 필요)
- **후행 스토리**: Story 9.3 (MCP WebSocket 서버 - 연결 대상)
- **관련 스토리**: Story 9.7 (온보딩 UI - showOnboardingUI 메서드 사용)

### Testing Requirements

**단위 테스트:**
```bash
cd apps/viewer && pnpm test
```

**통합 테스트 (Story 9.3 완료 후):**
```bash
# MCP 서버 시작
cd apps/cad-mcp && pnpm start

# Viewer에서 WebSocket 연결 확인
cd apps/viewer && pnpm dev
# → ws://localhost:3001 연결 확인
```

### Previous Implementation Intelligence

**기존 폴링 코드 (참조용):**
- `viewer/src/stores/sceneStore.ts` - 100ms interval 폴링
- `viewer/src/hooks/useScenePolling.ts` (있다면)

**WebSocket으로 대체 시 변경점:**
- 폴링 interval 제거
- WebSocket 메시지 이벤트로 SceneStore 업데이트
- 연결 상태 UI 추가 필요

### Potential Risks

| 위험 | 완화 전략 |
|------|----------|
| React 동시성 이슈 | useSyncExternalStore 패턴 사용 |
| 메모리 누수 | useEffect cleanup에서 dispose 호출 |
| 재연결 무한 루프 | maxReconnectAttempts 제한 (5회) |
| 메시지 검증 실패 | Zod 에러 로깅 + graceful 무시 |

### References

- [Source: docs/architecture.md#2.6] - WebSocket Message Format, Error Handling
- [Source: docs/epics.md#Story-9.2] - Story 정의 및 AC
- [Source: packages/shared/src/schemas.ts] - Zod 스키마 (Story 9.1에서 생성)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

**변경된 파일 (7개):**

```
apps/viewer/src/hooks/useWebSocket.ts    # useWebSocket 커스텀 훅
apps/viewer/package.json                 # @testing-library/react, jsdom 추가
apps/viewer/vitest.config.ts             # vitest 설정
apps/viewer/tests/setup.ts               # 테스트 셋업 (MockWebSocket)
apps/viewer/tests/hooks/useWebSocket.test.ts  # useWebSocket 테스트 (19개)
packages/shared/src/index.ts             # WebSocket 타입/스키마 export
packages/shared/src/ws-messages.ts       # Zod 스키마 정의
```

