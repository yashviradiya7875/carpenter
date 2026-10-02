// JS mirror of the tokens that code needs (media queries, timers, stacking).
// Keep in sync with tokens.css.

export const breakpoints = {
  xs: 380,
  sm: 520,
  md: 760,
  lg: 1000,
  xl: 1280,
} as const

export type Breakpoint = keyof typeof breakpoints

/** `(max-width: 760px)` style query for `window.matchMedia`. */
export function maxWidth(breakpoint: Breakpoint): string {
  return `(max-width: ${breakpoints[breakpoint]}px)`
}

export const durations = {
  instant: 80,
  fast: 150,
  base: 200,
  slow: 320,
  slower: 420,
} as const

export const zIndex = {
  base: 0,
  raised: 1,
  sticky: 10,
  dropdown: 20,
  overlay: 30,
  modal: 40,
  popover: 45,
  toast: 50,
} as const
