import { useMemo } from 'react'
import { useWebSocket } from './useWebSocket'
import type { Scene } from '@/types/scene'

/**
 * Hook to get scene data from WebSocket connection
 * Replaces file-polling approach with real-time WebSocket updates
 */
export function useScene(): { scene: Scene | null; isLoading: boolean; error: Error | null } {
  const { scene, connectionState, error } = useWebSocket()

  // Memoize Error object to prevent recreating on every render
  const memoError = useMemo(() => (error ? new Error(error) : null), [error])

  return {
    scene,
    isLoading: connectionState === 'connecting',
    error: memoError,
  }
}
