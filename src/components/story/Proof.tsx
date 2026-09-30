import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { RECEIPTS } from '../../data/portfolio'
import { BEAT, EASE } from '../../motion/tokens'
import StTitle from './StTitle'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * The breath after the ribbon: one still screen that says what the work adds
 * up to. A thesis and three receipts -- numbers the projects earned, set large
 * -- and nothing else.
 *
 * The rule under the thesis is where the red thread lands off the ribbon
 * (StoryThread.tsx), as it once landed between the header's two words; it is
 * the thread's red when the thread lets go of it. The receipts settle in
 * after the thesis, as the reader arrives.
 */
export default function Proof() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const receipts = gsap.utils.toArray<HTMLElement>('[data-proof-receipt]', root.current)
      const tl = gsap.timeline({ paused: true })
      tl.fromTo(
        receipts,
        { autoAlpha: 0, y: 30 },
        { autoAlpha: 1, y: 0, duration: BEAT * 2, ease: EASE.unfold, stagger: 0.1 },
      )
      ScrollTrigger.create({
        trigger: '.proof__receipts',
        start: 'top 90%',
        onEnter: () => (document.hidden ? tl.progress(1) : tl.play()),
        onLeaveBack: () => (document.hidden ? tl.progress(0) : tl.reverse()),
      })
    },
    { scope: root },
  )

  return (
    <section className="proof" id="proof" ref={root} aria-labelledby="proof-heading">
      <div className="st-corner st-corner--tl mono">
        <b>04</b> — Proof
      </div>
      <div className="st-corner st-corner--tr mono">Measured, not claimed</div>

      <div className="st-wrap proof__inner">
        <StTitle id="proof-heading" text="Built for the worst case." accent="worst case." />

        <div className="proof__rule" data-proof-rule aria-hidden="true" />

        <ol className="proof__receipts">
          {RECEIPTS.map((r, i) => (
            <li className="proof__receipt" data-proof-receipt key={r.label}>
              <span className="mono proof__index">{pad2(i + 1)}</span>
              <span className="proof__value" data-hot={r.hot ? '' : undefined}>
                {r.prefix ? <span className="proof__affix">{r.prefix}</span> : null}
                {r.value}
                {r.suffix ? <span className="proof__affix">{r.suffix}</span> : null}
              </span>
              <span className="mono proof__label">{r.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
