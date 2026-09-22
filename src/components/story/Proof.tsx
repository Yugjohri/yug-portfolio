import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { RECEIPTS } from '../../data/portfolio'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * The breath after the ribbon: one still screen that says what the work adds
 * up to. A thesis and three receipts -- numbers the projects earned, set large
 * -- and nothing else. It arrives as the reader does and otherwise holds still.
 */
export default function Proof() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      gsap
        .timeline({
          defaults: { ease: 'expo.out' },
          scrollTrigger: { trigger: root.current, start: 'top 62%', toggleActions: 'play none none reverse' },
        })
        .from('[data-proof-word]', { y: 28, autoAlpha: 0, duration: 0.9, stagger: 0.05 }, 0)
        .from('[data-proof-receipt]', { y: 26, autoAlpha: 0, duration: 1, stagger: 0.1 }, 0.35)
        .from('[data-proof-rule]', { scaleX: 0, duration: 1.1, ease: 'power3.inOut' }, 0.3)
    },
    { scope: root },
  )

  const thesis = ['Built', 'for', 'the']

  return (
    <section className="proof" id="proof" ref={root} aria-labelledby="proof-heading">
      <div className="st-corner st-corner--tl mono">01 — Proof</div>

      <div className="st-wrap proof__inner">
        <h2 className="proof__thesis" id="proof-heading">
          {thesis.map((w) => (
            <span className="st-word" key={w}>
              <span data-proof-word>{w}</span>
            </span>
          ))}
          <span className="st-word">
            <em data-proof-word>worst case.</em>
          </span>
        </h2>

        <div className="proof__rule" data-proof-rule aria-hidden="true" />

        <ol className="proof__receipts">
          {RECEIPTS.map((r, i) => (
            <li className="proof__receipt" data-proof-receipt key={r.label}>
              <span className="mono proof__index">{pad2(i + 1)}</span>
              <span className="proof__value">
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
