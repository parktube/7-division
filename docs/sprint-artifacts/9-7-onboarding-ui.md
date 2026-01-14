# Story 9.7: 온보딩 UI

Status: drafted

## Story

As a **신규 사용자**,
I want **MCP 미연결 시 연결 가이드가 표시되기를**,
so that **어떻게 시작해야 하는지 즉시 알 수 있다** (FR57).

## Acceptance Criteria

1. **Given** Viewer가 로드되고 MCP가 연결되지 않았을 때
   **When** 5초간 연결 시도가 실패하면
   **Then** 온보딩 오버레이가 표시된다:
   - "MCP 서버 미연결"
   - "npx @ai-native-cad/mcp start" 복사 버튼
   - 연결 재시도 버튼

2. **Given** 온보딩 UI가 표시된 상태에서
   **When** MCP 서버가 연결되면
   **Then** 온보딩 오버레이가 자동으로 사라진다
   **And** 정상 UI가 표시된다

3. **Given** 복사 버튼을 클릭했을 때
   **When** 클립보드에 복사되면
   **Then** "복사됨!" 피드백이 표시된다

4. **Given** 재시도 버튼을 클릭했을 때
   **When** 버튼이 클릭되면
   **Then** WebSocket 연결이 다시 시도된다
   **And** 연결 상태가 업데이트된다

## Tasks / Subtasks

- [ ] Task 1: 온보딩 오버레이 컴포넌트 (AC: #1)
  - [ ] 1.1 apps/viewer/src/components/OnboardingOverlay.tsx 생성
  - [ ] 1.2 오버레이 레이아웃 (전체 화면, 반투명 배경)
  - [ ] 1.3 "MCP 서버 미연결" 타이틀
  - [ ] 1.4 명령어 표시 영역 (`npx @ai-native-cad/mcp start`)
  - [ ] 1.5 복사 버튼 UI

- [ ] Task 2: 클립보드 복사 기능 (AC: #3)
  - [ ] 2.1 복사 버튼 클릭 핸들러
  - [ ] 2.2 navigator.clipboard.writeText 사용
  - [ ] 2.3 "복사됨!" 피드백 상태
  - [ ] 2.4 2초 후 피드백 자동 해제

- [ ] Task 3: 연결 재시도 버튼 (AC: #4)
  - [ ] 3.1 재시도 버튼 UI
  - [ ] 3.2 useWebSocket.reconnect() 호출
  - [ ] 3.3 재시도 중 로딩 상태 표시

- [ ] Task 4: 연결 상태 기반 렌더링 (AC: #1, #2)
  - [ ] 4.1 useWebSocket에서 connectionStatus 구독
  - [ ] 4.2 5초 타이머 후 온보딩 표시 로직
  - [ ] 4.3 연결 성공 시 오버레이 자동 숨김
  - [ ] 4.4 연결 상태 변경 시 UI 업데이트

- [ ] Task 5: 스타일링 (AC: #1)
  - [ ] 5.1 오버레이 배경 스타일 (rgba, blur)
  - [ ] 5.2 카드 스타일 (중앙 정렬)
  - [ ] 5.3 버튼 스타일 (복사, 재시도)
  - [ ] 5.4 반응형 레이아웃 (모바일 대응)

- [ ] Task 6: 테스트 (AC: #1~#4)
  - [ ] 6.1 오버레이 렌더링 테스트
  - [ ] 6.2 클립보드 복사 테스트 (mock)
  - [ ] 6.3 연결 성공 시 자동 숨김 테스트
  - [ ] 6.4 재시도 버튼 동작 테스트

## Dev Notes

### Architecture Compliance

**Source:** [docs/architecture.md Part 2.6]

온보딩 UI는 WebSocket 연결 실패 후 사용자에게 가이드를 제공합니다. 재연결 정책 (Exponential Backoff) 5회 실패 후 표시됩니다.

### Technical Requirements

**OnboardingOverlay 컴포넌트:**

```tsx
// apps/viewer/src/components/OnboardingOverlay.tsx
import { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

export function OnboardingOverlay() {
  const { connectionStatus, reconnect } = useWebSocket();
  const [copied, setCopied] = useState(false);

  const command = 'npx @ai-native-cad/mcp start';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 연결 성공 시 숨김
  if (connectionStatus === 'connected') {
    return null;
  }

  // 연결 중이면 로딩 표시
  if (connectionStatus === 'connecting') {
    return <LoadingOverlay />;
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <h2>MCP 서버 미연결</h2>
        <p>아래 명령어를 터미널에서 실행하세요:</p>

        <div className="command-box">
          <code>{command}</code>
          <button onClick={handleCopy}>
            {copied ? '복사됨!' : '복사'}
          </button>
        </div>

        <button onClick={reconnect} className="retry-button">
          연결 재시도
        </button>
      </div>
    </div>
  );
}
```

**연결 상태 흐름:**

```
Viewer 로드 → WebSocket 연결 시도 → 실패 (5회)
    ↓
온보딩 UI 표시
    ↓
[재시도] 또는 [사용자가 MCP 시작]
    ↓
연결 성공 → 온보딩 숨김 → 정상 UI
```

**타이머 로직:**

```tsx
function useOnboardingVisibility() {
  const { connectionStatus } = useWebSocket();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 5000); // 5초 후 표시

      return () => clearTimeout(timer);
    } else {
      setShowOnboarding(false);
    }
  }, [connectionStatus]);

  return showOnboarding;
}
```

### File Structure

```
apps/viewer/src/
├── components/
│   ├── OnboardingOverlay.tsx   # 온보딩 UI (이 스토리)
│   └── OnboardingOverlay.css   # 스타일
├── hooks/
│   └── useWebSocket.ts         # WebSocket 훅 (Story 9.2)
└── App.tsx                     # 루트 (OnboardingOverlay 렌더링)
```

### Dependencies

- **선행 스토리**: Story 9.2 (useWebSocket 훅), Story 9.6 (npx 명령어)
- **후행 스토리**: Story 9.8 (버전 호환성 - 온보딩과 함께 표시)

### UI/UX 요구사항

| 요소 | 스펙 |
|------|------|
| 오버레이 배경 | rgba(0, 0, 0, 0.7) + backdrop-blur |
| 카드 크기 | max-width: 400px, 중앙 정렬 |
| 복사 버튼 | 명령어 오른쪽, 아이콘 + 텍스트 |
| 재시도 버튼 | 카드 하단, primary 스타일 |
| 피드백 | "복사됨!" 2초간 표시 |

### 선택적 기능

- [ ] "다시 보지 않기" 체크박스 (localStorage)
- [ ] 연결 상태 애니메이션 (pulse)
- [ ] 다크 모드 지원

### Potential Risks

| 위험 | 완화 전략 |
|------|----------|
| 클립보드 API 권한 | HTTPS 또는 localhost에서만 동작 |
| 오버레이 z-index 충돌 | 최상위 레이어 (z-index: 9999) |
| 연결 상태 깜빡임 | 디바운스 적용 (300ms) |

### Testing Requirements

**단위 테스트:**
```bash
cd apps/viewer && pnpm test
```

**수동 테스트:**
```bash
# MCP 서버 없이 Viewer 실행
cd apps/viewer && pnpm dev
# → 5초 후 온보딩 UI 표시 확인

# MCP 서버 시작 후 자동 숨김 확인
npx @ai-native-cad/mcp start
```

### References

- [Source: docs/architecture.md#2.6] - Error Handling Patterns
- [Source: docs/epics.md#Story-9.7] - Story 정의 및 AC
- [Story 9.2] - useWebSocket 훅

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

