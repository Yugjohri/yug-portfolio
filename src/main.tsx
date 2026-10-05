import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorScreen'
import './styles/index.css'
import { afterBoot, startBoot } from './boot/boot'
import { inject } from '@vercel/analytics'

// the loading screen (static, in index.html) starts reporting before the app renders
startBoot()

// Vercel Web Analytics: cookieless page views, nothing on screen. Its script
// (served by Vercel at /_vercel/insights) is added once the loading screen has
// gone and the browser is idle, so it never competes with the first screen.
afterBoot(() => {
  const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1))
  idle(() => inject(), { timeout: 4000 })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* anything that breaks, anywhere: the desk, and a promise (components/ErrorScreen.tsx) */}
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
