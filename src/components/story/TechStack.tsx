import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { TECH } from '../../data/portfolio'
import { TECH_LOGOS, type TechLogo } from '../../data/techLogos'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * The stack, as a journey the reader scrolls through.
 *
 * The technologies are one stream of cards flying one path through a volume
 * around the statement. The path is a loop seen from slightly above -- near
 * and low in front, far and high behind -- that opens out at both ends: the
 * cards swing in from beyond the left edge, sweep across the front large and
 * facing the reader, bank edge-on round the right side, drift small and high
 * behind the statement travelling left, turn again at the left, come across
 * the front once more and swing out past the right edge. The loop is an
 * ellipse, not a track with straights, so a card is always changing depth;
 * and it undulates, so the stream rises and falls as it goes. Each card keeps
 * its own lane in the band (a little in or out, a little up or down), fixed
 * by its place in the stream, so the cards read as a flock, not a line.
 *
 * A card's place on the path gives it everything: where it is, how far away
 * (the perspective does the sizing), which way it faces (along the path, so
 * it really turns), how it banks in the turns and pitches on the rises, and
 * how bright it is (its back is dim).
 *
 * Nothing moves on its own. The section pins and one scrubbed timeline
 * carries the stream along the path with the scroll, so a slow scroll is a
 * slow procession and scrolling back runs it in reverse. The statement in
 * the middle is on the same timeline: it comes up out of blur as the first
 * cards round the back, and goes as the last ones head for the exit.
 */

/**
 * The path, in units of the space's width: the loop's half-width and
 * half-depth, how far the ends open out (a multiple of the loop), and the
 * spacing of the cards along the path. The stream (spacing x cards) must be
 * shorter than the loop, or the head would catch the tail at the front.
 */
const PATH = { rx: 0.36, rz: 0.19, open: 1.9, gap: 0.085 }
const PATH_NARROW = { rx: 0.32, rz: 0.5, open: 1.9, gap: 0.34 }
/** How far the front of the loop rides below the middle and the back above, in space heights. */
const TILT = 0.13
/** The undulation of the band: its height (space heights), waves per loop, and where they fall -- a
 * rise at the front right and a dip at the back right, so the stream crosses the statement there. */
const WAVE = { amp: 0.042, per: 3, phase: -2.77 }
/** A card's lane: how far in/out (widths) and up/down (heights) of the path it may sit. */
const LANE = { r: 0.035, y: 0.05 }
/** Bank in the turns and pitch on the rises, degrees at most. */
const BANK_DEG = 16
const PITCH_DEG = 10
/** Scroll pixels per pixel of travel along the path. */
const SCROLL_RATE = 0.36
/** The pointer's lean on the whole space, degrees at the edge. */
const LEAN_DEG = 3

const STATEMENT = ['i', 'pick', 'boring', 'on', 'purpose.']

const TAU = Math.PI * 2
const DEG = 180 / Math.PI
/** Past the loop's side, at each end, the path runs this much further round (radians). */
const OVERRUN = 0.25

type Shape = { rx: number; rz: number; open: number; gap: number }

/**
 * The path as an angle: 0 is the front of the loop (moving right), π the
 * back (moving left). It starts a quarter turn and a bit before the front,
 * out at the left where the loop has opened wide, closes to the loop by the
 * front, goes once round, and opens out again to the right. `point` gives
 * the place (x across, z toward the reader, both in widths) for an angle,
 * a card's lane pushing it in or out.
 */
function makePath({ rx, rz, open }: Shape) {
  const t0 = -Math.PI / 2 - OVERRUN
  const t1 = TAU + Math.PI / 2 + OVERRUN
  const opening = (t: number) => {
    if (t < 0) return (t / t0) ** 2
    if (t > TAU) return ((t - TAU) / (t1 - TAU)) ** 2
    return 0
  }
  const point = (t: number, dr = 0) => {
    const e = opening(t)
    const ax = (rx + dr) * (1 + open * e)
    const az = (rz + dr * 0.6) * (1 + open * 0.35 * e)
    return { x: ax * Math.sin(t), z: az * Math.cos(t) }
  }

  // arc length along the centre line, so the cards keep an even spacing
  // whatever the curve does; measured once, looked up by bisection
  const M = 1600
  const ts = new Float64Array(M + 1)
  const ss = new Float64Array(M + 1)
  let prev = point(t0)
  for (let k = 0; k <= M; k++) {
    const t = t0 + ((t1 - t0) * k) / M
    const q = point(t)
    ts[k] = t
    ss[k] = k ? ss[k - 1] + Math.hypot(q.x - prev.x, q.z - prev.z) : 0
    prev = q
  }
  const angleAt = (s: number) => {
    let lo = 0
    let hi = M
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (ss[mid] < s) lo = mid
      else hi = mid
    }
    const f = (s - ss[lo]) / (ss[hi] - ss[lo] || 1)
    return ts[lo] + (ts[hi] - ts[lo]) * f
  }
  const arcAt = (t: number) => ss[Math.round(((t - t0) / (t1 - t0)) * M)]
  // height of the band: the loop's tilt, plus the undulation
  const heightAt = (t: number) => Math.cos(t) * TILT + WAVE.amp * Math.sin(t * WAVE.per + WAVE.phase)
  return {
    point,
    angleAt,
    heightAt,
    total: ss[M],
    marks: { backMid: arcAt(Math.PI), loopEnd: arcAt(TAU) },
  }
}

