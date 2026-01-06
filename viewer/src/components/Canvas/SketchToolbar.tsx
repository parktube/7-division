import { Pencil, Eraser, Trash2 } from 'lucide-react'
import type { SketchTool } from '@/types/sketch'

interface SketchToolbarProps {
  isActive: boolean
  activeTool: SketchTool
  onToolChange: (tool: SketchTool) => void
  onClearAll: () => void
}

export default function SketchToolbar({
  isActive,
  activeTool,
  onToolChange,
  onClearAll,
}: SketchToolbarProps) {
  if (!isActive) return null

  const toolBtnClass = (tool: SketchTool) =>
    `w-8 h-8 flex items-center justify-center rounded transition-colors
    ${activeTool === tool
      ? 'bg-[var(--selection)] text-white'
      : 'hover:bg-[var(--hover)] text-[var(--text-secondary)]'
    }`

  return (
    <div
      className="absolute top-2 left-2 z-20 flex items-center gap-1 p-1 rounded-lg shadow-md"
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Pen tool */}
      <button
        onClick={() => onToolChange('pen')}
        className={toolBtnClass('pen')}
        title="Pen (P)"
      >
        <Pencil size={16} />
      </button>

      {/* Eraser tool */}
      <button
        onClick={() => onToolChange('eraser')}
        className={toolBtnClass('eraser')}
        title="Eraser (E)"
      >
        <Eraser size={16} />
      </button>

      {/* Divider */}
      <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border)' }} />

      {/* Clear All */}
      <button
        onClick={onClearAll}
        className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-[var(--hover)]"
        style={{ color: '#ef4444' }}
        title="Clear All"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}
