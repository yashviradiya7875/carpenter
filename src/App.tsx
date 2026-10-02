import AuthPage from './features/auth/AuthPage'
import { SharedResourcePage } from './features/files/FilesPage'

function App() {
  const match = window.location.pathname.match(/^\/share\/([^/]+)\/?$/)
  if (match) return <SharedResourcePage token={decodeURIComponent(match[1])} />
  return <AuthPage />
}

export default App