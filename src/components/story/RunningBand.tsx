import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * A breath between Projects and Contact: one line of huge outlined words
 * running slowly across the page, in Experience's hollow red. It drifts on
 * its own, runs faster while the page is being scrolled, and turns round
 * when the scroll does.
 */
const WORDS = ['open to work', 'AI engineering', 'RAG', 'full-stack', 'built to hold up']

export default function RunningBand() {
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const el = track.current
      if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      // the track holds two copies: moving it by one copy's width loops it seamlessly
      const loop = gsap.to(el, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 })
      let dir = 1
      const st = ScrollTrigger.create({
        trigger: root.current,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
        onUpdate: (self) => {
          const v = self.getVelocity()
          if (Math.abs(v) > 20) dir = v > 0 ? 1 : -1
          // a push with the scroll's speed, easing back to the drift
          gsap.to(loop, { timeScale: dir * (1 + Math.min(4, Math.abs(v) / 600)), duration: 0.3, overwrite: true })
          gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.3, overwrite: false })
        },
      })
      return () => st.kill()
    },
    { scope: root },
  )

  const run = (hidden: boolean) => (
    <span className="rband__run" aria-hidden={hidden || undefined}>
      {WORDS.map((w) => (
        <span key={w} className="rband__word">
          {w}
          <span className="rband__sep" aria-hidden="true">
            ✳
          </span>
        </span>
      ))}
    </span>
  )

  return (
    <div className="rband" ref={root} aria-label={WORDS.join(', ')} role="marquee">
      <div className="rband__track" ref={track}>
        {run(false)}
        {run(true)}
      </div>
    </div>
  )
}
