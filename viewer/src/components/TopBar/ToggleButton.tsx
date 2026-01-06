import type { LucideIcon } from 'lucide-react'

interface ToggleButtonProps {
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
}

export default function ToggleButton({ icon: Icon, label, active, onClick }: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1 px-2 py-1 rounded text-xs
        transition-colors
        ${active
          ? 'bg-accent text-white'
          : 'text-text-muted hover:bg-bg-alt hover:text-text'
        }
      `}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  )
}
