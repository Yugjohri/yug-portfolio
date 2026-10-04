import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import type { ProjectMedia, Sleeve } from '../../data/portfolio'
import { PopupSurface } from './popupSurface'
import { PROJECT_AUDIO } from '../../motion/projectAudio'

/**
 * A project, opened.
 *
 * The clicked screen grows into a sheet that stands just inside the viewport:
 * the project's information down its left, its case-study stream down its
 * right, scrolling on its own. Opening is one motion -- the sheet's box is
 * interpolated from the screen's footprint to its resting frame while the
 * title card inside it is carried from filling the box to its place at the
 * top of the stream, and the type stands up as the ground clears. Closing
 * plays the same motion backward, so the project returns to the screen it
 * came from.
 *
 * On the stage the growing is the ribbon's: its own card, still tipped the
 * way the hand left it, flies into the sheet's frame (see DetailFlight), and
 * the sheet here only fades in over it. The stacked column, which has no
 * stage, keeps the DOM motion above.
 *
 * The panel is portalled to <body>: the ribbon it opens over is pinned, and a
 * fixed element inside a pinned ancestor would not be fixed to the viewport.
 */

/**
 * On the stage, the ribbon's own card is what opens: the scene flies it into
 * the panel's frame while the panel's timeline drives it, and the panel
 * itself only fades in over a card that has already arrived. `frame` tells
 * the scene where to fly to (and the paper to wash to), `progress` flies it.
 */
export type DetailFlight = {
  /** the page-level veil's colour, the same the stage darkens its own ribbon toward */
  veil: string
  frame: (rect: DOMRect, paper: string) => void
  /** the flight (0..1) and how far the page behind has darkened (0..1), one curve for both */
  progress: (p: number, veil: number) => void
}

/** How far the page has darkened for a flight progress: under way at once, full well before the card lands. */
const veilAt = (p: number) => {
  const t = Math.min(1, p / 0.7)
  return t * t * (3 - 2 * t)
}

/** Where the panel opens from and closes to, in viewport px. */
export type DetailOrigin = {
  x: number
  y: number
  width: number
  height: number
  radius: number
  flight?: DetailFlight
}

type Props = {
  project: Sleeve
  origin: DetailOrigin
  /** The moment the close begins, so the page under it can come back with it. */
  onCloseStart: () => void
  /** After the panel has returned to the origin: unmount it. */
  onClosed: () => void
}

const OPEN_S = 0.9
const RADIUS = 24
/** The card's flight out of the ribbon, seconds; the panel settles in over its last stretch. */
const FLIGHT_S = 0.95
/** Closing runs the same timeline backward, a little quicker. */
const CLOSE_SCALE = 1.2
/** Opening and closing both run 15 % faster than the authored timings. */
const SPEED = 1 / 0.85
/** How far the photo, the type and the close button travel up as they fade in. */
const RISE_MEDIA = 64
const RISE_TYPE = 36
/** The close button's stylesheet eases its transform for the hover; while the timeline drives it, that would drag. */
const holdClose = (el: HTMLElement | null) => el && gsap.set(el, { transition: 'background-color 0.3s ease' })
const releaseClose = (el: HTMLElement | null) => el && gsap.set(el, { clearProps: 'transform,transition' })

const announce = (on: boolean) => window.dispatchEvent(new CustomEvent(PROJECT_AUDIO, { detail: on }))
/** Whether a playing element has any sound to give (the browsers each say it their own way). */
const hasAudio = (v: HTMLVideoElement) => {
  const m = v as HTMLVideoElement & { mozHasAudio?: boolean; webkitAudioDecodedByteCount?: number; audioTracks?: { length: number } }
  return !!(m.mozHasAudio || (m.webkitAudioDecodedByteCount ?? 0) > 0 || (m.audioTracks?.length ?? 0) > 0)
}
const SOUND_IN_S = 1.2
const SOUND_OUT_S = 0.35

