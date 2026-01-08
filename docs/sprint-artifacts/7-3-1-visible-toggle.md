# Story 7.3.1: Visible 토글

Status: done

## Story

As a **사용자**,
I want **트리뷰에서 엔티티의 가시성을 토글할 수 있기를**,
so that **불필요한 엔티티를 숨기고 작업에 집중할 수 있다** (FR36).

## Acceptance Criteria

1. **AC1**: 눈 아이콘 클릭 시 가시성 토글 (eye ↔ eye-off)
2. **AC2**: 숨김 엔티티는 Canvas에서 렌더링되지 않음
3. **AC3**: 그룹 숨김 시 자식 엔티티도 함께 숨겨짐
4. **AC4**: 숨김 상태에서 트리뷰 아이템은 반투명 표시
5. **AC5**: 숨김 상태가 selection.json에 저장

## Tasks / Subtasks

- [x] Task 1: Hidden 상태 관리 (AC: #1)
  - [x] UIContext에서 hidden 상태 관리 (useVisibility 훅 대신)
  - [x] hiddenIds Set 관리
  - [x] toggle, showAll, isHidden 함수

- [x] Task 2: LayerItem 눈 아이콘 (AC: #1, #4)
  - [x] Eye, EyeOff 아이콘 표시
  - [x] 클릭 이벤트 핸들러
  - [x] 숨김 시 아이템 반투명 (opacity-50)

- [x] Task 3: Canvas 렌더링 필터 (AC: #2)
  - [x] hiddenIds 전달
  - [x] 렌더링 루프에서 숨김 엔티티 스킵
  - [x] 선택 표시도 숨김 체크

- [x] Task 4: 그룹 숨김 처리 (AC: #3)
  - [x] 그룹 숨김 시 자식 렌더링 스킵
  - [x] 자식 개별 상태는 유지 (그룹 표시 시 복원)

- [x] Task 5: selection.json 확장 (AC: #5)
  - [x] hidden_entities 필드 추가
  - [x] 자동 저장 연동

## Dev Notes

### 의존성: Story 7-2-5

- Story 7-2-5: selection.json 연동

### useVisibility 훅

```typescript
// src/hooks/useVisibility.ts
import { useState, useCallback } from 'react';

export function useVisibility() {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const hide = useCallback((id: string) => {
    setHiddenIds(prev => new Set(prev).add(id));
  }, []);

  const show = useCallback((id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setHiddenIds(new Set());
  }, []);

  const isHidden = useCallback((id: string) => {
    return hiddenIds.has(id);
  }, [hiddenIds]);

  return { hiddenIds, toggle, hide, show, showAll, isHidden };
}
```

### LayerItem 눈 아이콘

```tsx
// src/components/LayerPanel/LayerItem.tsx
import { Eye, EyeOff } from 'lucide-react';

interface LayerItemProps {
  node: TreeNode;
  isHidden: boolean;
  onToggleVisibility: (id: string) => void;
  // ... 기존 props
}

export function LayerItem({ node, isHidden, onToggleVisibility, ...props }: LayerItemProps) {
  const handleVisibilityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleVisibility(node.id);
  };

  return (
    <div className={cn(isHidden && 'opacity-50')}>
      <div className="flex items-center gap-1 py-1 px-1 hover:bg-hover cursor-pointer">
        {/* 가시성 토글 버튼 */}
        <button
          onClick={handleVisibilityClick}
          className="p-0.5 hover:bg-hover-strong rounded"
          title={isHidden ? 'Show' : 'Hide'}
        >
          {isHidden ? (
            <EyeOff size={14} className="text-secondary" />
          ) : (
            <Eye size={14} className="text-secondary" />
          )}
        </button>

        {/* ... Chevron, Icon, Name ... */}
      </div>
      {/* children */}
    </div>
  );
}
```

### Canvas 렌더링 필터

```typescript
// src/utils/renderScene.ts
function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  viewport: ViewportState,
  selectedIds: Set<string>,
  hiddenIds: Set<string>  // 추가
) {
  // ... setup ...

  for (const entity of sortedEntities) {
    // 숨김 엔티티 스킵
    if (hiddenIds.has(entity.id)) continue;

    renderEntity(ctx, entity, entityMap, hiddenIds);
  }

  // 선택 표시 (숨김 엔티티 제외)
  for (const id of selectedIds) {
    if (hiddenIds.has(id)) continue;
    // ... render selection ...
  }
}

function renderEntity(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  entityMap: Map<string, Entity>,
  hiddenIds: Set<string>
) {
  // 그룹의 경우: 숨김이면 자식도 렌더링 스킵
  if (entity.type === 'Group' && entity.group_data) {
    for (const childId of entity.group_data.children) {
      const child = entityMap.get(childId);
      if (!child) continue;

      // 그룹이 숨김이면 자식도 숨김 (개별 숨김과 별개)
      if (hiddenIds.has(entity.id)) continue;
      // 자식 자체가 숨김인지도 확인
      if (hiddenIds.has(childId)) continue;

      renderEntity(ctx, child, entityMap, hiddenIds);
    }
  }
  // ... 일반 렌더링 ...
}
```

### 그룹 숨김 로직

```
그룹 A (숨김)
├── Circle 1  ← 렌더링 안됨 (부모가 숨김)
└── Rect 2    ← 렌더링 안됨 (부모가 숨김)

그룹 B (표시)
├── Circle 3 (숨김)  ← 렌더링 안됨 (개별 숨김)
└── Rect 4 (표시)    ← 렌더링됨
```

**핵심**: 부모 그룹 숨김 시 자식 렌더링 스킵, 자식 개별 상태는 유지

### selection.json 확장

```typescript
// src/types/selection.ts
export interface Selection {
  selected_entities: string[];
  locked_entities?: string[];
  hidden_entities?: string[];  // 추가
  timestamp: number;
}
```

```typescript
// src/hooks/useVisibility.ts - selection.json 동기화
useEffect(() => {
  saveSelection({
    selected_entities: Array.from(selectedIds),
    hidden_entities: Array.from(hiddenIds),
    timestamp: Date.now(),
  });
}, [hiddenIds, selectedIds]);
```

### 트리뷰 시각화

```
┌────────────────────────────────────┐
│ 👁️ ▼ Group A                       │  ← 표시 (눈 열림)
│ 👁️   ● Circle 1                    │
│ 👁️   ■ Rect 2                      │
│                                    │
│ 🚫 ▶ Group B       [반투명]        │  ← 숨김 (눈 닫힘)
│                                    │
│ 👁️ ─ Line 3                        │  ← 표시
└────────────────────────────────────┘
```

### Anti-Patterns (금지)

```typescript
// ❌ 그룹 숨김 시 자식 상태도 변경
const hideGroup = (groupId) => {
  hide(groupId);
  getChildren(groupId).forEach(hide);  // 틀림! 자식 상태 유지해야 함
};

// ❌ 숨김 엔티티도 선택 표시
for (const id of selectedIds) {
  renderSelection(ctx, entityMap.get(id));  // hiddenIds 체크 필요
}

// ❌ 렌더링 루프에서 매번 isHidden 호출 (Set 사용)
entities.forEach(e => {
  if (hiddenIds.includes(e.id)) return;  // includes는 O(n)
});
```

### References

- [docs/ux-design-specification.md#Entity Visibility] - 가시성 UI
- [docs/architecture.md#파일 통신 확장] - selection.json
- FR36: Visible 토글
- [Lucide Eye/EyeOff](https://lucide.dev/icons/eye)

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/contexts/UIContext.tsx (modify) - hidden 상태 추가
- src/components/LayerPanel/LayerPanel.tsx (modify) - LayerContext에 hidden 전달
- src/components/LayerPanel/LayerItem.tsx (modify) - Eye/EyeOff 아이콘 추가
- src/components/Canvas/Canvas.tsx (modify) - hiddenIds 전달
- src/utils/renderEntity.ts (modify) - hidden 엔티티 렌더링 스킵
- src/hooks/useSelectionSync.ts (modify) - hidden_entities 저장
