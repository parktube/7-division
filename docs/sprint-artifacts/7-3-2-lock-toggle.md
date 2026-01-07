# Story 7.3.2: Lock 토글

Status: done

## Story

As a **사용자**,
I want **엔티티를 잠금 처리하여 LLM이 수정하지 못하게 보호할 수 있기를**,
so that **중요한 엔티티가 실수로 변경되는 것을 방지할 수 있다** (FR37).

## Acceptance Criteria

1. **AC1**: 자물쇠 아이콘 클릭 시 잠금 토글 (unlock ↔ lock)
2. **AC2**: 잠긴 엔티티는 주황색으로 표시 (트리뷰 & Canvas)
3. **AC3**: Canvas에서 잠긴 엔티티에 주황색 테두리 표시
4. **AC4**: 잠금 상태가 selection.json에 저장
5. **AC5**: 그룹 잠금 시 자식 엔티티도 함께 보호

## Tasks / Subtasks

- [x] Task 1: Lock 상태 관리 (AC: #1)
  - [x] UIContext에서 locked 상태 관리
  - [x] lockedIds Set 관리
  - [x] toggleLocked, unlockAll, isLocked 함수

- [x] Task 2: LayerItem 자물쇠 아이콘 (AC: #1, #2)
  - [x] Lock, Unlock 아이콘 표시
  - [x] 잠금 시 주황색 아이콘 (#f97316)
  - [x] 클릭 이벤트 핸들러

- [x] Task 3: Canvas 잠금 표시 (AC: #3)
  - [x] 잠긴 엔티티에 주황색 실선 테두리
  - [x] 선택 테두리(파란색 점선)와 구분

- [x] Task 4: selection.json 확장 (AC: #4)
  - [x] locked_entities 필드 사용
  - [x] 자동 저장/로드 연동

- [x] Task 5: 그룹 잠금 처리 (AC: #5)
  - [x] 그룹 잠금 시 Canvas에서 주황색 테두리 표시
  - [x] 그룹의 자식도 잠금 상태 표시됨 (부모 범위로)

## Dev Notes

### 의존성: Story 7-3-1

- Story 7-3-1: Visible 토글 (유사 패턴)

### useLock 훅

```typescript
// src/hooks/useLock.ts
import { useState, useCallback } from 'react';

export function useLock() {
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setLockedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const lock = useCallback((id: string) => {
    setLockedIds(prev => new Set(prev).add(id));
  }, []);

  const unlock = useCallback((id: string) => {
    setLockedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const unlockAll = useCallback(() => {
    setLockedIds(new Set());
  }, []);

  const isLocked = useCallback((id: string) => {
    return lockedIds.has(id);
  }, [lockedIds]);

  return { lockedIds, toggle, lock, unlock, unlockAll, isLocked };
}
```

### 그룹 포함 잠금 확인

```typescript
// src/hooks/useLock.ts - 확장
export function useLock(scene: Scene | null) {
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  // 부모 그룹이 잠겨 있으면 자식도 잠김으로 간주
  const isEffectivelyLocked = useCallback((id: string): boolean => {
    if (lockedIds.has(id)) return true;

    // 부모 그룹 체크
    if (!scene) return false;

    const entity = scene.entities.find(e => e.id === id);
    if (!entity) return false;

    // 이 엔티티를 포함하는 그룹 찾기
    for (const e of scene.entities) {
      if (e.type === 'Group' && e.group_data?.children.includes(id)) {
        if (isEffectivelyLocked(e.id)) return true;
      }
    }

    return false;
  }, [lockedIds, scene]);

  return { lockedIds, isLocked, isEffectivelyLocked, toggle, lock, unlock };
}
```

### LayerItem 자물쇠 아이콘

```tsx
// src/components/LayerPanel/LayerItem.tsx
import { Lock, Unlock } from 'lucide-react';

interface LayerItemProps {
  node: TreeNode;
  isLocked: boolean;
  onToggleLock: (id: string) => void;
  // ... 기존 props
}

export function LayerItem({ node, isLocked, onToggleLock, ...props }: LayerItemProps) {
  const handleLockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleLock(node.id);
  };

  return (
    <div>
      <div className="flex items-center gap-1 py-1 px-1 hover:bg-hover cursor-pointer">
        {/* 가시성 토글 */}
        {/* ... Eye icon ... */}

        {/* 잠금 토글 */}
        <button
          onClick={handleLockClick}
          className="p-0.5 hover:bg-hover-strong rounded"
          title={isLocked ? 'Unlock' : 'Lock'}
        >
          {isLocked ? (
            <Lock size={14} className="text-orange-500" />
          ) : (
            <Unlock size={14} className="text-secondary" />
          )}
        </button>

        {/* ... Chevron, Type Icon, Name ... */}
      </div>
    </div>
  );
}
```

### Canvas 잠금 표시

```typescript
// src/utils/renderLock.ts
export function renderLockIndicator(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  viewport: ViewportState
) {
  // ✅ scene.json의 computed에서 읽기 (Dumb View 원칙)
  const bounds = entity.computed?.world_bounds;
  if (!bounds) return;

  ctx.save();

  ctx.translate(viewport.offset.x, viewport.offset.y);
  ctx.scale(viewport.zoom, viewport.zoom);

  // 주황색 실선 테두리
  ctx.strokeStyle = '#f97316';  // orange-500
  ctx.lineWidth = 2 / viewport.zoom;
  ctx.setLineDash([]);  // 실선

  ctx.strokeRect(
    bounds.min[0],
    bounds.min[1],
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1]
  );

  // 자물쇠 아이콘 (우상단)
  const iconSize = 12 / viewport.zoom;
  const iconX = bounds.max[0] - iconSize - 2 / viewport.zoom;
  const iconY = bounds.max[1] + 2 / viewport.zoom;

  ctx.fillStyle = '#f97316';
  // 간단한 자물쇠 모양 (또는 이미지 사용)
  ctx.fillRect(iconX, iconY, iconSize, iconSize);

  ctx.restore();
}
```

### 렌더링에 잠금 표시 추가

```typescript
// renderScene 수정
function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  viewport: ViewportState,
  selectedIds: Set<string>,
  hiddenIds: Set<string>,
  lockedIds: Set<string>  // 추가
) {
  // ... 엔티티 렌더링 ...

  // 잠금 표시 렌더링 (선택 표시보다 먼저)
  for (const id of lockedIds) {
    if (hiddenIds.has(id)) continue;
    const entity = entityMap.get(id);
    if (entity) {
      renderLockIndicator(ctx, entity, viewport);
    }
  }

  // 선택 표시 렌더링 (맨 위)
  for (const id of selectedIds) {
    // ...
  }
}
```

### 색상 구분

```
선택된 엔티티: 파란색 점선 테두리 (#2563eb)
잠긴 엔티티: 주황색 실선 테두리 (#f97316)
선택 + 잠금: 둘 다 표시 (주황 안쪽, 파랑 바깥)
```

### selection.json 확장

```json
{
  "selected_entities": ["circle_1"],
  "locked_entities": ["rect_2", "group_3"],
  "hidden_entities": ["line_4"],
  "timestamp": 1704499200000
}
```

### 트리뷰 시각화

```
┌──────────────────────────────────────────┐
│ 👁️ 🔓 ▼ Group A                          │  ← 잠금 해제
│ 👁️ 🔓   ● Circle 1                       │
│ 👁️ 🔒   ■ Rect 2     [주황색]            │  ← 잠금
│                                          │
│ 👁️ 🔒 ▶ Group B      [주황색]            │  ← 잠금 (자식도 보호)
│                                          │
│ 👁️ 🔓 ─ Line 3                           │  ← 잠금 해제
└──────────────────────────────────────────┘
```

### Anti-Patterns (금지)

```typescript
// ❌ 잠금 상태에서 선택 불가
if (isLocked(id)) return;  // 틀림! 잠금은 LLM 수정 방지, 선택은 가능

// ❌ 그룹 잠금 시 자식 lockedIds에 추가
const lockGroup = (groupId) => {
  lock(groupId);
  getChildren(groupId).forEach(lock);  // 틀림! isEffectivelyLocked 사용
};

// ❌ 잠금/선택 테두리 겹침 처리 없음
// 둘 다 같은 두께면 겹쳐서 안 보임
```

### References

- [docs/ux-design-specification.md#Entity Lock] - 잠금 UI
- [docs/architecture.md#파일 통신 확장] - selection.json
- FR37: Lock 가드
- [Lucide Lock/Unlock](https://lucide.dev/icons/lock)

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/contexts/UIContext.tsx (modify) - locked 상태 추가
- src/components/LayerPanel/LayerPanel.tsx (modify) - LayerContext에 locked 전달
- src/components/LayerPanel/LayerItem.tsx (modify) - Lock/Unlock 아이콘 추가
- src/components/Canvas/Canvas.tsx (modify) - 주황색 잠금 테두리 렌더링
- src/hooks/useSelectionSync.ts (modify) - locked_entities 저장
