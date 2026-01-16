import { useState, useCallback } from 'react'

export function useTreeExpansion(initialExpanded: Set<string> = new Set()) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(initialExpanded)

  const toggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const expand = useCallback((id: string) => {
    setExpandedIds(prev => new Set(prev).add(id))
  }, [])

  const collapse = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const expandAll = useCallback((ids: string[]) => {
    setExpandedIds(new Set(ids))
  }, [])

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  const isExpanded = useCallback((id: string) => {
    return expandedIds.has(id)
  }, [expandedIds])

  return { expandedIds, toggle, expand, collapse, expandAll, collapseAll, isExpanded }
}
