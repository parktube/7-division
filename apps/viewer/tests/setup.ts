import { vi, beforeEach, afterEach } from 'vitest'
import { __resetStoreForTesting } from '@/hooks/useWebSocket'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  // Control whether port discovery succeeds (for testing findAvailablePort)
  static portDiscoveryEnabled = true

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  private static instances: MockWebSocket[] = []
  private isPortTest: boolean = false

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)

    // Auto-open for port discovery when enabled
    // This simulates a successful port test so findAvailablePort() can complete
    if (MockWebSocket.portDiscoveryEnabled) {
      this.isPortTest = true
      // Use queueMicrotask to allow event handlers to be set first
      queueMicrotask(() => {
        if (this.isPortTest && this.onopen) {
          this.readyState = MockWebSocket.OPEN
          this.onopen(new Event('open'))
        }
      })
    }
  }

  send(data: string) {
    // Mock implementation
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close'))
    }
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    if (this.onopen) {
      this.onopen(new Event('open'))
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close'))
    }
  }

  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  }

  static getAllInstances(): MockWebSocket[] {
    return MockWebSocket.instances
  }

  static clearInstances() {
    MockWebSocket.instances = []
    MockWebSocket.portDiscoveryEnabled = true
  }

  // Mark this WebSocket as the main connection (not a port test)
  markAsMainConnection() {
    this.isPortTest = false
  }
}

// @ts-expect-error - Mock WebSocket globally
globalThis.WebSocket = MockWebSocket

// Export for use in tests
export { MockWebSocket }

afterEach(() => {
  vi.clearAllMocks()
})
