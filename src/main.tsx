import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary, { errorDesk } from './components/ErrorScreen'
import { home } from './routes'
import './styles/index.css'
import { startBoot } from './boot/boot'
import { whenIdle } from './lib/idle'
import { inject } from '@vercel/analytics'
import { injectSpeedInsights } from '@vercel/speed-insights'

// the loading screen (static, in index.html) starts reporting before the app renders
startBoot()

// the landing's code: at once on the landing (index.html has already asked for
// it), otherwise once the page is idle, so going back to it never waits
if (window.location.pathname === '/') void home.preload()
else whenIdle(() => void home.preload())
// and the error screen's desk, in case it is ever wanted
whenIdle(() => void errorDesk.preload(), 6000)

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
