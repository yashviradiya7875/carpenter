import { useSyncExternalStore } from 'react'

/**
 * What a URL shows. Every route the app has is listed here, so adding one is a single
 * place to change:
 *
 *   /                 studio      (signed in)
 *   /files            files       (signed in; `/file` works too)
 *   /share/<token>    share       (public)
 *   anything else     not-found
 *
 * The host must serve `index.html` for all of these (see vercel.json and deploy/nginx);
 * this module then decides the page. `/api/*` and `/assets/*` are never app routes.
 */
export type View = 'studio' | 'files' | 'share' | 'not-found'

/** The pages reachable by navigating inside the app. */
export type NavigableView = 'studio' | 'files'

const VIEW_PATHS: Record<NavigableView, string> = { studio: '/', files: '/files' }

const SHARE_PATH = /^\/share\/([^/]+)\/?$/

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

function viewFromLocation(): View {
  const path = window.location.pathname
  if (path === '/' || path === '/index.html') return 'studio'
  if (/^\/files?\/?$/i.test(path)) return 'files'
  if (SHARE_PATH.test(path)) return 'share'
  return 'not-found'
}

/** The token of a `/share/<token>` URL. */
export function shareTokenFromLocation(): string | null {
  const token = window.location.pathname.match(SHARE_PATH)?.[1]
  if (!token) return null
  try {
    return decodeURIComponent(token)
  } catch {
    return token
  }
}

/**
 * The current page, read from the URL, and a way to move between pages. Moving adds a
 * history entry, so the browser's Back and Forward buttons, reloads and shared links all work.
 */
export function useView(): [View, (view: NavigableView) => void] {
  const view = useSyncExternalStore(subscribe, viewFromLocation, (): View => 'studio')

  const goTo = (next: NavigableView) => {
    if (viewFromLocation() === next) return
    window.history.pushState(null, '', VIEW_PATHS[next])
    // pushState doesn't announce itself; tell subscribers the location changed.
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return [view, goTo]
}
