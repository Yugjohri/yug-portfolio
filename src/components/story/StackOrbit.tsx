import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { TECH } from '../../data/portfolio'
import { TECH_LOGOS, type TechLogo } from '../../data/techLogos'
import { layeredHoldPx } from '../../motion/sectionTransitions'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * The stack -- the section it used to be, shrunk into About's right column.
 *
 * The stage is laid out exactly as the old full-screen section was (a
 * viewport-sized space, the same path, perspective, cards and statement) and
 * scaled down as one piece to the column's width, so it looks and moves just
 * as it did, only smaller. The column clips it at its sides, so the stream
 * comes in at the column's left edge (where the screen's edge used to be) and
 * leaves at its right.
 *
 * It works as it did too: the About section pins, and one scrubbed timeline
 * carries the stream along the path with the scroll. The header's walls carry
 * a still copy of the column at the pin's first frame (mode "still"), so the
 * hand-over from the walls to the section is exact.
 *
 * Each card opens its technology's site in a new tab (TECH[].url in
 * data/portfolio.ts); a small label names the card under the hand.
 *
 * The stream starts empty: when the pin takes hold the first card is at the
 * left edge, and the cards come in one by one as the scroll carries them. The
 * statement (and the soft shadow on the floor under it) only rises once a few
 * cards are already round the loop.
 *
 * The stream's path is described in the comments of the original section
 * (git history: TechStack.tsx); the geometry below is unchanged.
 */

const PATH = { rx: 0.36, rz: 0.19, open: 1.9, gap: 0.085 }
const PATH_NARROW = { rx: 0.32, rz: 0.5, open: 1.9, gap: 0.34 }
const TILT = 0.13
const WAVE = { amp: 0.042, per: 3, phase: -2.77 }
const LANE = { r: 0.035, y: 0.05 }
const BANK_DEG = 16
const PITCH_DEG = 10
/** Scroll pixels per pixel of travel along the path (of the full-size stage, as before). */
const SCROLL_RATE = 0.3
/** The statement rises once this many cards have come in, over this many more. */
const STATEMENT_AFTER = 2.5
const STATEMENT_OVER = 1.5
const LEAN_DEG = 3
/** Desktop: the stage's own width (it is scaled to the column), so the stream keeps the old section's proportions. */
const STAGE_W = 1440

const STATEMENT = 'i pick boring on purpose.'
const STATEMENT_ACCENT = 'boring on purpose.'

const TAU = Math.PI * 2
const DEG = 180 / Math.PI
const OVERRUN = 0.25

type Shape = { rx: number; rz: number; open: number; gap: number }

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
  const heightAt = (t: number) => Math.cos(t) * TILT + WAVE.amp * Math.sin(t * WAVE.per + WAVE.phase)
  // the closed loop's own length (one turn, 0..TAU, where the path is a plain ellipse)
  const at = (t: number) => Math.round(((t - t0) / (t1 - t0)) * M)
  const loop = ss[at(TAU)] - ss[at(0)]
  return { point, angleAt, heightAt, total: ss[M], loop }
}

const lane = (i: number) => {
  const a = ((i * 0.618034) % 1) * 2 - 1
  const b = ((i * 0.381966 + 0.5) % 1) * 2 - 1
  return { dr: a * LANE.r, dy: b * LANE.y, roll: a * b * 5 }
}

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

type Props = {
  /** "pin": the live stack, pinning `pin` and scrubbing with the scroll. "still": its first frame. */
  mode: 'pin' | 'still'
  /** the element the live stack pins (About's section) */
  pin?: React.RefObject<HTMLElement>
}

/**
 * How far About's text runs past the bottom of the screen while it is pinned,
 * px: from the sheet's top to the closing note's bottom, by layout offsets (the
 * rise and the layered transition's transforms do not count), with a little
 * room under it. Under 40px it is called 0 -- the text fits, as on a desktop,
 * and nothing about the pin changes there.
 */
export const aboutOverflow = (sheet: HTMLElement) => {
  const last = sheet.querySelector<HTMLElement>('.apanel__coda') ?? sheet.querySelector<HTMLElement>('.apanel__body')
  if (!last) return 0
  let y = last.offsetHeight
  for (let e: HTMLElement | null = last; e && e !== sheet; e = e.offsetParent as HTMLElement | null) y += e.offsetTop
  const over = Math.round(y + 32 - window.innerHeight)
  return over < 40 ? 0 : over
}

