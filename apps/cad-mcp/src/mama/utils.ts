/**
 * MAMA Utility Functions
 *
 * Shared utility functions for MAMA modules.
 */

/**
 * Format timestamp age as human-readable string
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Human-readable age string (e.g., "2d ago", "3h ago", "just now")
 */
export function formatAge(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp

  // Handle future timestamps
  if (diffMs < 0) {
    return 'in the future'
  }

  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffDay > 0) {
    return `${diffDay}d ago`
  } else if (diffHour > 0) {
    return `${diffHour}h ago`
  } else if (diffMin > 0) {
    return `${diffMin}m ago`
  } else {
    return 'just now'
  }
}
