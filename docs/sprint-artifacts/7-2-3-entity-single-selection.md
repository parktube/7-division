# Story 7.2.3: 엔티티 단일 선택

Status: done

## Story

As a **사용자**,
I want **트리뷰에서 엔티티를 클릭하여 선택할 수 있기를**,
so that **특정 엔티티를 LLM에게 지정할 수 있다**.

## Acceptance Criteria

1. **AC1**: 트리뷰에서 엔티티 클릭 시 선택 상태로 하이라이트
2. **AC2**: Canvas에서 선택된 엔티티에 파란색 테두리 표시
3. **AC3**: Info Panel에 선택된 엔티티 정보 표시
4. **AC4**: 다른 엔티티 클릭 시 기존 선택 해제 후 새 엔티티 선택
5. **AC5**: 빈 영역 클릭 시 선택 해제

## Tasks / Subtasks

- [x] Task 1: Selection 상태 관리 (AC: #1, #4)
  - [x] UIContext에 선택 상태 추가
  - [x] selectedIds Set 관리
  - [x] select, deselect, clear 함수

- [x] Task 2: LayerItem 선택 UI (AC: #1)
  - [x] 선택 상태 스타일 (배경색 변경)
  - [x] 클릭 이벤트 핸들러
  - [x] 선택 인디케이터 (왼쪽 파란 바)

- [x] Task 3: Canvas 선택 표시 (AC: #2)
  - [x] 선택된 엔티티 바운딩 박스 계산
  - [x] 파란색 점선 테두리 렌더링
  - [x] 그룹 선택 시 자식 bounds 합산

- [x] Task 4: InfoPanel 연동 (AC: #3)
  - [x] 선택된 엔티티 정보 표시
  - [x] 이름, 타입, X/Y 좌표, Z-Order 표시
  - [x] geometry 기반 좌표 계산

- [x] Task 5: 선택 해제 (AC: #5)
  - [x] 트리뷰 빈 영역 클릭 감지
  - [x] ESC 키로 선택 해제

## Dev Notes

### 의존성: Story 7-2-2

- Story 7-2-2: 그룹 확장/축소

### useSelection 훅

```typescript
// src/hooks/useSelection.ts
import { useState, useCallback, useMemo } from 'react';

export interface SelectionState {
  selectedIds: Set<string>;
}

export function useSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 단일 선택 (기존 선택 대체)
  const select = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
  }, []);

  // 선택 해제
  const deselect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // 전체 해제
  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // 선택 여부 확인
  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  // 배열로 반환
  const selectedArray = useMemo(() => {
    return Array.from(selectedIds);
  }, [selectedIds]);

  return {
    selectedIds,
    selectedArray,
    select,
    deselect,
    clear,
    isSelected,
  };
}
```

### LayerItem 선택 UI

```tsx
// src/components/LayerPanel/LayerItem.tsx
interface LayerItemProps {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

export function LayerItem({
  node, depth, isExpanded, isSelected, onToggle, onSelect
}: LayerItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={cn(
          'flex items-center gap-1 py-1 px-1 cursor-pointer',
          isSelected
            ? 'bg-selection text-white'
            : 'hover:bg-hover'
        )}
        style={{ paddingLeft: depth * 16 + 4 }}
      >
        {/* ... Chevron, Icon, Name ... */}
      </div>
      {/* children */}
    </div>
  );
}
```

### Canvas 선택 표시

```typescript
// src/utils/renderSelection.ts
import { Entity } from '@/types/scene';

export function renderSelection(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  viewport: ViewportState
) {
  // ✅ scene.json의 computed에서 읽기 (Dumb View 원칙)
  const bounds = entity.computed?.world_bounds;
  if (!bounds) return;

  ctx.save();

  // Viewport 변환 적용
  ctx.translate(viewport.offset.x, viewport.offset.y);
  ctx.scale(viewport.zoom, viewport.zoom);

  // 선택 테두리 (파란색)
  ctx.strokeStyle = '#2563eb';  // blue-600
  ctx.lineWidth = 2 / viewport.zoom;  // 줌에 관계없이 일정 두께
  ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);

  ctx.strokeRect(
    bounds.min[0],
    bounds.min[1],
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1]
  );

  ctx.restore();
}

// ❌ calculateWorldBounds 삭제됨 - WASM이 계산, Viewer는 읽기만
```

### Canvas 렌더링에 선택 추가

```typescript
// src/components/Canvas/Canvas.tsx
function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  viewport: ViewportState,
  selectedIds: Set<string>
) {
  // 1. 씬 렌더링
  // ... entities rendering ...

  // 2. 선택 표시 렌더링 (맨 위에)
  for (const id of selectedIds) {
    const entity = entityMap.get(id);
    if (entity) {
      renderSelection(ctx, entity, viewport);
    }
  }
}
```

### InfoPanel 선택 정보

```tsx
// src/components/InfoPanel/SelectionInfo.tsx
import { Entity } from '@/types/scene';

interface SelectionInfoProps {
  entity: Entity | null;
}

export function SelectionInfo({ entity }: SelectionInfoProps) {
  if (!entity) {
    return (
      <div className="p-3 text-secondary text-sm">
        No selection
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <div>
        <span className="text-secondary text-xs">Name</span>
        <div className="font-medium">{entity.id}</div>
      </div>
      <div>
        <span className="text-secondary text-xs">Type</span>
        <div>{entity.type}</div>
      </div>
      <div>
        <span className="text-secondary text-xs">Position</span>
        <div>
          x: {entity.transform.translate[0].toFixed(1)},
          y: {entity.transform.translate[1].toFixed(1)}
        </div>
      </div>
      {entity.z_order !== undefined && (
        <div>
          <span className="text-secondary text-xs">Z-Order</span>
          <div>{entity.z_order}</div>
        </div>
      )}
    </div>
  );
}
```

### 선택 해제 처리

```tsx
// Canvas 빈 영역 클릭
const handleCanvasClick = (e: React.MouseEvent) => {
  // hit test 결과가 없으면 선택 해제
  const hit = hitTest(e.clientX, e.clientY, scene, viewport);
  if (!hit) {
    selection.clear();
  }
};

// ESC 키
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      selection.clear();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selection]);
```

### 선택 색상 (TailwindCSS 변수)

```css
/* globals.css */
:root {
  --color-selection: #2563eb;  /* blue-600 */
  --color-selection-bg: rgba(37, 99, 235, 0.1);
}
```

### Anti-Patterns (금지)

```typescript
// ❌ 선택 상태를 각 컴포넌트에서 개별 관리
const LayerItem = () => {
  const [isSelected, setIsSelected] = useState(false);  // 틀림!
};

// ❌ 전체 씬 재렌더링
useEffect(() => {
  renderScene();
}, [selectedIds]);  // 선택만 다시 그려야 함

// ❌ Canvas 클릭으로 선택 해제 무조건 호출
onClick={() => clear()}  // 엔티티 클릭도 해제됨
```

### References

- [docs/ux-design-specification.md#Selection UI] - 선택 표시 스타일
- [docs/architecture.md#이벤트 처리] - 클릭 이벤트
- FR35: 다중 선택 (기반)

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/hooks/useSelection.ts (new)
- src/utils/renderSelection.ts (new)
- src/components/LayerPanel/LayerItem.tsx (modify)
- src/components/Canvas/Canvas.tsx (modify)
- src/components/InfoPanel/SelectionInfo.tsx (new)
- src/components/InfoPanel/InfoPanel.tsx (modify)
