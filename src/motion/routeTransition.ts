import gsap from 'gsap'
import { EASE } from './tokens'

/**
 * Route transitions: a page leaves by collapsing into a primitive, the
 * primitive is carried across the route change in an overlay that outlives
 * both pages, and the next page unfolds from it.
 *
 * The overlay (RouteTransition.tsx) registers its elements here. A departing
 * page calls play(); just before it navigates it hands off what the
 * destination needs; the destination calls consume() on mount, plays its
 * arrival (lineIn, briefIn), and calls end() when it is whole.
 *
 * The overlay's state lives in its elements' inline styles, written directly,
 * and nowhere in a GSAP context: a context that is active when another one
 * is created or added to adopts it, so any overlay state recorded in one
 * would be reverted with whichever page happened to be running at the time
 * -- the departing page unmounting mid-flight would snap the overlay away.
 * Only reset() clears it.
 */

export type TransitionKind = 'story' | 'brief'

/**
 * The Brief's band exactly as the ASCII pass last drew it, so the overlay can
 * take it over in the same frame: the pass's whole box, placed and scaled as
 * the pass is, holding the pass's own text with every row but the band's
 * left blank. The whole box rather than one cut to the band, so each row is
 * laid out -- and its glyphs land on the pixel grid -- exactly as in the pass.
 */
export type BandShape = {
  /** the pass's box before its scale, viewport px */
  left: number
  top: number
  width: number
  height: number
  /** the pass's scale, about `origin` (px, in the box) */
  scale: number
  originX: number
  originY: number
  /** what the panel clips off either side, px in the box */
  clipLeft: number
  clipRight: number
  /** the text, and where the band's rows are in it */
  text: string
  first: number
  rows: number
  /** the face, with size and leading as the pass's own CSS values: a line
   *  height given another way can round each line box differently */
  fontFamily: string
  fontSize: string
  lineHeight: string
  /** one row's height, px, for placing things by the rows */
  rowHeight: number
  color: string
}

/** What a departure hands its destination. Positions are viewport CSS px. */
export type Handoff = {
  kind: TransitionKind
  /** where the carried point is when the route changes */
  point?: { x: number; y: number }
  /** the band the Brief's departure collapsed into */
  band?: BandShape
}

export type OverlayEls = {
  root: HTMLElement
  iris: HTMLElement
  point: HTMLElement
  cover: HTMLElement
  band: HTMLElement
}

type StoryPlay = {
  path: string
  /** the iris, live: centre and radius, viewport px */
  hole: () => { x: number; y: number; r: number }
  /** when the iris takes over from the shadow, and when the screen is black: seconds from play() */
  from: number
  to: number
}

type BriefPlay = {
  path: string
}

/** A horizontal line in the viewport: centre and width, px. */
type Line = { x: number; y: number; width: number }

/** Show or hide an overlay element over its stylesheet's hidden state. */
function shown(el: HTMLElement, on: boolean) {
  el.style.visibility = on ? 'visible' : 'hidden'
  el.style.opacity = on ? '1' : '0'
}

function setIris(els: OverlayEls, r: number, x: number, y: number) {
  els.iris.style.clipPath = `circle(${r.toFixed(2)}px at ${x.toFixed(2)}px ${y.toFixed(2)}px)`
}

/** The carried point's glow, at full strength; it goes as the point becomes a line. */
const GLOW = (a: number) =>
  `0 0 6px 1px rgb(241 235 232 / ${(0.7 * a).toFixed(3)}), 0 0 18px 3px rgb(241 235 232 / ${(0.22 * a).toFixed(3)})`

/** Velocity smear: px of stretch per px of travel in a frame, the most it may add, and how thin it may go. */
const SMEAR_K = 1.1
const SMEAR_MAX = 40
const SMEAR_THIN = 0.3

/** a handoff nobody claimed is abandoned after this long, ms */
const UNCLAIMED_MS = 3000

/**
 * Calls `go` once the page has settled after a route change: two frames in a
 * row under 40 ms. A freshly mounted page does its heavy setup (shader
 * links, texture uploads) in its first frames, and an arrival started before
 * that would have its opening frames eaten by the stall; the carried
 * primitive holds still until then. Stops waiting after 1.5 s. Returns a cancel.
 */
