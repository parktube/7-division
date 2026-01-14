import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react'
import type { Stroke, Point, SketchTool } from '@/types/sketch'

interface Viewport {
  offset: { x: number; y: number }
  zoom: number
}

interface SketchOverlayProps {
  isActive: boolean
  isPanning: boolean
  viewport: Viewport
  strokes: Stroke[]
  activeTool: SketchTool
  eraserRadius: number
  getCurrentStroke: () => Stroke | null
  onStartStroke: (point: Point) => void
  onAddPoint: (point: Point) => void
  onEndStroke: () => void
  onEraseAt: (point: Point, radius: number) => void
}

export interface SketchOverlayRef {
  canvas: HTMLCanvasElement | null
  getContext: () => CanvasRenderingContext2D | null
  clear: () => void
}

// Render a single stroke (in world coordinates, transform applied by caller)
function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, zoom: number) {
  if (stroke.points.length < 2) return

  ctx.beginPath()
  ctx.strokeStyle = stroke.color
  // Keep line width constant in screen space
  ctx.lineWidth = stroke.width / zoom
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const [first, ...rest] = stroke.points
  ctx.moveTo(first.x, first.y)

  for (const point of rest) {
    ctx.lineTo(point.x, point.y)
  }

  ctx.stroke()
}

// Render eraser cursor (in world coordinates)
function renderEraserCursor(ctx: CanvasRenderingContext2D, point: Point, radius: number, zoom: number) {
  ctx.beginPath()
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 2 / zoom
  ctx.setLineDash([4 / zoom, 4 / zoom])
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
}

