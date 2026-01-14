import { useState, useCallback } from 'react'
import {
  ViewportState,
  DEFAULT_VIEWPORT,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
} from '@/types/viewport'

export function useViewport() {
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT)

  // Zoom at cursor position
  const zoomAt = useCallback((cursorX: number, cursorY: number, delta: number) => {
    setViewport((prev) => {
      const zoomFactor = delta > 0 ? 1 - ZOOM_STEP : 1 + ZOOM_STEP
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev.zoom * zoomFactor))

      // Calculate offset to keep cursor position fixed
      const scale = newZoom / prev.zoom
      const newOffsetX = cursorX - scale * (cursorX - prev.offset.x)
      const newOffsetY = cursorY - scale * (cursorY - prev.offset.y)

      return {
        offset: { x: newOffsetX, y: newOffsetY },
        zoom: newZoom,
      }
    })
  }, [])

  // Pan by delta
  const pan = useCallback((dx: number, dy: number) => {
    setViewport((prev) => ({
      ...prev,
      offset: {
        x: prev.offset.x + dx,
        y: prev.offset.y - dy, // Invert Y for Y-up coordinate system
      },
    }))
  }, [])

  // Reset to default
  const reset = useCallback(() => {
    setViewport(DEFAULT_VIEWPORT)
  }, [])

  return { viewport, zoomAt, pan, reset }
}