/** The title card the ribbon draws, here in CSS: the same plate the screen shows. */
function Plate({ project }: { project: Sleeve }) {
  const [lead, ...rest] = project.metrics
  return (
    <div className="pd__plate work__stat" aria-hidden="true">
      <span className="work__stat-bar mono">
        <span>{project.code}</span>
        <span>{project.org}</span>
      </span>
      <span className="work__stat-lead">{lead}</span>
      {rest.length ? <span className="work__stat-sub mono">{rest.join('  ·  ')}</span> : null}
    </div>
  )
}

/** The first thing in the stream: the project's own artwork, or its plate. */
function Lead({ project }: { project: Sleeve }) {
  if (project.video) {
    return <video className="pd__media-item" src={project.video} poster={project.art} muted loop playsInline autoPlay />
  }
  if (project.art) return <img className="pd__media-item" src={project.art} alt="" />
  return <Plate project={project} />
}

function Media({ item }: { item: ProjectMedia }) {
  const style = item.aspect ? ({ aspectRatio: String(item.aspect) } as React.CSSProperties) : undefined
  if (item.kind === 'video') {
    return (
      <video className="pd__media-item" src={item.src} poster={item.poster} muted loop playsInline autoPlay style={style} />
    )
  }
  return <img className="pd__media-item" src={item.src} alt={item.alt ?? ''} loading="lazy" style={style} />
}

