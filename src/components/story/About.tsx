import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { BRIEF, HIGHLIGHTS } from '../../data/brief'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * The person behind the systems, in one read: a short statement set as the
 * headline with its last words in the serif, a plain paragraph of positioning
 * indented under it, the portrait at the page's edge, and three facts on a
 * rule. The Brief has the long form; this is the paragraph a reader should
 * remember.
 *
 * It is read by scrolling. The section pins and one scrubbed timeline
 * uncovers it in order: the portrait first, as a soft presence that
 * sharpens; the statement a word at a time, each coming up out of blur; then
 * the paragraph the same way, quicker; the small label; the rule and the
 * facts last. Scroll slowly and it unfolds slowly; scroll back and it folds
 * away again. When it is all there the pin lets go and the page moves on.
 */

const STATEMENT = 'I build AI systems that'
const STATEMENT_EM = 'hold up.'

const LINE =
  'AI engineer in Delhi. Retrieval, agents and fine-tuned models built for places the internet does not reach — an air-gapped lab, one GPU, a budget that says no. The work is making them dependable there.'

/** How far the reader scrolls through the reveal, as viewport heights. */
const PIN_LENGTH = 1.6

export default function About() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const rootEl = root.current
      if (!rootEl) return

      const q = gsap.utils.selector(rootEl)
      const statementWords = q('[data-about-word]')
      const lineWords = q('[data-about-pword]')

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const blurred = { autoAlpha: 0, filter: 'blur(12px)', y: 10 }
      const sharp = { autoAlpha: 1, filter: 'blur(0px)', y: 0 }

      gsap.set(statementWords, blurred)
      gsap.set(lineWords, { autoAlpha: 0, filter: 'blur(8px)', y: 6 })
      gsap.set(q('[data-about-label], [data-about-fact], [data-about-corner]'), { autoAlpha: 0 })
      gsap.set(q('[data-about-rule]'), { scaleX: 0, transformOrigin: 'left center' })
      gsap.set(q('[data-about-portrait]'), { autoAlpha: 0, filter: 'blur(28px)', x: 40 })
      gsap.set(q('[data-about-portrait] img'), { scale: 1.42 })

      // one timeline over the pin, 0..1; every piece placed along it
      const tl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: {
          trigger: rootEl,
          pin: true,
          start: 'top top',
          end: () => `+=${Math.round(window.innerHeight * PIN_LENGTH)}`,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      // 1. the portrait: a soft presence at the edge that resolves
      tl.to(q('[data-about-portrait]'), { autoAlpha: 1, filter: 'blur(0px)', x: 0, duration: 0.42, ease: 'power2.inOut' }, 0)
      tl.to(q('[data-about-portrait] img'), { scale: 1.26, duration: 0.6, ease: 'power2.out' }, 0)
      // 2. the statement, a word at a time, out of blur
      tl.to(statementWords, { ...sharp, duration: 0.16, stagger: 0.045 }, 0.06)
      // 3. the paragraph follows the same way, quicker, and its label
      tl.to(lineWords, { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 0.1, stagger: 0.006 }, 0.36)
      tl.to(q('[data-about-label]'), { autoAlpha: 1, duration: 0.08 }, 0.5)
      // 4. the small details, last: the rule draws, the facts stand up, the corners
      tl.to(q('[data-about-rule]'), { scaleX: 1, duration: 0.18, ease: 'power3.inOut' }, 0.58)
      tl.to(q('[data-about-fact]'), { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.05 }, 0.66)
      tl.fromTo(q('[data-about-fact]'), { y: 12 }, { y: 0, duration: 0.14, stagger: 0.05 }, 0.66)
      tl.to(q('[data-about-corner]'), { autoAlpha: 1, duration: 0.1 }, 0.7)
      // a beat at the end with everything in place, before the pin lets go
      tl.to({}, { duration: 0.12 }, 0.88)
    },
    { scope: root },
  )

  return (
    <section className="about" id="about" ref={root} aria-labelledby="about-heading">
      <div className="st-corner st-corner--tl mono" data-about-corner>
        02 — About
      </div>
      <div className="st-corner st-corner--tr mono" data-about-corner>
        {BRIEF.role} · {BRIEF.location}
      </div>

      <div className="st-wrap about__grid">
        <h2 className="about__statement" id="about-heading">
          {STATEMENT.split(' ').map((w, i) => (
            <span className="st-word" key={i}>
              <span data-about-word>{w}</span>
            </span>
          ))}
          <span className="st-word">
            <em data-about-word>{STATEMENT_EM}</em>
          </span>
        </h2>

        <figure className="about__portrait" data-about-portrait>
          <img src="/portrait.webp" alt={`${BRIEF.name}, ${BRIEF.role}, ${BRIEF.location}`} loading="lazy" decoding="async" />
        </figure>

        <div className="about__copy">
          <span className="mono about__label" data-about-label>
            Info
          </span>
          <p className="about__line">
            {LINE.split(' ').map((w, i) => (
              <span className="about__pword" key={i} data-about-pword>
                {w}
              </span>
            ))}
          </p>
        </div>

        <i className="about__rule" data-about-rule aria-hidden="true" />
        <ul className="about__facts">
          {HIGHLIGHTS.map((h) => (
            <li className="about__fact" data-about-fact key={h.label}>
              <span className="mono">{h.label}</span>
              <span>{h.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
