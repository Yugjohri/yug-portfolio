import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ABOUT_PANEL } from '../../data/brief'
import StackOrbit from './StackOrbit'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * The panel's contents, in two halves of the screen with a gutter at the
 * centre (the line the header's walls split on): the text block -- eyebrow,
 * two-line heading, the paragraphs -- centred in the left half, the stack
 * centred in the right half. Neither half reaches the centre, so each wall
 * carries a whole half.
 */
function Panel({ live, pin }: { live: boolean; pin?: React.RefObject<HTMLElement> }) {
  return (
    <div className="apanel__sheet">
      <div className="apanel__wrap">
        <div className="apanel__half apanel__half--l">
          <div className="apanel__left">
            <p className="apanel__eyebrow">{ABOUT_PANEL.eyebrow}</p>
            <h2 className="apanel__heading" id={live ? 'about-heading' : undefined}>
              <span className="apanel__l1">{ABOUT_PANEL.heading[0]}</span>
              <span className="apanel__l2">
                <em className="apanel__u">{ABOUT_PANEL.heading[1]}</em>.
              </span>
            </h2>
            <div className="apanel__body">
              {ABOUT_PANEL.paras.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
            <p className="apanel__coda">{ABOUT_PANEL.coda}</p>
          </div>
        </div>
        <div className="apanel__half apanel__half--r">
          <div className="apanel__side">
            <StackOrbit mode={live ? 'pin' : 'still'} pin={pin} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * About, after the reference, on its own ground: an eyebrow, a two-line
 * heading (a sans line, then an italic serif line underlined under its words,
 * not its period), the text on the left and the stack, shrunk from its old
 * section, on the right.
 *
 * Two forms of the same panel:
 *  - "copy": what the header's walls carry. Each wall clips a copy to its half
 *    of the screen, so the two halves travel in from opposite ends and meet.
 *    The stack in it is the live one's first frame. Hidden from readers.
 *  - "section": the real section. It sits a screen higher than its place in
 *    the flow (its wrapper's negative margin), so its top reaches the top of
 *    the viewport exactly as the walls land, and it is shown from that moment
 *    on, over the header, pixel for pixel where the copies were. Then it pins
 *    while the stack's stream runs with the scroll, and lets the page go on.
 */
export default function AboutPanel({ variant }: { variant: 'copy' | 'section' }) {
  const section = useRef<HTMLElement>(null)

  useGSAP(() => {
    const el = section.current
    if (variant !== 'section' || !el) return
    // shown from the moment its top reaches the top of the screen (the walls' landing)
    ScrollTrigger.create({
      trigger: el,
      start: 'top top+=1',
      end: 'max',
      refreshPriority: -1,
      onToggle: (self) => el.toggleAttribute('data-shown', self.isActive),
    })
  })

  if (variant === 'copy') {
    return (
      <div className="apanel" aria-hidden="true">
        <Panel live={false} />
      </div>
    )
  }
  return (
    <div className="about-shift">
      <section className="apanel apanel--section" id="about" ref={section} aria-labelledby="about-heading">
        <Panel live pin={section} />
      </section>
    </div>
  )
}
