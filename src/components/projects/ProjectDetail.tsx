import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import type { ProjectMedia, Sleeve } from '../../data/portfolio'

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
 * The panel is portalled to <body>: the ribbon it opens over is pinned, and a
 * fixed element inside a pinned ancestor would not be fixed to the viewport.
 */

/** Where the panel opens from and closes to, in viewport px. */
export type DetailOrigin = {
  x: number
  y: number
  width: number
  height: number
  radius: number
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
  const sheet = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const fly = useRef<HTMLDivElement>(null)
  const lead = useRef<HTMLDivElement>(null)
  const stream = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
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

    const timeline = gsap.timeline({
      paused: true,
      onComplete: () => {
        // the stream takes over from the flown plate; the sheet returns to its
        // stylesheet frame so a resize is honoured while it is open
        gsap.set(leadEl, { clearProps: 'visibility' })
        gsap.set(flyEl, { autoAlpha: 0 })
        gsap.set(bodyEl, { clearProps: 'width,height' })
        gsap.set(sheetEl, { clearProps: 'left,top,width,height,borderRadius' })
        closeBtn.current?.focus({ preventScroll: true })
      },
      onReverseComplete: onClosed,
    })
    timeline.to(box, { p: 1, duration: OPEN_S, ease: 'expo.inOut', onUpdate: apply }, 0)
    timeline.fromTo(scrim.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.55, ease: 'power2.out' }, 0)
    timeline.fromTo(info, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.05, ease: 'power3.out' }, 0.42)
    timeline.fromTo(closeBtn.current, { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2.2)' }, 0.55)
    if (rest.length) {
      timeline.fromTo(rest, { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.06, ease: 'power3.out' }, 0.5)
    }
    timeline.play()
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
    // the stream returns to its top so the plate is where the motion left it;
    // then the flown plate takes over again and the motion runs backward
    streamEl.scrollTop = 0
    if (timeline.progress() === 1) {
      const R1 = sheetEl.getBoundingClientRect()
      gsap.set(bodyEl, { width: R1.width, height: R1.height })
      gsap.set(leadEl, { visibility: 'hidden' })
      gsap.set(flyEl, { autoAlpha: 1 })
    }
    timeline.reverse()
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
                  Live site
                </a>
              ) : null}
              <span className="pd__chip mono">{project.org}</span>
              <span className="pd__emoji" aria-hidden="true">
                {project.emoji}
              </span>
            </div>
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

        <button className="pd__close" ref={closeBtn} type="button" onClick={close} aria-label="Close project">
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
