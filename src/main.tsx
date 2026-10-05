import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorScreen'
import './styles/index.css'
import { startBoot } from './boot/boot'
import { whenIdle } from './lib/idle'
import { inject } from '@vercel/analytics'
import { injectSpeedInsights } from '@vercel/speed-insights'

// the loading screen (static, in index.html) starts reporting before the app renders
startBoot()

// Vercel Web Analytics (cookieless page views) and Speed Insights (how fast
// the site really loads for visitors), nothing on screen. Their scripts are
// served by Vercel itself (/_vercel/...) and added once the loading screen has
// gone and the browser is idle, so they never compete with the first screen.
whenIdle(() => {
  inject()
  injectSpeedInsights()
}, 4000)

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
