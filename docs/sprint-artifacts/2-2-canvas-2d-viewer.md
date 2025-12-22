# Story 2.2: Canvas 2D 뷰어 기초 및 Polling 구현

Status: ready-for-dev

## Story

As a **사용자 (인간)**,
I want **브라우저에서 scene.json 파일을 자동으로 갱신하여 볼 수 있도록**,
So that **AI가 도형을 생성할 때마다 실시간으로 결과를 확인할 수 있다** (검증 UI).

## Acceptance Criteria

### AC1: 뷰어 HTML 및 Canvas 표시
**Given** viewer/index.html 파일이 존재
**When** 브라우저에서 파일을 열면
**Then** Canvas 요소가 화면에 표시된다
**And** 500ms 간격으로 scene.json을 fetch한다

### AC2: 자동 갱신 (Polling)
**Given** scene.json 파일이 업데이트된 경우
**When** 다음 polling 주기 (500ms 이내)
**Then** 새로운 scene.json 내용이 로드된다
**And** Canvas가 새 내용으로 다시 렌더링된다

### AC3: 에러 핸들링
**Given** scene.json 파일이 없거나 fetch 실패
**When** polling 시도
**Then** 에러가 콘솔에 출력되지만 polling은 계속된다
**And** 다음 주기에 다시 시도한다

### AC4: 정적 서버 동작
**Given** 정적 파일 서버에서 뷰어 실행
**When** `python -m http.server` 또는 유사 서버로 viewer 폴더 서빙
**Then** http://localhost:8000에서 뷰어가 동작한다
**And** Vite 없이 정상 동작한다

## Tasks / Subtasks

- [ ] **Task 1: viewer 디렉토리 구조 생성** (AC: #1)
  - [ ] 1.1: `viewer/` 디렉토리 생성
  - [ ] 1.2: `viewer/index.html` 파일 생성
  - [ ] 1.3: `viewer/renderer.js` 파일 생성

- [ ] **Task 2: HTML 및 Canvas 설정** (AC: #1)
  - [ ] 2.1: 기본 HTML 구조 작성
  - [ ] 2.2: Canvas 요소 추가 (적절한 크기)
  - [ ] 2.3: renderer.js 스크립트 로드

- [ ] **Task 3: Polling 로직 구현** (AC: #1, #2, #3)
  - [ ] 3.1: setInterval(fetch, 500) 패턴 구현
  - [ ] 3.2: scene.json fetch 및 파싱
  - [ ] 3.3: fetch 실패 시 에러 로깅 및 재시도

- [ ] **Task 4: 기본 렌더링 준비** (AC: #2)
  - [ ] 4.1: Canvas 2D context 획득
  - [ ] 4.2: clearRect로 캔버스 초기화
  - [ ] 4.3: scene 데이터 수신 시 render 함수 호출 (실제 렌더링은 Story 2.3)

- [ ] **Task 5: 테스트** (AC: #1, #3, #4)
  - [ ] 5.1: 정적 서버로 뷰어 실행 테스트
  - [ ] 5.2: scene.json 변경 시 갱신 확인
  - [ ] 5.3: 파일 없을 때 에러 처리 확인

## Dev Notes

### Architecture Patterns

#### 뷰어 갱신 전략 (Phase 1-2)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Code 세션                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Claude Code가 CAD Engine 함수 호출                          │
│     scene.add_circle("test", 0, 0, 10);                         │
│                                                                 │
│  2. WASM이 scene.json 파일 출력                                  │
│                                                                 │
│  3. 브라우저가 polling으로 갱신 (500ms 간격)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### index.html 예시

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI-Native CAD Viewer</title>
    <style>
        body {
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f0f0f0;
        }
        canvas {
            border: 1px solid #ccc;
            background: white;
        }
        #status {
            position: fixed;
            top: 10px;
            left: 10px;
            font-family: monospace;
            color: #666;
        }
    </style>
</head>
<body>
    <div id="status">Waiting for scene.json...</div>
    <canvas id="canvas" width="800" height="600"></canvas>
    <script src="renderer.js"></script>
</body>
</html>
```

#### renderer.js 예시 (Polling)

```javascript
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

let lastScene = null;

async function fetchScene() {
    try {
        const response = await fetch('scene.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const scene = await response.json();

        // 변경 감지 (간단한 비교)
        const sceneStr = JSON.stringify(scene);
        if (sceneStr !== lastScene) {
            lastScene = sceneStr;
            render(scene);
            status.textContent = `Loaded: ${scene.entities?.length || 0} entities`;
        }
    } catch (error) {
        console.warn('Failed to fetch scene.json:', error.message);
        status.textContent = `Error: ${error.message}`;
    }
}

function render(scene) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!scene.entities) return;

    for (const entity of scene.entities) {
        // Story 2.3에서 도형별 렌더링 구현
        console.log('Rendering:', entity.entity_type, entity.id);
    }
}

// 500ms 간격으로 polling (NFR3)
setInterval(fetchScene, 500);

// 초기 로드
fetchScene();
```

### 정적 서버 실행

```bash
# Python 3
cd viewer
python -m http.server 8000

# 또는 Node.js (npx)
npx serve viewer

# 브라우저에서 http://localhost:8000 접속
```

### 디렉토리 구조

```
viewer/
├── index.html      # ← 이 스토리
├── renderer.js     # ← 이 스토리 (polling 로직)
└── scene.json      # Claude Code가 생성 (WASM 출력)
```

### Project Structure Notes

- Vite 없이 정적 HTML + vanilla JS로 구현 (Phase 1 단순화)
- scene.json은 viewer/ 폴더 내에 위치 (Output 경로 옵션 A)
- 실제 도형 렌더링은 Story 2.3에서 구현

### 성능 고려사항

- 500ms polling 간격 (NFR3)
- 변경 감지로 불필요한 렌더링 방지
- fetch 실패 시에도 polling 지속

### Dependencies

- Story 2.1 (JSON Export) - scene.json 파일 생성 필요

## References

- [Source: docs/architecture.md#Viewer Architecture - Phase 1-2 Polling]
- [Source: docs/architecture.md#Output 경로 전략]
- [Source: docs/prd.md#User Journey - Phase 1]
- [Source: docs/epics.md#Story 2.2]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- viewer/index.html (신규)
- viewer/renderer.js (신규)
