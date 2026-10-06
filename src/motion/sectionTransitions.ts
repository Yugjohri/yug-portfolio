import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * The scroll transitions between the Story's sections. Each one is switched
 * here, and nowhere else: set it to false and the sections simply scroll as
 * they did before (its styles in story.css only apply while it is on, via the
 * attribute it sets on <main class="story">).
 *
 *  - layered: About -> Experience. When About's stack is done, About stays
 *    put and Experience slides up over it like a page laid on top, its top
 *    edge rounded and shadowed, while About dims underneath.
 *    (After GreenSock's "ScrollTrigger Layered Pin", codepen.io/GreenSock/pen/rNRarKg.)
 *  - footerReveal: Projects -> Contact. Projects lifts away like a sheet, its
 *    bottom rounded and shadowed, and Contact is uncovered underneath it,
 *    already in place -- its content rising more slowly than the scroll, with
 *    extra room above it so the two never feel crowded.
 *    (After nickcil's "Content Scroll Up to Reveal Footer", codepen.io/nickcil/pen/ExXvmM.)
 */
export const SECTION_TRANSITIONS = {
  layered: true,
  footerReveal: false,
}

/** How long (px) About's own pin (the stack's, StackOrbit 'about-stack') holds
 *  after its stream is done, for Experience to slide over it: one screen
 *  while "layered" is on, nothing otherwise. One pin does it all -- a second
 *  pin wrapped round the first broke the page when scrolling back up. */
// (the media query is asked once and followed, not asked again on every one of the many refreshes that read this)
const reducedMq = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
// and the screen's height kept from the last resize: reading innerHeight in the
// middle of a refresh made the browser lay the page out again, every time
let screenH = typeof window !== 'undefined' ? window.innerHeight : 0
if (typeof window !== 'undefined') window.addEventListener('resize', () => (screenH = window.innerHeight), { passive: true })
export const layeredHoldPx = () => (SECTION_TRANSITIONS.layered && !reducedMq?.matches ? screenH : 0)

export function useSectionTransitions() {
  useEffect(() => {
    const story = document.querySelector<HTMLElement>('main.story')
    if (!story) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const made: gsap.core.Tween[] = []
    const added: HTMLElement[] = []
    const undo: (() => void)[] = []

    // ---------------------------------------------------------- About -> Experience
    const about = story.querySelector<HTMLElement>('#about')
    const exp = story.querySelector<HTMLElement>('#experience')
    if (SECTION_TRANSITIONS.layered && about && exp && !reduced) {
      story.setAttribute('data-tr-layered', '')
      // Experience is drawn up by the hold, so it arrives while About is still held
      const pull = () => {
        exp.style.marginTop = `${-layeredHoldPx()}px`
      }
      pull()
      ScrollTrigger.addEventListener('refreshInit', pull)
      undo.push(() => {
        ScrollTrigger.removeEventListener('refreshInit', pull)
        exp.style.removeProperty('margin-top')
      })
      // and About dims under it, over the hold
      const veil = document.createElement('div')
      veil.className = 'tr-veil'
      about.appendChild(veil)
      added.push(veil)
      const stack = () => ScrollTrigger.getById('about-stack')
      // About eases back and fades into the page's own ground as it is covered,
      // so it is already gone when Experience reaches the top (a dark veil left
      // a last strip that vanished at once)
      const sheet = about.querySelector<HTMLElement>('.apanel__sheet')
      if (sheet) {
        made.push(
          gsap.fromTo(
            sheet,
            { scale: 1, yPercent: 0 },
            {
              scale: 0.94,
              yPercent: -3,
              ease: 'none',
              scrollTrigger: {
                trigger: about,
                start: () => (stack()?.end ?? 0) - layeredHoldPx(),
                end: () => stack()?.end ?? 1,
                scrub: true,
                invalidateOnRefresh: true,
              },
            },
          ),
        )
      }
      made.push(
        gsap.fromTo(
          veil,
          { opacity: 0 },
          {
            opacity: 1,
            ease: 'power1.in',
            scrollTrigger: {
              trigger: about,
              start: () => (stack()?.end ?? 0) - layeredHoldPx(),
              end: () => stack()?.end ?? 1,
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        ),
      )
    }

    // ---------------------------------------------------------- Projects -> Contact
    const work = story.querySelector<HTMLElement>('#projects')
    const contact = story.querySelector<HTMLElement>('#contact')
    if (SECTION_TRANSITIONS.footerReveal && work && contact) {
      story.setAttribute('data-tr-footer', '')
      const lift = contact.querySelectorAll<HTMLElement>(':scope > *')
      if (!reduced) {
        made.push(
          gsap.fromTo(
            lift,
            { yPercent: -28, opacity: 0.35 },
            {
              yPercent: 0,
              opacity: 1,
              ease: 'none',
              scrollTrigger: { trigger: contact, start: 'top bottom', end: 'top 15%', scrub: true },
            },
          ),
        )
      }
    }

    ScrollTrigger.refresh()
    return () => {
      made.forEach((m) => {
        m.scrollTrigger?.kill()
        m.revert()
      })
      added.forEach((el) => el.remove())
      undo.forEach((f) => f())
      story.removeAttribute('data-tr-layered')
      story.removeAttribute('data-tr-footer')
      ScrollTrigger.refresh()
    }
  }, [])
}
