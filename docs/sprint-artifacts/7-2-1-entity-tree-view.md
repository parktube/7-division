# Story 7.2.1: 엔티티 트리뷰

Status: done

## Story

As a **사용자**,
I want **Layer Panel에 scene.json의 모든 엔티티가 트리 구조로 표시되기를**,
so that **씬의 구조를 한눈에 파악할 수 있다** (FR33).

## Acceptance Criteria

1. **AC1**: 모든 엔티티가 트리 형태로 표시
2. **AC2**: 그룹은 폴더 아이콘, 개별 엔티티는 도형 타입별 아이콘 표시
3. **AC3**: 엔티티 이름이 표시
4. **AC4**: z-order 순서대로 정렬 (높을수록 위)
5. **AC5**: scene.json 변경 시 자동 갱신

## Tasks / Subtasks

- [x] Task 1: 트리 데이터 구조 설계 (AC: #1)
  - [x] TreeNode 타입 정의
  - [x] Scene → TreeNode[] 변환 함수
  - [x] 그룹 계층 구조 처리

- [x] Task 2: LayerPanel 컴포넌트 (AC: #1)
  - [x] src/components/LayerPanel/LayerPanel.tsx 리팩터링
  - [x] useScene 훅으로 데이터 로드
  - [x] 트리 구조 렌더링

- [x] Task 3: LayerItem 컴포넌트 (AC: #2, #3)
  - [x] src/components/LayerPanel/LayerItem.tsx 생성
  - [x] 도형 타입별 아이콘 매핑
  - [x] 엔티티 이름 표시

- [x] Task 4: 아이콘 매핑 (AC: #2)
  - [x] Lucide 아이콘 선정
  - [x] Circle → Circle, Rect → Square, etc.
  - [x] Group → Folder

- [x] Task 5: z-order 정렬 (AC: #4)
  - [x] 높은 z-order가 목록 상단
  - [x] 동일 z-order는 배열 순서 기준

- [x] Task 6: 자동 갱신 (AC: #5)
  - [x] useScene 폴링 연동
  - [x] 트리 상태 자동 업데이트

## Dev Notes

### 의존성: Story 7-1-4

- Story 7-1-4: Canvas 씬 렌더링 (useScene 훅)

### TreeNode 타입

```typescript
// src/types/tree.ts
import { Entity, EntityType } from './scene';

export interface TreeNode {
  id: string;
  name: string;
  type: EntityType;
  zOrder: number;
  children?: TreeNode[];
  entity: Entity;  // 원본 엔티티 참조
}
```

### Scene → TreeNode 변환

```typescript
// src/utils/buildTree.ts
import { Scene, Entity } from '@/types/scene';
import { TreeNode } from '@/types/tree';

export function buildTree(scene: Scene): TreeNode[] {
  const entityMap = new Map<string, Entity>();
  scene.entities.forEach(e => entityMap.set(e.id, e));

  // 그룹의 자식 ID Set
  const childIds = new Set<string>();
  scene.entities.forEach(e => {
    if (e.group_data?.children) {
      e.group_data.children.forEach(id => childIds.add(id));
    }
  });

  // 재귀적으로 TreeNode 생성
  function toTreeNode(entity: Entity): TreeNode {
    const node: TreeNode = {
      id: entity.id,
      name: entity.id,  // 이름 = ID
      type: entity.type,
      zOrder: entity.z_order ?? 0,
      entity,
    };

    if (entity.group_data?.children) {
      node.children = entity.group_data.children
        .map(id => entityMap.get(id))
        .filter(Boolean)
        .map(e => toTreeNode(e!))
        .sort((a, b) => b.zOrder - a.zOrder);  // 높은 z-order 먼저
    }

    return node;
  }

  // 루트 레벨 엔티티만 (다른 그룹의 자식이 아닌)
  const rootEntities = scene.entities
    .filter(e => !childIds.has(e.id))
    .sort((a, b) => (b.z_order ?? 0) - (a.z_order ?? 0));

  return rootEntities.map(toTreeNode);
}
```

### Lucide 아이콘 매핑

```typescript
// src/utils/entityIcon.ts
import {
  Circle,
  Square,
  Minus,
  Hexagon,
  Sun,
  Spline,
  Folder,
  LucideIcon
} from 'lucide-react';
import { EntityType } from '@/types/scene';

export const ENTITY_ICONS: Record<EntityType, LucideIcon> = {
  Circle: Circle,
  Rect: Square,
  Line: Minus,
  Polygon: Hexagon,
  Arc: Sun,
  Bezier: Spline,
  Group: Folder,
};
```

### LayerItem 컴포넌트

```tsx
// src/components/LayerPanel/LayerItem.tsx
import { TreeNode } from '@/types/tree';
import { ENTITY_ICONS } from '@/utils/entityIcon';

interface LayerItemProps {
  node: TreeNode;
  depth: number;
}

export function LayerItem({ node, depth }: LayerItemProps) {
  const Icon = ENTITY_ICONS[node.type];
  const paddingLeft = depth * 16;  // 들여쓰기

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-hover cursor-pointer"
        style={{ paddingLeft }}
      >
        <Icon size={14} className="text-secondary" />
        <span className="text-sm truncate">{node.name}</span>
      </div>

      {/* 자식 노드 재귀 렌더링 */}
      {node.children?.map(child => (
        <LayerItem key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
```

### LayerPanel 컴포넌트

```tsx
// src/components/LayerPanel/LayerPanel.tsx
import { useMemo } from 'react';
import { useScene } from '@/hooks/useScene';
import { buildTree } from '@/utils/buildTree';
import { LayerItem } from './LayerItem';

export function LayerPanel() {
  const { scene, isLoading } = useScene();

  const tree = useMemo(() => {
    return scene ? buildTree(scene) : [];
  }, [scene]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-secondary">Loading...</span>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-secondary text-sm">No entities</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {tree.map(node => (
        <LayerItem key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
```

### z-order 정렬 규칙

```
z_order: 10  ← 목록 맨 위 (앞에 보임)
z_order: 5
z_order: 0   ← 기본값
z_order: -5  ← 목록 맨 아래 (뒤에 보임)
```

레이어 패널에서는 Canvas 표시와 **동일**하게 정렬:
- 높은 z-order = 목록 상단 = Canvas 앞쪽

### 폴더 구조

```
src/components/LayerPanel/
├── LayerPanel.tsx      # 패널 컨테이너
├── LayerItem.tsx       # 개별 아이템 (재귀)
├── index.ts            # barrel export
└── types.ts            # (선택) 컴포넌트 전용 타입
```

### Anti-Patterns (금지)

```typescript
// ❌ 매번 트리 재구축
useEffect(() => {
  setTree(buildTree(scene));  // 틀림! useMemo 사용
}, [scene]);

// ❌ 모든 노드 동시 펼침 (성능)
function renderAll(node) {
  return node.children?.map(child => <LayerItem node={child} />);
}
// 초기에는 축소 상태, 클릭 시 확장 (다음 스토리)

// ❌ 엔티티 직접 렌더링 (트리 구조 무시)
scene.entities.map(e => <LayerItem entity={e} />);  // 그룹 계층 무시됨
```

### References

- [docs/architecture.md#Project Structure] - 컴포넌트 구조
- [docs/ux-design-specification.md#Layer Panel] - 트리뷰 디자인
- FR33: 계층 트리뷰
- [Lucide Icons](https://lucide.dev/icons/) - 아이콘 목록

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/types/tree.ts (new)
- src/utils/buildTree.ts (new)
- src/utils/entityIcon.ts (new)
- src/components/LayerPanel/LayerPanel.tsx (modify)
- src/components/LayerPanel/LayerItem.tsx (new)
- src/components/LayerPanel/index.ts (modify)
