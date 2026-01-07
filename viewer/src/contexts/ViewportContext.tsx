import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import {
  ViewportState,
  DEFAULT_VIEWPORT,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
} from '@/types/viewport'

interface ViewportContextValue {
  viewport: ViewportState
  zoomAt: (cursorX: number, cursorY: number, delta: number) => void
  pan: (dx: number, dy: number) => void
  reset: () => void
  setZoom: (zoom: number) => void
}

const ViewportContext = createContext<ViewportContextValue | null>(null)

export function ViewportProvider({ children }: { children: ReactNode }) {
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT)

  const zoomAt = useCallback((cursorX: number, cursorY: number, delta: number) => {
    setViewport((prev) => {
      const zoomFactor = delta > 0 ? 1 - ZOOM_STEP : 1 + ZOOM_STEP
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev.zoom * zoomFactor))

      const scale = newZoom / prev.zoom
      const newOffsetX = cursorX - scale * (cursorX - prev.offset.x)
      const newOffsetY = cursorY - scale * (cursorY - prev.offset.y)

      return {
        offset: { x: newOffsetX, y: newOffsetY },
        zoom: newZoom,
      }
    })
  }, [])

  // pan: Y축 반전 (-dy) - CAD 좌표계(Y↑)를 화면 좌표계(Y↓)로 변환
  const pan = useCallback((dx: number, dy: number) => {
    setViewport((prev) => ({
      ...prev,
      offset: {
        x: prev.offset.x + dx,
        y: prev.offset.y - dy,
      },
    }))
  }, [])

  const reset = useCallback(() => {
    setViewport(DEFAULT_VIEWPORT)
  }, [])

  // Set zoom to specific level (centered)
  const setZoom = useCallback((zoom: number) => {
    const clampedZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom))
    setViewport(prev => ({
      ...prev,
      zoom: clampedZoom,
    }))
  }, [])

  // Expose setZoom globally for capture (Puppeteer)
  useEffect(() => {
    (window as unknown as { __setZoom: (z: number) => void }).__setZoom = setZoom
    return () => {
      delete (window as unknown as { __setZoom?: (z: number) => void }).__setZoom
    }
  }, [setZoom])

  return (
    <ViewportContext.Provider value={{ viewport, zoomAt, pan, reset, setZoom }}>
      {children}
    </ViewportContext.Provider>
  )
}

export function useViewportContext() {
  const context = useContext(ViewportContext)
  if (!context) {
    throw new Error('useViewportContext must be used within ViewportProvider')
  }
  return context
}
