import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

declare global {
  interface Window {
    /** The page's Lenis, so in-page links can hand off to the same scroll. */
    __lenis?: Lenis
  }
}

/**
 * Lenis smooth scroll, driven from GSAP's ticker so ScrollTrigger and the
 * scroll read the same clock. Skipped entirely under reduced motion, where the
 * browser's own scrolling is the right answer.
 *
 * Lenis scrolls the window natively (no transform), so ScrollTrigger's pinning
 * needs no scrollerProxy.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({ duration: 1.05, smoothWheel: true })
    window.__lenis = lenis

    const onScroll = () => ScrollTrigger.update()
    lenis.on('scroll', onScroll)

    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      gsap.ticker.lagSmoothing(500, 33)
      lenis.off('scroll', onScroll)
      lenis.destroy()
      if (window.__lenis === lenis) delete window.__lenis
    }
  }, [])
}
