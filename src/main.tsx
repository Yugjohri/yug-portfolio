import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorScreen'
import './styles/index.css'
import { startBoot } from './boot/boot'

// the loading screen (static, in index.html) starts reporting before the app renders
startBoot()

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
