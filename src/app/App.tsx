import { useState } from 'react'
import AuthPage from '../features/auth/AuthPage'
import { useSession } from '../features/auth/useSession'
import DashboardPage from '../features/dashboard/DashboardPage'
import { FilesPage } from '../features/files/FilesPage'
import { SharedResourcePage } from '../features/files/SharedResourcePage'
import type { AuthAccount } from '../shared/auth/types'
import { AppHeader } from '../shared/components/AppHeader'
import { buttonClasses, LoadingState } from '../shared/ui'
import './App.css'

/**
 * Composition root. Every page renders inside the same shell:
 *
 *   App
 *    ├── AppHeader   (the single global header)
 *    └── page content
 *
 * The theme is global too: ThemeProvider wraps App in main.tsx.
 * Features never import each other; they are wired together here.
 */
function App() {
  const shareMatch = window.location.pathname.match(/^\/share\/([^/]+)\/?$/)
  if (shareMatch) {
    return (
      <div className="app-shell">
        <AppHeader actions={<a className={buttonClasses({ size: 'sm', shape: 'pill' })} href="/">Carpenter Pro</a>} />
        <SharedResourcePage token={decodeURIComponent(shareMatch[1])} />
      </div>
    )
  }
  return <SignedInApp />
}

function SignedInApp() {
  const { account, isRestoring, restoreError, signIn, signOut } = useSession()

  if (isRestoring) {
    return (
      <main className="checking-screen app-enter-fade">
        <LoadingState label="Restoring your workspace…" />
      </main>
    )
  }

  if (!account) return <AuthPage onSignedIn={signIn} initialError={restoreError} />

  // Keyed by account so a different sign-in starts with fresh workspace state.
  return <Workspace key={account.username} account={account} onSignOut={signOut} />
}

type View = 'studio' | 'files'

function Workspace({ account, onSignOut }: { account: AuthAccount; onSignOut: () => void }) {
  const [view, setView] = useState<View>('studio')
  const [credits, setCredits] = useState(account.credits)
  const goToStudio = () => setView('studio')

  return (
    <div className="app-shell">
      <AppHeader account={account} credits={credits} onSignOut={onSignOut} onHome={goToStudio} />
      {/* The studio stays mounted while Files is open, so its work in progress survives. */}
      <DashboardPage
        account={account}
        hidden={view !== 'studio'}
        onOpenFiles={() => setView('files')}
        onCreditsChange={setCredits}
      />
      {view === 'files' ? <FilesPage account={account} onBack={goToStudio} /> : null}
    </div>
  )
}

export default App
