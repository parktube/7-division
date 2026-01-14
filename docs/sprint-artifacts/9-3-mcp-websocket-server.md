# Story 9.3: MCP WebSocket 서버

Status: done

## Story

As a **MCP 서버 개발자**,
I want **WebSocket 서버를 구현하기를**,
so that **Viewer가 실시간으로 scene 업데이트를 받을 수 있다** (FR54).

## Acceptance Criteria

1. **Given** MCP 서버가 시작될 때
   **When** WebSocket 서버가 ws://127.0.0.1:3001에서 리슨하면
   **Then** Viewer 클라이언트가 연결할 수 있다
   **And** 127.0.0.1만 바인딩된다 (보안)

2. **Given** 클라이언트가 연결되었을 때
   **When** 초기 연결 후
   **Then** 현재 scene/selection 상태가 즉시 전송된다
   **And** 핸드셰이크 메시지(connection)가 전송된다

3. **Given** 여러 클라이언트가 연결되었을 때
   **When** scene이 업데이트되면
   **Then** 모든 클라이언트에 브로드캐스트된다

4. **Given** 클라이언트가 ping을 보낼 때
   **When** 서버가 수신하면
   **Then** pong 응답이 반환된다 (heartbeat)

5. **Given** 포트 3001이 사용 중일 때
   **When** 서버가 시작하면
   **Then** 3002, 3003 순서로 자동 탐색한다
   **And** 사용 가능한 포트로 바인딩된다

## Tasks / Subtasks

