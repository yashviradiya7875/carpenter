import { useEffect, useState } from 'react'
import AuthPage from '../features/auth/AuthPage'
import { useSession } from '../features/auth/useSession'
import DashboardPage from '../features/dashboard/DashboardPage'
import { FilesPage } from '../features/files/FilesPage'
import { SharedResourcePage } from '../features/files/SharedResourcePage'
import type { AuthAccount } from '../shared/auth/types'
import { AppHeader } from '../shared/components/AppHeader'
import { Button, buttonClasses, EmptyState, Skeleton, SkeletonGroup } from '../shared/ui'
import { shareTokenFromLocation, useView } from './useView'
import './App.css'

/**
 * Composition root. Every page renders inside the same shell:
 *
 *   App
 *    ├── AppHeader   (the single global header)
 *    └── page content
 *
 * Pages have their own URLs: the studio at `/`, Files at `/files`, and the public share page
 * at `/share/<token>` (see useView). Any other URL shows the app's own "page not found".
 * The studio and Files need a session; opening them signed out shows sign-in first, then the page.
 * The theme is global too: ThemeProvider wraps App in main.tsx.
 * Features never import each other; they are wired together here.
 */
function App() {
  const [view, goTo] = useView()
  const shareToken = view === 'share' ? shareTokenFromLocation() : null

  if (shareToken) {
    return (
      <div className="app-shell">
        <AppHeader actions={<a className={buttonClasses({ size: 'sm', shape: 'pill' })} href="/">Carpenter Pro</a>} />
        <SharedResourcePage token={shareToken} />
      </div>
    )
  }
  if (view === 'not-found') return <NotFoundPage onHome={() => goTo('studio')} />
  return <SignedInApp />
}

/** Shown for a URL that isn't one of the app's pages, signed in or not. */
function NotFoundPage({ onHome }: { onHome: () => void }) {
  useEffect(() => {
    document.title = 'Page not found · Carpenter Pro'
  }, [])

  return (
    <div className="app-shell">
      <AppHeader onHome={onHome} />
      <main className="not-found-page app-enter-fade">
        <EmptyState
          icon="search"
          headingLevel={1}
          title="Page not found"
          description="This address doesn’t match a page in Carpenter Pro. It may have been mistyped, or the page may have moved."
          actions={<Button variant="primary" shape="pill" icon="back" onClick={onHome}>Go to the studio</Button>}
        />
      </main>
    </div>
  )
}

function SignedInApp() {
  const { account, isRestoring, restoreError, signIn, signOut } = useSession()

  if (isRestoring) return <RestoringShell />

  if (!account) return <AuthPage onSignedIn={signIn} initialError={restoreError} />

  // Keyed by account so a different sign-in starts with fresh workspace state.
  return <Workspace key={account.username} account={account} onSignOut={signOut} />
}

/** While a stored session is checked: the app's frame, with the shape of the page that is about to open. */
function RestoringShell() {
  const [view] = useView()

  return (
    <div className="app-shell">
      <AppHeader isLoading />
      <main className="restoring-page">
        {view === 'files' ? (
          <SkeletonGroup label="Restoring your workspace…" className="restoring-files">
            <div className="restoring-files-sidebar">
              {Array.from({ length: 9 }, (_, index) => <Skeleton key={index} height={30} />)}
            </div>
            <div className="restoring-files-main">
              <Skeleton width={220} height={32} />
              <Skeleton className="restoring-files-list" />
            </div>
          </SkeletonGroup>
        ) : (
          <SkeletonGroup label="Restoring your workspace…" className="restoring-studio">
            <Skeleton className="restoring-studio-title" />
            <Skeleton variant="text" width={280} />
            <Skeleton className="restoring-studio-composer" />
          </SkeletonGroup>
        )}
      </main>
    </div>
  )
}

function Workspace({ account, onSignOut }: { account: AuthAccount; onSignOut: () => void }) {
  const [view, goTo] = useView()
  const [credits, setCredits] = useState(account.credits)
  const goToStudio = () => goTo('studio')

  return (
    <div className="app-shell">
      <AppHeader account={account} credits={credits} onSignOut={onSignOut} onHome={goToStudio} />
      {/* The studio stays mounted while Files is open, so its work in progress survives. */}
      <DashboardPage
        account={account}
        hidden={view !== 'studio'}
        onOpenFiles={() => goTo('files')}
        credits={credits}
        onCreditsChange={setCredits}
      />
      {view === 'files' ? <FilesPage account={account} onBack={goToStudio} /> : null}
    </div>
  )
}

export default App
