import { useMemo, createContext, useContext, useCallback, useRef } from 'react'
import { Search, Plus, MoreHorizontal } from 'lucide-react'
import { useScene } from '@/hooks/useScene'
import { useTreeExpansion } from '@/hooks/useTreeExpansion'
import { useUIContext } from '@/contexts/UIContext'
import type { TreeNode } from '@/types/tree'
import LayerItem from './LayerItem'

/** Flatten tree to array of IDs (for range selection) */
function flattenTree(nodes: TreeNode[]): string[] {
  const result: string[] = []
  function traverse(node: TreeNode) {
    result.push(node.id)
    node.children?.forEach(traverse)
  }
  nodes.forEach(traverse)
  return result
}

/** Find a node in tree by ID */
function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

interface LayerContextValue {
  isExpanded: (id: string) => boolean
  toggle: (id: string) => void
  isSelected: (id: string) => boolean
  select: (id: string) => void
  toggleSelect: (id: string) => void
  rangeSelect: (id: string) => void
  isHidden: (id: string) => boolean
  toggleHidden: (id: string) => void
  isLocked: (id: string) => boolean
  toggleLocked: (id: string) => void
}

const LayerContext = createContext<LayerContextValue | null>(null)

export function useLayerContext() {
  const ctx = useContext(LayerContext)
  if (!ctx) throw new Error('useLayerContext must be used within LayerPanel')
  return ctx
}

export default function LayerPanel() {
  const { scene, isLoading } = useScene()
  const { isExpanded, toggle, expand, collapse } = useTreeExpansion()
  const { isSelected, select, toggleSelect, rangeSelect, clearSelection, isHidden, toggleHidden, isLocked, toggleLocked, selectedArray } = useUIContext()
  const treeContainerRef = useRef<HTMLDivElement>(null)

  // Dumb View: read pre-computed tree from scene.json
  const tree = useMemo(() => {
    return (scene?.tree ?? []) as TreeNode[]
  }, [scene])

  const orderedIds = useMemo(() => {
    return flattenTree(tree)
  }, [tree])

  const handleRangeSelect = (id: string) => {
    rangeSelect(id, orderedIds)
  }

  const handleEmptyClick = () => {
    clearSelection()
  }

  // Keyboard navigation for expand/collapse (Story 7-2-2 Task 5)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Only handle arrow keys
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return

    // Need at least one selected item
    if (selectedArray.length === 0) return

    const selectedId = selectedArray[0]
    const node = findNode(tree, selectedId)
    if (!node) return

    // Only groups can be expanded/collapsed
    const hasChildren = node.children && node.children.length > 0
    if (!hasChildren) return

    e.preventDefault()

    if (e.key === 'ArrowRight') {
      // Expand
      expand(selectedId)
    } else if (e.key === 'ArrowLeft') {
      // Collapse
      collapse(selectedId)
    }
  }, [selectedArray, tree, expand, collapse])

  return (
    <LayerContext.Provider value={{ isExpanded, toggle, isSelected, select, toggleSelect, rangeSelect: handleRangeSelect, isHidden, toggleHidden, isLocked, toggleLocked }}>
      <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-panel)' }}>
        {/* Panel Header */}
        <div
          className="h-9 px-3 flex items-center justify-between flex-shrink-0"
          style={{ backgroundColor: 'var(--bg-panel-header)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <span
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-secondary)' }}
          >
            Layers
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Add layer"
              className="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-[var(--hover)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              aria-label="More options"
              className="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-[var(--hover)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search layers..."
              aria-label="Search layers"
              className="w-full py-1.5 pl-8 pr-2.5 text-xs rounded-md outline-none transition-all
                         border border-transparent focus:border-[var(--selection)] focus:bg-white focus:shadow-[0_0_0_3px_var(--selection-bg)]"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* Tree */}
        <div
          ref={treeContainerRef}
          role="tree"
          aria-label="Layer tree"
          className="flex-1 overflow-y-auto py-1 outline-none"
          onClick={handleEmptyClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {isLoading ? (
            <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Loading...
            </p>
          ) : tree.length === 0 ? (
            <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              No entities
            </p>
          ) : (
            tree.map(node => (
              <LayerItem key={node.id} node={node} depth={0} />
            ))
          )}
        </div>
      </div>
    </LayerContext.Provider>
  )
}
