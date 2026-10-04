import { useSyncExternalStore } from 'react'

/** The signed-in pages, each with its own URL: the studio at `/`, Files at `/files`. */
export type View = 'studio' | 'files'

const VIEW_PATHS: Record<View, string> = { studio: '/', files: '/files' }

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

/** `/files` (and `/file`) open Files; every other path is the studio. */
function viewFromLocation(): View {
  return /^\/files?\/?$/i.test(window.location.pathname) ? 'files' : 'studio'
}

/**
 * The current page, read from the URL, and a way to move between pages. Moving adds a
 * history entry, so the browser's Back and Forward buttons, reloads and shared links all work.
 */
export function useView(): [View, (view: View) => void] {
  const view = useSyncExternalStore(subscribe, viewFromLocation, (): View => 'studio')

  const goTo = (next: View) => {
    if (viewFromLocation() === next) return
    window.history.pushState(null, '', VIEW_PATHS[next])
    // pushState doesn't announce itself; tell subscribers the location changed.
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return [view, goTo]
}
