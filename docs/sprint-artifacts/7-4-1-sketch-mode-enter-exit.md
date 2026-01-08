# Story 7.4.1: 스케치 모드 진입/종료

Status: done

## Story

As a **사용자**,
I want **스케치 모드를 켜고 끌 수 있기를**,
so that **일반 탐색과 스케치 작업을 구분할 수 있다** (FR38).

## Acceptance Criteria

1. **AC1**: Top Bar의 "Sketch" 버튼 클릭으로 모드 전환
2. **AC2**: Status Bar에 "MODE: Normal" / "MODE: SKETCH" 표시
3. **AC3**: 스케치 모드에서 Canvas 위에 투명 오버레이 활성화
4. **AC4**: 마우스 커서가 펜 모양으로 변경
5. **AC5**: ESC 키로 스케치 모드 종료
6. **AC6**: 스케치 모드 종료 시 스케치 유지

## Tasks / Subtasks

- [x] Task 1: 모드 상태 관리 (AC: #1, #2)
  - [x] UIContext에서 sketchMode 관리 (이미 구현됨)
  - [x] 'Normal' | 'Sketch' 타입
  - [x] toggle, setMode 함수

- [x] Task 2: TopBar Sketch 버튼 (AC: #1)
  - [x] 기존 ToggleButton 활용
  - [x] active 상태 시 하이라이트 (이미 구현됨)
  - [x] Pencil 아이콘

- [x] Task 3: StatusBar 모드 표시 (AC: #2)
  - [x] mode prop 받기
  - [x] 스케치 모드 시 강조 표시 (이미 구현됨)

- [x] Task 4: SketchOverlay 컴포넌트 (AC: #3)
  - [x] src/components/Canvas/SketchOverlay.tsx 생성
  - [x] Canvas 위에 absolute 배치
  - [x] 투명 캔버스 레이어

- [x] Task 5: 커서 변경 (AC: #4)
  - [x] 스케치 모드: cursor-crosshair
  - [x] 일반 모드: cursor-grab/cursor-grabbing

- [x] Task 6: ESC 키 핸들링 (AC: #5)
  - [x] 전역 키보드 이벤트
  - [x] 스케치 모드에서 ESC: 모드 종료
  - [x] 일반 모드에서 ESC: 선택 해제

## Dev Notes

### 의존성: Story 7-1-3

- Story 7-1-3: TopBar, StatusBar

### useMode 훅

```typescript
// src/hooks/useMode.ts
import { useState, useCallback } from 'react';

export type AppMode = 'Normal' | 'Sketch';

export function useMode() {
  const [mode, setMode] = useState<AppMode>('Normal');

  const toggleSketchMode = useCallback(() => {
    setMode(prev => prev === 'Normal' ? 'Sketch' : 'Normal');
  }, []);

  const exitSketchMode = useCallback(() => {
    setMode('Normal');
  }, []);

  const enterSketchMode = useCallback(() => {
    setMode('Sketch');
  }, []);

  const isSketchMode = mode === 'Sketch';

  return {
    mode,
    isSketchMode,
    toggleSketchMode,
    enterSketchMode,
    exitSketchMode,
    setMode,
  };
}
```

### TopBar Sketch 버튼

```tsx
// TopBar.tsx 수정
import { Pencil } from 'lucide-react';

interface TopBarProps {
  isSketchMode: boolean;
  onToggleSketch: () => void;
  // ... 기존 props
}

export function TopBar({ isSketchMode, onToggleSketch, ...props }: TopBarProps) {
  return (
    <header className="h-8 bg-panel flex items-center justify-between px-3 border-b border-border">
      {/* ... 좌측 ... */}

      {/* 중앙: 토글 버튼 */}
      <div className="flex items-center gap-1">
        <ToggleButton icon={Grid3x3} label="Grid" active={gridEnabled} onClick={...} />
        <ToggleButton icon={Ruler} label="Rulers" active={rulersEnabled} onClick={...} />
        <ToggleButton
          icon={Pencil}
          label="Sketch"
          active={isSketchMode}
          onClick={onToggleSketch}
        />
      </div>

      {/* ... 우측 ... */}
    </header>
  );
}
```

### StatusBar 모드 표시

```tsx
// StatusBar.tsx 수정
interface StatusBarProps {
  mode: 'Normal' | 'Sketch';
  // ... 기존 props
}

export function StatusBar({ mode, ...props }: StatusBarProps) {
  return (
    <footer className="h-6 bg-panel flex items-center gap-5 px-3 border-t border-border text-xs text-secondary">
      <span>
        MODE: <strong className={cn(
          'text-primary',
          mode === 'Sketch' && 'text-orange-500'
        )}>
          {mode === 'Sketch' ? 'SKETCH' : mode}
        </strong>
      </span>
      {/* ... 나머지 ... */}
    </footer>
  );
}
```

### SketchOverlay 컴포넌트

```tsx
// src/components/Canvas/SketchOverlay.tsx
import { useRef, useEffect, forwardRef } from 'react';

interface SketchOverlayProps {
  isActive: boolean;
  // drawing handlers는 다음 스토리에서 추가
}

export const SketchOverlay = forwardRef<HTMLCanvasElement, SketchOverlayProps>(
  ({ isActive }, ref) => {
    const localRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = ref || localRef;

    if (!isActive) return null;

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10 cursor-crosshair"
        style={{ pointerEvents: isActive ? 'auto' : 'none' }}
      />
    );
  }
);

SketchOverlay.displayName = 'SketchOverlay';
```

### Canvas에 오버레이 통합

```tsx
// src/components/Canvas/Canvas.tsx
import { SketchOverlay } from './SketchOverlay';

interface CanvasProps {
  isSketchMode: boolean;
}

export function Canvas({ isSketchMode }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sketchRef = useRef<HTMLCanvasElement>(null);

  return (
    <div className={cn(
      'flex-1 relative bg-canvas',
      isSketchMode && 'cursor-crosshair'
    )}>
      {/* 메인 Canvas (씬 렌더링) */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* 스케치 오버레이 */}
      <SketchOverlay
        ref={sketchRef}
        isActive={isSketchMode}
      />
    </div>
  );
}
```

### ESC 키 핸들링

```typescript
// App.tsx 또는 전역
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (isSketchMode) {
        exitSketchMode();
        e.preventDefault();  // 다른 ESC 동작 방지
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isSketchMode, exitSketchMode]);
```

### 모드별 동작 구분

```
Normal 모드:
- Canvas 클릭: 엔티티 선택
- 드래그: 패닝
- 휠: 줌

Sketch 모드:
- Canvas 클릭/드래그: 그리기
- ESC: 모드 종료
- 패닝/줌: 비활성화 (또는 Shift+드래그로 패닝)
```

### 커서 스타일

```css
/* globals.css */
.cursor-crosshair {
  cursor: crosshair;
}

/* 커스텀 펜 커서 (선택) */
.cursor-pen {
  cursor: url('/cursors/pen.svg') 0 16, crosshair;
}
```

### Anti-Patterns (금지)

```typescript
// ❌ 모드 상태를 여러 곳에서 관리
const [mode1, setMode1] = useState('Normal');  // Canvas에서
const [mode2, setMode2] = useState('Normal');  // TopBar에서

// ❌ ESC 키가 다른 동작과 충돌
if (e.key === 'Escape') {
  exitSketchMode();  // 선택 해제도 동시 실행됨
  clearSelection();  // e.preventDefault() 필요
}

// ❌ 스케치 오버레이가 이벤트 차단 안함
<canvas style={{ pointerEvents: 'none' }} />  // 클릭 통과됨
```

### References

- [docs/ux-design-specification.md#Sketch Mode] - 스케치 모드 UI
- FR38: 스케치 모드
- [Lucide Pencil](https://lucide.dev/icons/pencil)

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/components/Canvas/SketchOverlay.tsx (new) - 투명 스케치 오버레이 캔버스
- src/components/Canvas/Canvas.tsx (modify) - 스케치 오버레이 통합, ESC 핸들링, 커서 변경
- src/contexts/UIContext.tsx (기존) - sketchMode 상태 관리 (이미 구현됨)
- src/components/TopBar/TopBar.tsx (기존) - Sketch 버튼 (이미 구현됨)
- src/components/StatusBar/StatusBar.tsx (기존) - 모드 표시 (이미 구현됨)
