import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { EASE } from './tokens'
import { line, point, rectOf, seam, type Rect } from './thread'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/** How much of About's portrait its clip still covers, from the top: 1 hidden, 0 whole. */
function covered(el: HTMLElement) {
  const m = /inset\(\s*([\d.]+)%/.exec(el.style.clipPath)
  return m ? parseFloat(m[1]) / 100 : 0
}

/** Mark an element as stood in for by the thread (it is not drawn meanwhile). */
const holds = (el: Element, on: boolean) =>
  on ? el.setAttribute('data-thread-holds', '') : el.removeAttribute('data-thread-holds')

/** An element's box as a line of the thread's weight, along its middle. */
const lineOf = (el: Element): Rect => {
  const b = el.getBoundingClientRect()
  return line(b.left + b.width / 2, b.top + b.height / 2, b.width)
}

/**
 * The red thread on the Story, from the first section to the last. It is the
 * header's rule, carried down the page and handed from one thing to the next:
 *
 *   header -> About     the rule becomes the edge the portrait is uncovered
 *                       by, then a point pinned to the portrait's top
 *   About -> Experience the point drops to the top of the roles' rail and
 *                       draws the rail down as the roles are read; the rail
 *                       stays drawn
 *   Experience -> Work  a point off the rail's foot, to the start of the
 *                       ribbon's track, which it fills as the ribbon runs
 *   Work -> Proof       the full track, carried up to be the rule under the
 *                       thesis -- as it was the rule between the header's words
 *   Proof -> Stack      the rule, lifted off to underline the statement for
 *                       the whole of the stack's journey
 *   Stack -> Contact    the underline, carried down to rest under the email
 *
 * Each handoff is its own seam (thread.ts), on its own element, over its own
 * range; the ranges meet end to start, and every seam but the last lets go
 * as its range ends, so there is only ever one thread on screen. Where a seam
 * lands on a real element, that element is hidden while the thread stands in
 * for it and drawn again when the thread lets go.
 *
 * Mounted last in the page, so its triggers come after the pins they are
 * measured through. Everything it follows is measured live. Under reduced
 * motion it is never shown, and the elements it would stand in for are left
 * as they are.
 */
export default function StoryThread() {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const host = ref.current
    const story = host?.parentElement
    if (!host || !story) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const $ = <T extends Element = HTMLElement>(sel: string) => story.querySelector<T>(sel)
    const threads = gsap.utils.toArray<HTMLElement>('.thread', host)
    const kills: (() => void)[] = []

    // --------------------------------------------------- header -> About
    const about = $('#about')
    const rule = $('.shero__rule')
    const portrait = $('[data-about-portrait]')
    // the top of what the clip has uncovered, as a line the portrait's width
    const edge = () => {
      if (!portrait) return null
      const b = portrait.getBoundingClientRect()
      const y = b.top + covered(portrait) * b.height
      return line(b.left + b.width / 2, Math.min(y, window.innerHeight - 1), b.width)
    }
    const portraitPin = () => {
      if (!portrait) return null
      const b = portrait.getBoundingClientRect()
      return point(b.left + b.width / 2, b.top)
    }
    if (about && rule && portrait) {
      // the header's own seam, as it was, save that it now hands on at the
      // end: over About's range with About's scrub, so its playhead is the
      // portrait clip's
      kills.push(
        seam(threads[0], {
          trigger: about,
          start: 'top bottom',
          end: 'top top',
          scrub: 0.6,
          release: true,
          segments: [
            { start: 0, end: 0.22, from: () => rectOf(rule), to: edge, ease: EASE.carry },
            { start: 0.22, end: 0.62, from: edge, to: edge },
            { start: 0.62, end: 0.75, from: edge, to: portraitPin, ease: EASE.collapse },
            { start: 0.75, end: 1, from: portraitPin, to: portraitPin },
          ],
          // the rule goes in the frame the thread takes its place, and is back in the frame it is given back
          onHold: (on, done) => holds(rule, on || done),
        }),
      )
    }

    // ------------------------------------------------ About -> Experience
    const exp = $('#experience')
    const rail = $('[data-exp-rail]')
    const railTop = () => {
      if (!rail) return null
      const b = rail.getBoundingClientRect()
      return point(b.left + b.width / 2, b.top)
    }
    const railFoot = () => {
      if (!rail) return null
      const b = rail.getBoundingClientRect()
      return point(b.left + b.width / 2, b.bottom)
    }
    // the rail, drawn down to where the reader is: its whole length by the end
    const railWhole = () => (rail ? { ...rectOf(rail), w: 2, r: 1 } : null)
    if (exp && rail && portrait) {
      kills.push(
        seam(threads[1], {
          trigger: exp,
          start: 'top bottom',
          end: 'bottom bottom',
          scrub: 0.6,
          release: true,
          segments: [
            { start: 0, end: 0.28, from: portraitPin, to: railTop, ease: EASE.carry },
            { start: 0.28, end: 1, from: railTop, to: railWhole },
          ],
          // drawn once the thread has run its length; a hairline before that
          onHold: (on, done) => {
            holds(rail, on)
            if (done) rail.setAttribute('data-lit', '')
            else rail.removeAttribute('data-lit')
          },
        }),
      )
    }

    // -------------------------------------------------- Experience -> Work
    const work = $('#projects')
    const track = $('[data-work-track]')
    const workPin = () =>
      ScrollTrigger.getAll().find((t) => t.pin && work?.contains(t.pin as Element) && t.pin !== work)
    const trackStart = () => {
      if (!track) return null
      const b = track.getBoundingClientRect()
      if (!b.width) return null
      return point(b.left, b.top + b.height / 2)
    }
    const trackWhole = () => (track && track.getBoundingClientRect().width ? lineOf(track) : null)
    // the approach's share of the range: one screen of rise, then the pin
    const approach = () => {
      const t = workPin()
      if (!t) return 0.3
      const run = t.end - t.start
      return window.innerHeight / (window.innerHeight + run)
    }
    if (work && track && rail) {
      kills.push(
        seam(threads[2], {
          trigger: work,
          start: 'top bottom',
          end: 'bottom bottom',
          scrub: true,
          release: true,
          segments: [
            { start: 0, end: approach, from: railFoot, to: trackStart, ease: EASE.carry },
            { start: approach, end: 1, from: trackStart, to: trackWhole },
          ],
        }),
      )
    }

    // ---------------------------------------------------- Work -> Proof
    const proofRule = $('[data-proof-rule]')
    const proof = $('#proof')
    if (proof && proofRule && track) {
      kills.push(
        seam(threads[3], {
          trigger: proof,
          start: 'top bottom',
          end: 'top 25%',
          scrub: 0.6,
          release: true,
          segments: [{ start: 0, end: 1, from: trackWhole, to: () => lineOf(proofRule), ease: EASE.carry }],
          onHold: (on) => holds(proofRule, on),
        }),
      )
    }

    // ---------------------------------------------------- Proof -> Stack
    const stack = $('#stack')
    // under the statement's last line: the words of the accent on it
    const underline = () => {
      const words = stack?.querySelectorAll('.stack__statement .st-word--hot')
      if (!words?.length) return null
      const lastTop = words[words.length - 1].getBoundingClientRect().top
      let l = Infinity
      let r = -Infinity
      let b = -Infinity
      words.forEach((w) => {
        const box = w.getBoundingClientRect()
        if (Math.abs(box.top - lastTop) > 4) return
        l = Math.min(l, box.left)
        r = Math.max(r, box.right)
        b = Math.max(b, box.bottom)
      })
      return line((l + r) / 2, b + 4, r - l)
    }
    const stackPin = () => ScrollTrigger.getAll().find((t) => t.pin === stack)
    const stackApproach = () => {
      const t = stackPin()
      if (!t) return 0.3
      return window.innerHeight / (window.innerHeight + t.end - t.start)
    }
    if (stack && proofRule) {
      kills.push(
        seam(threads[4], {
          // the pin's spacer: its foot reaches the screen's foot as the pin lets go
          trigger: stack.parentElement?.classList.contains('pin-spacer') ? stack.parentElement : stack,
          start: 'top bottom',
          end: 'bottom bottom',
          scrub: 0.6,
          release: true,
          segments: [
            { start: 0, end: stackApproach, from: () => lineOf(proofRule), to: underline, ease: EASE.carry },
            { start: stackApproach, end: 1, from: underline, to: underline },
          ],
          onHold: (on, done) => holds(proofRule, on && !done),
        }),
      )
    }

    // ------------------------------------------------- Stack -> Contact
    const contact = $('#contact')
    const email = $('[data-contact-line]')
    if (contact && email && stack) {
      kills.push(
        seam(threads[5], {
          trigger: contact,
          start: 'top bottom',
          end: 'top top',
          scrub: 0.6,
          segments: [
            { start: 0, end: 0.75, from: underline, to: () => lineOf(email), ease: EASE.carry },
            { start: 0.75, end: 1, from: () => lineOf(email), to: () => lineOf(email) },
          ],
          onHold: (on) => holds(email, on),
        }),
      )
    }

    return () => kills.forEach((k) => k())
  })

  return (
    <div className="threads" ref={ref} aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div className="thread" key={i} />
      ))}
    </div>
  )
}
