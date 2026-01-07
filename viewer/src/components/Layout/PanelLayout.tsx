import { useState, useCallback, useRef } from 'react'
import { LayerPanel } from '@/components/LayerPanel'
import { Canvas } from '@/components/Canvas'
import { InfoPanel } from '@/components/InfoPanel'

// Panel size limits per AC5
const LEFT_MIN = 150
const LEFT_MAX = 300
const RIGHT_MIN = 200
const RIGHT_MAX = 400

const DEFAULT_LEFT_WIDTH = 200
const DEFAULT_RIGHT_WIDTH = 280

const STORAGE_KEY = 'panel-layout-sizes'

function loadSizes(): { left: number; right: number } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        left: Math.max(LEFT_MIN, Math.min(LEFT_MAX, parsed.left ?? DEFAULT_LEFT_WIDTH)),
        right: Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, parsed.right ?? DEFAULT_RIGHT_WIDTH)),
      }
    }
  } catch {
    // ignore
  }
  return { left: DEFAULT_LEFT_WIDTH, right: DEFAULT_RIGHT_WIDTH }
}

function saveSizes(left: number, right: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, right }))
  } catch {
    // ignore
  }
}

export default function PanelLayout() {
  const [leftWidth, setLeftWidth] = useState(() => loadSizes().left)
  const [rightWidth, setRightWidth] = useState(() => loadSizes().right)
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((side: 'left' | 'right') => {
    setDragging(side)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()

      if (dragging === 'left') {
        const newWidth = Math.min(LEFT_MAX, Math.max(LEFT_MIN, e.clientX - rect.left))
        setLeftWidth(newWidth)
      } else if (dragging === 'right') {
        const newWidth = Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, rect.right - e.clientX))
        setRightWidth(newWidth)
      }
    },
    [dragging]
  )

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      saveSizes(leftWidth, rightWidth)
    }
    setDragging(null)
  }, [dragging, leftWidth, rightWidth])

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Left Panel */}
      <div
        className="flex-shrink-0 h-full"
        style={{ width: leftWidth, borderRight: '1px solid var(--border)' }}
      >
        <LayerPanel />
      </div>

      {/* Left Resize Handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={leftWidth}
        aria-valuemin={LEFT_MIN}
        aria-valuemax={LEFT_MAX}
        aria-label="Resize left panel"
        tabIndex={0}
        className="w-1 cursor-col-resize transition-colors relative"
        style={{
          backgroundColor: dragging === 'left' ? 'var(--selection)' : 'transparent',
        }}
        onMouseDown={() => handleMouseDown('left')}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* Canvas */}
      <div className="flex-1 min-w-0 h-full">
        <Canvas />
      </div>

      {/* Right Resize Handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={rightWidth}
        aria-valuemin={RIGHT_MIN}
        aria-valuemax={RIGHT_MAX}
        aria-label="Resize right panel"
        tabIndex={0}
        className="w-1 cursor-col-resize transition-colors relative"
        style={{
          backgroundColor: dragging === 'right' ? 'var(--selection)' : 'transparent',
        }}
        onMouseDown={() => handleMouseDown('right')}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* Right Panel */}
      <div
        className="flex-shrink-0 h-full"
        style={{ width: rightWidth, borderLeft: '1px solid var(--border)' }}
      >
        <InfoPanel />
      </div>
    </div>
  )
}
