# Story 6.4: 채팅 UI 구현

Status: drafted

## Story

As a **사용자 (인간)**,
I want **앱 내에서 AI와 대화할 수 있도록**,
so that **별도 터미널 없이 CAD 작업을 할 수 있다**.

## Acceptance Criteria

1. **AC1: 채팅 입력창**
   - Given: Electron 앱 실행
   - When: 우측 패널 확인
   - Then: 메시지 입력창이 표시된다
   - And: Enter 키 또는 전송 버튼으로 메시지를 보낼 수 있다

2. **AC2: 메시지 표시**
   - Given: 사용자가 메시지를 전송
   - When: 채팅 영역 확인
   - Then: 사용자 메시지가 오른쪽 정렬로 표시된다
   - And: AI 응답이 왼쪽 정렬로 표시된다

3. **AC3: Claude API 연동**
   - Given: API 키가 설정된 상태
   - When: 사용자가 메시지 전송
   - Then: Claude API가 호출된다
   - And: 응답이 채팅에 표시된다

4. **AC4: CAD 명령 자동 실행**
   - Given: Claude 응답에 CAD 명령이 포함된 경우
   - When: 응답 수신
   - Then: CAD 명령이 자동으로 실행된다
   - And: scene.json이 업데이트되어 Viewer에 반영된다

5. **AC5: 스트리밍 응답**
   - Given: Claude API 호출
   - When: 응답 수신 중
   - Then: 응답이 실시간으로 스트리밍되어 표시된다
   - And: 사용자가 응답 생성 과정을 볼 수 있다

6. **AC6: 로딩 상태 표시**
   - Given: API 호출 중
   - When: 응답 대기
   - Then: 로딩 인디케이터가 표시된다
   - And: 입력창이 비활성화된다

7. **AC7: 에러 처리**
   - Given: API 호출 실패 (네트워크 오류, 잘못된 API 키 등)
   - When: 에러 발생
   - Then: 사용자에게 에러 메시지가 표시된다
   - And: 앱이 크래시하지 않는다

8. **AC8: 대화 기록 유지**
   - Given: 여러 메시지를 주고받은 상태
   - When: 스크롤
   - Then: 이전 대화 내용을 볼 수 있다
   - Note: 세션 내 메모리 유지, 파일 저장은 선택적

## Tasks / Subtasks

- [ ] **Task 1: 채팅 UI 컴포넌트** (AC: 1, 2)
  - [ ] 1.1: ChatPanel.ts 컴포넌트 생성
  - [ ] 1.2: 메시지 입력창 (textarea + 전송 버튼)
  - [ ] 1.3: 메시지 목록 영역 (스크롤 가능)
  - [ ] 1.4: 사용자/AI 메시지 스타일 구분

- [ ] **Task 2: Claude API 클라이언트** (AC: 3, 5, 7)
  - [ ] 2.1: api-client.ts 생성
  - [ ] 2.2: Anthropic SDK 또는 fetch로 API 호출
  - [ ] 2.3: 스트리밍 응답 처리 (SSE)
  - [ ] 2.4: 에러 핸들링

- [ ] **Task 3: CAD 명령 실행** (AC: 4)
  - [ ] 3.1: Claude 응답에서 tool_use 추출
  - [ ] 3.2: WASM CAD 엔진 직접 실행 (Renderer에서)
  - [ ] 3.3: 메모리에서 Canvas 직접 렌더링
  - [ ] 3.4: Note: tool_use 방식 사용 (텍스트 파싱 X)

- [ ] **Task 4: 상태 관리** (AC: 6, 8)
  - [ ] 4.1: 메시지 배열 상태 관리
  - [ ] 4.2: 로딩 상태 관리
  - [ ] 4.3: 에러 상태 관리
  - [ ] 4.4: 자동 스크롤 (새 메시지 시)

- [ ] **Task 5: 스타일링** (AC: 1, 2)
  - [ ] 5.1: 채팅 버블 스타일
  - [ ] 5.2: 입력창 스타일
  - [ ] 5.3: 로딩 인디케이터 스타일
  - [ ] 5.4: 반응형 레이아웃

