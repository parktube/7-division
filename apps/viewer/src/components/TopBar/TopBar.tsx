import { Grid3x3, Ruler, Pencil, Sun, Moon, Settings, PenTool } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useUIContext } from '@/contexts/UIContext'

export default function TopBar() {
  const { theme, toggle } = useTheme()
  const {
    gridEnabled,
    setGridEnabled,
    rulersEnabled,
    setRulersEnabled,
    sketchMode,
    setSketchMode,
  } = useUIContext()

  const toolbarBtnClass = (active: boolean) =>
    `flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer
     ${active
       ? 'bg-white text-[var(--selection)] shadow-sm'
       : 'text-[var(--text-secondary)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]'
     }`

  const sketchBtnClass = `flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ml-3
    border shadow-sm
    ${sketchMode
      ? 'bg-[rgba(217,119,6,0.1)] border-[var(--lock)] text-[var(--lock)]'
      : 'bg-white border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`

  return (
    <header
      className="h-10 flex-shrink-0 flex items-center justify-between px-3 gap-3 z-50"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      {/* Left: Logo + Filename */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          <div
            className="w-5 h-5 rounded flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--selection) 0%, #0066cc 100%)' }}
          >
            <PenTool size={12} color="white" />
          </div>
          AI-Native CAD
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs"
          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
          scene.json
        </div>
      </div>

      {/* Center: Toggle buttons */}
      <div className="flex-1 flex items-center justify-center gap-1">
        <div
          className="flex items-center gap-0.5 p-1 rounded-md"
          style={{ backgroundColor: 'var(--bg-input)' }}
        >
          <button type="button" className={toolbarBtnClass(gridEnabled)} onClick={() => setGridEnabled(!gridEnabled)} aria-label="Toggle grid">
            <Grid3x3 size={14} />
            Grid
          </button>
          <button type="button" className={toolbarBtnClass(rulersEnabled)} onClick={() => setRulersEnabled(!rulersEnabled)} aria-label="Toggle rulers">
            <Ruler size={14} />
            Rulers
          </button>
        </div>
        <button type="button" className={sketchBtnClass} onClick={() => setSketchMode(!sketchMode)} aria-label="Toggle sketch mode">
          <Pencil size={14} />
          Sketch
        </button>
      </div>

      {/* Right: Theme, Settings */}
      <div className="flex items-center gap-1 min-w-[100px] justify-end">
        <button
          type="button"
          onClick={toggle}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-[var(--hover)]"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-[var(--hover)]"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Open settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  )
}
