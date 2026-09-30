import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ROLES } from '../../data/portfolio'
import { BEAT, EASE } from '../../motion/tokens'
import StTitle from './StTitle'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * Where the work was done: the roles, newest first, as rows on one rail.
 * The rail runs down the left of the list; the red thread comes down from
 * About's portrait and draws it as the reader goes (StoryThread.tsx), and
 * leaves it drawn.
 *
 * Each row settles in as it comes up the screen -- the same rise the
 * headlines use, a line's worth of travel -- and goes back if the reader
 * scrolls back above it.
 */
export default function Experience() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.utils.toArray<HTMLElement>('[data-exp-role]', root.current).forEach((row) => {
        const parts = gsap.utils.toArray<HTMLElement>('[data-exp-part]', row)
        const tl = gsap.timeline({ paused: true })
        tl.fromTo(
          parts,
          { autoAlpha: 0, y: 26 },
          { autoAlpha: 1, y: 0, duration: BEAT * 1.7, ease: EASE.unfold, stagger: 0.07 },
        )
        ScrollTrigger.create({
          trigger: row,
          start: 'top 88%',
          onEnter: () => (document.hidden ? tl.progress(1) : tl.play()),
          onLeaveBack: () => (document.hidden ? tl.progress(0) : tl.reverse()),
        })
      })
    },
    { scope: root },
  )

  const first = ROLES[ROLES.length - 1]?.period.split('—')[0].trim().split(' ').pop()

  return (
    <section className="exp" id="experience" ref={root} aria-labelledby="exp-heading">
      <div className="st-corner st-corner--tl mono">
        <b>02</b> — Experience
      </div>
      <div className="st-corner st-corner--tr mono">{first ? `${first} — now` : 'Roles'}</div>

      <div className="st-wrap exp__inner">
        <StTitle id="exp-heading" text="Where it had to hold up." accent="had to hold up." />

        <div className="exp__rows">
          <span className="exp__rail" data-exp-rail aria-hidden="true" />
          <ol className="exp__list">
          {ROLES.map((r) => (
            <li className={r.current ? 'exp__role exp__role--now' : 'exp__role'} key={r.org} data-exp-role>
              <div className="exp__when" data-exp-part>
                <span className="mono">{r.period}</span>
                {r.current ? <span className="mono exp__now">Now</span> : null}
              </div>
              <div className="exp__head" data-exp-part>
                <h3 className="exp__org">{r.org}</h3>
                <p className="exp__title">{r.title}</p>
              </div>
              <ul className="exp__points" data-exp-part>
                {r.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <ul className="mono exp__stack" data-exp-part aria-label="Stack">
                {r.stack.split(' · ').map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