- [ ] **Task 6: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [ ] 6.1: 메시지 전송/표시 테스트
  - [ ] 6.2: API 연동 테스트 (실제 API 키 필요)
  - [ ] 6.3: CAD 명령 실행 테스트
  - [ ] 6.4: 스트리밍 표시 테스트
  - [ ] 6.5: 에러 처리 테스트
  - [ ] 6.6: 스크롤 동작 테스트

## Dev Notes

### Architecture Compliance

**Client-Direct Architecture:**
- Renderer에서 Claude API 직접 호출 (fetch)
- API 키가 Renderer에 노출되지만 로컬 앱이므로 OK
- IPC 불필요 → 웹 버전과 코드 100% 동일

**CAD 명령 실행 방식:**
```
┌─ Electron Renderer (= 브라우저) ─────────────────────────┐
│                                                          │
│  채팅 UI → Claude API (fetch, 스트리밍)                  │
│              ↓                                           │
│         tool_use 응답                                    │
│              ↓                                           │
│         WASM 직접 실행 (브라우저에서)                    │
│              ↓                                           │
│         Scene 상태 변경 (메모리)                         │
│              ↓                                           │
│         Canvas 렌더링 (메모리에서 직접)                  │
│                                                          │
│  ※ 파일 I/O 없음, 폴링 없음, 즉각 반영                  │
│  ※ Main Process 경유 안 함                              │
└──────────────────────────────────────────────────────────┘
```

### Technical Requirements

1. **Anthropic SDK 사용**:
   ```typescript
   import Anthropic from '@anthropic-ai/sdk';

   const client = new Anthropic({
       apiKey: userApiKey,  // Story 6-5에서 관리
   });

   async function sendMessage(userMessage: string) {
       const response = await client.messages.create({
           model: 'claude-sonnet-4-20250514',
           max_tokens: 4096,
           messages: [
               { role: 'user', content: userMessage }
           ],
           stream: true,  // 스트리밍
       });

       for await (const event of response) {
           // 스트리밍 처리
       }
   }
   ```

2. **CAD 도구 정의 (tool_use)**:
   ```typescript
   const cadTools = [
       {
           name: 'draw_circle',
           description: 'Draw a circle',
           input_schema: {
               type: 'object',
               properties: {
                   name: { type: 'string' },
                   x: { type: 'number' },
                   y: { type: 'number' },
                   radius: { type: 'number' }
               },
               required: ['name', 'x', 'y', 'radius']
           }
       },
       // ... 다른 도구들
   ];
   ```

3. **메시지 타입**:
   ```typescript
   interface Message {
       id: string;
       role: 'user' | 'assistant';
       content: string;
       timestamp: number;
       status?: 'sending' | 'sent' | 'error';
   }
   ```

4. **채팅 UI 구조**:
   ```html
   <div class="chat-panel">
       <div class="message-list">
           <!-- 메시지들 -->
       </div>
       <div class="input-area">
           <textarea placeholder="메시지 입력..."></textarea>
           <button>전송</button>
       </div>
   </div>
   ```

### File Structure Notes

새로 생성:
- `electron-app/src/renderer/components/ChatPanel.ts`
- `electron-app/src/renderer/services/api-client.ts`
- `electron-app/src/renderer/services/cad-executor.ts`
- `electron-app/src/renderer/styles/chat.css`

의존성 추가:
- `@anthropic-ai/sdk` - Claude API 클라이언트

### References

- [Source: docs/epics.md#Story 6.4: 채팅 UI 구현]
- [Source: Anthropic SDK 문서](https://docs.anthropic.com/claude/reference/client-sdks)
- [Source: docs/sprint-artifacts/6-5-api-key-management.md - API 키 관리]

## Dev Agent Record

### Context Reference

- docs/epics.md (Epic 6, Story 6.4)
- Anthropic SDK 문서

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
