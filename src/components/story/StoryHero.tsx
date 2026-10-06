import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SplitText } from 'gsap/SplitText'
import { CrtScreen } from './crtScreen'
import { BRIEF } from '../../data/brief'
import AboutPanel from './AboutPanel'
import { routeTransition, whenSettled } from '../../motion/routeTransition.ts'
import { BEAT, EASE } from '../../motion/tokens'
import { scrambleIn } from '../../motion/scramble'

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)

// TODO(yug): final headline copy
/** The headline, a line each. On a phone the type is sized so a line of up
 *  to 15em (about 30 characters) fits the width; keep each line under that. */
const HEADLINE_1 = 'AI Engineering, Retrieval & Code.'
const HEADLINE_2 = 'Built to hold up.'
/** The word in the first line set in the red serif italic: the headline's one accent. */
const HEADLINE_ACCENT = 'Code.'
const ACCENT_AT = HEADLINE_1.lastIndexOf(HEADLINE_ACCENT)

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
    word: 'Yug',
    meaning:
      'i start by assuming it is wrong. a cheap habit, and it has saved me more than once.',
  },
  {
    word: 'Johri',
    meaning:
      'then i take things out until it stops surprising me. surprise is good company everywhere except production.',
  },
]

/** The small labels that stand at either end above each word (the reference's "MEANING: … VV"). */
const META: [string, string][] = [
  ['Meaning:', 'YJ'],
  [BRIEF.role.split(' ')[0], BRIEF.role.split(' ').slice(1).join(' ')],
]
/** The strip's thickness as the mask closes and it turns: a share of the width, within bounds. */
const stripPx = (_w: number) => 48
/** How far the bar turns: short of flat, as the reference's does -- it settles as a "/" and the rule keeps that tilt (story.css). */
const BAR_TURN = 80

/** How far the reader scrolls through the gesture, as viewport heights. */
/** The gesture's timeline runs 0..TL_TOTAL; everything up to the walls happens by 0.88, as it always
 *  did, and the walls take the long tail (0.88..1.30), so they follow the hand over a good stretch of
 *  scroll and can be stopped half way. One timeline unit is still 3.4 screen heights of scroll. */
export const TL_TOTAL = 1.3
export const PIN_LENGTH = 3.4 * TL_TOTAL
/** Where in the gesture the bar starts and stops turning (the header's mark grows over the same span). */
export const TURN_FROM = 0.4
export const TURN_TO = 0.7

type StoryHeroProps = {
  /** Optional looping clip for the screen. Without one it shows the still. */
  videoSrc?: string
  /** The still shown until the clip plays (and instead of it, without one). */
  posterSrc?: string
}

