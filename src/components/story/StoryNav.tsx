import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { BEAT, EASE } from '../../motion/tokens'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * The Story's section nav: one pill, top-right, in the music player's
 * material. It stays out of the way (and out of the tab order) for the whole
 * header, and comes in as the header's gesture completes -- the lockup has
 * settled by then -- and goes again when the reader scrolls back into it.
 *
 * The sections are read from the page, in order: About, Experience,
 * Projects, Stack, Contact. The one in view is marked.
 * Below 768px the pill is a single "Index" button that opens the same links.
 */

const SECTIONS: { id: string; label: string }[] = [
  { id: 'about', label: 'About' },
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'stack', label: 'Stack' },
  { id: 'contact', label: 'Contact' },
]

/** where in the header's gesture the nav arrives: the lockup has settled */
const ARRIVE_AT = 0.8

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function StoryNav() {
  const root = useRef<HTMLElement>(null)
  const veil = useRef<HTMLDivElement>(null)
  const [links, setLinks] = useState<{ id: string; label: string }[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  // the sections this page actually has, in page order
  useEffect(() => {
    const found = SECTIONS.filter((s) => document.getElementById(s.id)).sort((a, b) => {
      const ea = document.getElementById(a.id)!
      const eb = document.getElementById(b.id)!
      return ea.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    })
    setLinks(found)
  }, [])

  useGSAP(
    () => {
      const el = root.current
      const header = document.getElementById('story-top')
      if (!el || !header || !links.length) return
      const still = reduced()

      gsap.set(el, { autoAlpha: 0, y: still ? 0 : -8 })
      const show = (on: boolean) => {
        if (!on) setOpen(false)
        if (still) gsap.set(el, { autoAlpha: on ? 1 : 0 })
        else gsap.to(el, { autoAlpha: on ? 1 : 0, y: on ? 0 : -8, duration: BEAT, ease: EASE.unfold, overwrite: true })
      }

      // the header's own pin: the nav arrives at 80% of its range. Without it
      // (reduced motion, no pin) the nav arrives once the header has scrolled away.
      const pin = ScrollTrigger.getAll().find((t) => t.trigger === header && t.pin)
      ScrollTrigger.create(
        pin
          ? {
              start: () => pin.start + (pin.end - pin.start) * ARRIVE_AT,
              end: 'max',
              onToggle: (self) => show(self.isActive),
            }
          : {
              trigger: header,
              start: 'bottom 60%',
              end: 'max',
              onToggle: (self) => show(self.isActive),
            },
      )

      // which section is in view: the last one whose top has passed the
      // middle of the screen. Read from the scroll position every update,
      // rather than from each section's enter and leave, so a jump across
      // several sections still lands on the right one. A pinned section is
      // measured by its spacer, which is where its length really is.
      const sections = links
        .map(({ id }) => document.getElementById(id))
        .filter((el): el is HTMLElement => !!el)
        .map((el) => (el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el))
      const pick = () => {
        const mid = window.innerHeight / 2
        let at: string | null = null
        sections.forEach((el, i) => {
          if (el.getBoundingClientRect().top <= mid) at = links[i].id
        })
        setActive(at)
      }
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: pick, onRefresh: pick })
      pick()
    },
    { dependencies: [links], scope: root, revertOnUpdate: true },
  )

  const go = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    event.preventDefault()
    setOpen(false)
    const lenis = window.__lenis
    const y = target.getBoundingClientRect().top + window.scrollY
    if (reduced() || !lenis) {
      window.scrollTo({ top: y, behavior: 'auto' })
      return
    }
    // a long way (across more than two sections): cover, jump, uncover
    const from = links.findIndex((l) => l.id === active)
    const to = links.findIndex((l) => l.id === id)
    if (from >= 0 && Math.abs(to - from) > 2 && veil.current) {
      const v = veil.current
      gsap.to(v, {
        autoAlpha: 1,
        duration: 0.2,
        ease: 'none',
        onComplete: () => {
          lenis.scrollTo(target, { immediate: true, force: true })
          ScrollTrigger.update()
          gsap.to(v, { autoAlpha: 0, duration: 0.3, ease: 'none' })
        },
      })
      return
    }
    // otherwise a glide, longer the further it goes
    const distance = Math.abs(y - window.scrollY) / window.innerHeight
    lenis.scrollTo(target, { duration: gsap.utils.clamp(0.9, 1.6, 0.9 + distance * 0.12), force: true })
  }

  const items = links.map(({ id, label }) => (
    <a
      key={id}
      href={`#${id}`}
      className="snav__link"
      aria-current={active === id ? 'true' : undefined}
      onClick={(e) => go(e, id)}
    >
      {label}
    </a>
  ))

  return (
    <>
      <nav className="snav" ref={root} aria-label="Sections">
        <div className="snav__pill snav__pill--full">{items}</div>
        <div className="snav__index">
          <button
            type="button"
            className="snav__pill snav__toggle"
            aria-expanded={open}
            aria-controls="snav-menu"
            onClick={() => setOpen((o) => !o)}
          >
            Index
          </button>
          <div className="snav__menu" id="snav-menu" hidden={!open}>
            {items}
          </div>
        </div>
      </nav>
      <div className="snav__veil" ref={veil} aria-hidden="true" />
    </>
  )
}

/**
 * The status dot: a small red point at the top-centre of the Story, on the
 * nav's centre line, pulsing slowly. Hovered or focused, it says the one
 * thing it stands for, in the Brief's own words.
 */
export function StoryStatus() {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!shown) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShown(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shown])
  return (
    <div
      className="sstatus"
      tabIndex={0}
      role="img"
      aria-label="Open to AI engineering roles from October 2026"
      onPointerEnter={() => setShown(true)}
      onPointerLeave={() => setShown(false)}
      onFocus={() => setShown(true)}
      onBlur={() => setShown(false)}
    >
      <span className="sstatus__dot" aria-hidden="true" />
      <span className="sstatus__tip mono" aria-hidden="true" data-shown={shown ? '' : undefined}>
        open to work · from oct 2026
      </span>
    </div>
  )
}
