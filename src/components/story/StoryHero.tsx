import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SplitText } from 'gsap/SplitText'
import { CrtScreen } from './crtScreen'
import { BRIEF } from '../../data/brief'
import { routeTransition, whenSettled } from '../../motion/routeTransition.ts'
import { BEAT, EASE } from '../../motion/tokens'

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)

/**
 * The Story's header, and the one gesture that carries it into the ribbon.
 *
 * A curved display stands in the frame under a line of type, drawing its
 * picture as a field of small glyphs. Scrolling closes a mask over it until
 * only a strip is left -- the page's ground coming in from both sides as two
 * panels, the name already standing on them, uncovered as they close; the
 * strip turns to flat, thins and shortens until it is the rule between the
 * two halves of the name;
 * the lockup draws up toward the corner, and the ribbon rises over it.
 *
 * One pinned range, one scrubbed timeline. Everything is a transform or a
 * clip-path on three elements: the frame, the two definitions, the rule.
 */

/** The name, split across the two panels, each half with its line from the Brief's own copy. */
const DEFINITIONS = [
  {
    word: 'think',
    meaning:
      'i start by assuming it is wrong. a cheap habit, and it has saved me more than once.',
  },
  {
    word: 'build',
    meaning:
      'then i take things out until it stops surprising me. surprise is good company everywhere except production.',
  },
]

/** How far the reader scrolls through the gesture, as viewport heights. */
const PIN_LENGTH = 2.6

type StoryHeroProps = {
  /** Optional looping clip for the screen. Without one it shows the still. */
  videoSrc?: string
}

