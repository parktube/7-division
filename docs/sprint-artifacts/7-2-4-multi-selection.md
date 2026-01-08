# Story 7.2.4: 다중 선택

Status: done

## Story

As a **사용자**,
I want **Ctrl/Shift+클릭으로 여러 엔티티를 동시에 선택할 수 있기를**,
so that **여러 엔티티를 한번에 LLM에게 지정할 수 있다** (FR35).

## Acceptance Criteria

1. **AC1**: Ctrl+클릭으로 선택에 추가/제거 토글
2. **AC2**: Shift+클릭으로 범위 선택
3. **AC3**: Canvas에서 모든 선택된 엔티티에 선택 표시
4. **AC4**: Status Bar에 "Selected: N" 표시
5. **AC5**: Mac에서 Cmd 키 지원 (Ctrl 대신)

## Tasks / Subtasks

- [x] Task 1: useSelection 확장 (AC: #1, #2)
  - [x] toggleSelect 함수 (Ctrl+클릭용)
  - [x] rangeSelect 함수 (Shift+클릭용)
  - [x] lastSelectedId 추적 (범위 선택용)

- [x] Task 2: Ctrl+클릭 구현 (AC: #1, #5)
  - [x] Ctrl/Cmd 키 감지
  - [x] 이미 선택된 경우 해제
  - [x] 선택되지 않은 경우 추가

- [x] Task 3: Shift+클릭 구현 (AC: #2)
  - [x] 마지막 선택 위치 기억
  - [x] 두 위치 사이 모든 엔티티 선택
  - [x] flattenTree로 트리 순서 계산

- [x] Task 4: Canvas 다중 선택 표시 (AC: #3)
  - [x] 모든 selectedIds에 대해 선택 표시
  - [x] 렌더링 성능 최적화

- [x] Task 5: Status Bar 업데이트 (AC: #4)
  - [x] selectedCount from UIContext
  - [x] "N selected" 동적 표시

- [x] Task 6: 플랫폼 감지 (AC: #5)
  - [x] isMac() 유틸 함수
  - [x] isModifierKey() - metaKey/ctrlKey 분기

## Dev Notes

### 의존성: Story 7-2-3

- Story 7-2-3: 엔티티 단일 선택

### useSelection 확장

```typescript
// src/hooks/useSelection.ts
export function useSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // 단일 선택 (기존)
  const select = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
    setLastSelectedId(id);
  }, []);

  // 토글 선택 (Ctrl+클릭)
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastSelectedId(id);
  }, []);

  // 범위 선택 (Shift+클릭)
  const rangeSelect = useCallback((
    id: string,
    orderedIds: string[]  // 트리 순서로 정렬된 ID 배열
  ) => {
    if (!lastSelectedId) {
      select(id);
      return;
    }

    const startIdx = orderedIds.indexOf(lastSelectedId);
    const endIdx = orderedIds.indexOf(id);

    if (startIdx === -1 || endIdx === -1) {
      select(id);
      return;
    }

    const [from, to] = startIdx < endIdx
      ? [startIdx, endIdx]
      : [endIdx, startIdx];

    const rangeIds = orderedIds.slice(from, to + 1);
    setSelectedIds(new Set(rangeIds));
    // lastSelectedId는 유지 (연속 Shift+클릭 지원)
  }, [lastSelectedId, select]);

  // 선택에 추가
  const addToSelection = useCallback((id: string) => {
    setSelectedIds(prev => new Set(prev).add(id));
    setLastSelectedId(id);
  }, []);

  return {
    selectedIds,
    selectedArray: useMemo(() => Array.from(selectedIds), [selectedIds]),
    selectedCount: selectedIds.size,
    select,
    toggleSelect,
    rangeSelect,
    addToSelection,
    deselect,
    clear,
    isSelected: useCallback((id: string) => selectedIds.has(id), [selectedIds]),
  };
}
```

### 플랫폼 감지

```typescript
// src/utils/platform.ts
export function isMac(): boolean {
  return typeof navigator !== 'undefined' &&
         /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

export function isModifierKey(e: React.MouseEvent | React.KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}
```

### LayerItem 클릭 핸들러

```tsx
// src/components/LayerPanel/LayerItem.tsx
import { isModifierKey } from '@/utils/platform';

const handleClick = (e: React.MouseEvent) => {
  e.stopPropagation();

  if (e.shiftKey) {
    // Shift+클릭: 범위 선택
    onRangeSelect(node.id);
  } else if (isModifierKey(e)) {
    // Ctrl/Cmd+클릭: 토글
    onToggleSelect(node.id);
  } else {
    // 일반 클릭: 단일 선택
    onSelect(node.id);
  }
};
```

### 트리 순서 ID 배열 생성

```typescript
// src/utils/buildTree.ts
export function flattenTree(nodes: TreeNode[]): string[] {
  const result: string[] = [];

  function traverse(node: TreeNode) {
    result.push(node.id);
    node.children?.forEach(traverse);
  }

  nodes.forEach(traverse);
  return result;
}
```

### Canvas 다중 선택 렌더링

```typescript
// 성능: 선택된 엔티티만 별도 렌더링
function renderSelections(
  ctx: CanvasRenderingContext2D,
  entityMap: Map<string, Entity>,
  selectedIds: Set<string>,
  viewport: ViewportState
) {
  ctx.save();

  // Viewport 변환
  ctx.translate(viewport.offset.x, viewport.offset.y);
  ctx.scale(viewport.zoom, viewport.zoom);

  // 공통 스타일 설정
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2 / viewport.zoom;
  ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);

  for (const id of selectedIds) {
    const entity = entityMap.get(id);
    if (entity) {
      // ✅ scene.json의 computed에서 읽기 (Dumb View 원칙)
      const bounds = entity.computed?.world_bounds;
      if (bounds) {
        ctx.strokeRect(
          bounds.min[0],
          bounds.min[1],
          bounds.max[0] - bounds.min[0],
          bounds.max[1] - bounds.min[1]
        );
      }
    }
  }

  ctx.restore();
}
```

### Status Bar 다중 선택 표시

```tsx
// src/components/StatusBar/StatusBar.tsx
interface StatusBarProps {
  mode: 'Normal' | 'Sketch';
  entityCount: number;
  selectedCount: number;  // 추가
  mouseX: number;
  mouseY: number;
  zoom: number;
}

export function StatusBar({ selectedCount, ...props }: StatusBarProps) {
  return (
    <footer className="h-6 bg-panel flex items-center gap-5 px-3 border-t border-border text-xs text-secondary">
      {/* ... */}
      <span className="flex items-center gap-1">
        <CheckSquare size={12} />
        Selected: {selectedCount}
      </span>
      {/* ... */}
    </footer>
  );
}
```

### 선택 상태 시각적 피드백

```
트리뷰:
┌────────────────────────┐
│ ▼ Group A              │  ← 선택 안됨
│   ● Circle 1   [████]  │  ← 선택됨 (파란 배경)
│   ■ Rect 2     [████]  │  ← 선택됨 (파란 배경)
│ ─ Line 3               │  ← 선택 안됨
└────────────────────────┘

Canvas:
┌────────────────────────┐
│   ┌ ─ ─ ┐              │  ← 파란 점선 테두리
│   │ ○   │              │
│   └ ─ ─ ┘              │
│       ┌ ─ ─ ─ ┐        │
│       │ ■     │        │
│       └ ─ ─ ─ ┘        │
└────────────────────────┘
```

### Anti-Patterns (금지)

```typescript
// ❌ 항상 ctrlKey 사용 (Mac 미지원)
if (e.ctrlKey) {
  toggleSelect(id);
}

// ❌ 범위 선택 시 기존 선택 유지
const rangeSelect = (id) => {
  setSelectedIds(prev => new Set([...prev, ...rangeIds]));  // 틀림!
};
// 범위 선택은 새 범위로 대체

// ❌ 선택 표시 매번 전체 재렌더링
useEffect(() => {
  renderScene();  // 선택 변경만으로 전체 재렌더링
}, [selectedIds]);
```

### References

- [docs/ux-design-specification.md#Selection Behavior] - 선택 동작
- [docs/architecture.md#이벤트 처리] - 키보드 이벤트
- FR35: 다중 선택

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/hooks/useSelection.ts (modify)
- src/utils/platform.ts (modify)
- src/utils/buildTree.ts (modify)
- src/components/LayerPanel/LayerItem.tsx (modify)
- src/components/Canvas/Canvas.tsx (modify)
- src/components/StatusBar/StatusBar.tsx (modify)