export function whenSettled(go: () => void) {
  let raf = 0
  let last = 0
  let calm = 0
  const start = performance.now()
  const tick = (t: number) => {
    calm = last && t - last < 40 ? calm + 1 : 0
    last = t
    if (calm >= 2 || t - start > 1500) {
      go()
      return
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

class RouteTransitionController {
  private els: OverlayEls | null = null
  private pending: Handoff | null = null
  private expected: string | null = null
  private unclaimed = 0
  /** the overlay's own running animations, killed by reset() */
  private running: gsap.core.Animation[] = []

  /** a transition is running: from play() (or claim()) until end() or kill() */
  busy = false

  attach(els: OverlayEls) {
    this.els = els
  }

  detach() {
    this.kill()
    this.els = null
  }

  /** keep hold of an overlay animation, so reset() can stop it wherever it was made */
  private own<T extends gsap.core.Animation>(a: T) {
    this.running.push(a)
    return a
  }

  /**
   * Begin a departure: takes the lock and starts the overlay's part of the
   * sequence, beside the caller's own timeline and in the same tick. False
   * when a transition is already running or there is no overlay to play in.
   */
  play(kind: 'story', opts: StoryPlay): boolean
  play(kind: 'brief', opts: BriefPlay): boolean
  play(kind: TransitionKind, opts: StoryPlay | BriefPlay): boolean {
    const els = this.els
    if (this.busy || !els) return false
    this.busy = true
    this.expected = opts.path
    // Glyph Drain has no overlay part until the handoff: the drain is the ASCII pass's own
    if (kind === 'story') this.own(this.storyOut(els, opts as StoryPlay))
    return true
  }

  /**
   * A page opening on its own, with no departure behind it, that wants the
   * overlay (the Story's power-on on a direct load): takes the lock for
   * `path` as play() would, so leaving mid-way aborts it. True when it has
   * it -- including when `path` already holds it, so a remount can claim again.
   */
  claim(path: string) {
    if (this.busy) return this.expected === path
    this.busy = true
    this.expected = path
    return true
  }

  /** Event Horizon, the landing's half: a black iris that grows out of the hole's shadow. */
  private storyOut(els: OverlayEls, { hole, from, to }: StoryPlay) {
    // Every frame the iris takes its centre and radius from the hole, live.
    // It stops a frame short of the end: handoff() takes it the rest of the
    // way, and once it has, nothing here may draw the iris back down.
    const follow = () => {
      if (this.pending) return
      const h = hole()
      setIris(els, h.r, h.x, h.y)
    }
    const tl = gsap.timeline()
    tl.call(
      () => {
        follow()
        shown(els.iris, true)
      },
      undefined,
      from,
    )
    tl.to({}, { duration: to - from, ease: 'none', onUpdate: follow }, from)
    return tl
  }

  /** The carried point, drawn centred on (x, y): w by h, turned `rotate` degrees, its glow at `glow`. */
  private placePoint(els: OverlayEls, x: number, y: number, w: number, h: number, rotate = 0, glow = 1) {
    const s = els.point.style
    s.width = `${w.toFixed(2)}px`
    s.height = `${h.toFixed(2)}px`
    s.borderRadius = `${(Math.min(w, h) / 2).toFixed(2)}px`
    s.transform = `translate(${(x - w / 2).toFixed(2)}px, ${(y - h / 2).toFixed(2)}px) rotate(${rotate.toFixed(2)}deg)`
    s.boxShadow = GLOW(glow)
    shown(els.point, true)
  }

  /** the overlay band, set to exactly what the ASCII pass last drew */
  private placeBand(els: OverlayEls, b: BandShape) {
    const el = els.band
    el.textContent = b.text
    Object.assign(el.style, {
      left: `${b.left}px`,
      top: `${b.top}px`,
      width: `${b.width}px`,
      height: `${b.height}px`,
      overflow: 'hidden',
      fontFamily: b.fontFamily,
      fontSize: b.fontSize,
      lineHeight: b.lineHeight,
      color: b.color,
      transformOrigin: `${b.originX}px ${b.originY}px`,
      transform: `scale(${b.scale})`,
      clipPath: `inset(0px ${b.clipRight}px 0px ${b.clipLeft}px)`,
    })
    shown(el, true)
  }

  /**
   * Called by the departing page, synchronously, just before it navigates:
   * the overlay takes over the whole screen in the state the page left it,
   * and the handoff is stored for the destination.
   */
  handoff(h: Handoff) {
    const els = this.els
    if (els && h.kind === 'story' && h.point) {
      setIris(els, Math.hypot(window.innerWidth, window.innerHeight) * 1.5, h.point.x, h.point.y)
      shown(els.iris, true)
      this.placePoint(els, h.point.x, h.point.y, 5, 5)
    }
    if (els && h.kind === 'brief' && h.band) {
      els.cover.style.clipPath = 'none'
      shown(els.cover, true)
      this.placeBand(els, h.band)
    }
    this.pending = h
    // if the destination never claims it (a failed navigation), give the screen back
    window.clearTimeout(this.unclaimed)
    this.unclaimed = window.setTimeout(() => {
      if (this.pending === h) this.kill()
    }, UNCLAIMED_MS)
  }

  /**
   * Event Horizon, the Story's half (and the Story's own opening on a direct
   * load): the point is carried to where the tube will power on from and
   * stretches into its line. With `from` it glides there from the landing's
   * hole, smearing along its travel as it goes; without, it lights where the
   * line will be. `line` is measured live, every frame. The line stays up
   * until lineOff(), which the page calls in the frame its glass takes over.
   * Returned paused: the page plays it once it has settled (whenSettled).
   */
  lineIn({ from, line }: { from?: { x: number; y: number }; line: () => Line | null }) {
    const state = { glide: from ? 0 : 1, stretch: 0 }
    let last: { x: number; y: number } | null = null
    let angle = 0
    const draw = () => {
      const els = this.els
      const l = line()
      // a timeline killed from inside its own last render still reports that render
      if (!els || !l || !this.busy) return
      // the page underneath is the Story's own black by now
      shown(els.iris, false)
      const x = from ? from.x + (l.x - from.x) * state.glide : l.x
      const y = from ? from.y + (l.y - from.y) * state.glide : l.y
      // velocity smear, from the point's own travel since the last frame
      const dx = last ? x - last.x : 0
      const dy = last ? y - last.y : 0
      const d = Math.hypot(dx, dy)
      last = { x, y }
      if (d > 0.5) {
        angle = (Math.atan2(dy, dx) * 180) / Math.PI
        // a line has no direction: keep the turn within a quarter either way
        if (angle > 90) angle -= 180
        if (angle < -90) angle += 180
      }
      const smear = Math.min(d * SMEAR_K, SMEAR_MAX)
      const thin = Math.min(d / SMEAR_MAX, 1) * SMEAR_THIN
      const s = state.stretch
      this.placePoint(
        els,
        x,
        y,
        5 + smear + (l.width - 5 - smear) * s,
        5 * (1 - thin) + (2 - 5 * (1 - thin)) * s,
        angle * (1 - s),
        1 - s,
      )
    }
    const tl = gsap.timeline({ paused: true, onUpdate: draw })
    if (from) tl.to(state, { glide: 1, duration: 0.25, ease: EASE.carry }, 0)
    tl.to(state, { stretch: 1, duration: 0.25, ease: EASE.unfold }, from ? 0.125 : 0)
    return this.own(tl)
  }

  /** The line is the page's now: take the overlay's away, in this frame. */
  lineOff() {
    const els = this.els
    if (!els) return
    shown(els.point, false)
    shown(els.iris, false)
  }

  /**
   * Glyph Drain, the Brief's half. The band takes on the look of the Brief's
   * own dither rules -- one row, the page's glyphs and ink -- and sweeps down
   * to the bottom edge; the cover opens from the band's line, up with it and
   * down behind it, so the page unfolds from the line rather than being cut
   * to. `divider` is one of those rules, measured for its look. `onOpen`
   * fires once, when 40% of the viewport is open; `onDone` at the end.
   * Returned paused, like lineIn().
   */
  briefIn({
    divider,
    onOpen,
    onDone,
  }: {
    divider: HTMLElement | null
    onOpen: () => void
    onDone: () => void
  }) {
    const els = this.els
    const band = this.pending?.band
    if (!els || !band) return null
    const el = els.band
    const run = divider?.firstElementChild as HTMLElement | null
    const look = divider ? getComputedStyle(divider) : null
    const ink = look?.color ?? 'rgb(255 255 255 / 0.11)'
    const toInk = gsap.utils.interpolate(band.color, ink)
    // where the band is on screen as the pass drew it: its centre line, and its ends
    const mid = (band.first + band.rows / 2) * band.rowHeight
    const cy = band.top + band.originY + (mid - band.originY) * band.scale
    const x0 = band.left + band.originX + (band.clipLeft - band.originX) * band.scale
    const x1 = band.left + band.originX + (band.width - band.clipRight - band.originX) * band.scale
    const rowH = band.rowHeight * band.scale
    // The rows flatten about their own middle rather than about the pass's
    // centre: the same placement, re-expressed about a different origin.
    const oy = mid
    const ty0 = (band.originY - oy) * (1 - band.scale)

    const state = { sweep: 0, flat: 0, widen: 0 }
    let opened = false
    let restyled = false
    const draw = () => {
      // a timeline killed from inside its own last render still reports that render
      if (this.pending?.band !== band) return
      const h = window.innerHeight
      const w = window.innerWidth
      // the lower edge rides the band down; the upper opens toward the top so both reach their edges together
      const lower = cy + (h + rowH - cy) * state.sweep
      const upper = cy - cy * state.sweep
      const a = Math.max(0, upper)
      const b = Math.min(h, lower)
      if (restyled) {
        el.style.transform = `translateY(${(lower - 11).toFixed(2)}px)`
        const l = x0 * (1 - state.widen)
        const r = (w - x1) * (1 - state.widen)
        el.style.clipPath = `inset(0px ${r.toFixed(2)}px 0px ${l.toFixed(2)}px)`
      } else {
        const sy = band.scale * (1 - state.flat * (1 - 1 / band.rows))
        el.style.transformOrigin = `${band.originX}px ${oy}px`
        el.style.transform = `translateY(${(lower - cy + ty0).toFixed(2)}px) scale(${band.scale}, ${sy.toFixed(4)})`
        el.style.color = toInk(state.flat)
      }
      els.cover.style.clipPath =
        b - a < 0.5
          ? 'none'
          : `polygon(evenodd, 0px 0px, ${w}px 0px, ${w}px ${h}px, 0px ${h}px, 0px 0px, ` +
            `0px ${a.toFixed(2)}px, ${w}px ${a.toFixed(2)}px, ${w}px ${b.toFixed(2)}px, 0px ${b.toFixed(2)}px, 0px ${a.toFixed(2)}px)`
      if (!opened && b - a >= 0.4 * h) {
        opened = true
        onOpen()
      }
    }
    // one row of the Brief's own dither, full width, shown through the span the band had
    const restyle = () => {
      restyled = true
      el.textContent = run?.textContent ?? '░▒▓█▓▒░ '.repeat(48)
      Object.assign(el.style, {
        left: '0px',
        top: '0px',
        width: `${window.innerWidth}px`,
        height: '22px',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        fontFamily: look?.fontFamily ?? 'JetBrains Mono, ui-monospace, monospace',
        fontSize: look?.fontSize ?? '12px',
        lineHeight: look?.lineHeight ?? '22px',
        letterSpacing: look?.letterSpacing ?? '0.24px',
        color: ink,
        transformOrigin: '0px 0px',
        maskImage: look?.maskImage || 'none',
        // composited only now it is moving: promoted at the handoff it would
        // rasterize differently from the pass it is standing in for
        willChange: 'transform',
      })
      el.style.setProperty('-webkit-mask-image', look?.getPropertyValue('-webkit-mask-image') || look?.maskImage || 'none')
      draw()
    }
    const tl = gsap.timeline({ paused: true, onUpdate: draw })
    tl.to(state, { sweep: 1, duration: 0.55, ease: EASE.unfold }, 0)
    // the rows flatten into one and dim to the rule's ink as they start to move
    tl.to(state, { flat: 1, duration: 0.14, ease: EASE.collapse }, 0)
    tl.call(restyle, undefined, 0.14)
    tl.to(state, { widen: 1, duration: 0.2, ease: EASE.unfold }, 0.14)
    tl.call(onDone, undefined, 0.55)
    return this.own(tl)
  }

  /** Whether a handoff of this kind is waiting, without claiming it. */
  peek(kind: TransitionKind) {
    return this.pending?.kind === kind
  }

  /**
   * The destination asks whether it was arrived at by `kind`. Idempotent until
   * end(): React's strict mode mounts twice in development, and both mounts
   * must see the same arrival.
   */
  consume(kind: TransitionKind): Handoff | null {
    if (this.pending?.kind !== kind) return null
    window.clearTimeout(this.unclaimed)
    return this.pending
  }

  /** The arrival is whole: clear the overlay and release the lock. */
  end() {
    this.reset()
  }

  /** Abort from wherever the transition is: popstate, a stray route change, unmount. */
  kill() {
    if (!this.busy && !this.pending) return
    this.reset()
  }

  /** A route change while a transition runs is expected once, to its destination; any other aborts it. */
  routeChanged(path: string) {
    if (this.busy && this.expected !== null && path !== this.expected) this.kill()
  }

  private reset() {
    window.clearTimeout(this.unclaimed)
    this.pending = null
    this.expected = null
    this.busy = false
    const running = this.running
    this.running = []
    running.forEach((a) => a.kill())
    // every element back to its hidden, stylesheet state
    const els = this.els
    if (els) {
      for (const el of [els.iris, els.point, els.cover, els.band]) el.removeAttribute('style')
      els.band.textContent = ''
    }
  }
}

export const routeTransition = new RouteTransitionController()