export default function StoryHero({ videoSrc }: StoryHeroProps) {
  const root = useRef<HTMLElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const media = useRef<HTMLDivElement>(null)
  const lockup = useRef<HTMLDivElement>(null)
  const rule = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  /** 0..1 through the gesture, read by the render loop to know when to stop */
  const progress = useRef(0)
  /** the tube's power, read by the screen each frame: 1 unless the header is opening */
  const power = useRef({ v: 1 })
  /** told by the screen after each frame it draws, with the power it drew at */
  const drawn = useRef<((power: number) => void) | null>(null)
  /** how wide the tube's middle line is, as a share of the screen's width; set by the screen */
  const tubeLine = useRef(0)

  // ------------------------------------------------------------- the screen
  useEffect(() => {
    const host = media.current
    const rootEl = root.current
    if (!host || !rootEl) return

    // 'lit' reads the footage as it is; the ember grade that pulled it toward
    // crimson is still in the shader, unused
    const screen = new CrtScreen({ videoSrc, posterSrc: '/portrait.webp', grade: 'lit' })
    if (!screen.supported) {
      screen.dispose()
      return
    }
    screen.canvas.className = 'shero__canvas'
    host.appendChild(screen.canvas)
    tubeLine.current = CrtScreen.lineWidth

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let visible = true

    const measure = () => {
      const r = host.getBoundingClientRect()
      screen.resize(r.width, r.height)
      if (reduced) screen.render(0)
    }

    const frameLoop = (now: number) => {
      raf = requestAnimationFrame(frameLoop)
      // once the strip has become the rule there is nothing of the glass left
      if (!visible || progress.current > 0.78) return
      screen.power = power.current.v
      screen.render(now / 1000)
      drawn.current?.(screen.power)
    }

    // The screen keeps its own short trail of the hand's movement and eases
    // its presence with GSAP; a resting cursor is forgotten within a beat.
    // Coarse pointers are ignored: there is no cursor to follow.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = host.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = 1 - (e.clientY - r.top) / r.height
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        screen.pointerLeave()
        return
      }
      screen.pointerMove(x, y, performance.now())
    }
    const onLeave = () => screen.pointerLeave()

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    io.observe(rootEl)

    if (!reduced) {
      rootEl.addEventListener('pointermove', onMove)
      rootEl.addEventListener('pointerleave', onLeave)
      raf = requestAnimationFrame(frameLoop)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      rootEl.removeEventListener('pointermove', onMove)
      rootEl.removeEventListener('pointerleave', onLeave)
      screen.canvas.remove()
      screen.dispose()
      tubeLine.current = 0
    }
  }, [videoSrc])

  // ------------------------------------------------------------ the gesture
  useGSAP(
    () => {
      const rootEl = root.current
      const frameEl = frame.current
      const lockupEl = lockup.current
      const ruleEl = rule.current
      if (!rootEl || !frameEl || !lockupEl || !ruleEl) return

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // no gesture: the field, the line, then the definitions in flow
        rootEl.setAttribute('data-still', '')
        return () => rootEl.removeAttribute('data-still')
      }

      const defs = gsap.utils.toArray<HTMLElement>('[data-shero-def]', lockupEl)

      // Everything in the gesture is measured from the lockup's resting layout
      // (offsets, which ignore transforms), so the strip ends up exactly where
      // the rule sits between the words at any viewport, and a refresh
      // mid-gesture cannot poison the numbers.
      const geometry = () => {
        const w = rootEl.clientWidth
        const h = rootEl.clientHeight
        const pad = parseFloat(getComputedStyle(rootEl).getPropertyValue('--st-pad')) || 40
        const ruleLen = ruleEl.offsetWidth
        const ruleThick = Math.max(2, ruleEl.offsetHeight)
        // the lockup is centred by a translate of half its own height, which
        // offsetTop does not include: take it off, or the strip lands low
        const ruleCy =
          lockupEl.offsetTop - lockupEl.offsetHeight / 2 + ruleEl.offsetTop + ruleEl.offsetHeight / 2
        // how far each word starts out from its resting place: at the gutter.
        // The lockup is centred, so its visual left is half the slack, not
        // its offsetLeft (which is the centre it is translated back from).
        const spread = Math.max(0, (w - lockupEl.offsetWidth) / 2 - pad)
        return {
          stripX: ((w - 40) / 2 / w) * 100,
          barX: ((w - ruleThick) / 2 / w) * 100,
          barY: ((h - ruleLen) / 2 / h) * 100,
          dy: ruleCy - h / 2,
          spread,
        }
      }

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: rootEl,
          pin: true,
          start: 'top top',
          end: () => `+=${Math.round(window.innerHeight * PIN_LENGTH)}`,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progress.current = self.progress
          },
        },
      })

      const strip = () => `inset(0% ${geometry().stripX}% 0% ${geometry().stripX}%)`

      // the words start out at the gutters, either side of the picture
      tl.set(defs[0], { x: () => -geometry().spread }, 0)
      tl.set(defs[1], { x: () => geometry().spread }, 0)

      // 1. the mask closes from both sides to a strip; the line inside is cropped with it
      tl.fromTo(
        frameEl,
        { clipPath: 'inset(0% 0% 0% 0%)' },
        { clipPath: strip, duration: 0.34, ease: 'power1.inOut' },
        0,
      )
      // the name is already standing on the ground the mask uncovers: it is
      // not faded in, it is revealed as the two panels close in from the
      // sides (it is only switched on under the still-opaque frame, so a
      // theme without the frame's black backing cannot show it early)
      tl.fromTo(defs, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 0.01)

      // 2. the strip turns to flat while it shortens to the rule's length, thins
      //    to its weight and drops to the rule's line. One tween, 0 to exactly
      //    90 degrees on an ease that never leaves 0..1, so it reaches
      //    horizontal once, at 0.70, and cannot pass it or turn back; it is
      //    flat before the handover to the rule at 0.72. clip-path works in
      //    the frame's own box, before the rotation, so a thin, short
      //    *vertical* strip is what turns into the horizontal bar.
      tl.fromTo(frameEl, { rotate: 0 }, { rotate: 90, duration: 0.3, ease: 'power2.inOut', immediateRender: false }, 0.4)
      // explicit about where it starts (the strip), so a refresh mid-gesture
      // can never make it interpolate from the open frame
      tl.fromTo(
        frameEl,
        { clipPath: strip, y: 0 },
        {
          clipPath: () => {
            const g = geometry()
            return `inset(${g.barY}% ${g.barX}% ${g.barY}% ${g.barX}%)`
          },
          y: () => geometry().dy,
          duration: 0.36,
          ease: 'power2.inOut',
          immediateRender: false,
        },
        0.4,
      )
      // the words close in on the rule from either side
      tl.to(defs, { x: 0, duration: 0.36, ease: 'power2.inOut' }, 0.4)
      // 3. the strip becomes the rule: a crossfade at the moment they coincide
      tl.to(frameEl, { autoAlpha: 0, duration: 0.06 }, 0.72)
      tl.fromTo(ruleEl, { scaleX: 0.96, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: 0.06 }, 0.7)

      // 4. the lockup eases up a little and settles; the ribbon then rises over
      //    it in flow when the pin lets go -- the reference's films do the same
      tl.to(lockupEl, { scale: 0.82, yPercent: -18, duration: 0.2, ease: 'power2.inOut' }, 0.8)
    },
    { scope: root },
  )

  // ------------------------------------------------------------ the opening
  // Event Horizon's second half, and the header's own opening on a direct
  // load. A point -- carried from the landing's hole, or lit where the line
  // will be -- stretches into a line across the tube's middle; the glass
  // powers on from that line; then the title rises and the corners come up.
  // None of it touches the frame, its clip-path or its rotation, which belong
  // to the gesture. Under reduced motion, or landing part-way down the page,
  // the header is simply there, as it always was.
  useGSAP(
    () => {
      const rootEl = root.current
      const host = media.current
      const titleEl = title.current
      if (!rootEl || !host || !titleEl) return

      const handoff = routeTransition.consume('story')
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (handoff) routeTransition.end()
        return
      }
      if (!handoff && (window.scrollY > 2 || !routeTransition.claim('/story'))) return

      power.current.v = 0
      const corners = gsap.utils.toArray<HTMLElement>(':scope > .st-corner', rootEl)
      gsap.set(corners, { autoAlpha: 0 })

      // where the tube powers on from, measured live
      const line = () => {
        const r = host.getBoundingClientRect()
        if (!r.width) return null
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width * (tubeLine.current || 1) }
      }
      const carry = routeTransition.lineIn({ from: handoff?.point, line })
      const on = carry.duration()
      const titleAt = on + 0.7 + 0.15

      // everything waits, the point held where it is, until the page has settled
      let started = false
      let rise: gsap.core.Timeline | null = null
      const tl = gsap.timeline({ paused: true })
      // the glass takes the line over in the first frame it draws with any
      // power, and the overlay's line goes in that same frame
      tl.call(
        () => {
          drawn.current = (p) => {
            if (p <= 0) return
            drawn.current = null
            routeTransition.lineOff()
          }
        },
        undefined,
        on,
      )
      tl.to(power.current, { v: 1, duration: 0.7, ease: EASE.unfold }, on)
      // with no glass to take it (no WebGL), the line simply goes
      tl.call(
        () => {
          if (!drawn.current) return
          drawn.current = null
          routeTransition.lineOff()
        },
        undefined,
        on + 0.12,
      )
      tl.call(
        () => {
          if (handoff) {
            titleEl.tabIndex = -1
            titleEl.focus({ preventScroll: true })
          }
          routeTransition.end()
        },
        undefined,
        on + 0.7,
      )
      tl.to(corners, { autoAlpha: 1, duration: BEAT, ease: EASE.unfold }, titleAt)

      // The title rises a line at a time out of its own mask. SplitText
      // names the h1 from its text, which loses the line break's space, so
      // the name is given from what the h1 reads as. Once risen, the masks
      // stop clipping: at rest the title is exactly as it was.
      const label = titleEl.innerText.replace(/\s+/g, ' ').trim()
      let risen = false
      const unmask = (masks: Element[]) => masks.forEach((m) => ((m as HTMLElement).style.overflow = 'visible'))
      SplitText.create(titleEl, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit(self) {
          titleEl.setAttribute('aria-label', label)
          if (risen) {
            unmask(self.masks)
            return
          }
          rise = gsap.timeline({ paused: !started })
          rise.fromTo(
            self.lines,
            { yPercent: 100 },
            {
              yPercent: 0,
              duration: BEAT,
              ease: EASE.unfold,
              stagger: 0.08,
              onComplete: () => {
                risen = true
                unmask(self.masks)
              },
            },
            titleAt,
          )
          return rise
        },
      })

      const cancel = whenSettled(() => {
        started = true
        carry.play()
        tl.play()
        rise?.play()
      })

      return () => {
        cancel()
        carry.kill()
        drawn.current = null
        power.current.v = 1
      }
    },
    { scope: root },
  )

  return (
    <section className="shero" id="story-top" ref={root} aria-label="My story">
      <div className="st-corner st-corner--tl mono">{BRIEF.name}</div>
      <div className="st-corner st-corner--tr mono">My Story</div>

      {/* the picture and the line: one layer, masked as one */}
      <div className="shero__frame" ref={frame}>
        <div className="shero__screen" ref={media} aria-hidden="true" />
        <h1 className="shero__title" ref={title}>
          How I think, work,
          <br />
          and <em>build.</em>
        </h1>
      </div>

      {/* the two definitions, with the rule the strip becomes between them */}
      <div className="shero__lockup" ref={lockup}>
        <div className="shero__def" data-shero-def>
          <span className="mono shero__meta">01 — Meaning</span>
          <span className="shero__word">{DEFINITIONS[0].word}</span>
          <p className="shero__meaning">{DEFINITIONS[0].meaning}</p>
        </div>
        <div className="shero__rule" ref={rule} aria-hidden="true" />
        <div className="shero__def shero__def--r" data-shero-def>
          <span className="mono shero__meta">02 — Practice</span>
          <span className="shero__word">{DEFINITIONS[1].word}</span>
          <p className="shero__meaning">{DEFINITIONS[1].meaning}</p>
        </div>
      </div>
    </section>
  )
}
