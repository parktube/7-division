import { useState, useCallback, useEffect } from 'react'
import { Copy, CheckCircle, XCircle, Loader2, AlertTriangle, X, Wifi, WifiOff } from 'lucide-react'
import type { ConnectionState } from '@/hooks/useWebSocket'
import type { VersionCompatibility } from '@/utils/version'

interface OnboardingProps {
  connectionState: ConnectionState
  versionStatus: VersionCompatibility | null
  retryCount?: number
  maxRetriesReached?: boolean
}

const COMMAND = 'npx @ai-native-cad/mcp start'
const SHOW_DELAY_MS = 1500 // 1.5 seconds before showing onboarding

// Check if running in Puppeteer capture mode
function isCaptureMode(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as { __captureMode?: boolean }).__captureMode
}

export function Onboarding({
  connectionState,
  versionStatus,
  retryCount = 0,
  maxRetriesReached = false,
}: OnboardingProps) {
  const [copied, setCopied] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showVersionBanner, setShowVersionBanner] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  // Show onboarding after delay if not connected
  useEffect(() => {
    // Skip onboarding in Puppeteer capture mode
    if (isCaptureMode()) {
      setShowOnboarding(false)
      return
    }

    if (connectionState === 'connected') {
      setShowOnboarding(false)
      setDismissed(false) // Reset dismissed state on successful connection
      return
    }

    const timer = setTimeout(() => {
      setShowOnboarding(true)
    }, SHOW_DELAY_MS)

    return () => clearTimeout(timer)
  }, [connectionState])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(COMMAND)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = COMMAND
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  // Version banner for warnings/errors (shown when connected but version mismatch)
  const renderVersionBanner = () => {
    if (!versionStatus || versionStatus.status === 'compatible' || !showVersionBanner) {
      return null
    }

    const isError = versionStatus.status === 'error'

    return (
      <div
        className="fixed top-0 left-0 right-0 z-50 px-4 py-2.5 flex items-center justify-between"
        style={{
          backgroundColor: isError ? 'rgba(220, 38, 38, 0.95)' : 'rgba(217, 119, 6, 0.95)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          {isError ? (
            <XCircle className="w-4 h-4 text-white/90 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-white/90 flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-white/90">
            {versionStatus.message}
          </span>
        </div>
        {!isError && (
          <button
            type="button"
            onClick={() => setShowVersionBanner(false)}
            className="text-white/70 hover:text-white p-1 rounded transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            aria-label="닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  // Don't show onboarding dialog if connected (but still show version banner)
  if (connectionState === 'connected') {
    return renderVersionBanner()
  }

  // Don't show if dismissed or not yet time to show onboarding
  if (dismissed || !showOnboarding) {
    return null
  }

  const isConnecting = connectionState === 'connecting'

  return (
    <>
      {renderVersionBanner()}
      <div
        className="fixed inset-0 flex items-center justify-center z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <div
          className="max-w-sm w-full mx-4 rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{
              backgroundColor: 'var(--bg-panel-header)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center gap-2.5">
              {isConnecting ? (
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(217, 119, 6, 0.15)' }}
                >
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--lock)' }} />
                </div>
              ) : (
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)' }}
                >
                  <WifiOff className="w-4 h-4" style={{ color: 'var(--error)' }} />
                </div>
              )}
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {isConnecting ? 'MCP 서버 연결 중...' : 'MCP 서버 미연결'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="w-6 h-6 flex items-center justify-center rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Status indicator */}
            {maxRetriesReached ? (
              <div
                className="mb-3 px-3 py-2 rounded-md text-xs flex items-center gap-2"
                style={{
                  backgroundColor: 'rgba(220, 38, 38, 0.1)',
                  color: 'var(--error)',
                }}
              >
                <WifiOff className="w-3.5 h-3.5" />
                자동 재연결 실패. 서버 실행 후 &apos;다시 연결&apos;을 눌러주세요.
              </div>
            ) : isConnecting && retryCount > 0 ? (
              <div
                className="mb-3 px-3 py-2 rounded-md text-xs flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Wifi className="w-3.5 h-3.5" style={{ color: 'var(--lock)' }} />
                재연결 시도 중... ({retryCount}/5)
              </div>
            ) : null}

            {/* Step-by-step Guide */}
            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex gap-2.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
                  style={{ backgroundColor: 'var(--selection)', color: 'white' }}
                >
                  1
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                    터미널에서 아래 명령어 실행
                  </p>
                  <div
                    className="rounded-md p-2 flex items-center justify-between gap-2"
                    style={{ backgroundColor: 'var(--bg-input)' }}
                  >
                    <code
                      className="text-xs flex-1 overflow-x-auto"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}
                    >
                      {COMMAND}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: copied ? 'rgba(22, 163, 74, 0.15)' : 'var(--bg-panel)',
                        color: copied ? 'var(--success)' : 'var(--text-secondary)',
                        border: `1px solid ${copied ? 'var(--success)' : 'var(--border)'}`,
                      }}
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          복사됨
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          복사
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-2.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  2
                </div>
                <div className="flex-1">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    서버가 시작되면 <span style={{ color: 'var(--success)' }}>자동으로 연결</span>됩니다
                  </p>
                </div>
              </div>
            </div>

            {/* Dismiss button */}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="w-full mt-4 px-3 py-2 rounded text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--hover)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-input)'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              나중에 하기
            </button>
          </div>

          {/* Footer - Claude Integration Guide */}
          <div
            className="px-4 py-3"
            style={{
              backgroundColor: 'var(--bg-panel-header)',
              borderTop: '1px solid var(--border)',
            }}
          >
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              Claude에서 사용하기
            </p>
            <div className="flex gap-2">
              <a
                href="https://github.com/parktube/7-division#claude-code"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-2 py-1.5 rounded text-xs text-center transition-colors"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--selection)'
                  e.currentTarget.style.color = 'var(--selection)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
              >
                Claude Code
              </a>
              <a
                href="https://github.com/parktube/7-division#claude-desktop"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-2 py-1.5 rounded text-xs text-center transition-colors"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--selection)'
                  e.currentTarget.style.color = 'var(--selection)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
              >
                Claude Desktop
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
