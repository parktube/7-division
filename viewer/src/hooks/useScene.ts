import { useState, useEffect, useRef } from 'react'
import type { Scene } from '@/types/scene'

const POLLING_INTERVAL = 1000 // ms

/**
 * Get scene.json URL based on environment:
 * - Web: /scene.json (relative)
 * - Electron: Uses ?scene= query parameter passed from main process
 */
function getSceneUrl(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const sceneUrl = params.get('scene')
    if (sceneUrl) {
      return sceneUrl // Electron: absolute URL from main process
    }
  }
  return '/scene.json' // Web: relative path
}

export function useScene() {
  const [scene, setScene] = useState<Scene | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const lastModified = useRef<string | null>(null)
  const sceneUrl = useRef(getSceneUrl())

  useEffect(() => {
    let mounted = true

    const fetchScene = async () => {
      try {
        // Cache-bust with timestamp to ensure fresh data
        const url = `${sceneUrl.current}?t=${Date.now()}`
        const res = await fetch(url, { cache: 'no-store' })

        if (!res.ok) {
          throw new Error(`Failed to fetch scene.json: ${res.status}`)
        }

        const data = await res.json()
        // Hash includes last_operation (captures all changes including z-order)
        const newHash = data.last_operation || ''

        // Only update if content actually changed
        if (newHash !== lastModified.current) {
          if (mounted) {
            setScene(data)
            lastModified.current = newHash
            setIsLoading(false)
            setError(null)
          }
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e : new Error(String(e)))
          setIsLoading(false)
        }
      }
    }

    // Initial load
    fetchScene()

    // Polling
    const interval = setInterval(fetchScene, POLLING_INTERVAL)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return { scene, isLoading, error }
}
