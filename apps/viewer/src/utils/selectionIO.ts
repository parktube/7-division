import { Selection, DEFAULT_SELECTION } from '@/types/selection'
import { getDataUrl, hasDataServer } from './dataUrl'
import { sendSelectionUpdateDirect, isWebSocketConnected } from '@/hooks/useWebSocket'

export async function saveSelection(selection: Selection): Promise<void> {
  // Try WebSocket first (works for both local and GitHub Pages when MCP is running)
  if (isWebSocketConnected()) {
    sendSelectionUpdateDirect({
      selected_entities: selection.selected_entities,
      locked_entities: selection.locked_entities,
      hidden_entities: selection.hidden_entities,
    })
    return
  }

  // Fallback to HTTP POST for local development without WebSocket
  // Skip on GitHub Pages (HTTPS) - no local server to handle POST
  if (!hasDataServer() && typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return // Silently skip - expected behavior on GitHub Pages
  }

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
      // Silently ignore 404/405 errors (expected on static hosting)
      if (res.status === 404 || res.status === 405) {
        return
      }
      throw new Error(`Failed to save selection: ${res.status}`)
    }
  } catch {
    // Silently ignore network errors in production
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
