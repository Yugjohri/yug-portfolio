import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { routeTransition } from './routeTransition.ts'

/**
 * The layer route transitions play in. Mounted once, at the App's root, next
 * to the music player and under it (50 to its 55), so the player visibly
 * persists through a transition. It never takes the pointer and is hidden
 * from assistive technology; the pages themselves carry the meaning.
 *
 * Four elements, all hidden at rest: the iris (Event Horizon's black), the
 * carried point (which also becomes the CRT's line), and the Brief's cover
 * and band (Glyph Drain).
 */
export default function RouteTransition() {
  const root = useRef<HTMLDivElement>(null)
  const iris = useRef<HTMLDivElement>(null)
  const point = useRef<HTMLDivElement>(null)
  const cover = useRef<HTMLDivElement>(null)
  const band = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!root.current || !iris.current || !point.current || !cover.current || !band.current) return
    routeTransition.attach({
      root: root.current,
      iris: iris.current,
      point: point.current,
      cover: cover.current,
      band: band.current,
    })
    // the browser's own back and forward abort a transition wherever it is
    const onPop = () => routeTransition.kill()
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      routeTransition.detach()
    }
  }, [])

  // a route change that is not the transition's own destination aborts it
  useEffect(() => {
    routeTransition.routeChanged(pathname)
  }, [pathname])

  return (
    <div className="rt" ref={root} aria-hidden="true">
      <div className="rt__iris" ref={iris} />
      <div className="rt__cover" ref={cover} />
      <div className="rt__band" ref={band} />
      <div className="rt__point" ref={point} />
    </div>
  )
}
