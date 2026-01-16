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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`
        flex items-center gap-1 px-2 py-1 rounded text-xs
        transition-colors
        ${active
          ? 'bg-[var(--selection)] text-white'
          : 'text-[var(--text-secondary)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]'
        }
      `}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  )
}
