import { Selection, DEFAULT_SELECTION } from '@/types/selection'
import { isElectron } from './platform'

declare global {
  interface Window {
    cadAPI?: {
      writeSelection: (data: Selection) => boolean
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
    const result = window.cadAPI?.writeSelection(data)
    if (result === false) {
      throw new Error('Electron: Failed to save selection')
    }
  } else {
    // 웹: Vite middleware POST
    try {
      const res = await fetch('/selection.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data, null, 2),
      })
      if (!res.ok) {
        throw new Error(`Failed to save selection: ${res.status}`)
      }
    } catch (e) {
      // 네트워크 오류 또는 위에서 throw된 오류 로깅 후 재throw
      console.error('Failed to save selection:', e)
      throw e
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
