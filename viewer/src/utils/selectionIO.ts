import { Selection, DEFAULT_SELECTION } from '@/types/selection'
import { isElectron } from './platform'

declare global {
  interface Window {
    cadAPI?: {
      writeSelection: (data: Selection) => void
      readSelection: () => Selection
    }
  }
}

export async function saveSelection(selection: Selection): Promise<void> {
  const data: Selection = {
    ...selection,
    timestamp: Date.now(),
  }

  if (isElectron()) {
    // Electron: Preload API 사용
    window.cadAPI?.writeSelection(data)
  } else {
    // 웹: Vite middleware POST
    try {
      await fetch('/selection.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data, null, 2),
      })
    } catch (e) {
      console.error('Failed to save selection:', e)
    }
  }
}

export async function loadSelection(): Promise<Selection> {
  if (isElectron()) {
    return window.cadAPI?.readSelection() ?? DEFAULT_SELECTION
  } else {
    try {
      const res = await fetch('/selection.json')
      if (!res.ok) return DEFAULT_SELECTION
      return await res.json()
    } catch {
      return DEFAULT_SELECTION
    }
  }
}