export default function ProjectDetail({ project, origin, onCloseStart, onClosed }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const dim = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const fly = useRef<HTMLDivElement>(null)
  const lead = useRef<HTMLDivElement>(null)
  const stream = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const soundBtn = useRef<HTMLButtonElement>(null)
  /** the clip's sound: on as the project opens, until the toggle or the close takes it off */
  const [sound, setSound] = useState(true)
  const volume = useRef<gsap.core.Tween | null>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const closing = useRef(false)

  // -------------------------------------------------------------- the motion
  useLayoutEffect(() => {
    const rootEl = root.current
    const sheetEl = sheet.current
    const bodyEl = body.current
    const flyEl = fly.current
    const leadEl = lead.current
    const streamEl = stream.current
    if (!rootEl || !sheetEl || !bodyEl || !flyEl || !leadEl || !streamEl) return

    const flight = origin.flight
    if (flight) {
      // ---------------------------------------------------- from the stage
      // The sheet never moves: it sits at its resting frame, see-through,
      // while the ribbon's card flies into exactly that frame and washes to
      // its paper. The stream's first picture ghosts in over the card as it
      // arrives, then the paper and the shadow take over from the card, then
      // the type, the rest of the stream and the close, one after another.
      // Closing is this timeline backward: the content goes first, the paper
      // hands back to the card, and the card flies home.
      gsap.set(sheetEl, { clearProps: 'backgroundColor,boxShadow' })
      const cs = getComputedStyle(sheetEl)
      const paper = cs.backgroundColor
      const clear = paper.replace(/rgba?\(([^,]+),([^,]+),([^,)]+)(?:,[^)]*)?\)/, 'rgba($1,$2,$3,0)')
      const shadow = cs.boxShadow
      const frame = () => flight.frame(sheetEl.getBoundingClientRect(), paper)
      frame()

      const info = gsap.utils.toArray<HTMLElement>('[data-pd-rise]', rootEl)
      const rest = gsap.utils.toArray<HTMLElement>('[data-pd-item]', streamEl).slice(1)
      gsap.set(flyEl, { autoAlpha: 0 })
      // the stage darkens itself; the scrim here only takes the click
      gsap.set(scrim.current, { autoAlpha: 1, backgroundColor: 'transparent' })
      gsap.set(sheetEl, { backgroundColor: clear, boxShadow: 'none' })

      // The page darkens as one: the veil here covers the whole viewport, under
      // the lifted stage, and the stage darkens its own ribbon along the same
      // curve, so there is no seam where the section ends.
      const dimEl = dim.current
      const fly = { p: 0 }
      const step = () => {
        const v = veilAt(fly.p)
        if (dimEl) dimEl.style.opacity = String(v)
        flight.progress(fly.p, v)
      }
      step()
      holdClose(closeBtn.current)
      const timeline = gsap.timeline({
        paused: true,
        onComplete: () => {
          releaseClose(closeBtn.current)
          closeBtn.current?.focus({ preventScroll: true })
        },
        onReverseComplete: onClosed,
      })
      timeline.to(fly, { p: 1, duration: FLIGHT_S, ease: 'power3.inOut', onUpdate: step }, 0)
      // The picture ghosts in over the arriving card sitting a little low,
      // and only rises into its place once the panel has established itself
      // -- after the paper is down -- so the rise is seen, slow and small,
      // and reads as the content settling rather than as a separate move.
      timeline.fromTo(
        leadEl,
        { autoAlpha: 0, y: RISE_MEDIA },
        { autoAlpha: 1, y: 0, duration: 1.0, ease: 'power3.out' },
        0.5,
      )
      timeline.fromTo(
        sheetEl,
        { backgroundColor: clear, boxShadow: 'none' },
        { backgroundColor: paper, boxShadow: shadow, duration: 0.24, ease: 'none' },
        FLIGHT_S - 0.22,
      )
      timeline.fromTo(
        info,
        { autoAlpha: 0, y: RISE_TYPE },
        { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.07, ease: 'power3.out' },
        FLIGHT_S - 0.12,
      )
      if (rest.length) {
        timeline.fromTo(
          rest,
          { autoAlpha: 0, y: 64 },
          { autoAlpha: 1, y: 0, duration: 1.15, stagger: 0.08, ease: 'power3.out' },
          FLIGHT_S + 0.05,
        )
      }
      timeline.fromTo(
        closeBtn.current,
        { autoAlpha: 0, y: RISE_TYPE },
        { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' },
        FLIGHT_S + 0.08,
      )
      timeline.timeScale(SPEED).play()
      tl.current = timeline

      // The pictures answer the hand as the ribbon's screens did: the same
      // surface field bends them under a stroke, and the one under the hand
      // tips and lifts on the same springs. A canvas over the sheet draws
      // them where their elements are; the elements stay for layout, the
      // scroll and the reveal above, which the canvas reads back each frame.
      const surface = window.matchMedia('(hover: hover)').matches ? new PopupSurface() : null
      const place = () => {
        if (!surface?.supported) return
        const r = sheetEl.getBoundingClientRect()
        surface.resize(r.width, r.height, r.left, r.top)
        surface.rerasterize()
      }
      // a hovered link changes its ink: the surface redraws that block while it transitions
      const onOver = (e: PointerEvent) => surface?.touch(e.target as Element)
      const tick = (_t: number, deltaMs: number) => surface?.render(Math.min(deltaMs, 50) / 1000)
      const onMove = (e: PointerEvent) => surface?.stir(e.clientX, e.clientY)
      const onLeave = () => surface?.stir(null)
      const glItems: HTMLElement[] = []
      if (surface?.supported) {
        surface.canvas.className = 'pd__gl'
        sheetEl.appendChild(surface.canvas)
        streamEl.querySelectorAll<HTMLImageElement | HTMLVideoElement>('[data-pd-item] > .pd__media-item').forEach((m) => {
          if (!(m instanceof HTMLImageElement || m instanceof HTMLVideoElement)) return
          const fig = m.parentElement as HTMLElement
          fig.setAttribute('data-gl-item', '')
          glItems.push(fig)
          surface.add(m, fig)
        })
        // the type too: every block down the left, and the closing card of the stream
        info.forEach((el) => surface.addText(el))
        streamEl.querySelectorAll<HTMLElement>('.pd__specs').forEach((el) => surface.addText(el))
        place()
        gsap.ticker.add(tick)
        sheetEl.addEventListener('pointermove', onMove)
        sheetEl.addEventListener('pointerleave', onLeave)
        sheetEl.addEventListener('pointerover', onOver)
        sheetEl.addEventListener('pointerout', onOver)
      }

      // the sheet's frame follows the window; the card under it follows the sheet
      const ro = new ResizeObserver(() => {
        frame()
        place()
      })
      ro.observe(sheetEl)
      return () => {
        ro.disconnect()
        timeline.kill()
        tl.current = null
        if (surface?.supported) {
          gsap.ticker.remove(tick)
          sheetEl.removeEventListener('pointermove', onMove)
          sheetEl.removeEventListener('pointerleave', onLeave)
          sheetEl.removeEventListener('pointerover', onOver)
          sheetEl.removeEventListener('pointerout', onOver)
          glItems.forEach((fig) => fig.removeAttribute('data-gl-item'))
          surface.canvas.remove()
          surface.dispose()
        }
      }
    }

    // The resting geometry, from the stylesheet: the sheet's frame and where
    // the lead lands in the stream. The body is then held at that size while
    // the sheet grows over it, so nothing inside reflows mid-motion. (Any
    // geometry a previous run of this effect left inline is cleared first, so
    // a development double-mount measures the stylesheet, not the origin.)
    gsap.set(sheetEl, { clearProps: 'left,top,width,height,borderRadius' })
    gsap.set(bodyEl, { clearProps: 'width,height' })
    gsap.set(leadEl, { clearProps: 'visibility' })
    const R1 = sheetEl.getBoundingClientRect()
    const L1 = leadEl.getBoundingClientRect()
    const R0 = origin
    const info = gsap.utils.toArray<HTMLElement>('[data-pd-rise]', rootEl)
    const rest = gsap.utils.toArray<HTMLElement>('[data-pd-item]', streamEl).slice(1)

    gsap.set(bodyEl, { width: R1.width, height: R1.height })
    gsap.set(leadEl, { visibility: 'hidden' })

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const box = { p: 0 }
    const apply = () => {
      const t = box.p
      const x = lerp(R0.x, R1.left, t)
      const y = lerp(R0.y, R1.top, t)
      const w = lerp(R0.width, R1.width, t)
      const h = lerp(R0.height, R1.height, t)
      sheetEl.style.left = `${x}px`
      sheetEl.style.top = `${y}px`
      sheetEl.style.width = `${w}px`
      sheetEl.style.height = `${h}px`
      sheetEl.style.borderRadius = `${lerp(R0.radius, RADIUS, t)}px`
      // the plate: from filling the box to the lead's place, in the sheet's own space
      flyEl.style.left = `${lerp(R0.x, L1.left, t) - x}px`
      flyEl.style.top = `${lerp(R0.y, L1.top, t) - y}px`
      flyEl.style.width = `${lerp(R0.width, L1.width, t)}px`
      flyEl.style.height = `${lerp(R0.height, L1.height, t)}px`
      flyEl.style.borderRadius = `${lerp(R0.radius, 10, t)}px`
    }
    apply()

    holdClose(closeBtn.current)
    const timeline = gsap.timeline({
      paused: true,
      onComplete: () => {
        // the stream takes over from the flown plate; the sheet returns to its
        // stylesheet frame so a resize is honoured while it is open
        gsap.set(leadEl, { clearProps: 'visibility' })
        gsap.set(flyEl, { autoAlpha: 0 })
        gsap.set(bodyEl, { clearProps: 'width,height' })
        gsap.set(sheetEl, { clearProps: 'left,top,width,height,borderRadius' })
        releaseClose(closeBtn.current)
        closeBtn.current?.focus({ preventScroll: true })
      },
      onReverseComplete: onClosed,
    })
    timeline.to(box, { p: 1, duration: OPEN_S, ease: 'expo.inOut', onUpdate: apply }, 0)
    timeline.fromTo(scrim.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.55, ease: 'power2.out' }, 0)
    timeline.fromTo(info, { autoAlpha: 0, y: RISE_TYPE }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out' }, 0.42)
    timeline.fromTo(closeBtn.current, { autoAlpha: 0, y: RISE_TYPE }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.55)
    if (rest.length) {
      timeline.fromTo(rest, { autoAlpha: 0, y: RISE_MEDIA }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'power3.out' }, 0.5)
    }
    timeline.timeScale(SPEED).play()
    tl.current = timeline

    return () => {
      timeline.kill()
      tl.current = null
    }
    // the origin and project are fixed for the life of one panel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => {
    const timeline = tl.current
    const sheetEl = sheet.current
    const bodyEl = body.current
    const flyEl = fly.current
    const leadEl = lead.current
    const streamEl = stream.current
    if (!timeline || closing.current || !sheetEl || !bodyEl || !flyEl || !leadEl || !streamEl) return
    closing.current = true
    onCloseStart()
    // the sound goes as the panel does
    const v = leadVideo()
    if (v && !v.muted) {
      volume.current?.kill()
      const level = { v: v.volume }
      volume.current = gsap.to(level, { v: 0, duration: SOUND_OUT_S, ease: 'power1.in', onUpdate: () => { v.volume = level.v } })
    }
    if (soundBtn.current) gsap.to(soundBtn.current, { autoAlpha: 0, duration: 0.2 })
    // the button fades back down with the type, driven by the timeline again
    holdClose(closeBtn.current)
    // the stream returns to its top so the plate is where the motion left it;
    // then the flown plate takes over again and the motion runs backward
    streamEl.scrollTop = 0
    if (origin.flight) {
      // from the stage: the same timeline backward hands the panel back to the card
      timeline.timeScale(CLOSE_SCALE * SPEED).reverse()
      return
    }
    if (timeline.progress() === 1) {
      const R1 = sheetEl.getBoundingClientRect()
      gsap.set(bodyEl, { width: R1.width, height: R1.height })
      gsap.set(leadEl, { visibility: 'hidden' })
      gsap.set(flyEl, { autoAlpha: 1 })
    }
    timeline.reverse()
  }

  // ---------------------------------------------------------------- the sound
  // The clip in the stream (not the flying copy, which stays silent) plays with
  // its sound as the project opens -- the click that opened it is the gesture
  // the browser asks for -- easing up from silence. If the browser still says
  // no, it plays on muted and the toggle shows it off.
  const leadVideo = () => lead.current?.querySelector('video') ?? null
  useEffect(() => {
    const v = leadVideo()
    if (!v) return
    const level = { v: 0 }
    v.volume = 0
    v.muted = false
    let told = false
    // the music steps aside only once the clip is heard to have sound
    const check = () => {
      if (told || v.muted || v.currentTime < 0.25) return
      if (hasAudio(v)) {
        told = true
        announce(true)
      }
      v.removeEventListener('timeupdate', check)
    }
    v.addEventListener('timeupdate', check)
    let live = true
    v.play().catch((err: DOMException) => {
      // only a refusal falls back to muted; an interrupted start (a pause, a
      // remount) is not one, and a run already cleaned up has no say
      if (!live || err?.name !== 'NotAllowedError') return
      v.muted = true
      setSound(false)
      void v.play().catch(() => {})
    })
    volume.current = gsap.to(level, { v: 1, duration: SOUND_IN_S, ease: 'power1.out', onUpdate: () => { v.volume = level.v } })
    return () => {
      live = false
      volume.current?.kill()
      v.removeEventListener('timeupdate', check)
      v.muted = true
      v.pause()
      if (told) announce(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSound = () => {
    const v = leadVideo()
    if (!v) return
    volume.current?.kill()
    const on = v.muted
    v.muted = !on
    if (on) {
      v.volume = 1
      void v.play().catch(() => {})
    }
    setSound(on)
  }

  // Escape closes; the page's own scroll keys are swallowed while it is open,
  // Lenis being stopped underneath
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) {
        if (!(e.target as HTMLElement).closest('[data-pd-stream]')) e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const media = project.media ?? []

  return createPortal(
    <>
    {origin.flight ? <div className="pd__dim" ref={dim} style={{ background: origin.flight.veil }} aria-hidden="true" /> : null}
    <div className="pd" ref={root}>
      <div className="pd__scrim" ref={scrim} onClick={close} aria-hidden="true" />

      <div className="pd__sheet" ref={sheet} role="dialog" aria-modal="true" aria-labelledby="pd-title" data-lenis-prevent>
        <div className="pd__body" ref={body}>
          <div className="pd__info">
            <h2 className="pd__title" id="pd-title" data-pd-rise>
              {project.title}
            </h2>
            <p className="pd__summary" data-pd-rise>
              {project.summary}
            </p>
            <div className="pd__row" data-pd-rise>
              {project.repo ? (
                <a className="pd__link" href={project.repo} target="_blank" rel="noreferrer">
                  <span className="pd__link-mark" aria-hidden="true">
                    ↗
                  </span>
                  GitHub
                </a>
              ) : null}
              {project.live ? (
                <a className="pd__link" href={project.live} target="_blank" rel="noreferrer">
                  <span className="pd__link-mark" aria-hidden="true">
                    ↗
                  </span>
                  {project.liveLabel ?? 'Live demo'}
                </a>
              ) : null}
              {project.extra ? (
                <a className="pd__link" href={project.extra.href} target="_blank" rel="noreferrer">
                  <span className="pd__link-mark" aria-hidden="true">
                    ↗
                  </span>
                  {project.extra.label}
                </a>
              ) : null}
              <span className="pd__chip mono">{project.org}</span>
              <span className="pd__emoji" aria-hidden="true">
                {project.emoji}
              </span>
            </div>
            {project.points?.length ? (
              <ul className="pd__points" data-pd-rise>
                {project.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            ) : null}
            {!project.repo && !project.live ? (
              <p className="pd__note mono" data-pd-rise>
                Internal system — no public repository
              </p>
            ) : null}
          </div>

          <div className="pd__stream" ref={stream} data-pd-stream>
            <figure className="pd__item pd__item--lead" ref={lead} data-pd-item>
              <Lead project={project} />
            </figure>

            {media.map((m, i) => (
              <figure className="pd__item" key={`${m.src}-${i}`} data-pd-item>
                <Media item={m} />
              </figure>
            ))}

            {/* the numbers and the stack, as the closing card of the stream */}
            <figure className="pd__item pd__specs" data-pd-item>
              <ul className="pd__metrics">
                {project.metrics.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="pd__body-copy">{project.body}</p>
              <ul className="pd__tags mono">
                {project.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </figure>
          </div>
        </div>

        {/* the plate that flies: the screen's picture, carried into the stream */}
        <div className="pd__fly" ref={fly} aria-hidden="true">
          <Lead project={project} />
        </div>

        {project.video ? (
          <button
            className="pd__sound"
            ref={soundBtn}
            type="button"
            onClick={toggleSound}
            aria-label={sound ? 'Mute the video' : 'Play the video with sound'}
            aria-pressed={!sound}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 5.5h2.6L8.5 2.5v11L4.6 10.5H2v-5Z" />
              {sound ? (
                <path className="pd__sound-wave" d="M11 5.8a3 3 0 0 1 0 4.4M11.2 3a5.6 5.6 0 0 1 0 10" />
              ) : (
                <path className="pd__sound-wave" d="M10.2 6.4l3.6 3.6m0-3.6-3.6 3.6" />
              )}
            </svg>
          </button>
        ) : null}

        <button className="pd__close" ref={closeBtn} type="button" onClick={close} aria-label="Close project">
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>
    </div>
    </>,
    document.body,
  )
}
