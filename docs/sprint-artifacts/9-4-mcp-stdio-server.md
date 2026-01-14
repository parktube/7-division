# Story 9.4: MCP stdio 서버

Status: drafted

## Story

As a **Claude Code 사용자**,
I want **stdio 기반 MCP 서버가 동작하기를**,
so that **Claude Code에서 CAD 도구를 호출하고 Viewer에 실시간 반영된다** (FR53).

## Acceptance Criteria

1. **Given** Claude Code가 MCP 서버에 연결되었을 때
   **When** run_cad_code 도구를 호출하면
   **Then** WASM 엔진에서 코드가 실행된다
   **And** 결과가 WebSocket으로 Viewer에 브로드캐스트된다 (Story 9.3 의존)

2. **Given** stdio로 JSON-RPC 요청이 들어올 때
   **When** 유효한 MCP 프로토콜이면
   **Then** 도구 목록, 도구 실행, 리소스 접근이 가능하다

3. **Given** describe 명령이 호출될 때
   **When** 도메인 이름이 전달되면
   **Then** 해당 도메인의 함수 목록과 시그니처가 반환된다

4. **Given** stdio와 WebSocket이 동시에 운영될 때
   **When** 도구 호출 결과가 발생하면
   **Then** stdio로 응답을 반환하고
   **And** WebSocket으로 scene_update를 브로드캐스트한다

## Tasks / Subtasks

- [ ] Task 1: MCP SDK 설정 (AC: #2)
  - [ ] 1.1 @modelcontextprotocol/sdk 설치
  - [ ] 1.2 apps/cad-mcp/src/mcp-server.ts 생성
  - [ ] 1.3 Server 인스턴스 생성 (stdio transport)
  - [ ] 1.4 tools/list 핸들러 등록
  - [ ] 1.5 tools/call 핸들러 등록

- [ ] Task 2: 기존 cad-tools 코드 마이그레이션 (AC: #1, #3)
  - [ ] 2.1 sandbox/ 디렉토리 복사 (WASM 실행 로직)
  - [ ] 2.2 run-cad-code/ 핸들러 복사
  - [ ] 2.3 discovery.ts 복사 (describe 명령)
  - [ ] 2.4 schema.ts 복사 (도구 스키마)
  - [ ] 2.5 import 경로 업데이트

- [ ] Task 3: 도구 등록 (AC: #1, #2, #3)
  - [ ] 3.1 run_cad_code 도구 등록
  - [ ] 3.2 describe 도구 등록
  - [ ] 3.3 --status, --info, --search 등 옵션 지원
  - [ ] 3.4 --capture 도구 등록

- [ ] Task 4: WebSocket 브로드캐스트 연동 (AC: #1, #4)
  - [ ] 4.1 CadWebSocketServer 인스턴스 주입
  - [ ] 4.2 도구 실행 후 scene_update 브로드캐스트
  - [ ] 4.3 selection 변경 시 selection 브로드캐스트

- [ ] Task 5: 듀얼 서버 통합 (AC: #4)
  - [ ] 5.1 apps/cad-mcp/src/server.ts 생성 (메인 진입점)
  - [ ] 5.2 stdio 서버 + WebSocket 서버 동시 시작
  - [ ] 5.3 graceful shutdown 구현
  - [ ] 5.4 CLI 인터페이스 (start 명령)

- [ ] Task 6: 테스트 (AC: #1~#4)
  - [ ] 6.1 도구 목록 반환 테스트
  - [ ] 6.2 run_cad_code 실행 테스트
  - [ ] 6.3 describe 명령 테스트
  - [ ] 6.4 WebSocket 브로드캐스트 연동 테스트
  - [ ] 6.5 기존 cad-tools 테스트 마이그레이션

## Dev Notes

### Architecture Compliance

**Source:** [docs/architecture.md Part 2.4]

stdio + WebSocket 듀얼 서버 아키텍처:

```
Claude Code ──stdio──▶ MCP Server ──WebSocket──▶ Viewer (Web)
                           │
                      WASM Engine
                      File System
```

### Technical Requirements

**듀얼 서버 클래스:**

```typescript
// apps/cad-mcp/src/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CadWebSocketServer } from './websocket-server.js';

export class CadMcpServer {
  private mcpServer: Server;
  private wsServer: CadWebSocketServer;
  private engine: CadEngine;

  async start() {
    // 1. WebSocket 서버 시작
    const port = await this.wsServer.start();
    console.error(`WebSocket server running on ws://127.0.0.1:${port}`);

    // 2. stdio 서버 시작
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
  }

  async handleToolCall(name: string, args: unknown) {
    const result = await this.engine.execute(name, args);

    // WebSocket 브로드캐스트
    this.wsServer.broadcast({
      type: 'scene_update',
      data: { entities: result.entities },
      timestamp: Date.now(),
    });

    return result;
  }
}
```

**도구 등록:**

```typescript
// tools/list 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'run_cad_code',
      description: 'Execute CAD code in JavaScript',
      inputSchema: {
        type: 'object',
        properties: {
          module: { type: 'string', description: 'Module name (main, lib, etc.)' },
          code: { type: 'string', description: 'JavaScript code to execute' },
        },
        required: ['module'],
      },
    },
    {
      name: 'describe',
      description: 'Get domain function signatures',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Domain name (primitives, transforms, etc.)' },
        },
        required: ['domain'],
      },
    },
  ],
}));
```

### File Structure

**기존 cad-tools (재활용 대상):**
```
cad-tools/src/
├── sandbox/
│   ├── index.ts      # WASM 실행 컨텍스트
│   ├── text.ts       # 텍스트 렌더링
│   └── manifold.ts   # Boolean/기하 연산
├── run-cad-code/
│   ├── handlers.ts   # 명령 핸들러
│   └── index.ts      # 메인 로직
├── discovery.ts      # describe 명령
├── schema.ts         # 도구 스키마
└── cli.ts            # CLI 진입점
```

**신규 apps/cad-mcp:**
```
apps/cad-mcp/src/
├── server.ts              # 메인 진입점 (듀얼 서버)
├── mcp-server.ts          # stdio MCP 서버
├── websocket-server.ts    # WebSocket 서버 (Story 9.3)
├── engine/
│   ├── index.ts           # WASM 엔진 래퍼
│   └── sandbox/           # cad-tools/src/sandbox/ 복사
├── tools/
│   ├── run-cad-code.ts    # run_cad_code 도구
│   └── describe.ts        # describe 도구
└── cli.ts                 # CLI (start 명령)
```

### Dependencies

- **선행 스토리**: Story 9.3 (WebSocket 서버)
- **후행 스토리**: Story 9.6 (npm 패키지 배포)

**npm 패키지:**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": ">=1.25.2",
    "ws": "^8.x"
  }
}
```

