import { useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ROLES } from '../../data/portfolio'
import { BEAT, EASE } from '../../motion/tokens'
import StTitle from './StTitle'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * Where the work was done: the roles, newest first, as a list of huge names.
 *
 * Two pens, made one:
 *  - from Akinbobola-Trust-Ifemayowa's "Premium List Hover Effect"
 *    (codepen.io/Akinbobola-Trust-Ifemayowa/pen/MYeMPML): the rows, the
 *    condensed names that roll up on hover onto a second copy while the row
 *    leans in, and the click that opens a row like an accordion;
 *  - from devales's "GSAP Floating Image Reveal Portfolio"
 *    (codepen.io/devales/pen/XJKXZEP): the hollow name -- the copy that rolls
 *    in is outline only, in the accent -- and the arrow that turns and colours.
 *    (Its floating reveal was tried here and left out: without pictures for
 *    these roles it added nothing.)
 *
 * Without a hovering pointer (a phone) the names do not roll; rows open on
 * tap, and the newest starts open so the essentials are there without a tap.
 */
export default function Experience() {
  const root = useRef<HTMLElement>(null)
  const [open, setOpen] = useState<number | null>(0)

  const { contextSafe } = useGSAP(
    () => {
      const el = root.current
      if (!el) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const rows = gsap.utils.toArray<HTMLElement>('[data-xp-row]', el)

      // each row rises in as it comes up the screen, and goes back above it
      if (!reduced) {
        rows.forEach((row) => {
          const tl = gsap.timeline({ paused: true }).fromTo(row, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: BEAT * 1.7, ease: EASE.unfold })
          ScrollTrigger.create({
            trigger: row,
            start: 'top 90%',
            onEnter: () => (document.hidden ? tl.progress(1) : tl.play()),
            onLeaveBack: () => (document.hidden ? tl.progress(0) : tl.reverse()),
          })
        })
      }

      // the opened row starts open (no animation)
      rows.forEach((row, i) => {
        const body = row.querySelector<HTMLElement>('[data-xp-body]')
        if (body) gsap.set(body, { height: i === 0 ? 'auto' : 0 })
        gsap.set(row.querySelector('[data-xp-arrow]'), { rotation: i === 0 ? 90 : 0 })
      })
    },
    { scope: root },
  )

  const canRoll = () =>
    window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const enter = contextSafe((row: HTMLElement) => {
    if (!canRoll()) return
    gsap.to(row.querySelectorAll('[data-xp-name]'), { yPercent: -100, duration: 0.5, ease: 'power3.out', overwrite: 'auto' })
    gsap.to(row.querySelector('[data-xp-title]'), { x: 20, duration: 0.6, ease: 'power3.out', overwrite: 'auto' })
  })
  const leave = contextSafe((row: HTMLElement) => {
    gsap.to(row.querySelectorAll('[data-xp-name]'), { yPercent: 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' })
    gsap.to(row.querySelector('[data-xp-title]'), { x: 0, duration: 0.6, ease: 'power3.out', overwrite: 'auto' })
  })
  const toggle = contextSafe((i: number) => {
    const rows = gsap.utils.toArray<HTMLElement>('[data-xp-row]', root.current)
    const next = open === i ? null : i
    rows.forEach((row, k) => {
      const body = row.querySelector('[data-xp-body]')
      const arrow = row.querySelector('[data-xp-arrow]')
      const on = k === next
      gsap.to(body, { height: on ? 'auto' : 0, duration: on ? 0.6 : 0.5, ease: 'power3.inOut', overwrite: 'auto', onComplete: () => ScrollTrigger.refresh() })
      gsap.to(arrow, { rotation: on ? 90 : 0, duration: 0.5, ease: 'power3.inOut', overwrite: 'auto' })
    })
    setOpen(next)
  })

  const first = ROLES[ROLES.length - 1]?.period.split('—')[0].trim().split(' ').pop()

  return (
    <section className="exp" id="experience" ref={root} aria-labelledby="exp-heading">
      <div className="st-corner st-corner--tl mono">
        <b>02</b> — Experience
      </div>
      <div className="st-corner st-corner--tr mono">{first ? `${first} — now` : 'Roles'}</div>

      <div className="st-wrap exp__inner">
        <StTitle id="exp-heading" text="Where it had to hold up." accent="had to hold up." />

        <ol className="xp">
          {ROLES.map((r, i) => {
            const isOpen = open === i
            const bodyId = `xp-body-${i}`
            return (
              <li
                className="xp__row"
                key={r.org}
                data-xp-row
                data-open={isOpen ? '' : undefined}
                onPointerEnter={(e) => enter(e.currentTarget)}
                onPointerLeave={(e) => leave(e.currentTarget)}
              >
                <button className="xp__head" type="button" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => toggle(i)}>
                  <span className="mono xp__index">{String(i + 1).padStart(2, '0')}</span>
                  <span className="xp__title" data-xp-title>
                    {/* the name and its hollow twin, one above the other; the hover rolls them up */}
                    <span className="xp__roll">
                      <span className="xp__name" data-xp-name>
                        {r.org}
                      </span>
                      <span className="xp__name xp__name--hollow" data-xp-name aria-hidden="true">
                        {r.org}
                      </span>
                    </span>
                    <span className="xp__role">
                      {r.title}
                      {r.current ? <span className="mono xp__now">Now</span> : null}
                      {/* on a phone the period column folds in here */}
                      <span className="mono xp__when-inline">{r.period}</span>
                    </span>
                  </span>
                  <span className="mono xp__when">{r.period}</span>
                  <span className="xp__arrow" data-xp-arrow aria-hidden="true">
                    →
                  </span>
                </button>
                <div className="xp__body" id={bodyId} data-xp-body role="region" aria-label={r.org}>
                  <div className="xp__inner">
                    <ul className="xp__points">
                      {r.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    <ul className="mono xp__stack" aria-label="Stack">
                      {r.stack.split(' · ').map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

    </section>
  )
}