/** A card's lane, fixed by its place in the stream: evenly spread, never random. */
const lane = (i: number) => {
  const a = ((i * 0.618034) % 1) * 2 - 1
  const b = ((i * 0.381966 + 0.5) % 1) * 2 - 1
  return { dr: a * LANE.r, dy: b * LANE.y, roll: a * b * 5 }
}

/**
 * A logo on its own, sized for its weight rather than its box: every mark is
 * given about the same area (in em, so the stylesheet's font-size sets the
 * scale), nudged smaller when it is dense and solid and larger when it is a
 * thin outline, kept to its own proportions and within reach of its slot.
 */
function Logo({ name, logo }: { name: string; logo: TechLogo }) {
  const weight = Math.min(1.18, Math.max(0.8, Math.pow(logo.density / 0.55, -0.35)))
  let w = Math.sqrt(logo.aspect) * weight
  let h = weight / Math.sqrt(logo.aspect)
  const fit = Math.min(1, 1.9 / w, 1.45 / h)
  w *= fit
  h *= fit
  return (
    <img
      className="stack__logo"
      src={logo.src}
      alt={name}
      width={64}
      height={64}
      style={{ width: `${w.toFixed(3)}em`, height: `${h.toFixed(3)}em` }}
      draggable={false}
      decoding="async"
    />
  )
}

