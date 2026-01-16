import { Layers, SquareCheck, MousePointer, Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useViewportContext } from '@/contexts/ViewportContext'
import { useUIContext } from '@/contexts/UIContext'
import { useScene } from '@/hooks/useScene'
import { useWebSocket, type ConnectionState } from '@/hooks/useWebSocket'

function ConnectionIndicator({ state }: { state: ConnectionState }) {
  const config = {
    connected: { icon: Wifi, color: 'var(--success, #22c55e)', label: 'MCP Connected' },
    connecting: { icon: Loader2, color: 'var(--warning, #eab308)', label: 'Connecting...' },
    disconnected: { icon: WifiOff, color: 'var(--error, #ef4444)', label: 'MCP Disconnected' },
  }[state]

  const Icon = config.icon
  const isConnecting = state === 'connecting'

  return (
    <div
      className="flex items-center gap-1.5"
      title={config.label}
      style={{ color: config.color }}
    >
      <Icon size={12} className={isConnecting ? 'animate-spin' : ''} />
      <span style={{ fontSize: '10px', opacity: 0.9 }}>MCP</span>
    </div>
  )
}

export default function StatusBar() {
  const { viewport } = useViewportContext()
  const { mousePosition, sketchMode, selectedCount } = useUIContext()
  const { scene } = useScene()
  const { connectionState } = useWebSocket()
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
      <ConnectionIndicator state={connectionState} />
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
