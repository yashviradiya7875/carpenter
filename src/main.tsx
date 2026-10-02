import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './index.css'
import App from './app/App.tsx'
import { ThemeProvider } from './shared/ui'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider storageKey="carpenter-pro.theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
)
