import { Layers, SquareCheck, MousePointer, Wifi, WifiOff, Loader2, Bot } from 'lucide-react'
import { useViewportContext } from '@/contexts/ViewportContext'
import { useUIContext } from '@/contexts/UIContext'
import { useScene } from '@/hooks/useScene'
import { useWebSocket, type ConnectionState } from '@/hooks/useWebSocket'
import { useWebMcpToggle } from '@/webmcp'

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

function WebMcpToggle() {
  const { enabled, available, toggle } = useWebMcpToggle()

  if (!available) return null

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-colors"
      style={{
        backgroundColor: enabled ? 'rgba(34,197,94,0.15)' : 'transparent',
        color: enabled ? 'var(--success, #22c55e)' : 'var(--text-muted)',
        cursor: 'pointer',
        border: 'none',
      }}
      title={enabled ? 'WebMCP: ON (click to disable)' : 'WebMCP: OFF (click to enable)'}
    >
      <Bot size={12} />
      <span style={{ fontSize: '10px' }}>MCP</span>
    </button>
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
      <WebMcpToggle />
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
