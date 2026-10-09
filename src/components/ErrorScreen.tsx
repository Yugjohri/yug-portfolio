import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { preloadable } from '../lib/preloadable'

/** The desk, in a chunk of its own: every page carried it (a 13KB drawing) for a screen almost never seen. Fetched when idle (main.tsx). */
export const errorDesk = preloadable(() => import('./story/ContactDesk'))

/**
 * What the site shows when something on it breaks: the desk from the contact
 * section setting itself up and its lamp coming on, and a line under it.
 *
 * Two ways in:
 *  - a render error anywhere in the app: the boundary below catches it and
 *    shows this in place of the page;
 *  - an uncaught error anywhere else (a handler, a timer, the animation
 *    ticker -- the kind that leaves a page frozen rather than blank): the
 *    window's error event, filtered so that known browser noise and other
 *    people's scripts (extensions, cross-origin "Script error.") never trip it.
 *
 * The screen keeps its own ground (the cream) whatever the route's theme, so
 * it reads the same everywhere.
 */

// a no-break space keeps the smile with its word
const MESSAGE = 'whoops, yug will fix it soon, we promise :)'

/** Errors that are not the site breaking: browser noise and scripts that are not ours. */
function isNoise(e: ErrorEvent) {
  const msg = e.message || ''
  if (/ResizeObserver loop/i.test(msg)) return true
  // a cross-origin script's error arrives with its details stripped
  if (!e.error && msg === 'Script error.') return true
  // extensions and third-party scripts
  if (e.filename && !e.filename.startsWith(window.location.origin)) return true
  return false
}

export function ErrorScreen() {
  return (
    <div className="errscreen" role="alert">
      <div className="errscreen__inner">
        <Suspense fallback={null}>
          <errorDesk.Component playNow />
        </Suspense>
        <p className="errscreen__msg">{MESSAGE}</p>
        <button className="errscreen__retry mono" type="button" onClick={() => window.location.reload()}>
          Reload the page ↻
        </button>
      </div>
    </div>
  )
}

type Props = { children: ReactNode }
type State = { broken: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { broken: false }

  static getDerivedStateFromError(): State {
    return { broken: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[site] render error', error, info.componentStack)
  }

  private onWindowError = (e: ErrorEvent) => {
    if (this.state.broken || isNoise(e)) return
    console.error('[site] uncaught error', e.error ?? e.message)
    this.setState({ broken: true })
  }

  componentDidMount() {
    window.addEventListener('error', this.onWindowError)
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.onWindowError)
  }

  render() {
    return this.state.broken ? <ErrorScreen /> : this.props.children
  }
}
