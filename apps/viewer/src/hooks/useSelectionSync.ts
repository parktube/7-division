import { useEffect, useRef, useMemo } from 'react'
import { useUIContext } from '@/contexts/UIContext'
import { useScene } from '@/hooks/useScene'
import { saveSelection, loadSelection } from '@/utils/selectionIO'
import { debounce } from '@/utils/debounce'

/**
 * Syncs UIContext selection and visibility with selection.json
 * Converts between entity IDs (internal) and names (file)
 */
export function useSelectionSync() {
  const { selectedIds, hiddenIds, lockedIds, select, toggleHidden, toggleLocked } = useUIContext()
  const { scene } = useScene()
  const isLoadedRef = useRef(false)

  // Build maps for ID <-> name conversion
  const { idToName, nameToId } = useMemo(() => {
    const idToName = new Map<string, string>()
    const nameToId = new Map<string, string>()

    if (scene) {
      scene.entities.forEach(e => {
        const name = e.metadata?.name
        if (name) {
          idToName.set(e.id, name)
          nameToId.set(name, e.id)
        }
      })
    }

    return { idToName, nameToId }
  }, [scene])

  // Debounced save function
  const debouncedSave = useRef(
    debounce((selectedNames: string[], hiddenNames: string[], lockedNames: string[]) => {
      saveSelection({
        selected_entities: selectedNames,
        hidden_entities: hiddenNames,
        locked_entities: lockedNames,
        timestamp: Date.now(),
      })
    }, 100)
  ).current

  // Load initial selection and hidden entities
  useEffect(() => {
    if (!scene || isLoadedRef.current) return

    loadSelection().then((data) => {
      // Load selected entities
      if (data.selected_entities.length > 0) {
        const ids = data.selected_entities
          .map(name => nameToId.get(name))
          .filter((id): id is string => id !== undefined)

        if (ids.length > 0) {
          select(ids[0])
        }
      }

      // Load hidden entities
      if (data.hidden_entities && data.hidden_entities.length > 0) {
        data.hidden_entities.forEach(name => {
          const id = nameToId.get(name)
          if (id) {
            toggleHidden(id)
          }
        })
      }

      // Load locked entities
      if (data.locked_entities && data.locked_entities.length > 0) {
        data.locked_entities.forEach(name => {
          const id = nameToId.get(name)
          if (id) {
            toggleLocked(id)
          }
        })
      }

      isLoadedRef.current = true
    })
  }, [scene, nameToId, select, toggleHidden, toggleLocked])

  // Save selection, hidden, and locked entities when they change
  useEffect(() => {
    if (!isLoadedRef.current) return

    // Convert IDs to names
    const selectedNames = Array.from(selectedIds)
      .map(id => idToName.get(id))
      .filter((name): name is string => name !== undefined)

    const hiddenNames = Array.from(hiddenIds)
      .map(id => idToName.get(id))
      .filter((name): name is string => name !== undefined)

    const lockedNames = Array.from(lockedIds)
      .map(id => idToName.get(id))
      .filter((name): name is string => name !== undefined)

    debouncedSave(selectedNames, hiddenNames, lockedNames)
  }, [selectedIds, hiddenIds, lockedIds, idToName, debouncedSave])
}