- [x] Task 1: WebSocket 서버 기본 구조 (AC: #1)
  - [x] 1.1 apps/cad-mcp/src/ws-server.ts 생성
  - [x] 1.2 ws 라이브러리 설치 (pnpm add ws @types/ws)
  - [x] 1.3 CADWebSocketServer 클래스 구현 (start, stop 메서드)
  - [x] 1.4 127.0.0.1 바인딩 설정 (localhost-only 보안)
  - [x] 1.5 포트 자동 탐색 로직 (3001→3002→3003)

- [x] Task 2: 클라이언트 연결 관리 (AC: #2, #3)
  - [x] 2.1 클라이언트 연결 이벤트 핸들러
  - [x] 2.2 클라이언트 목록 관리 (Set<WebSocket>)
  - [x] 2.3 연결 시 핸드셰이크 메시지 전송 (connection 타입)
  - [x] 2.4 연결 시 현재 scene/selection 상태 전송
  - [x] 2.5 연결 종료 이벤트 핸들러 (cleanup)

- [x] Task 3: 브로드캐스트 기능 (AC: #3)
  - [x] 3.1 broadcastScene/broadcastSelection 메서드 구현
  - [x] 3.2 연결된 모든 클라이언트에 메시지 전송
  - [x] 3.3 전송 실패 클라이언트 처리 (연결 종료)

- [x] Task 4: Heartbeat 구현 (AC: #4)
  - [x] 4.1 ping 메시지 수신 핸들러
  - [x] 4.2 pong 메시지 응답 전송
  - [x] 4.3 클라이언트 타임아웃 감지 (30초 무응답 시 연결 종료)
    - ✅ 15초 간격 heartbeat ping, 30초 무응답 시 ws.terminate() 호출

- [x] Task 5: 메시지 검증 (AC: #2, #3, #4)
  - [x] 5.1 packages/shared의 Zod 스키마 import
  - [x] 5.2 수신 메시지 safeValidateMessage 적용
  - [x] 5.3 검증 실패 시 로깅

- [x] Task 6: 테스트 (AC: #1~#5)
  - [x] 6.1 WebSocket 서버 시작/종료 테스트
  - [x] 6.2 클라이언트 연결/해제 테스트
  - [x] 6.3 브로드캐스트 테스트
  - [x] 6.4 포트 충돌 시 자동 탐색 테스트
    - ✅ 2개 테스트 추가: "should try next port when default port is in use", "should throw when all ports are in use"

### Review Follow-ups (AI)

> 코드 리뷰 날짜: 2026-01-14 | 리뷰어: Claude Opus 4.5

**🔴 HIGH (반드시 수정)**
- [x] [AI-Review][HIGH] Status를 "done"으로 업데이트 필요 [9-3-mcp-websocket-server.md:3]
- [x] [AI-Review][HIGH] 모든 Tasks/Subtasks를 [x]로 마킹 필요 [9-3-mcp-websocket-server.md:38-72]
- [x] [AI-Review][HIGH] File List에 변경된 5개 파일 추가 필요

**🟡 MEDIUM (권장 수정) - 코드 품질**
- [x] [AI-Review][MEDIUM] `MCP_VERSION = '0.1.0'` 하드코딩 - package.json과 동기화 필요 [ws-server.ts:22]
  - ✅ package.json에서 동적으로 버전 읽도록 수정
- [x] [AI-Review][MEDIUM] 에러 케이스 테스트 부족 - 잘못된 메시지, 연결 실패 시나리오 [ws-server.test.ts]
  - ✅ 3개 에러 테스트 추가: "invalid JSON", "invalid message types", "broadcast error messages"

**🟢 LOW (개선 권장)**
- [x] [AI-Review][LOW] EADDRINUSE 조건 분기 불필요 - 동일하게 reject 처리 [ws-server.ts:72-77]
  - ✅ 불필요한 분기 제거
- [x] [AI-Review][LOW] 클라이언트 연결 수 제한 없음 - 로컬이라 낮은 위험
  - ✅ MAX_CLIENTS = 10 제한 추가, getMaxClients() 메서드 구현

## Dev Notes

### Architecture Compliance

**Source:** [docs/architecture.md Part 2.4]

WebSocket 서버는 MCP stdio 서버(Story 9.4)와 함께 듀얼 서버로 동작합니다.

```
Claude Code ──stdio──▶ MCP Server ──WebSocket──▶ Viewer (Web)
                           │
                      WASM Engine
                      File System
```

### Technical Requirements

**WebSocket 서버 클래스:**

```typescript
// apps/cad-mcp/src/websocket-server.ts
import { WebSocketServer, WebSocket } from 'ws';
import { WSMessage, validateMessage } from '@ai-native-cad/shared';

export class CadWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private port: number = 3001;

  async start(): Promise<number> {
    // 포트 자동 탐색 (3001→3002→3003→3004)
    for (const port of [3001, 3002, 3003, 3004]) {
      try {
        await this.tryBind(port);
        this.port = port;
        return port;
      } catch (e) {
        continue;
      }
    }
    throw new Error('No available port');
  }

  private tryBind(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({
        port,
        host: '127.0.0.1', // localhost-only (보안)
      });
      this.wss.on('error', reject);
      this.wss.on('listening', resolve);
    });
  }

  broadcast(message: WSMessage): void {
    try {
      const data = JSON.stringify(message);
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(data);
          } catch (e) {
            // 전송 실패 클라이언트는 제거 (Task 3.3 참조)
            this.clients.delete(client);
          }
        }
      }
    } catch (e) {
      console.error('Failed to serialize message:', e);
    }
  }

  stop(): void {
    this.wss?.close();
  }
}
```

**핸드셰이크 메시지:**

```typescript
interface ConnectionMessage {
  type: 'connection';
  data: {
    mcpVersion: string;       // "1.0.0"
    protocolVersion: number;  // 1
    minViewerVersion: string; // "1.0.0"
  };
  timestamp: number;
}
```

**포트/프로토콜:**

| 통신 | 프로토콜 | 용도 |
|------|---------|------|
| Claude Code ↔ MCP | stdio | MCP 도구 호출 (Story 9.4) |
| MCP ↔ Viewer | WebSocket (3001) | 실시간 동기화 |

### File Structure

```
apps/cad-mcp/src/
├── websocket-server.ts    # WebSocket 서버 (이 스토리)
├── mcp-server.ts          # stdio 서버 (Story 9.4)
├── server.ts              # 메인 진입점 (듀얼 서버 통합)
└── engine/                # WASM 엔진 래퍼
```

### Dependencies

- **선행 스토리**: Story 9.1 (모노레포 - packages/shared 필요)
- **후행 스토리**: Story 9.4 (stdio 서버 - WebSocket 브로드캐스트 사용)

**npm 패키지:**
```json
{
  "dependencies": {
    "ws": "^8.x"
  },
  "devDependencies": {
    "@types/ws": "^8.x"
  }
}
```

### Security Requirements

| 항목 | 요구사항 |
|------|---------|
| 바인딩 | 127.0.0.1 only (0.0.0.0 금지) |
| 인증 | 없음 (로컬 개발 도구) |
| CORS | Origin 체크 없음 (localhost) |

### Testing Requirements

**단위 테스트:**
```bash
cd apps/cad-mcp && pnpm test
```

**수동 테스트:**
```bash
# 서버 시작
node -e "
const { CadWebSocketServer } = require('./dist/websocket-server');
const server = new CadWebSocketServer();
server.start().then(port => console.log('Running on port', port));
"

# 클라이언트 연결 (wscat)
wscat -c ws://127.0.0.1:3001
```

### Previous Implementation Intelligence

**기존 cad-tools 참조:**
- `cad-tools/src/sandbox/` - WASM 실행 로직 (Story 9.4에서 재활용)

### Potential Risks

| 위험 | 완화 전략 |
|------|----------|
| 포트 충돌 | 3001→3002→3003→3004 자동 탐색 |
| 연결 누수 | Set<WebSocket>에서 종료된 클라이언트 제거 |
| 대용량 메시지 | maxPayload 설정 (10MB) |
| 메모리 누수 | 클라이언트 종료 시 리스너 정리 |

### References

- [Source: docs/architecture.md#2.4] - MCP Server Architecture
- [Source: docs/epics.md#Story-9.3] - Story 정의 및 AC
- [Source: packages/shared/src/schemas.ts] - Zod 스키마

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

**변경된 파일 (4개):**

```
apps/cad-mcp/src/ws-server.ts       # WebSocket 서버 구현 (heartbeat, client limit 추가)
apps/cad-mcp/src/index.ts           # export 추가
apps/cad-mcp/tests/ws-server.test.ts # 테스트 (13개: 기본 7 + 포트탐색 2 + 에러처리 3 + 클라이언트제한 1)
apps/cad-mcp/package.json           # ws 의존성 추가
```

