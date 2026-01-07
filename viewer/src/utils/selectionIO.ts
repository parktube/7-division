import { Selection, DEFAULT_SELECTION } from '@/types/selection'
import { getDataUrl } from './dataUrl'

export async function saveSelection(selection: Selection): Promise<void> {
  const data: Selection = {
    ...selection,
    timestamp: Date.now(),
  }

  try {
    const res = await fetch(getDataUrl('selection.json'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2),
    })
    if (!res.ok) {
      throw new Error(`Failed to save selection: ${res.status}`)
    }
  } catch (e) {
    console.error('Failed to save selection:', e)
    throw e
  }
}

export async function loadSelection(): Promise<Selection> {
  try {
    const res = await fetch(getDataUrl('selection.json'))
    if (!res.ok) return DEFAULT_SELECTION
    return await res.json()
  } catch {
    return DEFAULT_SELECTION
  }
}
