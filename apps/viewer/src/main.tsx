import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

// StrictMode temporarily disabled for WebSocket debugging
createRoot(rootElement).render(<App />)
