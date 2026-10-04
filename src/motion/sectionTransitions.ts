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
  footerReveal: true,
}

export function useSectionTransitions() {
  useEffect(() => {
    const story = document.querySelector<HTMLElement>('main.story')
    if (!story) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const made: (ScrollTrigger | gsap.core.Tween)[] = []
    const added: HTMLElement[] = []

    // ---------------------------------------------------------- About -> Experience
    const shift = story.querySelector<HTMLElement>('.about-shift')
    const exp = story.querySelector<HTMLElement>('#experience')
    if (SECTION_TRANSITIONS.layered && shift && exp) {
      story.setAttribute('data-tr-layered', '')
      const veil = document.createElement('div')
      veil.className = 'tr-veil'
      shift.appendChild(veil)
      added.push(veil)
      // the moment the stack's pin lets go (StackOrbit's 'about-stack'): About is held from exactly there
      const from = () => ScrollTrigger.getById('about-stack')?.end ?? 0
      if (!reduced) {
        // About held for one screen once its stack has let go; Experience comes up over it
        made.push(
          ScrollTrigger.create({
            trigger: shift,
            start: () => from() || 'bottom bottom',
            end: () => (from() ? from() + window.innerHeight : '+=100%'),
            pin: true,
            pinSpacing: false,
          }),
        )
        made.push(
          gsap.fromTo(
            veil,
            { opacity: 0 },
            {
              opacity: 0.55,
              ease: 'none',
              scrollTrigger: {
                trigger: shift,
                start: () => from() || 'bottom bottom',
                end: () => (from() ? from() + window.innerHeight : '+=100%'),
                scrub: true,
              },
            },
          ),
        )
      }
    }

    // ---------------------------------------------------------- Projects -> Contact
    const work = story.querySelector<HTMLElement>('#projects')
    const contact = story.querySelector<HTMLElement>('#contact')
    if (SECTION_TRANSITIONS.footerReveal && work && contact) {
      story.setAttribute('data-tr-footer', '')
      const lift = contact.querySelectorAll<HTMLElement>(':scope > *')
      if (!reduced) {
        // uncovered rather than scrolled in: the content starts well up, under
        // Projects, and rises slower than the page until Contact is in place
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
        if (m instanceof ScrollTrigger) m.kill(true)
        else {
          m.scrollTrigger?.kill()
          m.revert()
        }
      })
      added.forEach((el) => el.remove())
      story.removeAttribute('data-tr-layered')
      story.removeAttribute('data-tr-footer')
      ScrollTrigger.refresh()
    }
  }, [])
}
