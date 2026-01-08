# Story 7.1.5: Canvas Pan/Zoom

Status: done

## Story

As a **사용자**,
I want **Canvas를 드래그하여 이동하고 휠로 확대/축소할 수 있기를**,
so that **씬의 특정 부분을 자세히 볼 수 있다**.

## Acceptance Criteria

1. **AC1**: 마우스 휠 스크롤로 줌 인/아웃 (커서 위치 중심)
2. **AC2**: 마우스 중간 버튼 드래그 또는 스페이스+드래그로 패닝
3. **AC3**: 줌 레벨 범위 제한 (10% ~ 1000%)
4. **AC4**: Status Bar에 현재 줌 레벨 표시
5. **AC5**: 줌/패닝이 60fps로 부드럽게 동작

## Tasks / Subtasks

- [x] Task 1: 뷰포트 상태 관리 (AC: #1, #2)
  - [x] ViewportState 타입 정의 (offset, zoom)
  - [x] ViewportContext 생성 (useViewport 대신 Context 사용)
  - [x] 초기값: offset=(0, 0), zoom=1.0

- [x] Task 2: Zoom 구현 (AC: #1, #3)
  - [x] 마우스 휠 이벤트 핸들러
  - [x] 커서 위치 기준 줌 (pinch 효과)
  - [x] 줌 범위 제한: 0.1 ~ 10.0 (10% ~ 1000%)
  - [x] deltaY 방향에 따른 줌 인/아웃

- [x] Task 3: Pan 구현 (AC: #2) **[DEVIATION]**
  - [x] ~~마우스 중간 버튼 드래그 핸들러~~
  - [x] ~~스페이스 + 좌클릭 드래그 핸들러~~
  - [x] **좌클릭 드래그로 변경** (유저 요청)
  - [x] 드래그 중 커서 변경 (grab → grabbing)

- [x] Task 4: 렌더러 통합 (AC: #5)
  - [x] renderScene에 viewport 파라미터 추가
  - [x] ctx.translate(offset.x, offset.y)
  - [x] ctx.scale(zoom, zoom)
  - [x] useCallback으로 최적화

- [x] Task 5: Status Bar 연동 (AC: #4)
  - [x] ViewportContext에서 zoom 값 export
  - [x] StatusBar에 줌 레벨 표시 (정수 %)
  - [x] 예: "100%", "150%", "50%"

- [x] Task 6: 성능 검증 (AC: #5)
  - [x] Pan/Zoom 시 부드러운 동작 확인
  - [x] 메모리 누수 없음 확인

## Deviations

### AC2 변경: 패닝 입력 방식
- **원래 스펙**: 마우스 중간 버튼 또는 스페이스+드래그
- **실제 구현**: 좌클릭 드래그
- **변경 사유**: 유저 요청 - 더 직관적인 인터랙션
- **변경일**: 2026-01-06

## Dev Notes

### 의존성: Story 7-1-4

- Story 7-1-4: Canvas 씬 렌더링 (필수)

### ViewportState 타입

```typescript
// src/types/viewport.ts
export interface ViewportState {
  offset: {
    x: number;
    y: number;
  };
  zoom: number;  // 1.0 = 100%
}

export const DEFAULT_VIEWPORT: ViewportState = {
  offset: { x: 0, y: 0 },
  zoom: 1.0
};

export const ZOOM_MIN = 0.1;   // 10%
export const ZOOM_MAX = 10.0;  // 1000%
export const ZOOM_STEP = 0.1;  // 휠당 10%
```

### useViewport 훅

```typescript
// src/hooks/useViewport.ts
import { useState, useCallback } from 'react';
import { ViewportState, DEFAULT_VIEWPORT, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '@/types/viewport';

export function useViewport() {
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT);

  // Zoom at cursor position
  const zoomAt = useCallback((cursorX: number, cursorY: number, delta: number) => {
    setViewport(prev => {
      const zoomFactor = delta > 0 ? (1 - ZOOM_STEP) : (1 + ZOOM_STEP);
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev.zoom * zoomFactor));

      // 커서 위치 기준 줌 계산
      const scale = newZoom / prev.zoom;
      const newOffsetX = cursorX - scale * (cursorX - prev.offset.x);
      const newOffsetY = cursorY - scale * (cursorY - prev.offset.y);

      return {
        offset: { x: newOffsetX, y: newOffsetY },
        zoom: newZoom
      };
    });
  }, []);

  // Pan by delta
  const pan = useCallback((dx: number, dy: number) => {
    setViewport(prev => ({
      ...prev,
      offset: {
        x: prev.offset.x + dx,
        y: prev.offset.y + dy
      }
    }));
  }, []);

  // Reset to default
  const reset = useCallback(() => {
    setViewport(DEFAULT_VIEWPORT);
  }, []);

  return { viewport, zoomAt, pan, reset };
}
```

### Zoom 이벤트 핸들러

```typescript
// Canvas.tsx 내부
const handleWheel = useCallback((e: WheelEvent) => {
  e.preventDefault();

  const canvas = canvasRef.current;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const cursorX = e.clientX - rect.left;
  const cursorY = e.clientY - rect.top;

  zoomAt(cursorX, cursorY, e.deltaY);
}, [zoomAt]);

// passive: false 필수 (preventDefault 허용)
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  canvas.addEventListener('wheel', handleWheel, { passive: false });
  return () => canvas.removeEventListener('wheel', handleWheel);
}, [handleWheel]);
```

### Pan 이벤트 핸들러

```typescript
// Canvas.tsx 내부
const [isPanning, setIsPanning] = useState(false);
const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
const [isSpacePressed, setIsSpacePressed] = useState(false);

// 중간 버튼 또는 스페이스+클릭으로 패닝 시작
const handleMouseDown = useCallback((e: React.MouseEvent) => {
  const isMiddleButton = e.button === 1;
  const isSpacePan = isSpacePressed && e.button === 0;

  if (isMiddleButton || isSpacePan) {
    e.preventDefault();
    setIsPanning(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  }
}, [isSpacePressed]);

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  if (!isPanning) return;

  const dx = e.clientX - lastMousePos.x;
  const dy = e.clientY - lastMousePos.y;

  pan(dx, dy);
  setLastMousePos({ x: e.clientX, y: e.clientY });
}, [isPanning, lastMousePos, pan]);

const handleMouseUp = useCallback(() => {
  setIsPanning(false);
}, []);

// 스페이스바 이벤트
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) {
      setIsSpacePressed(true);
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      setIsSpacePressed(false);
      setIsPanning(false);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, []);
```

### 커서 스타일

```tsx
// Canvas.tsx
<canvas
  ref={canvasRef}
  className={cn(
    'absolute inset-0',
    isSpacePressed && !isPanning && 'cursor-grab',
    isPanning && 'cursor-grabbing'
  )}
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  onMouseLeave={handleMouseUp}
/>
```

### 렌더러에 Viewport 적용

```typescript
// renderScene 수정
function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  viewport: ViewportState
) {
  const { width, height } = ctx.canvas;

  ctx.clearRect(0, 0, width, height);
  ctx.save();

  // 1. 원점을 캔버스 중앙으로
  ctx.translate(width / 2, height / 2);

  // 2. Y축 반전 (Y-up)
  ctx.scale(1, -1);

  // 3. Viewport 적용 (Pan + Zoom)
  ctx.translate(viewport.offset.x, viewport.offset.y);
  ctx.scale(viewport.zoom, viewport.zoom);

  // 4. 씬 렌더링
  // ... entities 렌더링

  ctx.restore();
}
```

### Status Bar 줌 표시

```tsx
// StatusBar.tsx
interface StatusBarProps {
  mode: 'Normal' | 'Sketch';
  entityCount: number;
  selectedCount: number;
  mouseX: number;
  mouseY: number;
  zoom: number;  // 1.0 = 100%
}

export function StatusBar({ mode, entityCount, selectedCount, mouseX, mouseY, zoom }: StatusBarProps) {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <footer className="h-6 bg-panel flex items-center gap-5 px-3 border-t border-border text-xs text-secondary">
      {/* ... 다른 항목들 ... */}
      <span>{zoomPercent}%</span>
    </footer>
  );
}
```

### 60fps 최적화

```typescript
// requestAnimationFrame 사용
const [needsRender, setNeedsRender] = useState(false);

const scheduleRender = useCallback(() => {
  setNeedsRender(true);
}, []);

useEffect(() => {
  if (!needsRender) return;

  const frameId = requestAnimationFrame(() => {
    renderScene(ctx, scene, viewport);
    setNeedsRender(false);
  });

  return () => cancelAnimationFrame(frameId);
}, [needsRender, scene, viewport]);

// viewport 변경 시 렌더 스케줄
useEffect(() => {
  scheduleRender();
}, [viewport, scheduleRender]);
```

### 커서 위치 기준 줌 알고리즘

```
줌 전:
  화면좌표 P = (cursorX, cursorY)
  월드좌표 W = (P - offset) / oldZoom

줌 후:
  월드좌표 W는 그대로 P에 매핑되어야 함
  P = W * newZoom + newOffset
  newOffset = P - W * newZoom
            = P - (P - offset) * (newZoom / oldZoom)
            = P * (1 - scale) + offset * scale
  (여기서 scale = newZoom / oldZoom)
```

### Anti-Patterns (금지)

```typescript
// ❌ 매 이벤트마다 직접 렌더링
const handleWheel = (e) => {
  updateViewport();
  renderScene();  // 틀림! requestAnimationFrame 사용
};

// ❌ passive wheel 이벤트 (preventDefault 안됨)
canvas.addEventListener('wheel', handleWheel);  // passive: true가 기본값

// ❌ 줌 범위 검증 없음
const newZoom = prev.zoom * zoomFactor;  // 무한대 가능
```

### References

- [docs/architecture.md#Canvas 렌더링 패턴] - 변환 순서
- [docs/ux-design-specification.md#Viewport Control] - 인터랙션 명세
- NFR18: 60fps 성능

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/types/viewport.ts (new)
- src/hooks/useViewport.ts (new)
- src/components/Canvas/Canvas.tsx (modify)
- src/components/StatusBar/StatusBar.tsx (modify)
