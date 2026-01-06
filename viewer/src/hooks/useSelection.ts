import { useState, useCallback, useMemo } from 'react'

export function useSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Single select (replaces existing selection)
  const select = useCallback((id: string) => {
    setSelectedIds(new Set([id]))
  }, [])

  // Deselect single
  const deselect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Clear all
  const clear = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Toggle selection (for multi-select in future)
  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Check if selected
  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id)
  }, [selectedIds])

  // Array form
  const selectedArray = useMemo(() => {
    return Array.from(selectedIds)
  }, [selectedIds])

  return {
    selectedIds,
    selectedArray,
    select,
    deselect,
    toggle,
    clear,
    isSelected,
  }
}
