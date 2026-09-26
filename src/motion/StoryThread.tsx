import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { EASE } from './tokens'
import { line, point, rectOf, seam } from './thread'

gsap.registerPlugin(useGSAP)

/** How much of About's portrait its clip still covers, from the top: 1 hidden, 0 whole. */
function covered(el: HTMLElement) {
  const m = /inset\(\s*([\d.]+)%/.exec(el.style.clipPath)
  return m ? parseFloat(m[1]) / 100 : 0
}

/**
 * The red thread on the Story: the header's rule, once the header has let go
 * of it, carried down into About, where it is the edge the portrait is
 * uncovered by, then a point pinned to the portrait's top.
 *
 * Mounted last in the page, so the triggers it makes come after the pins
 * they are measured through. Everything it follows is measured live. Under
 * reduced motion it is never shown and the rule is left alone.
 *
 * Its seam runs over About's own range with About's own scrub (top bottom to
 * top top, 0.6), so its playhead is the portrait clip's playhead:
 *   0 - 0.22     carry: from the rule to the portrait's uncovered edge
 *   0.22 - 0.62  ride the edge as the clip opens (About's clip runs here)
 *   0.62 - 0.75  collapse to a 6 px point at the portrait's top-centre
 *   0.75 - 1     ride with the portrait as a pin
 * The portrait sits low in About, so its edge is below the fold for the
 * first part of the ride; the thread keeps to the viewport, waiting on its
 * bottom edge until the edge comes up to meet it.
 */
export default function StoryThread() {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const el = ref.current
    const story = el?.parentElement
    const about = story?.querySelector<HTMLElement>('#about')
    const rule = story?.querySelector<HTMLElement>('.shero__rule')
    const portrait = story?.querySelector<HTMLElement>('[data-about-portrait]')
    if (!el || !about || !rule || !portrait) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // the top of what the clip has uncovered, as a line the portrait's width
    const edge = () => {
      const b = portrait.getBoundingClientRect()
      const y = b.top + covered(portrait) * b.height
      return line(b.left + b.width / 2, Math.min(y, window.innerHeight - 1), b.width)
    }
    const pin = () => {
      const b = portrait.getBoundingClientRect()
      return point(b.left + b.width / 2, b.top)
    }

    return seam(el, {
      trigger: about,
      start: 'top bottom',
      end: 'top top',
      scrub: 0.6,
      segments: [
        { start: 0, end: 0.22, from: () => rectOf(rule), to: edge, ease: EASE.carry },
        { start: 0.22, end: 0.62, from: edge, to: edge },
        { start: 0.62, end: 0.75, from: edge, to: pin, ease: EASE.collapse },
        { start: 0.75, end: 1, from: pin, to: pin },
      ],
      // the rule goes in the frame the thread takes its place, and is back in the frame it is given back
      onHold: (on) => (on ? rule.setAttribute('data-thread-holds', '') : rule.removeAttribute('data-thread-holds')),
    })
  })

  return <div className="thread" ref={ref} aria-hidden="true" />
}
