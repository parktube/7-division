import { useState, useCallback, useRef, useEffect } from 'react'
import type { Stroke, Point, SketchTool } from '@/types/sketch'
import { getDataUrl } from '@/utils/dataUrl'

const DEFAULT_COLOR = '#ef4444' // red-500
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
  try {
    await fetch(getDataUrl('sketch.json'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strokes }),
    })
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

  // Load strokes on mount
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    loadStrokes().then(loaded => {
      if (loaded.length > 0) {
        setStrokes(loaded)
      }
    })
  }, [])

  // Save strokes when they change (debounced)
  useEffect(() => {
    if (!isInitialized.current) return
    saveStrokes(strokes)
  }, [strokes])

  const startStroke = useCallback((point: Point) => {
    currentStrokeRef.current = {
      id: `stroke_${Date.now()}`,
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
