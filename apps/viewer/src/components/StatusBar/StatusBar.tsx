import { Layers, SquareCheck, MousePointer } from 'lucide-react'
import { useViewportContext } from '@/contexts/ViewportContext'
import { useUIContext } from '@/contexts/UIContext'
import { useScene } from '@/hooks/useScene'

export default function StatusBar() {
  const { viewport } = useViewportContext()
  const { mousePosition, sketchMode, selectedCount } = useUIContext()
  const { scene } = useScene()
  const entityCount = scene?.entities.length ?? 0
  const zoomPercent = Math.round(viewport.zoom * 100)
  const mode = sketchMode ? 'Sketch' : 'Normal'

  const isSketch = mode === 'Sketch'

  return (
    <footer
      className="h-6 flex-shrink-0 flex items-center gap-4 px-3 text-xs"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-muted)'
      }}
    >
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 rounded font-medium"
        style={{
          backgroundColor: isSketch ? 'rgba(217,119,6,0.1)' : 'var(--bg-input)',
          color: isSketch ? 'var(--lock)' : 'var(--text-primary)'
        }}
      >
        <MousePointer size={12} />
        {mode}
      </div>
      <div className="flex items-center gap-1.5" style={{ opacity: 0.7 }}>
        <Layers size={12} />
        {entityCount} entities
      </div>
      <div className="flex items-center gap-1.5" style={{ opacity: 0.7 }}>
        <SquareCheck size={12} />
        {selectedCount} selected
      </div>
      <div className="flex-1" />
      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
        X: {mousePosition.x.toFixed(1)} &nbsp; Y: {mousePosition.y.toFixed(1)}
      </div>
      <div>{zoomPercent}%</div>
    </footer>
  )
}
