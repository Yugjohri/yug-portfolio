import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { BRIEF } from '../../data/brief'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * The person behind the systems, in three points and a great deal of air:
 * an introduction left of centre, the portrait small and alone in the
 * middle, one short statement to the right. Nothing else -- the emptiness
 * around them is the composition, so this section stays spare on purpose.
 * The Brief carries the long form and the numbers.
 *
 * It is read by scrolling, on one scrubbed timeline: the portrait uncovers
 * from its lower edge, the introduction settles a line at a time, the
 * statement follows a word at a time. All of it runs while the section rises
 * into place, so it is whole by the time it reaches the top. Scroll back and
 * it folds away again.
 */

/** Two short lines, left of centre: the lead-in, then the name under it. */
const INTRO_LEAD = "hi, i'm"

/** One statement, right of centre. Three lines at the width set in the CSS. */
const LINE =
  'i design, and i write code. what i care about is making the complex simple — and the simple meaningful.'

export default function About() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const rootEl = root.current
      if (!rootEl) return

      const q = gsap.utils.selector(rootEl)
      const lineWords = q('[data-about-pword]')

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      gsap.set(q('[data-about-intro]'), { autoAlpha: 0, y: 10 })
      gsap.set(lineWords, { autoAlpha: 0, y: 8 })
      gsap.set(q('[data-about-corner]'), { autoAlpha: 0 })
      // the portrait is uncovered rather than faded: a clip from its lower edge
      gsap.set(q('[data-about-portrait]'), { clipPath: 'inset(100% 0% 0% 0%)' })
      gsap.set(q('[data-about-portrait] img'), { scale: 1.08 })

      // One timeline over the section's own arrival, 0..1. It runs while the
      // section travels up the screen -- from the moment its top edge appears
      // at the bottom to the moment it reaches the top -- rather than over a
      // pin once it is already there. The header's pin releases exactly as
      // this begins, so the two run back to back: the header leaves while
      // this is being uncovered, and no blank screen sits between them.
      const tl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: {
          trigger: rootEl,
          start: 'top bottom',
          end: 'top top',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      })

      // 1. the portrait, uncovered from below, its picture settling as it comes
      tl.to(q('[data-about-portrait]'), { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.4, ease: 'power2.inOut' }, 0.22)
      tl.to(q('[data-about-portrait] img'), { scale: 1, duration: 0.62, ease: 'power2.out' }, 0)
      // 2. the introduction, a line at a time
      tl.to(q('[data-about-intro]'), { autoAlpha: 1, y: 0, duration: 0.18, stagger: 0.08 }, 0.16)
      // 3. the statement follows, a word at a time, quicker
      tl.to(lineWords, { autoAlpha: 1, y: 0, duration: 0.12, stagger: 0.012 }, 0.34)
      // 4. the corner labels last
      tl.to(q('[data-about-corner]'), { autoAlpha: 1, duration: 0.12 }, 0.58)
      // a beat at the end with everything in place, as it lands
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

      <div className="about__grid">
        <h2 className="about__intro" id="about-heading">
          <span className="about__lead" data-about-intro>
            {INTRO_LEAD}
          </span>
          <span className="about__name" data-about-intro>
            {BRIEF.name}
          </span>
        </h2>

        <figure className="about__portrait" data-about-portrait>
          <img src="/portrait.webp" alt={`${BRIEF.name}, ${BRIEF.role}, ${BRIEF.location}`} loading="lazy" decoding="async" />
        </figure>

        <p className="about__line">
          {LINE.split(' ').map((w, i) => (
            <span className="about__pword" key={i} data-about-pword>
              {w}
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}
