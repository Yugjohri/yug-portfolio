import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { BRIEF, LINKS } from '../../data/brief'
import { ROLES } from '../../data/portfolio'
import { BEAT, EASE } from '../../motion/tokens'
import ContactGlass from './ContactGlass'
import NotesBoard from './NotesBoard'

gsap.registerPlugin(useGSAP, ScrollTrigger)

// TODO(yug): confirm the availability line
/** What is true right now, in a line: what just finished, and what is next. */
const NOW = 'Open to AI engineering roles, from October 2026.'

/** The backdrop's words (ContactGlass.tsx): plain, the last line in the accent. */
const GLASS_LINES = ["LET'S WORK", 'TOGETHER']

/** The résumé, served from public/. */
const RESUME = '/yug-johri-resume.pdf'

/** A profile link is only shown once it points at a profile, not the site's front page. */
const isProfile = (url: string) => {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') !== ''
  } catch {
    return false
  }
}

/**
 * The end of the Story, where the red thread comes to rest: under the email
 * (StoryThread.tsx). A line on what is true now, the invitation, the address
 * set large, and the few places to go next; then the page's footer.
 */
export default function Contact() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const parts = gsap.utils.toArray<HTMLElement>('[data-contact-part]', root.current)
      const tl = gsap.timeline({ paused: true })
      tl.fromTo(
        parts,
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: BEAT * 1.7, ease: EASE.unfold, stagger: 0.08 },
      )
      const board = root.current?.querySelector('[data-contact-board]')
      if (board) tl.fromTo(board, { autoAlpha: 0 }, { autoAlpha: 1, duration: BEAT * 1.7, ease: EASE.unfold }, 0)
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top 55%',
        onEnter: () => (document.hidden ? tl.progress(1) : tl.play()),
        onLeaveBack: () => (document.hidden ? tl.progress(0) : tl.reverse()),
      })
    },
    { scope: root },
  )

  // the current role if there is one, otherwise the one just finished
  const current = ROLES.find((r) => r.current)
  const latest = ROLES[0]
  const links = [
    { label: 'GitHub', href: LINKS.github, external: true },
    ...(isProfile(LINKS.linkedin) ? [{ label: 'LinkedIn', href: LINKS.linkedin, external: true }] : []),
    { label: 'Résumé (PDF)', href: RESUME, external: true },
  ]

  const toTop = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const lenis = window.__lenis
    if (lenis) lenis.scrollTo(0, { duration: 1.6, force: true })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section className="contact" id="contact" ref={root} aria-labelledby="contact-heading">
      <div className="st-corner st-corner--tl mono">
        <b>04</b> — Contact
      </div>
      <div className="st-corner st-corner--tr mono">{BRIEF.location} · IST</div>

      {/* two halves: the notes board, and the invitation with the details under it */}
      <div className="contact__grid">
      {/* faded in on its own, without a transform: a transformed ancestor would
          keep the open board (position: fixed) from reaching the whole screen */}
      <div className="contact__board" data-contact-board>
        <NotesBoard />
      </div>
      <div className="contact__main">
      {/* the words, with a knot of glass turning in front of them */}
      <ContactGlass lines={GLASS_LINES} above=".contact__now" />

      <div className="contact__inner">
        <p className="contact__now" data-contact-part>
          <span className="mono contact__label">Now</span>
          <span>
            {current
              ? `${current.title.split(' · ')[0]} at ${current.org}. `
              : latest
                ? `Just finished at ${latest.org}. `
                : ''}
            {NOW}
          </span>
        </p>

        {/* what the backdrop says, for whoever cannot see it */}
        <h2 className="contact__heading" id="contact-heading">
          Let's work together
        </h2>

        <a className="contact__email" href={`mailto:${LINKS.email}`} data-contact-part>
          {LINKS.email}
          <span className="contact__line" data-contact-line aria-hidden="true" />
        </a>

        <a className="contact__phone" href={`tel:${LINKS.phone.replace(/\s/g, '')}`} data-contact-part>
          {LINKS.phone}
        </a>

        <ul className="contact__links" data-contact-part>
          {links.map((l) => (
            <li key={l.label}>
              <a className="contact__link" href={l.href} target="_blank" rel="noreferrer">
                {l.label}
                <span aria-hidden="true"> ↗</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      </div>
      </div>


      <footer className="contact__foot mono">
        <span>
          © {new Date().getFullYear()} {BRIEF.name}
        </span>
        <span className="contact__built">React · GSAP · Lenis · WebGL</span>
        <a className="contact__top" href="#story-top" onClick={toTop}>
          Back to top ↑
        </a>
      </footer>
    </section>
  )
}
