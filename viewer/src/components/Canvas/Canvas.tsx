import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useScene } from '@/hooks/useScene'
import { useTheme } from '@/hooks/useTheme'
import { useViewportContext } from '@/contexts/ViewportContext'
import { useUIContext } from '@/contexts/UIContext'
import { useSketch } from '@/hooks/useSketch'
import { setupCanvas } from '@/utils/transform'
import { renderScene } from '@/utils/renderEntity'
import SketchOverlay, { type SketchOverlayRef } from './SketchOverlay'
import SketchToolbar from './SketchToolbar'
import type { Entity } from '@/types/scene'

// Grid and ruler constants
const MINOR_GRID_SIZE = 20
const MAJOR_GRID_SIZE = 100
const RULER_SIZE = 20

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sketchRef = useRef<SketchOverlayRef>(null)
  const wheelListenerRef = useRef<((e: WheelEvent) => void) | null>(null)
  const { scene, isLoading, error } = useScene()
  const { viewport, zoomAt, pan } = useViewportContext()
  const {
    setMousePosition, gridEnabled, rulersEnabled,
    sketchMode, setSketchMode, selectedIds, hiddenIds, lockedIds, clearSelection,
  } = useUIContext()
  const {
    strokes, activeTool, startStroke, addPoint, endStroke,
    eraseAt, clearAll, switchTool, getCurrentStroke, eraserRadius,
  } = useSketch()
  const { theme } = useTheme()

  // Use refs for immediate access in event handlers (avoids stale closure)
  const isPanningRef = useRef(false)
  const lastMousePosRef = useRef({ x: 0, y: 0 })
  const isSpacePressedRef = useRef(false)

  // State for cursor styling only
  const [isPanning, setIsPanning] = useState(false)
  const [isSpacePressed, setIsSpacePressed] = useState(false)

  // Cache CSS variables to avoid getComputedStyle on every render
  // Re-computed when theme changes
  const cssVars = useMemo(() => {
    const computedStyle = getComputedStyle(document.documentElement)
    return {
      bgCanvas: computedStyle.getPropertyValue('--bg-canvas').trim() || '#e8e8e8',
      bgPanel: computedStyle.getPropertyValue('--bg-panel').trim() || '#ffffff',
      border: computedStyle.getPropertyValue('--border').trim() || '#e5e5e5',
      textMuted: computedStyle.getPropertyValue('--text-muted').trim() || '#9ca3af',
    }
  }, [theme])

  // Build entity maps for quick lookup
  // Separate maps to avoid key collision between id and name
  const { entityById, entityByName } = useMemo(() => {
    if (!scene) return { entityById: new Map<string, Entity>(), entityByName: new Map<string, Entity>() }
    const byId = new Map<string, Entity>()
    const byName = new Map<string, Entity>()
    scene.entities.forEach(e => {
      byId.set(e.id, e)
      if (e.metadata?.name) {
        byName.set(e.metadata.name, e)
      }
    })
    return { entityById: byId, entityByName: byName }
  }, [scene])

  // Helper to find entity by id or name (for children lookup which uses name)
  const findEntity = useCallback((key: string): Entity | undefined => {
    return entityById.get(key) ?? entityByName.get(key)
  }, [entityById, entityByName])

  // Render lock indicator (orange solid border) - Dumb View: read computed
  const renderLockIndicator = useCallback((ctx: CanvasRenderingContext2D) => {
    if (lockedIds.size === 0) return

    for (const id of lockedIds) {
      if (hiddenIds.has(id)) continue // Skip hidden entities

      const entity = findEntity(id)
      if (!entity) continue

      // Dumb View: read from computed.world_bounds
      const bounds = entity.computed?.world_bounds
      if (!bounds) continue

      // Lock border (orange solid)
      ctx.strokeStyle = '#f97316' // orange-500
      ctx.lineWidth = 2 / viewport.zoom
      ctx.setLineDash([]) // solid line

      const padding = 2 / viewport.zoom
      ctx.strokeRect(
        bounds.min[0] - padding,
        bounds.min[1] - padding,
        bounds.max[0] - bounds.min[0] + padding * 2,
        bounds.max[1] - bounds.min[1] + padding * 2
      )
    }
  }, [lockedIds, hiddenIds, findEntity, viewport.zoom])

  // Render selection highlight - Dumb View: read computed
  const renderSelection = useCallback((ctx: CanvasRenderingContext2D) => {
    if (selectedIds.size === 0) return

    for (const id of selectedIds) {
      if (hiddenIds.has(id)) continue // Skip hidden entities

      const entity = findEntity(id)
      if (!entity) continue

      // Dumb View: read from computed.world_bounds
      const bounds = entity.computed?.world_bounds
      if (!bounds) continue

      // Selection border (blue dashed)
      ctx.strokeStyle = '#2563eb' // blue-600
      ctx.lineWidth = 2 / viewport.zoom
      ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom])

      const padding = 4 / viewport.zoom
      ctx.strokeRect(
        bounds.min[0] - padding,
        bounds.min[1] - padding,
        bounds.max[0] - bounds.min[0] + padding * 2,
        bounds.max[1] - bounds.min[1] + padding * 2
      )

      ctx.setLineDash([])
    }
  }, [selectedIds, hiddenIds, findEntity, viewport.zoom])

  // Render grid (matching mockup CSS: minor 20px @4% + major 100px @8%)
  const renderGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const minorGridSize = MINOR_GRID_SIZE
    const majorGridSize = MAJOR_GRID_SIZE

    // Calculate visible world bounds
    const left = (-width / 2 - viewport.offset.x) / viewport.zoom
    const right = (width / 2 - viewport.offset.x) / viewport.zoom
    const bottom = (-height / 2 - viewport.offset.y) / viewport.zoom
    const top = (height / 2 - viewport.offset.y) / viewport.zoom

    ctx.lineWidth = 1 / viewport.zoom

    // Minor grid: rgba(0,0,0,0.04)
    ctx.strokeStyle = 'rgba(0,0,0,0.04)'
    const minorStartX = Math.floor(left / minorGridSize) * minorGridSize
    const minorStartY = Math.floor(bottom / minorGridSize) * minorGridSize

    for (let x = minorStartX; x <= right; x += minorGridSize) {
      ctx.beginPath()
      ctx.moveTo(x, bottom)
      ctx.lineTo(x, top)
      ctx.stroke()
    }
    for (let y = minorStartY; y <= top; y += minorGridSize) {
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(right, y)
      ctx.stroke()
    }

    // Major grid: rgba(0,0,0,0.08)
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    const majorStartX = Math.floor(left / majorGridSize) * majorGridSize
    const majorStartY = Math.floor(bottom / majorGridSize) * majorGridSize

    for (let x = majorStartX; x <= right; x += majorGridSize) {
      ctx.beginPath()
      ctx.moveTo(x, bottom)
      ctx.lineTo(x, top)
      ctx.stroke()
    }
    for (let y = majorStartY; y <= top; y += majorGridSize) {
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(right, y)
      ctx.stroke()
    }
  }, [viewport])

  // Render rulers (screen-space, drawn after restore)
  const renderRulers = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const rulerSize = RULER_SIZE
    // Zoom-based tick interval: 300%+ → 10단위, 100%+ → 25단위, <100% → 50단위
    const tickInterval = viewport.zoom >= 3 ? 10 : viewport.zoom >= 1 ? 25 : 50

    const { bgPanel: bgColor, border: borderColor, textMuted: textColor } = cssVars

    // Calculate world bounds
    const left = (-width / 2 - viewport.offset.x) / viewport.zoom
    const right = (width / 2 - viewport.offset.x) / viewport.zoom
    const bottom = (-height / 2 - viewport.offset.y) / viewport.zoom
    const top = (height / 2 - viewport.offset.y) / viewport.zoom

    // Convert world coord to screen X
    const worldToScreenX = (wx: number) => width / 2 + viewport.offset.x + wx * viewport.zoom
    const worldToScreenY = (wy: number) => height / 2 - viewport.offset.y - wy * viewport.zoom

    // Horizontal ruler (top)
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, width, rulerSize)
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, rulerSize)
    ctx.lineTo(width, rulerSize)
    ctx.stroke()

    // Horizontal ticks (major only - 숫자 표시)
    ctx.fillStyle = textColor
    ctx.font = '10px Inter, sans-serif'
    ctx.textAlign = 'center'

    const hStart = Math.floor(left / tickInterval) * tickInterval
    for (let wx = hStart; wx <= right; wx += tickInterval) {
      const sx = worldToScreenX(wx)
      if (sx < rulerSize || sx > width) continue

      ctx.strokeStyle = borderColor
      ctx.beginPath()
      ctx.moveTo(sx, rulerSize)
      ctx.lineTo(sx, rulerSize - 8)
      ctx.stroke()

      ctx.fillText(String(wx), sx, 10)
    }

    // Vertical ruler (left) - draw below horizontal ruler
    ctx.fillStyle = bgColor
    ctx.fillRect(0, rulerSize, rulerSize, height - rulerSize)
    ctx.strokeStyle = borderColor
    ctx.beginPath()
    ctx.moveTo(rulerSize, rulerSize)
    ctx.lineTo(rulerSize, height)
    ctx.stroke()

    // Vertical ticks (major only - 숫자 표시)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '9px Inter, sans-serif'
    ctx.fillStyle = textColor
    const vStart = Math.floor(bottom / tickInterval) * tickInterval
    for (let wy = vStart; wy <= top; wy += tickInterval) {
      const sy = worldToScreenY(wy)
      if (sy < rulerSize + 5 || sy > height - 5) continue

      ctx.strokeStyle = borderColor
      ctx.beginPath()
      ctx.moveTo(rulerSize, sy)
      ctx.lineTo(rulerSize - 8, sy)
      ctx.stroke()

      ctx.fillText(String(wy), rulerSize / 2, sy)
    }

    // Corner square (top-left)
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, rulerSize, rulerSize)
    ctx.strokeStyle = borderColor
    ctx.strokeRect(0, 0, rulerSize, rulerSize)
  }, [viewport, cssVars])

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !scene) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Fill background using cached CSS variable
    ctx.fillStyle = cssVars.bgCanvas
    ctx.fillRect(0, 0, rect.width, rect.height)

    // Setup coordinate system with viewport
    ctx.save()
    setupCanvas(ctx, rect.width, rect.height)
    ctx.translate(viewport.offset.x, viewport.offset.y)
    ctx.scale(viewport.zoom, viewport.zoom)

    // Render grid if enabled
    if (gridEnabled) {
      renderGrid(ctx, rect.width, rect.height)
    }

    renderScene(ctx, scene, hiddenIds)
    renderLockIndicator(ctx)
    renderSelection(ctx)
    ctx.restore()

    // Render rulers on top (screen coordinates)
    if (rulersEnabled) {
      renderRulers(ctx, rect.width, rect.height)
    }
  }, [scene, viewport, gridEnabled, renderGrid, rulersEnabled, renderRulers, renderLockIndicator, renderSelection, hiddenIds, cssVars])

  // Render on scene or viewport change
  useEffect(() => {
    render()
  }, [render])

  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      render()
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [render])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space key for panning
      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true
        setIsSpacePressed(true)
        e.preventDefault()
      }

      if (e.key === 'Escape') {
        if (sketchMode) {
          // Exit sketch mode (don't clear selection)
          setSketchMode(false)
          e.preventDefault()
        } else {
          // Normal mode: clear selection
          clearSelection()
        }
      }
      // Sketch mode tool shortcuts
      if (sketchMode) {
        const key = e.key.toLowerCase()
        if (key === 'p') {
          switchTool('pen')
        } else if (key === 'e') {
          switchTool('eraser')
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false
        setIsSpacePressed(false)
        // Stop panning when space is released
        isPanningRef.current = false
        setIsPanning(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [sketchMode, setSketchMode, clearSelection, switchTool])

  // Wheel zoom handler - using callback ref to ensure listener is attached when DOM is ready
  // Store zoomAt in ref to avoid re-attaching listener when zoomAt changes
  const zoomAtRef = useRef(zoomAt)
  zoomAtRef.current = zoomAt

  // Callback ref for container - attaches wheel listener when mounted
  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    // Cleanup previous listener
    if (containerRef.current && wheelListenerRef.current) {
      containerRef.current.removeEventListener('wheel', wheelListenerRef.current, { capture: true })
    }

    containerRef.current = node

    if (node) {
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault()
        const rect = node.getBoundingClientRect()
        const cursorX = e.clientX - rect.left - rect.width / 2
        const cursorY = -(e.clientY - rect.top - rect.height / 2) // Y-up
        zoomAtRef.current(cursorX, cursorY, e.deltaY)
      }

      wheelListenerRef.current = handleWheel
      // capture: true - handle during capture phase before SketchOverlay
      node.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    }
  }, [])


  // Mouse handlers for panning (Space + left-click drag)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start panning if Space is pressed
      if (e.button === 0 && isSpacePressedRef.current) {
        e.preventDefault()
        isPanningRef.current = true
        lastMousePosRef.current = { x: e.clientX, y: e.clientY }
        setIsPanning(true)
      }
    },
    []
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      // Calculate world coordinates
      const rect = canvas.getBoundingClientRect()
      const screenX = e.clientX - rect.left - rect.width / 2
      const screenY = -(e.clientY - rect.top - rect.height / 2) // Y-up

      // Convert to world coordinates: world = (screen - offset) / zoom
      const worldX = (screenX - viewport.offset.x) / viewport.zoom
      const worldY = (screenY - viewport.offset.y) / viewport.zoom

      setMousePosition({ x: worldX, y: worldY })

      // Handle panning
      if (!isPanningRef.current) return

      const dx = e.clientX - lastMousePosRef.current.x
      const dy = e.clientY - lastMousePosRef.current.y

      pan(dx, dy)
      lastMousePosRef.current = { x: e.clientX, y: e.clientY }
    },
    [pan, viewport, setMousePosition]
  )

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false
    setIsPanning(false)
  }, [])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-canvas)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading scene...</p>
      </div>
    )
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'No scene loaded'
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-canvas)' }}>
        <p style={{ color: 'var(--text-muted)' }}>{errorMessage}</p>
      </div>
    )
  }

  // Cursor class based on mode and panning state
  const cursorClass = isPanning
    ? 'cursor-grabbing'
    : isSpacePressed
      ? 'cursor-grab'
      : 'cursor-default'

  return (
    <div
      ref={containerCallbackRef}
      id="cad-canvas"
      className="h-full relative"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
      role="application"
      aria-label="CAD canvas workspace"
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${cursorClass}`}
        style={{ touchAction: 'none' }}
        role="img"
        aria-label="CAD drawing canvas with shapes and sketches"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {/* Sketch toolbar */}
      <SketchToolbar
        isActive={sketchMode}
        activeTool={activeTool}
        onToolChange={switchTool}
        onClearAll={clearAll}
      />
      {/* Sketch overlay for freehand drawing */}
      <SketchOverlay
        ref={sketchRef}
        isActive={sketchMode}
        isPanning={isSpacePressed}
        viewport={viewport}
        strokes={strokes}
        activeTool={activeTool}
        eraserRadius={eraserRadius}
        getCurrentStroke={getCurrentStroke}
        onStartStroke={startStroke}
        onAddPoint={addPoint}
        onEndStroke={endStroke}
        onEraseAt={eraseAt}
      />
    </div>
  )
}
