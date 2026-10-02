import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ThemeContext, type Theme } from './themeContext'

const LIGHT_QUERY = '(prefers-color-scheme: light)'

function readSavedTheme(storageKey: string): Theme | null {
  try {
    const saved = window.localStorage.getItem(storageKey)
    return saved === 'light' || saved === 'dark' ? saved : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.(LIGHT_QUERY).matches ? 'light' : 'dark'
}

export type ThemeProviderProps = {
  children: ReactNode
  /** localStorage key for the saved choice. Use the same key in the pre-paint script in index.html. */
  storageKey?: string
}

/**
 * Applies the theme to <html data-theme> and persists the user's choice.
 * Without a saved choice it follows the OS preference, including live changes.
 */
export function ThemeProvider({ children, storageKey = 'theme' }: ThemeProviderProps) {
  const [savedTheme, setSavedTheme] = useState<Theme | null>(() => readSavedTheme(storageKey))
  const [osTheme, setOsTheme] = useState<Theme>(systemTheme)
  const theme = savedTheme ?? osTheme
  const isFirstApply = useRef(true)

  useEffect(() => {
    const query = window.matchMedia?.(LIGHT_QUERY)
    if (!query) return
    const handleChange = () => setOsTheme(query.matches ? 'light' : 'dark')
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    // Swap colors in one frame instead of letting every transition fade separately.
    if (!isFirstApply.current) root.classList.add('app-theme-switching')
    root.dataset.theme = theme
    const canvas = getComputedStyle(root).getPropertyValue('--color-canvas').trim()
    if (canvas) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', canvas)

    if (isFirstApply.current) {
      isFirstApply.current = false
      return
    }
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => root.classList.remove('app-theme-switching'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setSavedTheme(next)
    try {
      window.localStorage.setItem(storageKey, next)
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this visit.
    }
  }, [storageKey])

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
