# Story 7.4.3: 지우개 도구

Status: done

## Story

As a **사용자**,
I want **그린 스케치를 지울 수 있기를**,
so that **잘못 그린 부분을 수정할 수 있다** (FR38).

## Acceptance Criteria

1. **AC1**: 지우개 버튼으로 지우개 모드 전환
2. **AC2**: 드래그한 영역의 스케치가 지워짐
3. **AC3**: "Clear All" 버튼으로 모든 스케치 삭제
4. **AC4**: CAD 도형은 영향받지 않음
5. **AC5**: 지우개 커서 표시

## Tasks / Subtasks

- [x] Task 1: 스케치 도구 상태 (AC: #1)
  - [x] SketchTool 타입: 'pen' | 'eraser'
  - [x] useSketch에 activeTool 추가
  - [x] 도구 전환 함수 (switchTool)

- [x] Task 2: 지우개 버튼 UI (AC: #1)
  - [x] 스케치 모드 활성화 시 SketchToolbar 표시
  - [x] Eraser 아이콘 (Lucide)
  - [x] 활성 도구 하이라이트

- [x] Task 3: 지우개 동작 구현 (AC: #2)
  - [x] 지우개 경로와 스트로크 교차 판정
  - [x] 교차하는 스트로크 제거
  - [x] 성능 최적화 (경계 박스 체크)

- [x] Task 4: Clear All 버튼 (AC: #3)
  - [x] Trash 아이콘 버튼
  - [x] 확인 없이 즉시 삭제

- [x] Task 5: 커서 변경 (AC: #5)
  - [x] 지우개 모드: 원형 점선 커서 (canvas 렌더링)
  - [x] 펜 모드: crosshair
  - [x] 키보드 단축키 (P, E)

## Dev Notes

### 의존성: Story 7-4-2

- Story 7-4-2: 프리핸드 그리기

### SketchTool 타입

```typescript
// src/types/sketch.ts
export type SketchTool = 'pen' | 'eraser';
```

### useSketch 확장

```typescript
// src/hooks/useSketch.ts
export function useSketch() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeTool, setActiveTool] = useState<SketchTool>('pen');
  // ...

  const switchTool = useCallback((tool: SketchTool) => {
    setActiveTool(tool);
  }, []);

  const eraseAt = useCallback((point: Point, radius: number = 10) => {
    setStrokes(prev => prev.filter(stroke => {
      // 스트로크의 어떤 포인트도 지우개 영역에 없으면 유지
      return !stroke.points.some(p =>
        Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) <= radius
      );
    }));
  }, []);

  const clearAll = useCallback(() => {
    setStrokes([]);
  }, []);

  return {
    strokes,
    activeTool,
    switchTool,
    eraseAt,
    clearAll,
    // ...
  };
}
```

### 스케치 도구 바

```tsx
// src/components/Canvas/SketchToolbar.tsx
import { Pencil, Eraser, Trash2 } from 'lucide-react';
import { SketchTool } from '@/types/sketch';

interface SketchToolbarProps {
  isActive: boolean;
  activeTool: SketchTool;
  onToolChange: (tool: SketchTool) => void;
  onClearAll: () => void;
}

export function SketchToolbar({
  isActive,
  activeTool,
  onToolChange,
  onClearAll,
}: SketchToolbarProps) {
  if (!isActive) return null;

  return (
    <div className="absolute top-2 left-2 z-20 flex gap-1 bg-panel rounded-lg p-1 shadow-md">
      {/* 펜 도구 */}
      <button
        onClick={() => onToolChange('pen')}
        className={cn(
          'p-2 rounded',
          activeTool === 'pen' ? 'bg-selection text-white' : 'hover:bg-hover'
        )}
        title="Pen (P)"
      >
        <Pencil size={16} />
      </button>

      {/* 지우개 도구 */}
      <button
        onClick={() => onToolChange('eraser')}
        className={cn(
          'p-2 rounded',
          activeTool === 'eraser' ? 'bg-selection text-white' : 'hover:bg-hover'
        )}
        title="Eraser (E)"
      >
        <Eraser size={16} />
      </button>

      <div className="w-px bg-border mx-1" />

      {/* 전체 삭제 */}
      <button
        onClick={onClearAll}
        className="p-2 rounded hover:bg-hover text-red-500"
        title="Clear All"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
```

### 지우개 동작

```tsx
// SketchOverlay.tsx
const handleMouseMove = (e: React.MouseEvent) => {
  if (e.buttons !== 1) return;

  const point = getPoint(e);

  if (activeTool === 'pen') {
    onAddPoint(point);
  } else if (activeTool === 'eraser') {
    onEraseAt(point, ERASER_RADIUS);
  }
};

const handleMouseDown = (e: React.MouseEvent) => {
  if (e.button !== 0) return;

  const point = getPoint(e);

  if (activeTool === 'pen') {
    onStartStroke(point);
  } else if (activeTool === 'eraser') {
    onEraseAt(point, ERASER_RADIUS);
  }
};
```

### 지우개 커서

```tsx
// 지우개 모드 커서 (원형)
const ERASER_RADIUS = 10;

function EraserCursor({ x, y, radius }: { x: number; y: number; radius: number }) {
  return (
    <div
      className="absolute pointer-events-none border-2 border-red-500 rounded-full"
      style={{
        left: x - radius,
        top: y - radius,
        width: radius * 2,
        height: radius * 2,
      }}
    />
  );
}
```

### 키보드 단축키

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isSketchMode) return;

    if (e.key === 'p' || e.key === 'P') {
      switchTool('pen');
    } else if (e.key === 'e' || e.key === 'E') {
      switchTool('eraser');
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isSketchMode, switchTool]);
```

### 지우개 최적화 (경계 박스)

```typescript
// 성능 개선: 경계 박스 우선 체크
function strokeIntersectsEraser(stroke: Stroke, eraserPoint: Point, radius: number): boolean {
  // 1. 경계 박스 체크 (빠른 제외)
  const bounds = getStrokeBounds(stroke);
  if (
    eraserPoint.x + radius < bounds.minX ||
    eraserPoint.x - radius > bounds.maxX ||
    eraserPoint.y + radius < bounds.minY ||
    eraserPoint.y - radius > bounds.maxY
  ) {
    return false;
  }

  // 2. 상세 교차 판정
  return stroke.points.some(p =>
    Math.sqrt(Math.pow(p.x - eraserPoint.x, 2) + Math.pow(p.y - eraserPoint.y, 2)) <= radius
  );
}

function getStrokeBounds(stroke: Stroke) {
  const xs = stroke.points.map(p => p.x);
  const ys = stroke.points.map(p => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
```

### 지우개 시각적 피드백

```
┌────────────────────────────────────┐
│ [✏️] [🧽] │ [🗑️]                    │  ← 스케치 도구바
│                                    │
│     ~~~~~~~~                       │  ← 스케치
│         ○                          │  ← 지우개 커서
│    ~~~~~~~~~~~~                    │
│                                    │
└────────────────────────────────────┘
```

### Anti-Patterns (금지)

```typescript
// ❌ 매 프레임마다 모든 스트로크 교차 판정
requestAnimationFrame(() => {
  strokes.forEach(stroke => {
    stroke.points.forEach(point => {
      // 비효율적
    });
  });
});

// ❌ CAD 도형에 영향
const eraseAt = (point) => {
  // scene.entities 수정 - 금지!
};

// ❌ 지우개 없이 개별 스트로크만 삭제
// Undo 기능으로 대체 (미래 스토리)
```

### References

- [docs/ux-design-specification.md#Sketch Mode] - 스케치 도구
- FR38: 스케치 모드
- [Lucide Eraser](https://lucide.dev/icons/eraser)

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/types/sketch.ts (modify) - SketchTool 타입 추가
- src/hooks/useSketch.ts (modify) - eraseAt, switchTool, clearAll 추가
- src/components/Canvas/SketchToolbar.tsx (new) - 펜/지우개/삭제 버튼
- src/components/Canvas/SketchOverlay.tsx (modify) - 지우개 모드 및 커서
- src/components/Canvas/Canvas.tsx (modify) - 툴바 통합, 키보드 단축키
