import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

/**
 * Type guard to validate stored theme value
 */
function isValidTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    const stored = localStorage.getItem('theme')
    // Validate stored value before using
    if (isValidTheme(stored)) return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })

  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggle }
}
