import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { TECH } from '../../data/portfolio'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * The stack, as a journey the reader scrolls through.
 *
 * The technologies are one stream of cards on a single invisible track: a
 * stadium in plan, seen from slightly above. They come in from off the left
 * edge along the near straight -- large, facing the reader, evenly spaced --
 * sweep right, turn edge-on at the right end and go round to the far
 * straight, where they are small, high and seen from behind, travelling left;
 * turn again at the left end, come back down the near straight, and leave off
 * the right edge. Each card's place on the track gives it everything: where
 * it is, how far away (the perspective does the sizing), which way it faces
 * (along the track, so it really turns), how bright it is (its back is dim).
 *
 * Nothing moves on its own. The section pins and one scrubbed timeline
 * carries the stream along the track with the scroll, so a slow scroll is a
 * slow procession and scrolling back runs it in reverse. The statement in
 * the middle is on the same timeline: it comes up out of blur as the first
 * cards round the back, and goes as the last ones head for the exit.
 */

/**
 * The track, in units of the space's width. Half the straight's length,
 * the turn's radius (also how far the near and far straights sit from the
 * middle), how far past the straight's end the entry and exit run, and the
 * spacing of the cards along it.
 */
const TRACK = { a: 0.24, b: 0.24, run: 0.34, gap: 0.19 }
const TRACK_NARROW = { a: 0.34, b: 0.32, run: 0.5, gap: 0.3 }
/** How far the near straight sits below the middle and the far one above, in space heights. */
const TILT = 0.16
/** Scroll pixels per pixel of travel along the track. */
const SCROLL_RATE = 0.4
/** The pointer's lean on the whole space, degrees at the edge. */
const LEAN_DEG = 3

const STATEMENT = ['Built', 'with', 'the', 'right', 'tools.']

type Pose = { x: number; z: number; heading: number }

/**
 * A point on the stadium at arc length s, in track units, with the heading
 * of travel (0 = rightward along the near straight, growing anticlockwise
 * seen from above). The pieces, in order: the entry and near straight, the
 * right turn, the far straight, the left turn, the near straight again and
 * the exit.
 */
function makeTrack(a: number, b: number, run: number) {
  const L1 = run + 2 * a // in from the left, along the front
  const L2 = Math.PI * b // right turn
  const L3 = 2 * a // along the back
  const L4 = Math.PI * b // left turn
  const L5 = 2 * a + run // along the front, out to the right
  const total = L1 + L2 + L3 + L4 + L5
  const at = (s: number): Pose => {
    if (s < L1) return { x: -a - run + s, z: b, heading: 0 }
    s -= L1
    if (s < L2) {
      const f = s / b // 0..π
      return { x: a + b * Math.sin(f), z: b * Math.cos(f), heading: f }
    }
    s -= L2
    if (s < L3) return { x: a - s, z: -b, heading: Math.PI }
    s -= L3
    if (s < L4) {
      const f = s / b
      return { x: -a - b * Math.sin(f), z: -b * Math.cos(f), heading: Math.PI + f }
    }
    s -= L4
    return { x: -a + s, z: b, heading: 0 }
  }
  return { at, total, marks: { backStart: L1 + L2, exitStart: L1 + L2 + L3 + L4 } }
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
      const dims = { W: 1, H: 1, a: 0, b: 0, run: 0, gap: 0 }
      let track = makeTrack(TRACK.a, TRACK.b, TRACK.run)
      const measure = () => {
        const t = window.matchMedia('(max-width: 899px)').matches ? TRACK_NARROW : TRACK
        dims.W = spaceEl.clientWidth
        dims.H = spaceEl.clientHeight
        dims.a = t.a
        dims.b = t.b
        dims.run = t.run
        dims.gap = t.gap
        track = makeTrack(t.a, t.b, t.run)
      }
      measure()

      // the whole stream's travel: the track, plus the room for the last card
      // to follow the first one all the way through
      const span = () => track.total + (n - 1) * dims.gap

      const flow = { p: 0 }
      const lean = { x: 0, y: 0 }
      const leanX = gsap.quickTo(lean, 'x', { duration: 0.9, ease: 'power2.out' })
      const leanY = gsap.quickTo(lean, 'y', { duration: 0.9, ease: 'power2.out' })

      const place = () => {
        const { W, H } = dims
        const head = flow.p * span()
        for (let i = 0; i < n; i++) {
          const el = cards[i]
          const s = head - i * dims.gap
          if (s <= 0 || s >= track.total) {
            // not in yet, or gone: parked out of sight, but placed, so a
            // reversed scroll brings it straight back in
            el.style.opacity = '0'
            el.style.visibility = 'hidden'
            continue
          }
          const { x, z, heading } = track.at(s)
          const px = x * W
          const pz = z * W
          // the near straight rides low, the far one high
          const py = (z / dims.b) * TILT * H
          // faces along the track: square to the reader on the near straight,
          // edge-on in the turns, its back to the reader on the far straight
          const ry = (heading * 180) / Math.PI
          const facing = Math.cos(heading) // 1 toward the reader, -1 away
          // a card seen from behind is dim; edge-on it thins to nothing anyway
          const light = 0.42 + 0.58 * Math.max(0, facing)
          // a soft fade at the very ends of the run, so nothing pops at the edge
          const edgeIn = Math.min(1, s / (dims.run * 0.6))
          const edgeOut = Math.min(1, (track.total - s) / (dims.run * 0.6))
          el.style.visibility = ''
          el.style.opacity = String(Math.min(edgeIn, edgeOut))
          el.style.transform = `translate3d(${px}px, ${py}px, ${pz}px) rotateY(${ry}deg)`
          el.style.filter = `brightness(${light.toFixed(3)})`
          el.style.zIndex = String(Math.round((z + dims.b) * 100))
        }
        spaceEl.style.transform = `rotateX(${-lean.y * LEAN_DEG}deg) rotateY(${lean.x * LEAN_DEG}deg)`
      }

      // ---------------------------------------------------------- the words
      // where along the scroll the statement should come and go: when the first
      // card is well onto the far straight, and when the last card is on its
      // way out. Ratios of track units, so they hold at any width.
      const textIn = () => (track.marks.backStart + dims.a * 0.6) / span()
      const textOut = () => (track.marks.exitStart + (n - 1) * dims.gap + dims.a * 0.8) / span()

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
          end: () => `+=${Math.round(span() * dims.W * SCROLL_RATE)}`,
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
        { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 0.09, stagger: 0.022, ease: 'power2.out' },
        textIn(),
      )
      tl.to(
        words,
        { autoAlpha: 0, filter: 'blur(10px)', y: -14, duration: 0.07, stagger: 0.012, ease: 'power2.in' },
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
          {TECH.map((t) => (
            <div className="stack__card" key={t.name} data-stack-card>
              <span className="stack__mark">{t.mark}</span>
              <span className="stack__name">{t.name}</span>
              <span className="stack__cat mono">{t.category}</span>
            </div>
          ))}
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