### MCP Protocol Notes

**stdio 통신:**
- stdin: JSON-RPC 요청 수신
- stdout: JSON-RPC 응답 전송
- stderr: 로그 출력 (디버깅용)

**보안 고려사항 (SDK 문서 기준):**
- MCP SDK는 보안 모델을 강제하지 않음
- 서버 구현자가 입력 검증, 권한 체크 책임
- 이 프로젝트: localhost-only, 파일 시스템 접근 제한 (~/.ai-native-cad)

### Testing Requirements

**기존 테스트 마이그레이션:**
```bash
# cad-tools 테스트 실행 (참조)
cd cad-tools && npm test

# 마이그레이션 후
cd apps/cad-mcp && pnpm test
```

**통합 테스트:**
```bash
# MCP 서버 시작
cd apps/cad-mcp && node dist/cli.js start

# Claude Code 설정 (~/.config/claude/mcp.json)
{
  "mcpServers": {
    "ai-native-cad": {
      "command": "node",
      "args": ["/path/to/apps/cad-mcp/dist/cli.js", "start"]
    }
  }
}
```

### Potential Risks

| 위험 | 완화 전략 |
|------|----------|
| 코드 마이그레이션 오류 | 기존 테스트 100% 통과 확인 |
| MCP SDK 버전 호환성 | SDK 버전 고정 (^1.x) |
| stdio/WebSocket 동기화 | 단일 엔진 인스턴스로 상태 공유 |
| WASM 경로 문제 | 상대 경로 → 절대 경로 변환 |

### References

- [Source: docs/architecture.md#2.4] - MCP Server Architecture
- [Source: docs/epics.md#Story-9.4] - Story 정의 및 AC
- [Source: cad-tools/src/] - 기존 구현 (재활용 대상)
- [MCP SDK Docs] - @modelcontextprotocol/sdk 사용법

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

