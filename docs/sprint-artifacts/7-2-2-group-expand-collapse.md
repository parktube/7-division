# Story 7.2.2: 그룹 확장/축소

Status: done

## Story

As a **사용자**,
I want **그룹을 확장하거나 축소하여 내부 엔티티를 탐색할 수 있기를**,
so that **복잡한 씬에서 원하는 부분만 볼 수 있다** (FR34).

## Acceptance Criteria

1. **AC1**: 그룹의 Chevron 아이콘 클릭 시 확장/축소 토글
2. **AC2**: 확장 시 자식 엔티티가 들여쓰기되어 표시
3. **AC3**: 축소 시 자식 엔티티가 숨겨짐
4. **AC4**: 중첩 그룹 각 레벨 독립적 확장/축소
5. **AC5**: 확장 상태가 세션 동안 유지

## Tasks / Subtasks

- [x] Task 1: 확장 상태 관리 (AC: #1, #5)
  - [x] expandedIds Set 상태 정의
  - [x] toggle, expand, collapse 함수
  - [x] Context 또는 상위 컴포넌트에서 관리

- [x] Task 2: Chevron 아이콘 (AC: #1)
  - [x] ChevronRight (축소), ChevronDown (확장)
  - [x] 클릭 영역 설정
  - [x] 리프 노드는 아이콘 없음

- [x] Task 3: LayerItem 수정 (AC: #2, #3)
  - [x] isExpanded prop 추가
  - [x] 조건부 자식 렌더링
  - [x] 들여쓰기 레벨 처리

- [x] Task 4: 중첩 그룹 처리 (AC: #4)
  - [x] 각 그룹별 독립적 확장 상태
  - [x] 부모 축소 시 자식 상태 유지

- [x] Task 5: 키보드 지원 (AC: #1)
  - [x] 좌측 화살표: 축소
  - [x] 우측 화살표: 확장
  - [x] 포커스 상태 관리 (트리 컨테이너에 tabIndex 추가)

## Dev Notes

### 의존성: Story 7-2-1

- Story 7-2-1: 엔티티 트리뷰

### 확장 상태 관리

```typescript
// src/hooks/useTreeExpansion.ts
import { useState, useCallback } from 'react';

export function useTreeExpansion(initialExpanded: Set<string> = new Set()) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(initialExpanded);

  const toggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expand = useCallback((id: string) => {
    setExpandedIds(prev => new Set(prev).add(id));
  }, []);

  const collapse = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const expandAll = useCallback((ids: string[]) => {
    setExpandedIds(new Set(ids));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const isExpanded = useCallback((id: string) => {
    return expandedIds.has(id);
  }, [expandedIds]);

  return { expandedIds, toggle, expand, collapse, expandAll, collapseAll, isExpanded };
}
```

### LayerItem 수정

```tsx
// src/components/LayerPanel/LayerItem.tsx
import { ChevronRight, ChevronDown } from 'lucide-react';
import { TreeNode } from '@/types/tree';
import { ENTITY_ICONS } from '@/utils/entityIcon';

interface LayerItemProps {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}

export function LayerItem({ node, depth, isExpanded, onToggle }: LayerItemProps) {
  const Icon = ENTITY_ICONS[node.type];
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = depth * 16 + 4;

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.id);
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-1 hover:bg-hover cursor-pointer"
        style={{ paddingLeft }}
      >
        {/* Chevron (그룹만) */}
        {hasChildren ? (
          <button
            onClick={handleChevronClick}
            className="p-0.5 hover:bg-hover-strong rounded"
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-secondary" />
            ) : (
              <ChevronRight size={14} className="text-secondary" />
            )}
          </button>
        ) : (
          <span className="w-5" />  {/* 들여쓰기 맞춤 */}
        )}

        {/* 아이콘 */}
        <Icon size={14} className="text-secondary flex-shrink-0" />

        {/* 이름 */}
        <span className="text-sm truncate">{node.name}</span>
      </div>

      {/* 자식 노드 (확장 시에만) */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map(child => (
            <LayerItem
              key={child.id}
              node={child}
              depth={depth + 1}
              isExpanded={/* pass from context */}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### LayerPanel Context

```tsx
// src/components/LayerPanel/LayerPanel.tsx
import { createContext, useContext, useMemo } from 'react';
import { useScene } from '@/hooks/useScene';
import { useTreeExpansion } from '@/hooks/useTreeExpansion';
import { buildTree } from '@/utils/buildTree';
import { LayerItem } from './LayerItem';

interface LayerContextValue {
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
}

const LayerContext = createContext<LayerContextValue | null>(null);

export function useLayerContext() {
  const ctx = useContext(LayerContext);
  if (!ctx) throw new Error('useLayerContext must be used within LayerPanel');
  return ctx;
}

export function LayerPanel() {
  const { scene, isLoading } = useScene();
  const { isExpanded, toggle } = useTreeExpansion();

  const tree = useMemo(() => {
    return scene ? buildTree(scene) : [];
  }, [scene]);

  return (
    <LayerContext.Provider value={{ isExpanded, toggle }}>
      <div className="flex-1 overflow-auto">
        {tree.map(node => (
          <LayerItem
            key={node.id}
            node={node}
            depth={0}
            isExpanded={isExpanded(node.id)}
            onToggle={toggle}
          />
        ))}
      </div>
    </LayerContext.Provider>
  );
}
```

### 키보드 네비게이션

```typescript
// 포커스 상태 관리는 Story 7-2-3에서 구현
// 여기서는 확장/축소 키보드만 처리

const handleKeyDown = (e: React.KeyboardEvent, nodeId: string) => {
  if (e.key === 'ArrowRight') {
    expand(nodeId);
  } else if (e.key === 'ArrowLeft') {
    if (isExpanded(nodeId)) {
      collapse(nodeId);
    }
    // 이미 축소된 경우 부모로 이동 (다음 스토리)
  }
};
```

### Chevron 아이콘 상태

```
┌─▶ Group A (축소)
│   └ (자식 숨김)
│
┌─▼ Group B (확장)
│   ├── Circle 1
│   └── Rect 2
│
├── Line 3 (Chevron 없음, 리프)
```

### 애니메이션 (선택)

```tsx
// 부드러운 확장/축소 (TailwindCSS)
<div
  className={cn(
    'overflow-hidden transition-all duration-200',
    isExpanded ? 'max-h-96' : 'max-h-0'
  )}
>
  {children}
</div>
```

### Anti-Patterns (금지)

```typescript
// ❌ 모든 그룹 기본 확장
const [expandedIds] = useState(new Set(allGroupIds));

// ❌ 부모 축소 시 자식 확장 상태 삭제
const collapse = (id) => {
  // 자식 확장 상태도 삭제 - 틀림!
  const children = getChildIds(id);
  children.forEach(cid => expandedIds.delete(cid));
};

// ❌ 전체 트리 재렌더링
useEffect(() => {
  forceUpdate();  // 비효율적
}, [expandedIds]);
```

### References

- [docs/ux-design-specification.md#Layer Panel] - 트리뷰 인터랙션
- FR34: 그룹 탐색
- [Lucide ChevronRight/Down](https://lucide.dev/icons/chevron-right)

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/hooks/useTreeExpansion.ts (new)
- src/components/LayerPanel/LayerPanel.tsx (modify)
- src/components/LayerPanel/LayerItem.tsx (modify)
