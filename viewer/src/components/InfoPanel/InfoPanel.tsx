import { useMemo, useState } from 'react'
import { ChevronDown, MoreHorizontal, Check, Lock, Globe, Box } from 'lucide-react'
import { useUIContext } from '@/contexts/UIContext'
import { useScene } from '@/hooks/useScene'
import { ENTITY_ICONS } from '@/utils/entityIcon'
import { calculateEntityBounds, calculateWorldBounds } from '@/utils/calculateBounds'
import type { Entity } from '@/types/scene'

type CoordinateSpace = 'world' | 'local'

// Get entity position (center of bounds or geometry origin)
function getEntityPosition(entity: Entity, entityMap: Map<string, Entity>): { x: number; y: number } {
  const geo = entity.geometry

  // Try to get position from geometry
  if (typeof geo === 'object' && geo !== null) {
    if ('Circle' in geo) {
      const { center } = geo.Circle
      return {
        x: center[0] + entity.transform.translate[0],
        y: center[1] + entity.transform.translate[1]
      }
    }
    if ('Rect' in geo) {
      const { origin, width, height } = geo.Rect
      return {
        x: origin[0] + width / 2 + entity.transform.translate[0],
        y: origin[1] + height / 2 + entity.transform.translate[1]
      }
    }
    if ('Arc' in geo) {
      const { center } = geo.Arc
      return {
        x: center[0] + entity.transform.translate[0],
        y: center[1] + entity.transform.translate[1]
      }
    }
  }

  // For groups or other types, use bounds center
  const bounds = calculateEntityBounds(entity, entityMap)
  if (bounds) {
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    }
  }

  // Fallback to transform
  return {
    x: entity.transform.translate[0],
    y: entity.transform.translate[1]
  }
}

// Get world position (center of world bounds)
function getWorldPosition(entity: Entity, entityMap: Map<string, Entity>): { x: number; y: number } | null {
  const bounds = calculateWorldBounds(entity, entityMap)
  if (!bounds) return null
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  }
}

// Get effective z-order info (consider parent group)
function getEffectiveZOrder(entity: Entity, entityMap: Map<string, Entity>): string {
  const ownZ = entity.metadata?.z_index ?? 0

  // If has parent, show parent's z-order + position in group
  if (entity.parent_id) {
    const parent = entityMap.get(entity.parent_id)
    if (parent && parent.children) {
      const parentZ = parent.metadata?.z_index ?? 0
      const entityName = entity.metadata?.name || entity.id
      const idx = parent.children.indexOf(entityName)
      if (idx !== -1) {
        // Show: parentZ (position/total)
        return `${parentZ} (${idx + 1}/${parent.children.length})`
      }
      return String(parentZ)
    }
  }

  return String(ownZ)
}

