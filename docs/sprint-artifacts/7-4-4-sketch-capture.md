# Story 7.4.4: 스케치 캡쳐

Status: done

## Story

As a **LLM**,
I want **capture_viewport가 스케치를 포함한 이미지를 캡쳐하기를**,
so that **Vision 모델이 사용자 의도를 해석할 수 있다** (FR39).

## Acceptance Criteria

1. **AC1**: capture_viewport 실행 시 CAD 도형 + 스케치 오버레이 함께 캡쳐
2. **AC2**: PNG 이미지로 저장
3. **AC3**: 빨간색 스케치 선이 Vision에서 "사용자 의도 표시"로 인식 가능
4. **AC4**: 캡쳐 시점의 뷰포트 상태 (줌, 패닝) 반영
5. **AC5**: 선택 표시, 잠금 표시도 포함 (선택)

## Tasks / Subtasks

- [x] Task 1: Puppeteer 브라우저 캡처 (AC: #1, #4)
  - [x] Puppeteer가 전체 뷰포트 캡처 (Canvas + SketchOverlay 포함)
  - [x] 동일한 뷰포트 설정 적용 (줌, 패닝 반영)
  - [x] 별도 합성 불필요 (DOM 렌더링 그대로 캡처)

- [x] Task 2: PNG 내보내기 (AC: #2)
  - [x] Puppeteer page.screenshot으로 PNG 저장
  - [x] viewer/capture.png에 저장
  - [x] 해상도 1024x768 (Vision 최적화)

- [x] Task 3: capture_viewport URL 업데이트 (AC: #1)
  - [x] Vite 개발 서버 URL (localhost:5173)
  - [x] CAD_VIEWER_URL 환경변수 지원
  - [x] 대기 시간 1500ms로 증가

- [x] Task 4: 스케치 포함 확인 (AC: #1)
  - [x] SketchOverlay z-index: 10으로 Canvas 위에 렌더링
  - [x] Puppeteer 스크린샷에 자동 포함
  - [x] 선택/잠금 표시도 자동 포함

- [x] Task 5: Vision 최적화 (AC: #3)
  - [x] 스케치 색상: 빨간색 (#ef4444)
  - [x] 선 두께: 2px (MIN_DISTANCE 체크로 포인트 최적화)
  - [x] 배경과 충분한 대비 (회색 배경에 빨간 선)

## Dev Notes

### 의존성: Story 7-4-3, 기존 capture_viewport

- Story 7-4-3: 지우개 도구 (스케치 완성)
- 기존 cad-tools capture_viewport 명령어

### 캡쳐 아키텍처

```
┌─────────────┐    요청     ┌─────────────┐    저장     ┌─────────────┐
│  cad-tools  │ ─────────→ │   Viewer    │ ─────────→ │ capture.png │
│  CLI        │ capture-   │   React     │            │             │
└─────────────┘ request    └─────────────┘            └─────────────┘
      ↓                           ↓
 "캡쳐 완료"              Canvas 합성 + toDataURL
```

### 합성 캔버스 로직

```typescript
// src/utils/captureViewport.ts
export async function captureViewport(
  sceneCanvas: HTMLCanvasElement,
  sketchCanvas: HTMLCanvasElement | null
): Promise<string> {
  // 1. 오프스크린 캔버스 생성 (동일 크기)
  const { width, height } = sceneCanvas;
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d')!;

  // 2. 배경색 (선택)
  ctx.fillStyle = '#1e1e1e';  // 다크 테마 배경
  ctx.fillRect(0, 0, width, height);

  // 3. 메인 캔버스 (CAD 도형) 복사
  ctx.drawImage(sceneCanvas, 0, 0);

  // 4. 스케치 오버레이 복사
  if (sketchCanvas) {
    ctx.drawImage(sketchCanvas, 0, 0);
  }

  // 5. PNG로 변환
  return offscreen.toDataURL('image/png');
}
```

### 캡쳐 요청/응답 시스템

```typescript
// viewer/src/hooks/useCaptureRequest.ts
const CAPTURE_REQUEST_PATH = '/capture-request.json';
const CAPTURE_OUTPUT_PATH = '/capture.png';

export function useCaptureRequest(
  sceneCanvasRef: RefObject<HTMLCanvasElement>,
  sketchCanvasRef: RefObject<HTMLCanvasElement>
) {
  useEffect(() => {
    // 캡쳐 요청 폴링
    const checkRequest = async () => {
      try {
        const res = await fetch(CAPTURE_REQUEST_PATH, { cache: 'no-store' });
        if (!res.ok) return;

        const request = await res.json();
        if (request.pending) {
          // 캡쳐 수행
          const dataUrl = await captureViewport(
            sceneCanvasRef.current!,
            sketchCanvasRef.current
          );

          // PNG 저장 (Base64 → Blob → POST)
          const blob = await (await fetch(dataUrl)).blob();
          await fetch(CAPTURE_OUTPUT_PATH, {
            method: 'POST',
            body: blob,
          });

          // 요청 완료 표시
          await fetch(CAPTURE_REQUEST_PATH, {
            method: 'POST',
            body: JSON.stringify({ pending: false, completed: true }),
          });
        }
      } catch {
        // 요청 파일 없음 - 정상
      }
    };

    const interval = setInterval(checkRequest, 200);
    return () => clearInterval(interval);
  }, [sceneCanvasRef, sketchCanvasRef]);
}
```

### cad-tools capture_viewport 수정

```typescript
// cad-tools/src/commands/capture.ts
import fs from 'fs';
import path from 'path';

export async function captureViewport(): Promise<string> {
  const viewerPath = path.join(process.cwd(), 'viewer');
  const requestPath = path.join(viewerPath, 'capture-request.json');
  const outputPath = path.join(viewerPath, 'capture.png');

  // 1. 캡쳐 요청
  fs.writeFileSync(requestPath, JSON.stringify({ pending: true }));

  // 2. 완료 대기 (폴링)
  const maxWait = 5000;  // 5초
  const pollInterval = 100;
  let waited = 0;

  while (waited < maxWait) {
    await new Promise(r => setTimeout(r, pollInterval));
    waited += pollInterval;

    try {
      const status = JSON.parse(fs.readFileSync(requestPath, 'utf-8'));
      if (status.completed) {
        // 요청 파일 정리
        fs.unlinkSync(requestPath);
        return outputPath;
      }
    } catch {
      continue;
    }
  }

  throw new Error('Capture timeout');
}
```

### Vite Middleware (캡쳐 파일)

```typescript
// vite.config.ts
{
  name: 'capture-middleware',
  configureServer(server) {
    // capture-request.json 처리
    server.middlewares.use('/capture-request.json', (req, res, next) => {
      const filePath = path.join(__dirname, 'capture-request.json');

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          fs.writeFileSync(filePath, body);
          res.end('OK');
        });
      } else if (req.method === 'GET') {
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/json');
          res.end(fs.readFileSync(filePath));
        } else {
          res.statusCode = 404;
          res.end();
        }
      }
    });

    // capture.png 저장
    server.middlewares.use('/capture.png', (req, res, next) => {
      const filePath = path.join(__dirname, 'capture.png');

      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
          fs.writeFileSync(filePath, Buffer.concat(chunks));
          res.end('OK');
        });
      } else {
        next();  // 정적 파일 서빙
      }
    });
  }
}
```

### 선택/잠금 표시 포함 (선택)

```typescript
// 캡쳐에 UI 요소 포함
export async function captureViewport(
  sceneCanvas: HTMLCanvasElement,
  sketchCanvas: HTMLCanvasElement | null,
  options?: {
    includeSelection?: boolean;
    includeLockIndicators?: boolean;
  }
): Promise<string> {
  // ...
  // 선택 표시, 잠금 표시도 sceneCanvas에 이미 렌더링되어 있음
  // 별도 처리 불필요 (Canvas에 렌더링된 상태 그대로 캡쳐)
}
```

### Vision 프롬프트 예시

```
이 이미지는 CAD 뷰어의 캡쳐입니다.
- 검정/회색 도형: 기존 CAD 엔티티
- 빨간색 손그림 선: 사용자가 표시한 의도
- 파란색 점선 테두리: 선택된 엔티티
- 주황색 테두리: 잠긴 엔티티

빨간색 스케치를 해석하여 사용자의 의도를 파악해주세요.
예: "여기에 원 추가", "이 선 연장", "이 영역 삭제" 등
```

### 캡쳐 결과 예시

```
┌────────────────────────────────────┐
│                                    │
│   ┌───┐      ○                     │  ← CAD 도형
│   │   │                            │
│   └───┘  ~~~~~~~ ← 빨간색 스케치   │
│              ↓                     │
│          "여기에 화살표 추가"       │
│                                    │
└────────────────────────────────────┘
```

### Anti-Patterns (금지)

```typescript
// ❌ HTML2Canvas 사용 (무거움)
import html2canvas from 'html2canvas';
html2canvas(document.body);  // 불필요하게 복잡

// ❌ 스케치 없이 CAD만 캡쳐
ctx.drawImage(sceneCanvas, 0, 0);
// sketchCanvas 누락

// ❌ 동기적 파일 대기 (블로킹)
while (!fs.existsSync(outputPath)) {
  // CPU 100% 사용
}
```

### References

- [docs/architecture.md#Integration Points] - 파일 기반 통신
- FR39: 스케치 캡쳐
- CLAUDE.md - capture_viewport 명령어

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- cad-tools/src/capture.ts (modify) - URL, 해상도, 대기시간 업데이트
- viewer/src/components/Canvas/SketchOverlay.tsx (기존) - z-index: 10으로 캡처에 포함됨

### Implementation Note

Puppeteer가 브라우저의 전체 뷰포트를 스크린샷으로 캡처하므로, SketchOverlay가 DOM에 렌더링된 상태 그대로 캡처됩니다. 별도의 캔버스 합성이나 파일 기반 통신은 불필요합니다.
