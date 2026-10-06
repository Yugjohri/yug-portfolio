import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { BRIEF } from '../../data/brief'
import { scrollToSection } from '../../motion/scrollToSection'
import UselessSwitch from './UselessSwitch'
import { PIN_LENGTH, TL_TOTAL, TURN_FROM, TURN_TO } from './StoryHero'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * The Story's header, fixed for the whole page (after the reference's
 * "ABOUT  PILLARS  [mark]  LINEAGE  SHOP"): the sections spread across the
 * top in the accent, two before the signature and three after it, each
 * gliding to its section; the one in view is underlined.
 *
 * The signature starts compact. On the first screen the CRT stands right
 * under it, so the mark sits small and high; it grows to its full size while
 * the header's bar turns, and stays there.
 *
 * Below 768px the links fold into a Menu button beside the mark.
 */

const LEFT = [
  { id: 'about', label: 'About' },
  { id: 'experience', label: 'Experience' },
]
const RIGHT = [
  { id: 'projects', label: 'Projects' },
  { id: 'contact', label: 'Contact' },
]
const ALL = [...LEFT, ...RIGHT]

/** on the first screen the mark scales with the window's height, so it clears the glass on any screen */
const compactPx = () => (window.innerHeight < 800 ? 30 : Math.min(46, window.innerHeight * 0.05))
/** where (in the hero's timeline) the closing mask has uncovered the side links */
const DARK_SIDES_UNTIL = 0.14
/** on a phone the mark stays compact everywhere: at full size it would sit on the sections' titles */
const PHONE = '(max-width: 767px)'

export default function SiteHeader() {
  const root = useRef<HTMLElement>(null)
  const mark = useRef<HTMLAnchorElement>(null)
  const [active, setActive] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useGSAP(
    () => {
      const el = root.current
      const markEl = mark.current
      if (!el || !markEl) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // arrives with the page: a short drop from above
      // (the transform is cleared once it lands, so the fixed header is no
      // containing block for anything inside it)
      if (!reduced) gsap.from(el, { autoAlpha: 0, y: -14, duration: 0.9, delay: 0.5, ease: 'power3.out', clearProps: 'transform' })

      // compact over the glass, full size once the gesture has closed it away
      const hero = document.getElementById('story-top')
      const compact = () => Math.min(0.75, compactPx() / Math.max(1, markEl.offsetHeight))
      const mm = gsap.matchMedia()
      mm.add(PHONE, () => {
        gsap.set(markEl, { scale: () => Math.min(0.75, 44 / Math.max(1, markEl.offsetHeight)) })
      })
      mm.add(`not all and ${PHONE}`, () => {
        if (!hero || reduced) return
        gsap.fromTo(
          markEl,
          { scale: compact },
          {
            scale: 1,
            ease: 'none',
            // it grows exactly while the bar turns
            scrollTrigger: {
              start: () => hero.offsetTop + (window.innerHeight * PIN_LENGTH * TURN_FROM) / TL_TOTAL,
              end: () => hero.offsetTop + (window.innerHeight * PIN_LENGTH * TURN_TO) / TL_TOTAL,
              scrub: 0.4,
              invalidateOnRefresh: true,
            },
          },
        )
      })
      // over the first screen's black the header takes the signal red (the crimson
      // is too dark on black): the links until the closing mask has uncovered
      // them (it sweeps in from the sides), the mark until the strip it sits on
      // starts to turn away
      if (hero) {
        const at = (t: number) => () => hero.offsetTop + (window.innerHeight * PIN_LENGTH * t) / TL_TOTAL
        ScrollTrigger.create({
          start: -1, // so the very top counts as inside
          end: at(DARK_SIDES_UNTIL),
          invalidateOnRefresh: true,
          onToggle: (self) => el.toggleAttribute('data-dark-sides', self.isActive),
        })
        ScrollTrigger.create({
          start: -1,
          end: at(TURN_FROM),
          invalidateOnRefresh: true,
          onToggle: (self) => el.toggleAttribute('data-dark-mark', self.isActive),
        })
      }
      // past the header, a soft ground behind the bar (phones), so the page passing under it stays clear
      if (hero) {
        ScrollTrigger.create({
          trigger: hero,
          start: 'bottom top+=1',
          end: 'max',
          onToggle: (self) => el.toggleAttribute('data-solid', self.isActive),
        })
      }

      // the section in view
      ALL.forEach(({ id }) => {
        const section = document.getElementById(id)
        if (!section) return
        ScrollTrigger.create({
          trigger: section,
          start: 'top 45%',
          end: 'bottom 45%',
          onToggle: (self) => {
            if (self.isActive) setActive(id)
            else setActive((a) => (a === id ? null : a))
          },
        })
      })
    },
    { scope: root },
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const link = ({ id, label }: { id: string; label: string }) => (
    <a
      key={id}
      href={`#${id}`}
      aria-current={active === id ? 'true' : undefined}
      onClick={(e) => {
        if (scrollToSection(id)) e.preventDefault()
        setOpen(false)
      }}
    >
      {label}
    </a>
  )

  return (
    <header className="shead" ref={root} data-open={open ? '' : undefined}>
      <nav className="shead__side shead__side--l" aria-label="Sections">
        {LEFT.map(link)}
        <span aria-hidden="true" />
      </nav>
      <a
        className="shead__mark"
        ref={mark}
        href="#story-top"
        aria-label={`${BRIEF.name}, back to the top`}
        onClick={(e) => {
          if (scrollToSection('story-top')) e.preventDefault()
          setOpen(false)
        }}
      />
      <nav className="shead__side shead__side--r" aria-label="More sections">
        <span aria-hidden="true" />
        {RIGHT.map(link)}
        {/* where the dark-mode switch sits (it is placed over this, outside the nav) */}
        <span className="shead__mode-slot" aria-hidden="true" />
      </nav>
      {/* the prank: a dark-mode toggle a bear will not let anyone use (UselessSwitch.tsx) */}
      <div className="shead__mode">
        <UselessSwitch skin="mode" />
      </div>
      <button className="shead__menu" type="button" aria-expanded={open} aria-controls="shead-sheet" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : 'Menu'}
      </button>
      <div className="shead__sheet" id="shead-sheet" hidden={!open}>
        {ALL.map(link)}
      </div>
    </header>
  )
}