export default function InfoPanel() {
  const { selectedArray } = useUIContext()
  const { scene } = useScene()
  const [coordinateSpace, setCoordinateSpace] = useState<CoordinateSpace>('world')

  // Build entity map for lookups
  const entityMap = useMemo(() => {
    if (!scene) return new Map<string, Entity>()
    const map = new Map<string, Entity>()
    scene.entities.forEach(e => {
      map.set(e.id, e)
      if (e.metadata?.name) {
        map.set(e.metadata.name, e)
      }
    })
    return map
  }, [scene])

  // Get selected entity
  const selectedEntity = useMemo((): Entity | null => {
    if (!scene || selectedArray.length === 0) return null
    return scene.entities.find(e => e.id === selectedArray[0]) || null
  }, [scene, selectedArray])

  // Check if entity has parent (World/Local will differ)
  const hasParent = useMemo(() => {
    return selectedEntity?.parent_id != null
  }, [selectedEntity])

  // Get parent name for display
  const parentName = useMemo(() => {
    if (!selectedEntity?.parent_id) return null
    const parent = entityMap.get(selectedEntity.parent_id)
    return parent?.metadata?.name || parent?.id?.slice(0, 8) || null
  }, [selectedEntity, entityMap])

  // Calculate position based on coordinate space
  const position = useMemo(() => {
    if (!selectedEntity) return { x: 0, y: 0 }
    if (coordinateSpace === 'world') {
      return getWorldPosition(selectedEntity, entityMap) || { x: 0, y: 0 }
    }
    return getEntityPosition(selectedEntity, entityMap)
  }, [selectedEntity, entityMap, coordinateSpace])

  // Calculate bounds for display
  const bounds = useMemo(() => {
    if (!selectedEntity) return null
    if (coordinateSpace === 'world') {
      return calculateWorldBounds(selectedEntity, entityMap)
    }
    return calculateEntityBounds(selectedEntity, entityMap)
  }, [selectedEntity, entityMap, coordinateSpace])

  const zOrder = useMemo(() => {
    if (!selectedEntity) return '0'
    return getEffectiveZOrder(selectedEntity, entityMap)
  }, [selectedEntity, entityMap])

  const Icon = selectedEntity ? ENTITY_ICONS[selectedEntity.entity_type] : null

  return (
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
          Properties
        </span>
        <button
          className="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-[var(--hover)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Selection Section */}
        <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div
            className="px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors hover:bg-[var(--hover)]"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Selection
            </span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="px-3 pb-3">
            {selectedEntity ? (
              <div className="space-y-2">
                {/* Badges */}
                <div className="flex gap-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium"
                    style={{ backgroundColor: 'var(--selection-bg)', color: 'var(--selection)' }}
                  >
                    <Check size={12} />
                    Selected
                  </span>
                  {selectedEntity.metadata?.locked && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium"
                      style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: 'var(--lock)' }}
                    >
                      <Lock size={12} />
                      Locked
                    </span>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                    Name
                  </label>
                  <div className="flex items-center gap-2">
                    {Icon && <Icon size={14} style={{ color: 'var(--text-secondary)' }} />}
                    <input
                      type="text"
                      value={selectedEntity.metadata?.name || selectedEntity.id.slice(0, 8)}
                      readOnly
                      className="flex-1 py-1.5 px-2 text-xs rounded outline-none"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>

                {/* Type */}
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                    Type
                  </label>
                  <div
                    className="py-1.5 px-2 text-xs rounded"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    {selectedEntity.entity_type}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No selection
              </p>
            )}
          </div>
        </div>

        {/* Coordinates Section */}
        <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div
            className="px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors hover:bg-[var(--hover)]"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Coordinates
            </span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="px-3 pb-3 space-y-3">
            {/* World/Local Toggle */}
            <div className="flex items-center gap-1 p-0.5 rounded" style={{ backgroundColor: 'var(--bg-input)' }}>
              <button
                onClick={() => setCoordinateSpace('world')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] font-medium rounded transition-colors"
                style={{
                  backgroundColor: coordinateSpace === 'world' ? 'var(--selection-bg)' : 'transparent',
                  color: coordinateSpace === 'world' ? 'var(--selection)' : 'var(--text-muted)',
                }}
              >
                <Globe size={12} />
                World
              </button>
              <button
                onClick={() => setCoordinateSpace('local')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] font-medium rounded transition-colors"
                style={{
                  backgroundColor: coordinateSpace === 'local' ? 'var(--selection-bg)' : 'transparent',
                  color: coordinateSpace === 'local' ? 'var(--selection)' : 'var(--text-muted)',
                }}
              >
                <Box size={12} />
                Local
              </button>
            </div>

            {/* Parent info (only in Local mode with parent) */}
            {coordinateSpace === 'local' && parentName && (
              <div
                className="py-1.5 px-2 text-[11px] rounded flex items-center gap-2"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Parent:</span>
                <span className="font-medium">{parentName}</span>
              </div>
            )}

            {/* Same coords indicator (when no parent) */}
            {!hasParent && (
              <div
                className="py-1.5 px-2 text-[11px] rounded"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}
              >
                Root entity (World = Local)
              </div>
            )}

            {/* Bounds */}
            {bounds && (
              <div className="space-y-2">
                <label className="text-[11px] font-medium block" style={{ color: 'var(--text-muted)' }}>Bounds</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>min</label>
                    <div
                      className="py-1.5 px-2 text-xs rounded"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontFamily: 'JetBrains Mono, monospace'
                      }}
                    >
                      ({bounds.minX.toFixed(1)}, {bounds.minY.toFixed(1)})
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>max</label>
                    <div
                      className="py-1.5 px-2 text-xs rounded"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontFamily: 'JetBrains Mono, monospace'
                      }}
                    >
                      ({bounds.maxX.toFixed(1)}, {bounds.maxY.toFixed(1)})
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Center */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Center X</label>
                <input
                  type="text"
                  value={position.x.toFixed(2)}
                  readOnly
                  className="w-full py-1.5 px-2 text-xs rounded outline-none"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Center Y</label>
                <input
                  type="text"
                  value={position.y.toFixed(2)}
                  readOnly
                  className="w-full py-1.5 px-2 text-xs rounded outline-none"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                />
              </div>
            </div>

            {/* Size */}
            {bounds && (
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Size</label>
                <div
                  className="py-1.5 px-2 text-xs rounded"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                >
                  {(bounds.maxX - bounds.minX).toFixed(1)} × {(bounds.maxY - bounds.minY).toFixed(1)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transform Section */}
        <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div
            className="px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors hover:bg-[var(--hover)]"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Transform
            </span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="px-3 pb-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Rotation</label>
                <input
                  type="text"
                  value={selectedEntity ? `${(selectedEntity.transform.rotate * 180 / Math.PI).toFixed(1)}°` : '0°'}
                  readOnly
                  className="w-full py-1.5 px-2 text-xs rounded outline-none"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Z-Order</label>
                <input
                  type="text"
                  value={zOrder}
                  readOnly
                  className="w-full py-1.5 px-2 text-xs rounded outline-none"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
