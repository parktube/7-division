# Story 9.2: WebSocket Hook 구현

Status: drafted

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

- [ ] Task 1: WebSocket 연결 관리 클래스 구현 (AC: #1, #2)
  - [ ] 1.1 WebSocketManager 클래스 생성 (apps/viewer/src/lib/websocket-manager.ts)
  - [ ] 1.2 연결 상태 enum 정의 (connecting, connected, disconnected, error)
  - [ ] 1.3 connect/disconnect/send 메서드 구현
  - [ ] 1.4 자동 재연결 로직 구현 (지수 백오프)
  - [ ] 1.5 cleanup/dispose 메서드 구현

- [ ] Task 2: Zod 메시지 스키마 정의 (AC: #3)
  - [ ] 2.1 packages/shared에서 스키마 import 설정
  - [ ] 2.2 WSMessage 타입 정의 (scene_update, selection, connection, error, ping, pong)
  - [ ] 2.3 validateMessage 함수 구현

- [ ] Task 3: useWebSocket 훅 구현 (AC: #1, #3)
  - [ ] 3.1 useWebSocket 커스텀 훅 생성 (apps/viewer/src/hooks/useWebSocket.ts)
  - [ ] 3.2 연결 상태(connectionStatus) 반환
  - [ ] 3.3 scene 데이터 반환
  - [ ] 3.4 selection 데이터 반환
  - [ ] 3.5 send 함수 반환 (메시지 전송용)
  - [ ] 3.6 useSyncExternalStore 패턴 적용 (React 19 호환)

- [ ] Task 4: 기존 폴링 로직 대체 준비 (AC: #3)
  - [ ] 4.1 SceneStore 연동 인터페이스 설계
  - [ ] 4.2 WebSocket 메시지 → SceneStore 업데이트 브릿지
  - [ ] 4.3 기존 폴링 비활성화 플래그 추가 (feature flag)

- [ ] Task 5: 테스트 (AC: #1, #2, #3)
  - [ ] 5.1 WebSocketManager 단위 테스트
  - [ ] 5.2 useWebSocket 훅 테스트 (vitest + react-testing-library)
  - [ ] 5.3 재연결 시나리오 테스트
  - [ ] 5.4 메시지 검증 실패 케이스 테스트

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

