import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * The red thread: one fixed element, a pill in the Story's red, carried from
 * one thing on the page to the next as the reader scrolls. It takes over a
 * real element's exact geometry (the header's rule), travels, rides whatever
 * it is handed to, and parks as a point.
 *
 * Its path is laid out as segments of a seam. A seam is one scrubbed
 * ScrollTrigger over one range; its segments are slices of that range, each
 * interpolating the thread between two rects that are measured live every
 * frame -- so a section that is pinned, scrolling or clipping is followed
 * exactly, however it moves. One trigger per seam rather than per segment:
 * the thread's playhead is then a single value that can be kept in step with
 * the section it rides (the same range and scrub as its timeline), and no two
 * triggers ever argue over the element on a fast scroll.
 *
 * Each frame reads everything first, then writes once.
 */

/** Centre, size and corner radius, viewport CSS px. */
export type Rect = { x: number; y: number; w: number; h: number; r: number }

/** A point is a 6 x 6 rect with full radius. */
export const point = (x: number, y: number): Rect => ({ x, y, w: 6, h: 6, r: 3 })
/** A line is w x 2. */
export const line = (x: number, y: number, w: number): Rect => ({ x, y, w, h: 2, r: 1 })
/** An element's box, as it stands now. */
export function rectOf(el: Element, r = 0): Rect {
  const b = el.getBoundingClientRect()
  return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height, r }
}

export type Segment = {
  /** where the segment runs, as a share of the seam's range */
  start: number
  end: number
  from: () => Rect | null
  to: () => Rect | null
  ease?: string
}

type SeamOptions = {
  trigger: Element
  start: string
  end: string
  /** the scrub of the timeline the thread rides, so the two playheads are one */
  scrub: number | true
  segments: Segment[]
  /** called when the thread takes over (true) and gives back (false), in the same frame it shows or hides */
  onHold?: (holding: boolean) => void
}

/** Velocity smear: px of stretch per px of travel a frame, capped at 0.35 of the length along travel; thins up to 30%. */
const SMEAR_K = 1
const SMEAR_CAP = 0.35
const SMEAR_THIN = 0.3

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Lay the thread along a seam. Returns a kill that removes its trigger and
 * frame work and hides the thread.
 */
export function seam(el: HTMLElement, { trigger, start, end, scrub, segments, onHold }: SeamOptions) {
  const parts = [...segments].sort((a, b) => a.start - b.start)
  const eases = parts.map((s) => gsap.parseEase(s.ease ?? 'none'))

  // the playhead: a one-second timeline scrubbed over the range, so its
  // progress is the seam's, lagging exactly as the ridden timeline's does
  const tl = gsap.timeline({
    scrollTrigger: { trigger, start, end, scrub, invalidateOnRefresh: true },
  })
  tl.to({}, { duration: 1, ease: 'none' })
  // the frame work only runs while the seam's section is anywhere on screen,
  // or while the playhead is still catching up after it has left
  const zone = ScrollTrigger.create({ trigger, start, end: 'bottom top' })

  let holding = false
  let lastP = -1
  let last: { x: number; y: number; t: number } | null = null

  const hide = () => {
    el.style.visibility = 'hidden'
    last = null
    if (holding) {
      holding = false
      onHold?.(false)
    }
  }

  const frame = () => {
    const p = tl.progress()
    if (!zone.isActive && p === lastP && !holding) return
    lastP = p
    // before the seam, the thread is not needed: whatever it would take over is itself
    if (p <= 0 || !zone.isActive) {
      if (p <= 0 || zone.progress >= 1) {
        hide()
        return
      }
    }

    // --- read
    let i = parts.length - 1
    while (i > 0 && p < parts[i].start) i--
    const seg = parts[i]
    const a = seg.from()
    const b = seg.to()
    if (!a || !b) {
      hide()
      return
    }
    const t = eases[i](clamp01((p - seg.start) / (seg.end - seg.start || 1)))
    const x = mix(a.x, b.x, t)
    const y = mix(a.y, b.y, t)
    let w = mix(a.w, b.w, t)
    let h = mix(a.h, b.h, t)
    const r = mix(a.r, b.r, t)

    // velocity smear, from the thread's own travel since the last frame: it
    // stretches along the way it is going, behind itself, and thins across
    const now = performance.now()
    let sx = 0
    let sy = 0
    if (last) {
      const k = 16.67 / Math.max(1, now - last.t)
      const vx = (x - last.x) * k
      const vy = (y - last.y) * k
      const w0 = w
      const h0 = h
      const ax = Math.min(Math.abs(vx) * SMEAR_K, SMEAR_CAP * w0)
      const ay = Math.min(Math.abs(vy) * SMEAR_K, SMEAR_CAP * h0)
      // only a short side thins: a line moving across itself keeps its length
      if (h0 <= w0 * 1.5) h *= 1 - SMEAR_THIN * (ax / (SMEAR_CAP * w0 || 1))
      if (w0 <= h0 * 1.5) w *= 1 - SMEAR_THIN * (ay / (SMEAR_CAP * h0 || 1))
      w += ax
      h += ay
      sx = -Math.sign(vx) * (ax / 2)
      sy = -Math.sign(vy) * (ay / 2)
    }
    last = { x, y, t: now }

    // --- write
    const s = el.style
    s.width = `${w.toFixed(2)}px`
    s.height = `${h.toFixed(2)}px`
    s.borderRadius = `${Math.min(r, w / 2, h / 2).toFixed(2)}px`
    s.transform = `translate(${(x + sx - w / 2).toFixed(2)}px, ${(y + sy - h / 2).toFixed(2)}px)`
    s.visibility = 'visible'
    if (!holding) {
      holding = true
      onHold?.(true)
    }
  }

  gsap.ticker.add(frame)
  return () => {
    gsap.ticker.remove(frame)
    tl.scrollTrigger?.kill()
    tl.kill()
    zone.kill()
    hide()
    el.removeAttribute('style')
  }
}