const SketchOverlay = forwardRef<SketchOverlayRef, SketchOverlayProps>(
  ({ isActive, isPanning, viewport, strokes, activeTool, eraserRadius, getCurrentStroke, onStartStroke, onAddPoint, onEndStroke, onEraseAt }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number | undefined>(undefined)
    const [mousePos, setMousePos] = useState<Point | null>(null)

    useImperativeHandle(ref, () => ({
      canvas: canvasRef.current,
      getContext: () => canvasRef.current?.getContext('2d') ?? null,
      clear: () => {
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        }
      }
    }))

    // Render function with viewport transform (matching main canvas exactly)
    const render = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Get actual canvas size from DOM (CSS determines size via inset-0)
      const rect = canvas.getBoundingClientRect()
      const canvasWidth = rect.width
      const canvasHeight = rect.height

      if (canvasWidth === 0 || canvasHeight === 0) return

      const dpr = window.devicePixelRatio || 1

      // Setup canvas internal resolution (don't set style.width/height - CSS handles it)
      canvas.width = canvasWidth * dpr
      canvas.height = canvasHeight * dpr

      // Apply DPR scale (same as main canvas)
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      // Setup coordinate system with viewport (matching main canvas exactly)
      ctx.save()
      // setupCanvas equivalent: move origin to center, flip Y
      ctx.translate(canvasWidth / 2, canvasHeight / 2)
      ctx.scale(1, -1)
      // Apply viewport transform
      ctx.translate(viewport.offset.x, viewport.offset.y)
      ctx.scale(viewport.zoom, viewport.zoom)

      // Render saved strokes (in world coordinates)
      for (const stroke of strokes) {
        renderStroke(ctx, stroke, viewport.zoom)
      }

      // Render current stroke (pen mode)
      const currentStroke = getCurrentStroke()
      if (currentStroke) {
        renderStroke(ctx, currentStroke, viewport.zoom)
      }

      // Render eraser cursor (in world coordinates)
      if (activeTool === 'eraser' && mousePos) {
        renderEraserCursor(ctx, mousePos, eraserRadius / viewport.zoom, viewport.zoom)
      }

      ctx.restore()
    }, [viewport, strokes, getCurrentStroke, activeTool, mousePos, eraserRadius])

    // Animation loop for real-time rendering when active
    // Also render once when inactive but has strokes (for capture)
    useEffect(() => {
      const hasContent = strokes.length > 0

      if (!isActive) {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = undefined
        }
        // Render once to show saved strokes (for capture)
        if (hasContent) {
          render()
        }
        return
      }

      const animate = () => {
        render()
        animationRef.current = requestAnimationFrame(animate)
      }
      animate()

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }
    }, [isActive, render, strokes.length])

    // ResizeObserver to re-render when canvas size changes (for inactive mode with strokes)
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const hasContent = strokes.length > 0
      // Only need ResizeObserver when inactive but showing strokes
      // (when active, animation loop handles re-render)
      if (isActive || !hasContent) return

      const resizeObserver = new ResizeObserver(() => {
        render()
      })
      resizeObserver.observe(canvas)

      return () => {
        resizeObserver.disconnect()
      }
    }, [isActive, strokes.length, render])

    // Convert screen coordinates to world coordinates (same as Canvas.tsx)
    const screenToWorld = useCallback((e: React.MouseEvent): Point => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }

      const rect = canvas.getBoundingClientRect()

      // Same calculation as Canvas.tsx handleMouseMove
      const screenX = e.clientX - rect.left - rect.width / 2
      const screenY = -(e.clientY - rect.top - rect.height / 2) // Y-up

      // Convert to world coordinates: world = (screen - offset) / zoom
      const worldX = (screenX - viewport.offset.x) / viewport.zoom
      const worldY = (screenY - viewport.offset.y) / viewport.zoom

      return { x: worldX, y: worldY }
    }, [viewport])

    // Mouse event handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      if (e.button !== 0 || isPanning) return // Left click only, not when panning
      const point = screenToWorld(e)

      if (activeTool === 'pen') {
        onStartStroke(point)
      } else if (activeTool === 'eraser') {
        onEraseAt(point, eraserRadius / viewport.zoom)
      }
    }, [activeTool, isPanning, screenToWorld, onStartStroke, onEraseAt, eraserRadius, viewport.zoom])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
      const point = screenToWorld(e)
      setMousePos(point)

      if (e.buttons !== 1 || isPanning) return // Only while dragging, not when panning

      if (activeTool === 'pen') {
        onAddPoint(point)
      } else if (activeTool === 'eraser') {
        onEraseAt(point, eraserRadius / viewport.zoom)
      }
    }, [activeTool, isPanning, screenToWorld, onAddPoint, onEraseAt, eraserRadius, viewport.zoom])

    const handleMouseUp = useCallback(() => {
      if (activeTool === 'pen') {
        onEndStroke()
      }
    }, [activeTool, onEndStroke])

    const handleMouseLeave = useCallback(() => {
      setMousePos(null)
      if (activeTool === 'pen') {
        onEndStroke()
      }
    }, [activeTool, onEndStroke])

    // Show overlay if: sketch mode is active OR there are strokes to display
    const hasContent = strokes.length > 0
    if (!isActive && !hasContent) return null

    // Only handle input events when sketch mode is active
    const handleEvents = isActive

    // Cursor: grab when panning, none for eraser, crosshair for pen
    const cursor = isPanning
      ? 'grab'
      : activeTool === 'eraser'
        ? 'none'
        : 'crosshair'

    // Determine pointer events:
    // - 'none' if panning (let events pass through to main canvas)
    // - 'none' if not in sketch mode (just displaying saved strokes)
    // - 'auto' if in sketch mode and not panning (handle drawing)
    const pointerEvents = !handleEvents || isPanning ? 'none' : 'auto'

    return (
      <canvas
        ref={canvasRef}
        className="absolute z-10"
        style={{
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents,
          cursor: handleEvents ? cursor : 'default',
        }}
        onMouseDown={handleEvents ? handleMouseDown : undefined}
        onMouseMove={handleEvents ? handleMouseMove : undefined}
        onMouseUp={handleEvents ? handleMouseUp : undefined}
        onMouseLeave={handleEvents ? handleMouseLeave : undefined}
      />
    )
  }
)

SketchOverlay.displayName = 'SketchOverlay'

export default SketchOverlay
