import { useState, useCallback, useEffect } from 'react'
import { Copy, RefreshCw, CheckCircle, XCircle, Loader2, AlertTriangle, X } from 'lucide-react'
import type { ConnectionState } from '@/hooks/useWebSocket'
import type { VersionCompatibility } from '@/utils/version'

interface OnboardingProps {
  connectionState: ConnectionState
  versionStatus: VersionCompatibility | null
  onReconnect: () => void
}

const COMMAND = 'npx @ai-native-cad/mcp start'
const SHOW_DELAY_MS = 5000 // 5 seconds before showing onboarding

export function Onboarding({ connectionState, versionStatus, onReconnect }: OnboardingProps) {
  const [copied, setCopied] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showVersionBanner, setShowVersionBanner] = useState(true)

  // Show onboarding after delay if not connected
  useEffect(() => {
    if (connectionState === 'connected') {
      setShowOnboarding(false)
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
        className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-between ${
          isError ? 'bg-red-900/90' : 'bg-yellow-900/90'
        }`}
      >
        <div className="flex items-center gap-3">
          {isError ? (
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          )}
          <span className={`text-sm ${isError ? 'text-red-200' : 'text-yellow-200'}`}>
            {versionStatus.message}
          </span>
        </div>
        {!isError && (
          <button
            onClick={() => setShowVersionBanner(false)}
            className="text-yellow-400 hover:text-yellow-300 p-1"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  // Don't show onboarding dialog if connected (but still show version banner)
  if (connectionState === 'connected') {
    return renderVersionBanner()
  }

  // Don't show if not yet time to show onboarding
  if (!showOnboarding) {
    return null
  }

  return (
    <>
      {renderVersionBanner()}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            {connectionState === 'connecting' ? (
              <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
            ) : (
              <XCircle className="w-6 h-6 text-red-500" />
            )}
            <h2 className="text-lg font-semibold text-zinc-100">
              {connectionState === 'connecting' ? 'MCP 서버 연결 중...' : 'MCP 서버 미연결'}
            </h2>
          </div>

          {/* Description */}
          <p className="text-zinc-400 text-sm mb-4">
            AI-Native CAD를 사용하려면 로컬에서 MCP 서버를 실행해야 합니다.
            터미널에서 아래 명령어를 실행하세요.
          </p>

          {/* Command */}
          <div className="bg-zinc-800 rounded-md p-3 mb-4 flex items-center justify-between gap-2">
            <code className="text-green-400 text-sm font-mono flex-1 overflow-x-auto">
              {COMMAND}
            </code>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm rounded transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">복사됨!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>복사</span>
                </>
              )}
            </button>
          </div>

          {/* Retry button */}
          <button
            onClick={onReconnect}
            disabled={connectionState === 'connecting'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${connectionState === 'connecting' ? 'animate-spin' : ''}`} />
            {connectionState === 'connecting' ? '연결 중...' : '다시 연결'}
          </button>

          {/* Help text */}
          <p className="text-zinc-500 text-xs mt-4 text-center">
            연결에 문제가 있나요?{' '}
            <a
              href="https://github.com/parktube/7-division"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              문서 확인하기
            </a>
          </p>
        </div>
      </div>
    </>
  )
}
