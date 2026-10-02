import { createContext } from 'react'

export type Theme = 'light' | 'dark'

export type ThemeContextValue = {
  /** The active theme: the saved choice, or the OS preference when none is saved. */
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
