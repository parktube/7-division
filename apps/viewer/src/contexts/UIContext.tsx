import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

interface MousePosition {
  x: number
  y: number
}

interface UIContextValue {
  // Mouse position (world coordinates)
  mousePosition: MousePosition
  setMousePosition: (pos: MousePosition) => void

  // View options
  gridEnabled: boolean
  setGridEnabled: (enabled: boolean) => void
  rulersEnabled: boolean
  setRulersEnabled: (enabled: boolean) => void
  sketchMode: boolean
  setSketchMode: (enabled: boolean) => void

  // Selection
  selectedIds: Set<string>
  selectedArray: string[]
  selectedCount: number
  lastSelectedId: string | null
  select: (id: string) => void
  selectMultiple: (ids: string[]) => void
  deselect: (id: string) => void
  toggleSelect: (id: string) => void
  rangeSelect: (id: string, orderedIds: string[]) => void
  clearSelection: () => void
  isSelected: (id: string) => boolean

  // Visibility
  hiddenIds: Set<string>
  hiddenArray: string[]
  toggleHidden: (id: string) => void
  showAll: () => void
  isHidden: (id: string) => boolean

  // Lock
  lockedIds: Set<string>
  lockedArray: string[]
  toggleLocked: (id: string) => void
  unlockAll: () => void
  isLocked: (id: string) => boolean
}

const UIContext = createContext<UIContextValue | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [mousePosition, setMousePositionState] = useState<MousePosition>({ x: 0, y: 0 })
  const [gridEnabled, setGridEnabledState] = useState(true)
  const [rulersEnabled, setRulersEnabledState] = useState(true)
  const [sketchMode, setSketchModeState] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set())

  const setMousePosition = useCallback((pos: MousePosition) => {
    setMousePositionState(pos)
  }, [])

  const setGridEnabled = useCallback((enabled: boolean) => {
    setGridEnabledState(enabled)
  }, [])

  const setRulersEnabled = useCallback((enabled: boolean) => {
    setRulersEnabledState(enabled)
  }, [])

  const setSketchMode = useCallback((enabled: boolean) => {
    setSketchModeState(enabled)
  }, [])

  // Selection functions
  const select = useCallback((id: string) => {
    setSelectedIds(new Set([id]))
    setLastSelectedId(id)
  }, [])

  const selectMultiple = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(ids))
    setLastSelectedId(ids[ids.length - 1])
  }, [])

  const deselect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const wasSelected = next.has(id)
      if (wasSelected) {
        next.delete(id)
      } else {
        next.add(id)
        // Only update lastSelectedId when selecting, not deselecting
        setLastSelectedId(id)
      }
      return next
    })
  }, [])

  const rangeSelect = useCallback((id: string, orderedIds: string[]) => {
    if (!lastSelectedId) {
      setSelectedIds(new Set([id]))
      setLastSelectedId(id)
      return
    }

    const startIdx = orderedIds.indexOf(lastSelectedId)
    const endIdx = orderedIds.indexOf(id)

    if (startIdx === -1 || endIdx === -1) {
      setSelectedIds(new Set([id]))
      setLastSelectedId(id)
      return
    }

    const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
    const rangeIds = orderedIds.slice(from, to + 1)
    setSelectedIds(new Set(rangeIds))
    // lastSelectedId는 유지 (연속 Shift+클릭 지원)
  }, [lastSelectedId])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id)
  }, [selectedIds])

  const selectedArray = useMemo(() => {
    return Array.from(selectedIds)
  }, [selectedIds])

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds])

  // Visibility functions
  const toggleHidden = useCallback((id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const showAll = useCallback(() => {
    setHiddenIds(new Set())
  }, [])

  const isHidden = useCallback((id: string) => {
    return hiddenIds.has(id)
  }, [hiddenIds])

  const hiddenArray = useMemo(() => {
    return Array.from(hiddenIds)
  }, [hiddenIds])

  // Lock functions
  const toggleLocked = useCallback((id: string) => {
    setLockedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const unlockAll = useCallback(() => {
    setLockedIds(new Set())
  }, [])

  const isLocked = useCallback((id: string) => {
    return lockedIds.has(id)
  }, [lockedIds])

  const lockedArray = useMemo(() => {
    return Array.from(lockedIds)
  }, [lockedIds])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    mousePosition,
    setMousePosition,
    gridEnabled,
    setGridEnabled,
    rulersEnabled,
    setRulersEnabled,
    sketchMode,
    setSketchMode,
    selectedIds,
    selectedArray,
    selectedCount,
    lastSelectedId,
    select,
    selectMultiple,
    deselect,
    toggleSelect,
    rangeSelect,
    clearSelection,
    isSelected,
    hiddenIds,
    hiddenArray,
    toggleHidden,
    showAll,
    isHidden,
    lockedIds,
    lockedArray,
    toggleLocked,
    unlockAll,
    isLocked,
  }), [
    mousePosition,
    setMousePosition,
    gridEnabled,
    setGridEnabled,
    rulersEnabled,
    setRulersEnabled,
    sketchMode,
    setSketchMode,
    selectedIds,
    selectedArray,
    selectedCount,
    lastSelectedId,
    select,
    selectMultiple,
    deselect,
    toggleSelect,
    rangeSelect,
    clearSelection,
    isSelected,
    hiddenIds,
    hiddenArray,
    toggleHidden,
    showAll,
    isHidden,
    lockedIds,
    lockedArray,
    toggleLocked,
    unlockAll,
    isLocked,
  ])

  return (
    <UIContext.Provider value={contextValue}>
      {children}
    </UIContext.Provider>
  )
}

export function useUIContext() {
  const context = useContext(UIContext)
  if (!context) {
    throw new Error('useUIContext must be used within UIProvider')
  }
  return context
}
