import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SplitText } from 'gsap/SplitText'
import { ABOUT_PANEL } from '../../data/brief'
import StackOrbit, { aboutOverflow } from './StackOrbit'
import { layeredHoldPx } from '../../motion/sectionTransitions'

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)

/** A paragraph as words, each its own span (the reveal lights them one by one); the spaces stay text. */
function Words({ text }: { text: string }) {
  const words = text.split(' ')
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="apanel__w" data-ap-word>
            {w}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </>
  )
}

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
            {/* each line rises out of its own mask as the walls close (osmo's masked line reveal, driven by StoryHero) */}
            <h2 className="apanel__heading" id={live ? 'about-heading' : undefined}>
              <span className="apanel__mask">
                <span className="apanel__l1 apanel__rise" data-ap-line>
                  {ABOUT_PANEL.heading[0]}
                </span>
              </span>
              <span className="apanel__mask">
                <span className="apanel__l2 apanel__rise" data-ap-line>
                  <em className="apanel__u">{ABOUT_PANEL.heading[1]}</em>.
                </span>
              </span>
            </h2>
            {/* the words start faint and light up one by one as the stack's scroll runs */}
            <div className="apanel__body">
              {ABOUT_PANEL.paras.map((p) => (
                <p key={p.slice(0, 24)}>
                  <Words text={p} />
                </p>
              ))}
            </div>
            <p className="apanel__coda">
              <Words text={ABOUT_PANEL.coda} />
            </p>
          </div>
        </div>
        <div className="apanel__half apanel__half--r">
          {/* the stack's label: the left's eyebrow, at its height, over the stack */}
          <p className="apanel__eyebrow apanel__eyebrow--stack">Tech stack</p>
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
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const words = gsap.utils.toArray<HTMLElement>('[data-ap-word]', el)
    // The heading has already risen on the walls (StoryHero drives the copies'
    // lines with the walls' own travel), so the real section shows it in place.
    // shown from the moment its top reaches the top of the screen (the walls' landing)
    ScrollTrigger.create({
      trigger: el,
      start: 'top top+=1',
      end: 'max',
      refreshPriority: -1,
      onToggle: (self) => el.toggleAttribute('data-shown', self.isActive),
    })
    if (reduced) return

    // The heading answers the hand, after rniswonger's "Variable font hover
    // animation using Greensock" (codepen.io/rniswonger/pen/oNOBQwq): in the
    // sans line each letter's weight swells toward 900 the nearer the cursor
    // is, settling back to 600 as it leaves; the serif line (not variable)
    // lifts its letters instead. And once, as About lands, a heavier weight
    // runs along the first line like a wave.
    const l1 = el.querySelector<HTMLElement>('.apanel__l1')
    const l2 = el.querySelector<HTMLElement>('.apanel__u')
    if (l1 && l2) {
      // letters inside words: a line may only break between words, even while
      // the wave swells the letters (letters alone broke "co / mplex" on a phone)
      const s1 = SplitText.create(l1, { type: 'words,chars', wordsClass: 'apanel__hw', charsClass: 'apanel__ch' })
      const s2 = SplitText.create(l2, { type: 'words,chars', wordsClass: 'apanel__hw', charsClass: 'apanel__ch' })
      const sans = s1.chars as HTMLElement[]
      const serif = s2.chars as HTMLElement[]
      const REST = 600
      const REACH = 170
      // the underline waits undrawn (as on the walls) and draws itself in after the wave
      gsap.set(l2, { '--ap-ul': '0%' })
      let run: gsap.core.Timeline | gsap.core.Tween | null = null
      const wave = () =>
        gsap.timeline()
          .to(sans, { fontWeight: 880, duration: 0.35, ease: 'power2.out', stagger: 0.025 })
          .to(sans, { fontWeight: REST, duration: 0.6, ease: 'power2.inOut', stagger: 0.025 }, 0.3)
          .to(l2, { '--ap-ul': '100%', duration: 0.9, ease: 'power3.inOut' }, 0.45)
      ScrollTrigger.create({
        trigger: el,
        start: 'top top+=1',
        end: 'max',
        refreshPriority: -1,
        // every time About lands from above -- scrolling back up past it and down again replays it
        onEnter: () => {
          run?.kill()
          gsap.set(sans, { fontWeight: REST })
          gsap.set(l2, { '--ap-ul': '0%' })
          run = gsap.delayedCall(0.15, () => {
            run = wave()
          })
        },
        onLeaveBack: () => {
          run?.kill()
          gsap.set(l2, { '--ap-ul': '0%' })
        },
      })
      const near = (c: HTMLElement, x: number, y: number) => {
        const r = c.getBoundingClientRect()
        const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2))
        return Math.max(0, 1 - d / REACH)
      }
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return
        sans.forEach((c) => {
          const k = near(c, e.clientX, e.clientY)
          gsap.to(c, { fontWeight: REST + (900 - REST) * k * k, duration: 0.5, ease: 'power2', overwrite: 'auto' })
        })
        serif.forEach((c) => {
          const k = near(c, e.clientX, e.clientY)
          gsap.to(c, { y: -10 * k * k, duration: 0.5, ease: 'power2', overwrite: 'auto' })
        })
      }
      const onLeave = () => {
        gsap.to(sans, { fontWeight: REST, duration: 0.6, ease: 'power2', overwrite: 'auto' })
        gsap.to(serif, { y: 0, duration: 0.6, ease: 'power2', overwrite: 'auto' })
      }
      const heading = el.querySelector<HTMLElement>('.apanel__heading')
      const zone = heading?.parentElement ?? el
      zone.addEventListener('pointermove', onMove)
      zone.addEventListener('pointerleave', onLeave)
    }

    // the words light up across the stack's run (its pin, StackOrbit's 'about-stack'),
    // done a little before it ends so the last lines are read while the stream still goes.
    // Where About overflows the screen (a phone), its text rises into view over
    // 30-92% of the run (StackOrbit), so the words light over that stretch instead.
    const pin = () => ScrollTrigger.getById('about-stack')
    const sheet = el.querySelector<HTMLElement>('.apanel__sheet')
    const span = (a: number, b: number) => {
      const p = pin()
      if (!p) return null
      const run = p.end - layeredHoldPx() - p.start
      const tall = sheet ? aboutOverflow(sheet) > 0 : false
      return p.start + run * (tall ? b : a)
    }
    gsap.to(words, {
      opacity: 1,
      ease: 'none',
      stagger: 0.04,
      duration: 0.3,
      scrollTrigger: {
        trigger: el,
        start: () => span(0, 0.3) ?? 'top top',
        end: () => span(0.62, 0.95) ?? '+=150%',
        scrub: 0.4,
        invalidateOnRefresh: true,
        refreshPriority: -1,
      },
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
