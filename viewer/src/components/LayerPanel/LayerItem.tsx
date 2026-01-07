import { ChevronRight, ChevronDown, Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import type { TreeNode } from '@/types/tree'
import { ENTITY_ICONS, ENTITY_ICON_COLORS } from '@/utils/entityIcon'
import { isModifierKey } from '@/utils/platform'
import { useLayerContext } from './LayerPanel'

interface LayerItemProps {
  node: TreeNode
  depth: number
  parentLocked?: boolean
}

export default function LayerItem({ node, depth, parentLocked = false }: LayerItemProps) {
  const { isExpanded, toggle, isSelected, select, toggleSelect, rangeSelect, isHidden, toggleHidden, isLocked, toggleLocked } = useLayerContext()
  const Icon = ENTITY_ICONS[node.type]
  const iconColor = ENTITY_ICON_COLORS[node.type]
  const isGroup = node.type === 'Group'
  const hasChildren = node.children && node.children.length > 0
  const expanded = isExpanded(node.id)
  const selected = isSelected(node.id)
  const hidden = isHidden(node.id)
  const selfLocked = isLocked(node.id)
  const locked = selfLocked || parentLocked  // 부모가 잠기면 자식도 잠김

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggle(node.id)
  }

  const handleVisibilityClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleHidden(node.id)
  }

  const handleLockClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleLocked(node.id)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (e.shiftKey) {
      // Shift+클릭: 범위 선택
      rangeSelect(node.id)
    } else if (isModifierKey(e)) {
      // Ctrl/Cmd+클릭: 토글
      toggleSelect(node.id)
    } else {
      // 일반 클릭: 단일 선택
      select(node.id)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(node.id)
    }
  }

  return (
    <div role="treeitem" aria-selected={selected} aria-expanded={isGroup ? expanded : undefined}>
      <div
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className={`group flex items-center h-8 cursor-pointer mx-1 my-px rounded transition-colors relative
          ${selected
            ? 'bg-[var(--selection-bg)]'
            : 'hover:bg-[var(--hover)]'
          }
          ${hidden ? 'opacity-50' : ''}`}
        style={{ paddingLeft: depth * 24 + 8 }}
      >
        {/* Selection indicator */}
        {selected && (
          <div
            className="absolute left-0 top-1 bottom-1 w-0.5 rounded-sm"
            style={{ backgroundColor: 'var(--selection)' }}
          />
        )}

        {/* Chevron (groups only) */}
        <div className="w-6 h-8 flex items-center justify-center flex-shrink-0">
          {isGroup && hasChildren && (
            <button
              type="button"
              onClick={handleChevronClick}
              aria-label={expanded ? 'Collapse group' : 'Expand group'}
              className="p-0.5 rounded hover:bg-[var(--hover-strong)] transition-colors"
            >
              {expanded ? (
                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
              ) : (
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              )}
            </button>
          )}
        </div>

        {/* Icon */}
        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
          <div
            className="w-4 h-4 rounded flex items-center justify-center"
            style={{
              backgroundColor: isGroup ? 'rgba(139, 92, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            }}
          >
            <Icon size={12} color={iconColor} />
          </div>
        </div>

        {/* Name */}
        <span
          className={`flex-1 text-[13px] truncate ${selected ? 'font-medium' : ''}`}
          style={{ color: selected ? 'var(--selection)' : 'var(--text-primary)' }}
        >
          {node.name}
        </span>

        {/* Lock toggle */}
        <button
          type="button"
          onClick={handleLockClick}
          aria-label={locked ? 'Unlock layer' : 'Lock layer'}
          aria-pressed={locked}
          className={`w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--hover-strong)] transition-all flex-shrink-0
            ${locked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          style={{ color: locked ? '#f97316' : 'var(--text-secondary)' }}
        >
          {locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>

        {/* Visibility toggle */}
        <button
          type="button"
          onClick={handleVisibilityClick}
          aria-label={hidden ? 'Show layer' : 'Hide layer'}
          aria-pressed={hidden}
          className={`w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--hover-strong)] transition-all flex-shrink-0
            ${hidden ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          style={{ color: hidden ? 'var(--text-muted)' : 'var(--text-secondary)' }}
        >
          {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {/* Children (recursive, only when expanded) */}
      {hasChildren && expanded && node.children!.map(child => (
        <LayerItem key={child.id} node={child} depth={depth + 1} parentLocked={locked} />
      ))}
    </div>
  )
}
