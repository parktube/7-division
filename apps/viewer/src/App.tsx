import { PanelLayout } from '@/components/Layout'
import { TopBar } from '@/components/TopBar'
import { StatusBar } from '@/components/StatusBar'
import { ViewportProvider } from '@/contexts/ViewportContext'
import { UIProvider } from '@/contexts/UIContext'
import { useSelectionSync } from '@/hooks/useSelectionSync'
import { initDataServer } from '@/utils/dataUrl'

// Initialize data server URL from query params (for Electron)
initDataServer()

// Component to sync selection with selection.json
function SelectionSync() {
  useSelectionSync()
  return null
}

export default function App() {
  return (
    <UIProvider>
      <ViewportProvider>
        <SelectionSync />
        <div className="h-full w-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
          <TopBar />
          <main className="flex-1 min-h-0 overflow-hidden">
            <PanelLayout />
          </main>
          <StatusBar />
        </div>
      </ViewportProvider>
    </UIProvider>
  )
}
