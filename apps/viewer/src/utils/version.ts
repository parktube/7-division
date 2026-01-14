/**
 * Version compatibility utilities
 *
 * Implements semantic versioning compatibility checks:
 * - Major version mismatch: Error, block connection
 * - Minor version mismatch: Warning, allow connection
 * - Patch version difference: Silent, allow connection
 */

// Viewer version (Vite에서 빌드 시점에 주입)
declare const __APP_VERSION__: string
export const VIEWER_VERSION = __APP_VERSION__

export interface SemVer {
  major: number
  minor: number
  patch: number
}

export type VersionCompatibility =
  | { status: 'compatible' }
  | { status: 'warning'; message: string }
  | { status: 'error'; message: string }

/**
 * Parse a semver string into components
 */
export function parseSemVer(version: string): SemVer | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  }
}

/**
 * Check version compatibility between viewer and MCP server
 *
 * @param viewerVersion - The viewer version (e.g., "1.2.3")
 * @param mcpVersion - The MCP server version (e.g., "1.3.0")
 * @returns Compatibility status and message
 */
export function checkVersionCompatibility(
  viewerVersion: string,
  mcpVersion: string
): VersionCompatibility {
  const viewer = parseSemVer(viewerVersion)
  const mcp = parseSemVer(mcpVersion)

  if (!viewer || !mcp) {
    return {
      status: 'warning',
      message: `버전 파싱 실패: Viewer=${viewerVersion}, MCP=${mcpVersion}`,
    }
  }

  // Major version mismatch - block connection
  if (viewer.major !== mcp.major) {
    if (viewer.major > mcp.major) {
      return {
        status: 'error',
        message: `호환되지 않는 버전입니다. MCP를 업데이트하세요. (Viewer: v${viewerVersion}, MCP: v${mcpVersion})`,
      }
    } else {
      return {
        status: 'error',
        message: `호환되지 않는 버전입니다. Viewer 페이지를 새로고침하세요. (Viewer: v${viewerVersion}, MCP: v${mcpVersion})`,
      }
    }
  }

  // Minor version mismatch - warning
  if (viewer.minor !== mcp.minor) {
    if (viewer.minor < mcp.minor) {
      return {
        status: 'warning',
        message: `MCP 서버가 더 새로운 버전입니다. 페이지 새로고침을 권장합니다. (Viewer: v${viewerVersion}, MCP: v${mcpVersion})`,
      }
    } else {
      return {
        status: 'warning',
        message: `Viewer가 더 새로운 버전입니다. MCP 업데이트를 권장합니다. (Viewer: v${viewerVersion}, MCP: v${mcpVersion})`,
      }
    }
  }

  // Compatible
  return { status: 'compatible' }
}
