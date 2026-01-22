import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { Stroke, Point, SketchTool } from '@/types/sketch'
import { getDataUrl } from '@/utils/dataUrl'
import { debounce } from '@/utils/debounce'
import { sendSketchUpdateDirect, isWebSocketConnected } from './useWebSocket'

const DEFAULT_COLOR = '#ef4444' // red-500

// Global sketch store for injection (similar to scene injection)
let globalSketchSetter: ((strokes: Stroke[]) => void) | null = null

/**
 * Inject sketch data directly (for Puppeteer capture without HTTP fetch)
 * Usage: window.__injectSketch(strokesData)
 */
function injectSketch(strokes: Stroke[]) {
  if (globalSketchSetter) {
    globalSketchSetter(strokes)
  }
}

// Expose to window for Puppeteer capture
if (typeof window !== 'undefined') {
  (window as unknown as { __injectSketch: typeof injectSketch }).__injectSketch = injectSketch
}
const DEFAULT_WIDTH = 2
const MIN_DISTANCE = 2 // Minimum distance between points
const ERASER_RADIUS = 15 // Eraser hit radius

// Calculate stroke bounding box for quick rejection
function getStrokeBounds(stroke: Stroke) {
  const xs = stroke.points.map(p => p.x)
  const ys = stroke.points.map(p => p.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

// Check if eraser intersects with stroke
function strokeIntersectsEraser(stroke: Stroke, eraserPoint: Point, radius: number): boolean {
  // Quick rejection using bounding box
  const bounds = getStrokeBounds(stroke)
  if (
    eraserPoint.x + radius < bounds.minX ||
    eraserPoint.x - radius > bounds.maxX ||
    eraserPoint.y + radius < bounds.minY ||
    eraserPoint.y - radius > bounds.maxY
  ) {
    return false
  }

  // Detailed point check
  return stroke.points.some(p =>
    Math.sqrt(Math.pow(p.x - eraserPoint.x, 2) + Math.pow(p.y - eraserPoint.y, 2)) <= radius
  )
}

// Save strokes to sketch.json
async function saveStrokes(strokes: Stroke[]) {
  // Try WebSocket first (works for both local and GitHub Pages when MCP is running)
  if (isWebSocketConnected()) {
    sendSketchUpdateDirect(strokes)
    return
  }

  // Fallback to HTTP POST for local development without WebSocket
  // Skip on GitHub Pages (HTTPS) - no local server to handle POST
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return // Silently skip - expected behavior on GitHub Pages
  }

  try {
    const res = await fetch(getDataUrl('sketch.json'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strokes }),
    })
    // Silently ignore 404/405 errors (expected on static hosting)
    if (!res.ok && res.status !== 404 && res.status !== 405) {
      console.warn('Failed to save strokes:', res.status)
    }
  } catch {
    // Ignore save errors (e.g., in production without middleware)
  }
}

// Load strokes from sketch.json
async function loadStrokes(): Promise<Stroke[]> {
  try {
    const res = await fetch(getDataUrl('sketch.json'), { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.strokes || []
  } catch {
    return []
  }
}

export function useSketch() {
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [activeTool, setActiveTool] = useState<SketchTool>('pen')
  const currentStrokeRef = useRef<Stroke | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const isInitialized = useRef(false)
  const isLoadingRef = useRef(false)  // Prevent save during initial load

  // Debounced save function (300ms delay to batch rapid changes)
  const debouncedSave = useMemo(() => debounce(saveStrokes, 300), [])

  // Register global setter for injection (Puppeteer capture)
  useEffect(() => {
    const currentSetter = setStrokes
    globalSketchSetter = currentSetter
    return () => {
      // Only clear if this instance set it (protect against multiple instances)
      if (globalSketchSetter === currentSetter) {
        globalSketchSetter = null
      }
    }
  }, [])

  // Load strokes on mount
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true
    isLoadingRef.current = true  // Mark as loading

    loadStrokes().then(loaded => {
      if (loaded.length > 0) {
        setStrokes(loaded)
      }
    }).finally(() => {
      // Allow saves after initial load completes
      isLoadingRef.current = false
    })
  }, [])

  // Cleanup debounced save on unmount
  useEffect(() => {
    return () => debouncedSave.cancel()
  }, [debouncedSave])

  // Save strokes when they change (debounced)
  useEffect(() => {
    // Skip save during initialization or initial load
    if (!isInitialized.current || isLoadingRef.current) return
    debouncedSave(strokes)
  }, [strokes, debouncedSave])

  const startStroke = useCallback((point: Point) => {
    currentStrokeRef.current = {
      // Use crypto.randomUUID() for guaranteed unique IDs (avoids Date.now() collisions)
      id: `stroke_${crypto.randomUUID()}`,
      points: [point],
      color: DEFAULT_COLOR,
      width: DEFAULT_WIDTH,
    }
    setIsDrawing(true)
  }, [])

  const addPoint = useCallback((point: Point) => {
    if (!currentStrokeRef.current) return

    const points = currentStrokeRef.current.points
    const lastPoint = points[points.length - 1]

    // Minimum distance check to avoid too many points
    const distance = Math.sqrt(
      Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2)
    )

    if (distance >= MIN_DISTANCE) {
      points.push(point)
    }
  }, [])

  const endStroke = useCallback(() => {
    const stroke = currentStrokeRef.current
    if (stroke && stroke.points.length > 1) {
      setStrokes(prev => [...prev, stroke])
    }
    currentStrokeRef.current = null
    setIsDrawing(false)
  }, [])

  const eraseAt = useCallback((point: Point, radius: number = ERASER_RADIUS) => {
    setStrokes(prev => prev.filter(stroke => !strokeIntersectsEraser(stroke, point, radius)))
  }, [])

  const clearAll = useCallback(() => {
    setStrokes([])
    currentStrokeRef.current = null
    setIsDrawing(false)
  }, [])

  const switchTool = useCallback((tool: SketchTool) => {
    // If switching from pen, end current stroke
    if (currentStrokeRef.current && tool !== 'pen') {
      endStroke()
    }
    setActiveTool(tool)
  }, [endStroke])

  const getCurrentStroke = useCallback(() => {
    return currentStrokeRef.current
  }, [])

  return {
    strokes,
    activeTool,
    isDrawing,
    startStroke,
    addPoint,
    endStroke,
    eraseAt,
    clearAll,
    switchTool,
    getCurrentStroke,
    eraserRadius: ERASER_RADIUS,
  }
}