export default function StoryHero({ videoSrc, posterSrc = '/story-header-poster.webp' }: StoryHeroProps) {
  const root = useRef<HTMLElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const media = useRef<HTMLDivElement>(null)
  const lockup = useRef<HTMLDivElement>(null)
  const rule = useRef<HTMLDivElement>(null)
  const tint = useRef<HTMLDivElement>(null)
  const wallL = useRef<HTMLDivElement>(null)
  const wallR = useRef<HTMLDivElement>(null)
  const edgeL = useRef<HTMLDivElement>(null)
  const edgeR = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  /** 0..1 through the gesture, read by the render loop to know when to stop */
  const progress = useRef(0)
  /** the tube's power, read by the screen each frame: 1 unless the header is opening */
  const power = useRef({ v: 1 })
  /** told by the screen after each frame it draws, with the power it drew at */
  const drawn = useRef<((power: number) => void) | null>(null)
  /** how wide the tube's middle line is, as a share of the screen's width; set by the screen */
  const tubeLine = useRef(0)
  const glow = useRef<HTMLCanvasElement>(null)

  // ------------------------------------------------------------- the screen
  useEffect(() => {
    const host = media.current
    const rootEl = root.current
    if (!host || !rootEl) return

    // 'lit' reads the footage as it is; the ember grade that pulled it toward
    // crimson is still in the shader, unused
    const screen = new CrtScreen({ videoSrc, posterSrc, grade: 'lit' })
    if (!screen.supported) {
      screen.dispose()
      // no WebGL, or a software renderer (lib/gpu.ts): the footage's own still,
      // in the glass's place, rather than an empty screen
      const still = document.createElement('img')
      still.className = 'shero__canvas shero__still'
      still.src = posterSrc
      still.alt = ''
      host.appendChild(still)
      return () => still.remove()
    }
    screen.canvas.className = 'shero__canvas'
    host.appendChild(screen.canvas)

    // The room the screen lights: the footage, shrunk to a few dozen pixels and
    // blurred wide behind the glass, so its colours spill onto the black around
    // it as a TV's do in a dark room. Resampled a few times a second.
    const glowEl = glow.current
    const glowCtx = glowEl?.getContext('2d', { alpha: false }) ?? null
    if (glowEl) {
      glowEl.width = 32
      glowEl.height = 18
    }
    let glowFrame = 0
    let glowOpacity = ''
    // On a touchscreen the glow is blurred inside its 32x18 canvas (3px there is
    // the CSS 40-90px once scaled up), not by a CSS blur over its large on-screen
    // box -- which the GPU redid at 15 fps while the header was on screen.
    if (glowEl && glowCtx && window.matchMedia('(pointer: coarse)').matches && 'filter' in glowCtx) {
      glowCtx.filter = 'blur(3px) saturate(1.35)'
      glowEl.style.filter = 'none'
    }
    const paintGlow = () => {
      if (!glowEl || !glowCtx) return
      // (written only when it changes: a style write every frame restyled the page every frame)
      const o = String(0.17 * Math.max(0, Math.min(1, screen.power)))
      if (o !== glowOpacity) glowEl.style.opacity = glowOpacity = o
      const src = screen.source
      if (!src || glowFrame++ % 4) return
      glowCtx.drawImage(src, 0, 0, glowEl.width, glowEl.height)
    }
    tubeLine.current = CrtScreen.lineWidth

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let visible = true

    const measure = () => {
      // the screen's own layout size, not its box on screen: the gesture turns
      // and clips the frame, and a box measured then (a reload part way down,
      // a resize while scrolled) had the turned shape -- the picture came out
      // stretched and zoomed until the next resize
      screen.resize(host.clientWidth, host.clientHeight)
      if (reduced) {
        screen.render(0)
        // under reduced motion the glow is painted once the footage has a frame
        if (screen.source) {
          glowFrame = 0
          paintGlow()
        }
      }
    }

    // On a touchscreen the glass is drawn at 30 frames a second once it is on:
    // the footage is 30 fps and there is no cursor to answer, so every other
    // frame was the same picture drawn again -- GPU time a phone needs for the
    // scroll and the gesture. (The power-on, and the desktop, keep every frame.)
    const halfRate = window.matchMedia('(pointer: coarse)').matches
    let odd = false
    const frameLoop = (now: number) => {
      raf = requestAnimationFrame(frameLoop)
      // once the strip has become the rule there is nothing of the glass left
      if (!visible || progress.current > 0.78) return
      if (halfRate && power.current.v >= 1) {
        odd = !odd
        if (odd) return
      }
      screen.power = power.current.v
      screen.render(now / 1000)
      paintGlow()
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
  }, [videoSrc, posterSrc])

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
      // Measured once and kept until the page is measured again (a resize or a
      // turn of the phone): clipBar runs on every frame of the turn, and
      // reading layout there forced a reflow per frame -- what made the
      // gesture stutter on a phone.
      let geom: ReturnType<typeof measureGeometry> | null = null
      const dropGeometry = () => {
        geom = null
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        closeAt = null
      }
      ScrollTrigger.addEventListener('refreshInit', dropGeometry)
      const geometry = () => (geom ??= measureGeometry())
      const measureGeometry = () => {
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
          stripX: ((w - stripPx(w)) / 2 / w) * 100,
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
      tl.fromTo(frameEl, { rotate: 0 }, { rotate: BAR_TURN, duration: TURN_TO - TURN_FROM, ease: 'power2.inOut', immediateRender: false }, TURN_FROM)
      // The strip shortens with the turn but keeps its full weight -- a long,
      // thick bar is what turns, the reference's -- and it is short enough to
      // sit between the words by the time it settles. It only thins as it
      // collapses (4.), in one movement with its shortening.
      // (explicit about where they start, so a refresh mid-gesture can never
      // make it interpolate from the open frame)
      const bar = { len: 0, thick: 0 }
      const clipBar = () => {
        const g = geometry()
        const x = g.stripX + (g.barX - g.stripX) * bar.thick
        const y = g.barY * bar.len
        frameEl.style.clipPath = `inset(${y}% ${x}% ${y}% ${x}%)`
      }
      tl.fromTo(bar, { len: 0 }, { len: 1, duration: 0.3, ease: 'power2.inOut', immediateRender: false, onUpdate: clipBar }, 0.4)
      tl.fromTo(frameEl, { y: 0 }, { y: () => geometry().dy, duration: 0.36, ease: 'power2.inOut', immediateRender: false }, 0.4)
      // the words close in on the rule from either side
      tl.to(defs, { x: 0, duration: 0.36, ease: 'power2.inOut' }, 0.4)
      // 3. the strip becomes the rule: a crossfade at the moment they coincide
      // the bar shades from black through deep red to the accent as it turns
      if (tint.current) tl.fromTo(tint.current, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power1.inOut' }, 0.5)
      tl.to(frameEl, { autoAlpha: 0, duration: 0.04 }, 0.755)
      // the rule takes over at the strip's weight (scaled up across its line)
      const weight = () => stripPx(rootEl.clientWidth) / Math.max(2, ruleEl.offsetHeight)
      tl.fromTo(ruleEl, { scaleX: 0.96, scaleY: weight, autoAlpha: 0 }, { scaleX: 1, scaleY: weight, autoAlpha: 1, duration: 0.05 }, 0.74)

      // 4. the red line draws in from both ends while the words close on it,
      //    until the name stands as one line: "Yug Johri"
      // (measured with the rest of the geometry, once per refresh)
      let closeAt: number | null = null
      const closeBy = () => {
        if (closeAt === null) {
          const gap = parseFloat(getComputedStyle(lockupEl).columnGap) || 24
          closeAt = (ruleEl.offsetWidth + gap) / 2
        }
        return closeAt
      }
      // One progress for both, on one curve: the line's length shrinks exactly as
      // fast as the gap between the words closes, so it is always shorter than
      // the gap -- it never crosses the type -- and it reaches nothing as they meet.
      const COLLAPSE = { at: 0.775, dur: 0.105, ease: 'sine.inOut' }
      // and its weight goes on the same progress: it thins as it converges, to nothing
      tl.to(ruleEl, { scaleX: 0, scaleY: 0, duration: COLLAPSE.dur, ease: COLLAPSE.ease }, COLLAPSE.at)
      tl.to(defs[0], { x: () => closeBy(), duration: COLLAPSE.dur, ease: COLLAPSE.ease }, COLLAPSE.at)
      tl.to(defs[1], { x: () => -closeBy(), duration: COLLAPSE.dur, ease: COLLAPSE.ease }, COLLAPSE.at)

      // 5. the walls: the left half comes down from the top, the right half up
      //    from the bottom, each carrying its half of About, so the section is
      //    whole the moment they meet -- nothing left to scroll for.
      if (wallL.current && wallR.current && edgeL.current && edgeR.current) {
        // each wall travels with its edge (the red line and the shadow, an element of their own)
        const left = [wallL.current, edgeL.current]
        const right = [wallR.current, edgeR.current]
        // y is pinned to 0 so only the percentage moves them (a remount must not read a stale offset)
        gsap.set(left, { y: 0, yPercent: -100, visibility: 'visible' })
        gsap.set(right, { y: 0, yPercent: 100, visibility: 'visible' })
        const WALLS = { at: 0.88, dur: TL_TOTAL - 0.88, ease: 'sine.inOut' }
        tl.fromTo(left, { y: 0, yPercent: -100 }, { y: 0, yPercent: 0, duration: WALLS.dur, ease: WALLS.ease }, WALLS.at)
        tl.fromTo(right, { y: 0, yPercent: 100 }, { y: 0, yPercent: 0, duration: WALLS.dur, ease: WALLS.ease }, WALLS.at)
        // About assembles as the walls close (the left half; the right is the stack's):
        // its heading's lines rise out of their masks, one after the other, and the
        // paragraphs come up from nothing to their faint resting state -- all with
        // the scroll, so stopping part way leaves it part built, and back undoes it
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const walls = [wallL.current, wallR.current]
          const lines = walls.flatMap((w) => gsap.utils.toArray<HTMLElement>('[data-ap-line]', w))
          const words = walls.flatMap((w) => gsap.utils.toArray<HTMLElement>('.apanel__body, .apanel__coda', w))
          const span = WALLS.dur
          tl.fromTo(lines, { yPercent: 140 }, { yPercent: 0, duration: span * 0.42, ease: 'power3.out', stagger: span * 0.12 }, WALLS.at + span * 0.22)
          tl.fromTo(words, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: span * 0.4, ease: 'power2.out', stagger: span * 0.06 }, WALLS.at + span * 0.45)
        }
        // their edges (the red line and the shadow) fade out over the last stretch,
        // so they are gone as the walls meet and About takes over -- not cut at once.
        // (Their own opacity, which the compositor fades: it was a CSS variable on
        // the walls, which restyled every element of both About copies each frame.)
        const EDGE = 0.16
        tl.fromTo([edgeL.current, edgeR.current], { opacity: 1 }, { opacity: 0, duration: EDGE, ease: 'sine.in' }, TL_TOTAL - EDGE)
      }
      return () => ScrollTrigger.removeEventListener('refreshInit', dropGeometry)
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
      // (the header has no corner labels at present; GSAP warns on an empty target)
      if (corners.length) gsap.set(corners, { autoAlpha: 0 })

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
      if (corners.length) tl.to(corners, { autoAlpha: 1, duration: BEAT, ease: EASE.unfold }, titleAt)

      // The title rises a line at a time out of its own mask. SplitText
      // names the h1 from its text, which loses the line break's space, so
      // the name is given from what the h1 reads as. Once risen, the masks
      // stop clipping: at rest the title is exactly as it was.
      const label = titleEl.innerText.replace(/\s+/g, ' ').trim()
      let risen = false
      // as it rises the title decodes, glyph by glyph, like the screen above it tuning in
      let unscramble: (() => void) | null = null
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
          rise.call(() => {
            unscramble = scrambleIn(titleEl, { duration: 1.25 })
          }, undefined, titleAt)
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
        unscramble?.()
        drawn.current = null
        power.current.v = 1
      }
    },
    { scope: root },
  )

  return (
    <section className="shero" id="story-top" ref={root} aria-label="My story">

      {/* the picture and the line: one layer, masked as one */}
      <div className="shero__frame" ref={frame}>
        {/* the light the screen throws on the dark around it */}
        <canvas className="shero__glow" ref={glow} aria-hidden="true" />
        <div className="shero__screen" ref={media} aria-hidden="true" />
        <div className="shero__tint" ref={tint} aria-hidden="true" />
        <h1 className="shero__title" ref={title}>
          {ACCENT_AT < 0 ? (
            HEADLINE_1
          ) : (
            <>
              {HEADLINE_1.slice(0, ACCENT_AT)}
              <em>{HEADLINE_ACCENT}</em>
              {HEADLINE_1.slice(ACCENT_AT + HEADLINE_ACCENT.length)}
            </>
          )}
          <br />
          {HEADLINE_2}
        </h1>
      </div>

      {/* the two definitions, with the rule the strip becomes between them */}
      {/* the walls that close the header carry About: each a copy of the panel's
          first screen, clipped to its half, so it is split while they travel and
          whole when they meet; the real section takes over in place as they land */}
      <div className="shero__wall shero__wall--l" ref={wallL} aria-hidden="true">
        <AboutPanel variant="copy" />
      </div>
      {/* each wall's edge just after it: over its own wall, under the next */}
      <div className="shero__edge shero__edge--l" ref={edgeL} aria-hidden="true" />
      <div className="shero__wall shero__wall--r" ref={wallR} aria-hidden="true">
        <AboutPanel variant="copy" />
      </div>
      <div className="shero__edge shero__edge--r" ref={edgeR} aria-hidden="true" />
      <div className="shero__lockup" ref={lockup}>
        <div className="shero__def" data-shero-def>
          <span className="shero__meta">
            <span>{META[0][0]}</span>
            <span>{META[0][1]}</span>
          </span>
          <span className="shero__word">{DEFINITIONS[0].word}</span>
          <p className="shero__meaning">{DEFINITIONS[0].meaning}</p>
        </div>
        <div className="shero__rule" ref={rule} aria-hidden="true" />
        <div className="shero__def shero__def--r" data-shero-def>
          <span className="shero__meta">
            <span>{META[1][0]}</span>
            <span>{META[1][1]}</span>
          </span>
          <span className="shero__word shero__word--accent">{DEFINITIONS[1].word}</span>
          <p className="shero__meaning">{DEFINITIONS[1].meaning}</p>
        </div>
      </div>
    </section>
  )
}
