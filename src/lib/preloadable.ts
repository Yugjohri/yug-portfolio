import { createElement, type ComponentType } from 'react'

/**
 * A component in a chunk of its own, fetched ahead of need (`preload`) and
 * drawn at once when it is wanted: unlike React.lazy, a component whose chunk
 * has already arrived renders in the same pass, never through a Suspense
 * fallback (lazy suspends once even then, a frame of nothing). Only when it
 * is wanted before it has arrived does it suspend -- so it goes under a
 * Suspense of its own, close by. A chunk that fails to arrive is thrown to
 * the error boundary when it is wanted (and fetched again on the next preload).
 */
export function preloadable<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  let loaded: ComponentType<P> | null = null
  let failed: unknown = null
  let pending: Promise<void> | null = null
  const preload = () =>
    (pending ??= load().then(
      (m) => {
        loaded = m.default
        failed = null
      },
      (err) => {
        failed = err
        pending = null
      },
    ))
  function Preloaded(props: P) {
    if (loaded) return createElement(loaded, props)
    if (failed) throw failed
    throw preload()
  }
  return { preload, Component: Preloaded }
}