export default function TechStack() {
  const root = useRef<HTMLElement>(null)
  const space = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const rootEl = root.current
      const spaceEl = space.current
      const ringEl = ring.current
      if (!rootEl || !spaceEl || !ringEl) return

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const words = gsap.utils.toArray<HTMLElement>('[data-stack-word]', rootEl)
      const cards = gsap.utils
        .toArray<HTMLElement>('[data-stack-card]', ringEl)
        .filter((el) => getComputedStyle(el).display !== 'none')
      const n = cards.length
      if (!n) return

      // ------------------------------------------------------------ geometry
      const dims = { W: 1, H: 1, gap: PATH.gap }
      let path = makePath(PATH)
      const measure = () => {
        const shape = window.matchMedia('(max-width: 899px)').matches ? PATH_NARROW : PATH
        dims.W = spaceEl.clientWidth
        dims.H = spaceEl.clientHeight
        dims.gap = shape.gap
        path = makePath(shape)
      }
      measure()
      const lanes = cards.map((_, i) => lane(i))

      // the whole stream's travel: the path, plus the room for the last card
      // to follow the first one all the way through
      const span = () => path.total + (n - 1) * dims.gap

      const flow = { p: 0 }
      const lean = { x: 0, y: 0 }
      const leanX = gsap.quickTo(lean, 'x', { duration: 0.9, ease: 'power2.out' })
      const leanY = gsap.quickTo(lean, 'y', { duration: 0.9, ease: 'power2.out' })

      const DS = 0.004 // a short step along the path, for the direction of travel
      const FADE = 0.25 // at the very ends of the path, well out of sight

      const place = () => {
        const { W, H } = dims
        const head = flow.p * span()
        for (let i = 0; i < n; i++) {
          const el = cards[i]
          const s = head - i * dims.gap
          if (s <= 0 || s >= path.total) {
            // not in yet, or gone: parked out of sight, but placed, so a
            // reversed scroll brings it straight back in
            el.style.opacity = '0'
            el.style.visibility = 'hidden'
            continue
          }
          const { dr, dy, roll } = lanes[i]
          const t = path.angleAt(s)
          const tb = path.angleAt(Math.max(0, s - DS))
          const ta = path.angleAt(Math.min(path.total, s + DS))
          const p = path.point(t, dr)
          const pb = path.point(tb, dr)
          const pa = path.point(ta, dr)

          // faces along the path: square to the reader across the front,
          // edge-on in the turns, its back to the reader behind
          const heading = Math.atan2(pb.z - pa.z, pa.x - pb.x)
          let turn = Math.atan2(p.z - pa.z, pa.x - p.x) - Math.atan2(pb.z - p.z, p.x - pb.x)
          if (turn > Math.PI) turn -= TAU
          if (turn < -Math.PI) turn += TAU
          // banks into the turn, and pitches with the rise and fall of the band
          const bank = gsap.utils.clamp(-BANK_DEG, BANK_DEG, (turn / DS) * 3.2)
          const slope = ((path.heightAt(ta) - path.heightAt(tb)) * H) / (2 * DS * W)
          const pitch = gsap.utils.clamp(-PITCH_DEG, PITCH_DEG, -Math.atan(slope) * DEG * 1.4)

          const px = p.x * W
          const pz = p.z * W
          const py = (path.heightAt(t) + dy) * H

          const facing = Math.cos(heading) // 1 toward the reader, -1 away
          // a card seen from behind is dim; edge-on it thins to nothing anyway
          const light = 0.42 + 0.58 * Math.max(0, facing)
          const edge = Math.min(1, s / FADE, (path.total - s) / FADE)
          el.style.visibility = ''
          el.style.opacity = edge.toFixed(3)
          el.style.transform =
            `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, ${pz.toFixed(1)}px) ` +
            `rotateY(${(heading * DEG).toFixed(2)}deg) rotateZ(${(pitch + roll).toFixed(2)}deg) rotateX(${bank.toFixed(2)}deg)`
          el.style.filter = `brightness(${light.toFixed(3)})`
          el.style.zIndex = String(Math.round((p.z + 1) * 100))
        }
        spaceEl.style.transform = `rotateX(${-lean.y * LEAN_DEG}deg) rotateY(${lean.x * LEAN_DEG}deg)`
      }

      // ---------------------------------------------------------- the words
      // where along the scroll the statement should come and go: when the
      // first card is round at the back, and when the last card is on its
      // way out. Ratios of path lengths, so they hold at any width.
      const textIn = () => path.marks.backMid / span()
      const textOut = () => (path.marks.loopEnd + (n + 1) * dims.gap) / span()

      if (reduced) {
        // a still: the stream half way through, the statement up
        flow.p = 0.5
        gsap.set(words, { autoAlpha: 1, filter: 'blur(0px)', y: 0 })
        place()
        const ro = new ResizeObserver(() => {
          measure()
          place()
        })
        ro.observe(spaceEl)
        return () => ro.disconnect()
      }

      gsap.set(words, { autoAlpha: 0, filter: 'blur(14px)', y: 18 })

      // one scrubbed timeline, 0..1 over the pin: the stream's travel, and the
      // statement's arrival and departure placed along it
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: rootEl,
          pin: true,
          start: 'top top',
          // on a tall narrow screen the width is small, so the height sets the pace
          end: () => `+=${Math.round(span() * Math.max(dims.W, dims.H * 0.9) * SCROLL_RATE)}`,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: () => {
            measure()
            place()
          },
        },
      })
      tl.to(flow, { p: 1, duration: 1, onUpdate: place }, 0)
      tl.to(
        words,
        { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 0.07, stagger: 0.018, ease: 'power2.out' },
        textIn(),
      )
      tl.to(
        words,
        { autoAlpha: 0, filter: 'blur(10px)', y: -14, duration: 0.06, stagger: 0.01, ease: 'power2.in' },
        textOut(),
      )
      place()

      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return
        const r = rootEl.getBoundingClientRect()
        leanX(((e.clientX - r.left) / r.width) * 2 - 1)
        leanY(((e.clientY - r.top) / r.height) * 2 - 1)
      }
      const onLeave = () => {
        leanX(0)
        leanY(0)
      }
      rootEl.addEventListener('pointermove', onMove)
      rootEl.addEventListener('pointerleave', onLeave)
      // the lean is the only thing that moves without the scroll; it is cheap
      const leanTick = () => {
        if (Math.abs(lean.x) + Math.abs(lean.y) > 0.001) place()
      }
      gsap.ticker.add(leanTick)

      const ro = new ResizeObserver(() => {
        measure()
        place()
      })
      ro.observe(spaceEl)

      return () => {
        gsap.ticker.remove(leanTick)
        ro.disconnect()
        rootEl.removeEventListener('pointermove', onMove)
        rootEl.removeEventListener('pointerleave', onLeave)
      }
    },
    { scope: root },
  )

  return (
    <section className="stack" id="stack" ref={root} aria-labelledby="stack-heading">
      <div className="st-corner st-corner--tl mono">03 — Stack</div>
      <div className="st-corner st-corner--tr mono">{TECH.length} tools</div>

      <div className="stack__space" ref={space}>
        <h2 className="stack__statement" id="stack-heading">
          {STATEMENT.map((w, i) => (
            <span className="st-word" key={w} data-stack-word>
              {i >= 2 ? <em>{w}</em> : <span>{w}</span>}
            </span>
          ))}
        </h2>

        <div className="stack__ring" ref={ring} aria-hidden="true">
          {TECH.map((t) => {
            const logo = t.logo ? TECH_LOGOS[t.logo] : undefined
            return (
              <div className={logo ? 'stack__card stack__card--logo' : 'stack__card'} key={t.name} data-stack-card>
                {logo ? (
                  <Logo name={t.name} logo={logo} />
                ) : (
                  <>
                    <span className="stack__mark">{t.mark}</span>
                    <span className="stack__name">{t.name}</span>
                    <span className="stack__cat mono">{t.category}</span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* the list itself, for readers */}
      <ul className="sr-only">
        {TECH.map((t) => (
          <li key={t.name}>
            {t.name} — {t.category}
          </li>
        ))}
      </ul>
    </section>
  )
}
