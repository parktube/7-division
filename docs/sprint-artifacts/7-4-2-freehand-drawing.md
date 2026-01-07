# Story 7.4.2: 프리핸드 그리기

Status: done

## Story

As a **사용자**,
I want **캔버스에 자유롭게 그림을 그릴 수 있기를**,
so that **LLM에게 원하는 변경사항을 시각적으로 전달할 수 있다** (FR38).

## Acceptance Criteria

1. **AC1**: 마우스 드래그로 빨간색 선 그리기
2. **AC2**: 선이 CAD 도형 위에 오버레이로 표시
3. **AC3**: 마우스 버튼 떼면 스트로크 저장
4. **AC4**: 여러 스트로크를 연속으로 그리기 가능
5. **AC5**: 스트로크 두께 및 색상 일관성 (빨간색, 2px)

## Tasks / Subtasks

- [x] Task 1: Stroke 데이터 구조 (AC: #3)
  - [x] Stroke 타입 정의 (points, color, width)
  - [x] strokes 배열 상태 관리
  - [x] useSketch 훅 생성

- [x] Task 2: 드래그 이벤트 핸들링 (AC: #1)
  - [x] mousedown: 스트로크 시작
  - [x] mousemove: 포인트 추가
  - [x] mouseup: 스트로크 완료

- [x] Task 3: 실시간 렌더링 (AC: #2)
  - [x] 현재 스트로크 즉시 렌더링
  - [x] 이전 스트로크들 유지
  - [x] requestAnimationFrame 최적화

- [x] Task 4: 스트로크 저장 (AC: #3, #4)
  - [x] 완료된 스트로크 배열에 추가
  - [x] 메모리 효율적 저장 (MIN_DISTANCE 체크)

- [x] Task 5: 스타일 설정 (AC: #5)
  - [x] 기본 색상: 빨간색 (#ef4444)
  - [x] 기본 두께: 2px
  - [x] 확장 가능한 구조

## Dev Notes

### 의존성: Story 7-4-1

- Story 7-4-1: 스케치 모드 진입/종료

### Stroke 타입 정의

```typescript
// src/types/sketch.ts
export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
}

export interface SketchState {
  strokes: Stroke[];
  currentStroke: Stroke | null;
}
```

### useSketch 훅

```typescript
// src/hooks/useSketch.ts
import { useState, useCallback, useRef } from 'react';
import { Stroke, Point } from '@/types/sketch';

const DEFAULT_COLOR = '#ef4444';  // red-500
const DEFAULT_WIDTH = 2;

export function useSketch() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startStroke = useCallback((point: Point) => {
    currentStroke.current = {
      id: `stroke_${Date.now()}`,
      points: [point],
      color: DEFAULT_COLOR,
      width: DEFAULT_WIDTH,
    };
    setIsDrawing(true);
  }, []);

  const addPoint = useCallback((point: Point) => {
    if (!currentStroke.current) return;
    currentStroke.current.points.push(point);
  }, []);

  const endStroke = useCallback(() => {
    if (currentStroke.current && currentStroke.current.points.length > 1) {
      setStrokes(prev => [...prev, currentStroke.current!]);
    }
    currentStroke.current = null;
    setIsDrawing(false);
  }, []);

  const clearAll = useCallback(() => {
    setStrokes([]);
    currentStroke.current = null;
  }, []);

  const getCurrentStroke = useCallback(() => {
    return currentStroke.current;
  }, []);

  return {
    strokes,
    isDrawing,
    startStroke,
    addPoint,
    endStroke,
    clearAll,
    getCurrentStroke,
  };
}
```

### SketchOverlay 드로잉 통합

```tsx
// src/components/Canvas/SketchOverlay.tsx
import { useRef, useEffect, useCallback } from 'react';
import { Point } from '@/types/sketch';

interface SketchOverlayProps {
  isActive: boolean;
  strokes: Stroke[];
  currentStroke: Stroke | null;
  onStartStroke: (point: Point) => void;
  onAddPoint: (point: Point) => void;
  onEndStroke: () => void;
}

export function SketchOverlay({
  isActive,
  strokes,
  currentStroke,
  onStartStroke,
  onAddPoint,
  onEndStroke,
}: SketchOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Canvas 크기 설정
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // 렌더링
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 저장된 스트로크 렌더링
    for (const stroke of strokes) {
      renderStroke(ctx, stroke);
    }

    // 현재 스트로크 렌더링
    if (currentStroke) {
      renderStroke(ctx, currentStroke);
    }
  }, [strokes, currentStroke]);

  // 애니메이션 루프
  useEffect(() => {
    const animate = () => {
      render();
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  // 마우스 이벤트
  const getPoint = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;  // 좌클릭만
    onStartStroke(getPoint(e));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return;  // 드래그 중
    onAddPoint(getPoint(e));
  };

  const handleMouseUp = () => {
    onEndStroke();
  };

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}

// 스트로크 렌더링 헬퍼
function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) return;

  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const [first, ...rest] = stroke.points;
  ctx.moveTo(first.x, first.y);

  for (const point of rest) {
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
}
```

### 스트로크 최적화

```typescript
// 포인트 간격 제한 (너무 많은 포인트 방지)
const MIN_DISTANCE = 2;  // 픽셀

const addPoint = useCallback((point: Point) => {
  if (!currentStroke.current) return;

  const points = currentStroke.current.points;
  const lastPoint = points[points.length - 1];

  const distance = Math.sqrt(
    Math.pow(point.x - lastPoint.x, 2) +
    Math.pow(point.y - lastPoint.y, 2)
  );

  if (distance >= MIN_DISTANCE) {
    points.push(point);
  }
}, []);
```

### 부드러운 선 (Catmull-Rom Spline)

```typescript
// 선택적 개선: 부드러운 곡선
function renderSmoothStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 3) {
    renderStroke(ctx, stroke);  // 기본 직선
    return;
  }

  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const points = stroke.points;
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(points.length - 1, i + 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  ctx.stroke();
}
```

### 스트로크 색상/두께 변경 (확장)

```typescript
// 나중에 필요 시 추가
interface SketchConfig {
  color: string;
  width: number;
}

const [config, setConfig] = useState<SketchConfig>({
  color: '#ef4444',
  width: 2,
});
```

### Anti-Patterns (금지)

```typescript
// ❌ 매 포인트마다 전체 캔버스 클리어
const addPoint = (point) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);  // 깜빡임
  renderAllStrokes();
};

// ❌ 상태 배열 직접 수정
stroke.points.push(point);  // 불변성 위반
// setState 사용하거나 ref 사용

// ❌ 무한 포인트 저장
// MIN_DISTANCE 체크 없이 모든 mousemove 포인트 저장
```

### References

- [docs/ux-design-specification.md#Sketch Mode] - 스케치 UI
- FR38: 스케치 모드

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/types/sketch.ts (new) - Point, Stroke 타입 정의
- src/hooks/useSketch.ts (new) - 스케치 상태 관리 훅
- src/components/Canvas/SketchOverlay.tsx (modify) - 드로잉 이벤트 및 렌더링
- src/components/Canvas/Canvas.tsx (modify) - useSketch 통합