export default function StackOrbit({ mode, pin }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const space = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const floor = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const rootEl = root.current
      const stageEl = stage.current
      const spaceEl = space.current
      const ringEl = ring.current
      const floorEl = floor.current
      const statementEl = stageEl?.querySelector<HTMLElement>('.stack__statement') ?? null
      const tipEl = tip.current
      if (!rootEl || !stageEl || !spaceEl || !ringEl || !floorEl || !tipEl) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      // narrow screens show fewer cards (stack.css); only the shown ones fly
      const cards = gsap.utils.toArray<HTMLElement>('[data-stack-card]', ringEl).filter((el) => getComputedStyle(el).display !== 'none')
      const n = cards.length
      if (!n) return

      // ------------------------------------------- the stage, at the old size
      // The old section was the viewport; the stage is laid out at that size
      // and scaled down to the column, so everything in it shrinks together.
      // ySpread: on desktop the band's rise and fall is opened up so the stream
      // fills the column's height, beside the text (the reference's figure does)
      const dims = { W: 1, H: 1, gap: PATH.gap, ySpread: 1 }
      /** desktop: the cards spaced further apart along the path than the old section, so the bigger cards never crowd */
      const GAP_WIDE = 0.25
      let path = makePath(PATH)
      const fit = () => {
        // On a phone the column is the screen's width: the old narrow stage, a
        // little shorter, at the column's width. Wider, the stage is scaled so the
        // loop itself (0.72 of its width) fills the column, centred in it; the
        // stream's open ends run past the column and are clipped there.
        const narrow = window.matchMedia('(max-width: 899px)').matches
        const colW = Math.max(1, rootEl.clientWidth)
        const bleed = parseFloat(getComputedStyle(rootEl).paddingTop) || 0
        stageEl.style.top = `${bleed}px`
        if (narrow) {
          const W = Math.max(1, window.innerWidth)
          const H = Math.max(1, window.innerHeight * 0.58)
          const k = Math.max(0.05, colW / W)
          stageEl.style.width = `${W}px`
          stageEl.style.height = `${H}px`
          stageEl.style.left = `${((colW - W * k) / 2).toFixed(1)}px`
          stageEl.style.transform = `scale(${k})`
          rootEl.style.height = `${(H * k).toFixed(1)}px`
          rootEl.style.marginTop = ''
          return
        }
        // Desktop: a stage of fixed width, scaled so its loop (0.72 of the
        // width) takes 78% of the right half, centred in it, so the cards stay
        // clear of the area's fading edges; as tall as the text beside it, and
        // level with its first paragraph (15px higher). Positions are read from
        // the layout (offsets within the sheet), not the screen, so a copy on a
        // moving wall works them out exactly as the section does.
        const W = STAGE_W
        const k = Math.max(0.05, (colW * 0.78) / (W * 0.72))
        const sheet = rootEl.closest<HTMLElement>('.apanel__sheet')
        const body = sheet?.querySelector<HTMLElement>('.apanel__body')
        const side = rootEl.parentElement
        const tall = gsap.utils.clamp(360, 820, body?.offsetHeight || 560)
        const H = tall / k
        stageEl.style.width = `${W}px`
        stageEl.style.height = `${H.toFixed(1)}px`
        stageEl.style.left = `${((colW - W * k) / 2).toFixed(1)}px`
        stageEl.style.transform = `scale(${k})`
        rootEl.style.height = `${tall.toFixed(1)}px`
        // About's heading is set at the statement's size as drawn (its size in the stage, times the scale)
        const statement = stageEl.querySelector<HTMLElement>('.stack__statement')
        const heading = sheet?.querySelector<HTMLElement>('.apanel__heading')
        if (sheet && statement) sheet.style.setProperty('--ap-type', `${(parseFloat(getComputedStyle(statement).fontSize) * k).toFixed(2)}px`)
        if (sheet && body && side) {
          const offTop = (el: HTMLElement) => {
            let y = 0
            for (let e: HTMLElement | null = el; e && e !== sheet; e = e.offsetParent as HTMLElement | null) y += e.offsetTop
            return y
          }
          // (where the first paragraph would be without the text block's own drop, so the stack stays put)
          const halfL = sheet.querySelector<HTMLElement>('.apanel__half--l')
          const drop = halfL ? parseFloat(getComputedStyle(halfL).paddingTop) || 0 : 0
          // and the heading's growth past its old width-based size, so a bigger heading does not push the stack down
          let grown = 0
          if (heading) {
            const now = parseFloat(getComputedStyle(heading).fontSize) || 1
            const was = Math.min(body.offsetWidth / 13.8, 50) + 2
            grown = heading.offsetHeight * (1 - was / now)
          }
          rootEl.style.marginTop = `${(offTop(body) - drop - grown - 15 - offTop(side) - bleed).toFixed(1)}px`
        }
      }
      // The walls' copies show the stack's first frame, which is empty (the
      // stream enters from out of sight): no cards to place there. Setting
      // them up forced two whole-page style recalculations on load, the
      // Story's longest task on a phone. They are still fitted, though: that
      // sets the heading's size and the column's place, and without it the
      // copy did not match the section that takes over from it (the text
      // jumped left and the heading grew at the handoff).
      if (mode === 'still') {
        stageEl.style.visibility = 'hidden'
        fit()
        const still = new ResizeObserver(() => fit())
        still.observe(rootEl)
        const text = rootEl.closest('.apanel__sheet')?.querySelector<HTMLElement>('.apanel__body')
        if (text) still.observe(text)
        return () => still.disconnect()
      }
      const measure = () => {
        fit()
        const shape = window.matchMedia('(max-width: 899px)').matches ? PATH_NARROW : PATH
        dims.W = Math.max(1, spaceEl.clientWidth)
        dims.H = Math.max(1, spaceEl.clientHeight)
        dims.gap = shape.gap
        dims.ySpread = window.matchMedia('(max-width: 899px)').matches ? 1 : 2.2
        path = makePath(shape)
        // The path goes round one and a half times, so it passes the front twice:
        // space the cards so a whole number and a half fit in one turn, and the
        // second pass runs exactly between the first's cards, never over them
        if (!window.matchMedia('(max-width: 899px)').matches) {
          const fits = Math.max(1, Math.round(path.loop / GAP_WIDE - 0.5))
          dims.gap = path.loop / (fits + 0.5)
        }
      }
      measure()
      const lanes = cards.map((_, i) => lane(i))
      const span = () => path.total + (n - 1) * dims.gap

      const flow = { p: 0 }
      const lean = { x: 0, y: 0 }
      const leanX = gsap.quickTo(lean, 'x', { duration: 0.9, ease: 'power2.out' })
      const leanY = gsap.quickTo(lean, 'y', { duration: 0.9, ease: 'power2.out' })
      const DS = 0.004
      const FADE = 0.25
      const num = (v: number) => (Number.isFinite(v) ? v : 0)

      const place = () => {
        const { W, H } = dims
        const head = flow.p * span()
        for (let i = 0; i < n; i++) {
          const el = cards[i]
          const s = head - i * dims.gap
          if (s <= 0 || s >= path.total) {
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
          const heading = Math.atan2(pb.z - pa.z, pa.x - pb.x)
          let turn = Math.atan2(p.z - pa.z, pa.x - p.x) - Math.atan2(pb.z - p.z, p.x - pb.x)
          if (turn > Math.PI) turn -= TAU
          if (turn < -Math.PI) turn += TAU
          const bank = Math.max(-BANK_DEG, Math.min(BANK_DEG, num((turn / DS) * 3.2)))
          const slope = ((path.heightAt(ta) - path.heightAt(tb)) * dims.ySpread * H) / (2 * DS * W)
          const pitch = Math.max(-PITCH_DEG, Math.min(PITCH_DEG, num(-Math.atan(slope) * DEG * 1.4)))
          const px = p.x * W
          const pz = p.z * W
          const py = (path.heightAt(t) * dims.ySpread + dy) * H
          const facing = Math.cos(heading)
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
        // the statement, and its shadow, rise once a few cards are in
        const entered = (head - win.sIn) / Math.max(1e-6, dims.gap)
        const q = gsap.utils.clamp(0, 1, (entered - STATEMENT_AFTER) / STATEMENT_OVER)
        const e = q * q * (3 - 2 * q)
        if (statementEl) {
          statementEl.style.opacity = e.toFixed(3)
          statementEl.style.transform = `translate3d(0, ${((1 - e) * 46).toFixed(1)}px, 0)`
          statementEl.style.filter = e < 1 ? `blur(${((1 - e) * 10).toFixed(1)}px)` : ''
        }
        floorEl.style.opacity = e.toFixed(3)
      }

      // the visible stretch: the pin starts with the stream empty -- its first
      // card at the left edge -- and lets go once the last has left
      // (the stage's edges are the column's)
      const win = { p0: 0, p1: 1, sIn: 0 }
      const findWindow = () => {
        const persp = parseFloat(getComputedStyle(spaceEl).perspective) || 1000
        const onScreen = (s: number) => {
          const q = path.point(path.angleAt(s))
          const z = q.z * dims.W
          if (z >= persp - 1) return false
          const x = (q.x * dims.W * persp) / (persp - z)
          return Math.abs(x) < dims.W / 2
        }
        const steps = 600
        let sIn = 0
        let sOut = path.total
        for (let k = 0; k <= steps; k++) {
          const s = (path.total * k) / steps
          if (onScreen(s)) {
            sIn = s
            break
          }
        }
        for (let k = steps; k >= 0; k--) {
          const s = (path.total * k) / steps
          if (onScreen(s)) {
            sOut = s
            break
          }
        }
        // half a card's spacing short of the edge, so the first card is wholly out of sight when the pin takes hold
        win.sIn = Math.max(0, sIn - dims.gap * 0.5)
        win.p0 = gsap.utils.clamp(0, 1, win.sIn / span())
        // the pin lets go only once the last card has left: the page moves on with the column empty
        win.p1 = gsap.utils.clamp(win.p0 + 0.1, 1, (sOut + (n - 1) * dims.gap + 0.02) / span())
      }
      findWindow()
      flow.p = win.p0

      const ro = new ResizeObserver(() => {
        measure()
        findWindow()
        place()
      })
      ro.observe(rootEl)
      // the stack is as tall as the text beside it: follow the text's height too
      const bodyEl = rootEl.closest('.apanel__sheet')?.querySelector<HTMLElement>('.apanel__body')
      if (bodyEl) ro.observe(bodyEl)

      // The section to pin. Read from the page, not only from the ref: React
      // sets a parent's ref after its children's layout effects have run, so
      // in a production build `pin.current` is still null here on the first
      // (and there only) run -- the pin was never made, and Experience slid
      // over About at once. (Development runs effects twice, which hid it.)
      const pinEl = pin?.current ?? rootEl.closest<HTMLElement>('.apanel--section')
      if (reduced || !pinEl) {
        // the first frame of the live stack (or, reduced, a still half way through)
        flow.p = reduced ? 0.5 : win.p0
        place()
        return () => ro.disconnect()
      }

      // ---------------------------------------- live: the section pins, the scroll carries it
      // the hold after the stream (set once the timeline exists; onRefresh can fire while it is being made)
      let hold: gsap.core.Tween | null = null
      const streamPx = () => Math.round(span() * (win.p1 - win.p0) * Math.max(dims.W, dims.H * 0.9) * SCROLL_RATE)
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          // AboutPanel reads this pin's range: the paragraphs light up over it
          id: 'about-stack',
          trigger: pinEl,
          pin: true,
          start: 'top top',
          // the stream's run, then (with the layered transition on) a screen's hold for Experience to come over
          end: () => `+=${streamPx() + layeredHoldPx()}`,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          // default order (document order): the triggers below it -- Projects and on -- are measured after its pin adds its length
          onRefresh: () => {
            measure()
            findWindow()
            place()
            // the hold's share of the timeline, against the stream's
            hold?.duration(layeredHoldPx() / Math.max(1, streamPx()))
          },
        },
      })
      tl.fromTo(flow, { p: () => win.p0 }, { p: () => win.p1, duration: 1, onUpdate: place }, 0)
      // Where About is taller than the screen (a phone: one column, the stack
      // above the text), the pin would hold its top and the rest of the text
      // would never come into view before Experience covered it. So, once the
      // stack has streamed a while, the content rises inside the pin by just
      // what overflows, and the whole text is read (it lights up as it comes,
      // AboutPanel). Where it fits (the desktop) the overflow is 0 and this is
      // nothing. (.apanel__wrap, not the sheet: the layered transition owns
      // the sheet's transform.)
      const wrap = pinEl.querySelector<HTMLElement>('.apanel__wrap')
      const sheetEl = pinEl.querySelector<HTMLElement>('.apanel__sheet')
      if (wrap && sheetEl) {
        tl.fromTo(wrap, { y: 0 }, { y: () => -aboutOverflow(sheetEl), duration: 0.62, ease: 'power1.inOut' }, 0.3)
      }
      // nothing moves in the hold: the stream is done, About waits under Experience
      hold = gsap.to({}, { duration: layeredHoldPx() / Math.max(1, streamPx()) })
      tl.add(hold, 1)
      place()

      // the lean answers the hand, as before
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return
        const r = rootEl.getBoundingClientRect()
        leanX(((e.clientX - r.left) / r.width) * 2 - 1)
        leanY(((e.clientY - r.top) / r.height) * 2 - 1)
      }
      const onLeave = () => {
        leanX(0)
        leanY(0)
        tipEl.removeAttribute('data-on')
      }
      const leanTick = () => {
        if (Math.abs(lean.x) + Math.abs(lean.y) > 0.001) place()
      }
      // one upright label over the card under the hand
      const onOver = (e: PointerEvent) => {
        const card = (e.target as HTMLElement).closest<HTMLElement>('[data-stack-card]')
        if (!card) {
          tipEl.removeAttribute('data-on')
          return
        }
        const r = card.getBoundingClientRect()
        const o = rootEl.getBoundingClientRect()
        tipEl.textContent = card.dataset.name ?? ''
        tipEl.style.transform = `translate(${(r.left + r.width / 2 - o.left).toFixed(1)}px, ${(r.top - o.top - 6).toFixed(1)}px)`
        tipEl.setAttribute('data-on', '')
      }
      const onOut = (e: PointerEvent) => {
        if (!(e.relatedTarget as HTMLElement | null)?.closest?.('[data-stack-card]')) tipEl.removeAttribute('data-on')
      }
      rootEl.addEventListener('pointermove', onMove)
      rootEl.addEventListener('pointerleave', onLeave)
      ringEl.addEventListener('pointerover', onOver)
      ringEl.addEventListener('pointerout', onOut)
      gsap.ticker.add(leanTick)

      return () => {
        ro.disconnect()
        gsap.ticker.remove(leanTick)
        rootEl.removeEventListener('pointermove', onMove)
        rootEl.removeEventListener('pointerleave', onLeave)
        ringEl.removeEventListener('pointerover', onOver)
        ringEl.removeEventListener('pointerout', onOut)
      }
    },
    { scope: root },
  )

  const live = mode === 'pin'
  return (
    <div className="orbit" ref={root}>
      <div className="orbit__stage" ref={stage}>
        <div className="orbit__floor" ref={floor} aria-hidden="true" />
        <div className="stack__space" ref={space}>
          <p className="st-title stack__statement">
            {STATEMENT.slice(0, STATEMENT.indexOf(STATEMENT_ACCENT))}
            <em>{STATEMENT_ACCENT}</em>
          </p>
          <div className="stack__ring" ref={ring}>
            {TECH.map((t) => {
              const logo = t.logo ? TECH_LOGOS[t.logo] : undefined
              return (
                <a
                  className={logo ? 'stack__card stack__card--logo' : 'stack__card'}
                  key={t.name}
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  tabIndex={live ? undefined : -1}
                  aria-label={`${t.name}, ${t.category} (opens its site in a new tab)`}
                  data-stack-card
                  data-name={t.name}
                >
                  {logo ? (
                    <Logo name={t.name} logo={logo} />
                  ) : (
                    <>
                      <span className="stack__mark">{t.mark}</span>
                      <span className="stack__name">{t.name}</span>
                      <span className="stack__cat mono">{t.category}</span>
                    </>
                  )}
                </a>
              )
            })}
          </div>
        </div>
      </div>
      <div className="orbit__tip mono" ref={tip} aria-hidden="true" />
    </div>
  )
}
