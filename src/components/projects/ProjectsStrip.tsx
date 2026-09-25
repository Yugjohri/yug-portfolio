import { useCallback, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SLEEVES, type Sleeve } from '../../data/portfolio'
import { RibbonScene } from './ribbonScene'
import ProjectDetail, { type DetailOrigin } from './ProjectDetail'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * The layout switches between the pinned ribbon and a plain stacked column.
 * CSS and GSAP must agree on when, so the condition lives once here and once,
 * verbatim, in projects.css.
 */
const STAGE_MEDIA = '(min-width: 900px) and (prefers-reduced-motion: no-preference)'

/** Scroll speed, px/s, that the sheet reads as full: the wring saturates
 *  past it. Squared below so a slow scroll barely stirs the sheet and a flick
 *  does -- the reference's own curve. */
const VEL_NORM = 2800

/** Vertical px of scroll per px of ribbon travel. Under 1 the strip moves
 *  faster than the hand; the mapping stays linear, so nothing snaps. */
const SCROLL_RATE = 0.68

/** The thrown ribbon: how quickly a release's speed dies away, seconds, and
 *  the speed below which it is considered stopped, ribbon px/s. */
const FLING_FRICTION_S = 0.6
const FLING_STOP = 24
/** The fastest a throw can leave the hand, ribbon px/s: a flick carries about
 *  a loop of the strip at most, however sharp the pointer's last event was. */
const FLING_MAX = 6000

const pad2 = (n: number) => String(n).padStart(2, '0')

/** The ribbon shows the finished projects only -- the ones with their film.
 *  The rest stay in the data (the Brief and the index still list them) and
 *  join the ribbon as soon as they have one. */
const PROJECTS = SLEEVES.filter((p) => p.video)

/** The stacked column's screen. On the stage the scene draws screens and
 *  titles alike; the column stays in the DOM, off screen, for readers and
 *  keyboards. */
function Screen({ project }: { project: Sleeve }) {
  if (project.video) {
    return (
      <video
        data-work-media
        className="work__media"
        src={project.video}
        poster={project.art}
        muted
        loop
        playsInline
        preload="none"
      />
    )
  }
  if (project.art) {
    return (
      <img
        data-work-media
        className="work__media"
        src={project.art}
        alt=""
        loading="lazy"
        decoding="async"
      />
    )
  }
  const [lead, ...rest] = project.metrics
  return (
    <div className="work__media work__stat" aria-hidden="true">
      <span className="work__stat-bar mono">
        <span>{project.code}</span>
        <span>{project.org}</span>
      </span>
      <span className="work__stat-lead">{lead}</span>
      {rest.length ? <span className="work__stat-sub mono">{rest.join('  ·  ')}</span> : null}
    </div>
  )
}

/** What the stage hands the detail panel, while the stage is up. */
type Stage = {
  scene: RibbonScene
  pinEl: HTMLDivElement
  corners: HTMLElement[]
}

export default function ProjectsStrip() {
  const root = useRef<HTMLElement>(null)
  const pin = useRef<HTMLDivElement>(null)
  const ribbon = useRef<HTMLDivElement>(null)
  const count = useRef<HTMLElement>(null)
  const caption = useRef<HTMLDivElement>(null)
  const hint = useRef<HTMLDivElement>(null)

  // ------------------------------------------------------- the opened project
  // One panel at a time: `busy` holds from the click until the panel has
  // returned to its screen, so a second click cannot open a second one.
  const stage = useRef<Stage | null>(null)
  const busy = useRef(false)
  // where the hand last was, viewport px: the panel covers the stage while it
  // is open, so this is how the ribbon knows what is under the hand on return
  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  const [detail, setDetail] = useState<{ project: Sleeve; origin: DetailOrigin } | null>(null)

  const openProject = useCallback((index: number, fallback: HTMLElement | null) => {
    if (busy.current) return
    const st = stage.current
    let origin: DetailOrigin | null = null
    if (st) {
      // The ribbon's own card is what opens: the scene flies that surface,
      // tipped and lifted as the hand left it, to the panel's frame, and the
      // panel's timeline drives the flight so the two cannot drift apart. The
      // ribbon itself -- its scroll, its place, its cloth -- is not touched.
      const r = st.pinEl.getBoundingClientRect()
      const c = st.scene.cardRect(index)
      origin = {
        x: r.left + c.x,
        y: r.top + c.y,
        width: c.width,
        height: c.height,
        radius: c.radius,
        flight: {
          veil: RibbonScene.veilCss(),
          frame: (R, paper) => {
            const p = st.pinEl.getBoundingClientRect()
            st.scene.lift(p.top)
            st.scene.openFrame(R.left - p.left, R.top - p.top, R.width, R.height, paper)
          },
          progress: (p, veil) => {
            st.scene.openProgress = p
            st.scene.openVeil = veil
          },
        },
      }
      // The opening is the page's, not the section's: the canvas is lifted
      // out to cover the viewport -- over the page's own veil, under the
      // panel -- so the card can fly wherever the panel is even when the
      // section is only part way on screen. It still draws the ribbon exactly
      // where the section is; the page scroll and the pin are not touched.
      const cv = st.scene.canvas
      Object.assign(cv.style, { position: 'fixed', left: `${r.left}px`, top: '0px', zIndex: '59', pointerEvents: 'none' })
      document.body.appendChild(cv)
      st.scene.lift(r.top)
      st.scene.open(index)
      st.pinEl.style.cursor = ''
      gsap.to(st.corners, { autoAlpha: 0, duration: 0.35, ease: 'power2.out' })
    } else if (fallback) {
      // from the card in the stacked column
      const r = (fallback.querySelector('.work__screen') ?? fallback).getBoundingClientRect()
      origin = { x: r.left, y: r.top, width: r.width, height: r.height, radius: 14 }
    }
    if (!origin) return
    busy.current = true
    window.__lenis?.stop()
    // touch scrolls the window natively under Lenis; hold it while the sheet is up
    if (window.matchMedia('(hover: none)').matches) document.documentElement.style.overflow = 'hidden'
    setDetail({ project: PROJECTS[index], origin })
  }, [])

  const onCloseStart = useCallback(() => {
    const st = stage.current
    if (!st) return
    gsap.to(st.corners, { autoAlpha: 1, duration: 0.5, delay: 0.45, ease: 'power2.out' })
  }, [])

  const onClosed = useCallback(() => {
    const st = stage.current
    if (st) {
      // the card is back in its place; the hand takes the stage again from
      // wherever it is now, so the card under it (if any) picks up at once
      st.scene.closed()
      // back into its section, drawn in place again
      const cv = st.scene.canvas
      cv.style.removeProperty('position')
      cv.style.removeProperty('left')
      cv.style.removeProperty('top')
      cv.style.removeProperty('z-index')
      cv.style.removeProperty('pointer-events')
      st.pinEl.prepend(cv)
      st.scene.lift(null)
      const r = st.pinEl.getBoundingClientRect()
      const at = lastPointer.current
      if (at && at.x >= r.left && at.x <= r.right && at.y >= r.top && at.y <= r.bottom) {
        st.scene.hold(at.x - r.left, at.y - r.top)
        st.pinEl.style.cursor = 'grab'
      } else {
        st.scene.hold(null)
      }
    }
    setDetail(null)
    document.documentElement.style.overflow = ''
    window.__lenis?.start()
    busy.current = false
  }, [])

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      // ------------------------------------------------------------ the stage
      mm.add(STAGE_MEDIA, () => {
        const pinEl = pin.current
        const ribbonEl = ribbon.current
        const rootEl = root.current
        if (!pinEl || !ribbonEl || !rootEl) return

        const cards = gsap.utils.toArray<HTMLElement>('[data-work-card]', ribbonEl)
        if (!cards.length) return

        const ground = getComputedStyle(rootEl).backgroundColor
        const scene = new RibbonScene(PROJECTS, ground)
        if (!scene.supported) {
          // no WebGL: the stacked column is the page
          rootEl.setAttribute('data-flat', '')
          return () => rootEl.removeAttribute('data-flat')
        }
        scene.canvas.className = 'work__gl'
        pinEl.prepend(scene.canvas)
        rootEl.setAttribute('data-stage', '')
        stage.current = { scene, pinEl, corners: gsap.utils.toArray<HTMLElement>('.work__corner', pinEl) }
        if (import.meta.env.DEV) (window as unknown as { __ribbon?: RibbonScene }).__ribbon = scene

        // speed is smoothed on its own so the sheet eases into and out of its
        // deformation instead of twitching with every wheel notch
        const motion = { v: 0 }
        const pushV = gsap.quickTo(motion, 'v', { duration: 0.55, ease: 'power3.out' })
        let current = -1

        const measure = () => {
          scene.resize(pinEl.clientWidth, pinEl.clientHeight)
        }
        measure()

        // gsap.ticker hands over the frame's delta in ms; the cursor's physics
        // is dt-shaped so a 120Hz frame and a dropped one leave the same cloth
        const render = (_time?: number, deltaMs = 16.7) => {
          scene.velocity = Math.min(1, Math.abs(motion.v))
          scene.render(Math.min(deltaMs, 50) / 1000)
          if (scene.nearest !== current) {
            current = scene.nearest
            cards.forEach((el, i) => el.toggleAttribute('data-active', i === current))
            if (count.current) count.current.textContent = pad2(current + 1)
            if (caption.current) caption.current.textContent = cards[current].dataset.workCaption ?? ''
          }
        }

        // Where the ribbon is: one number, in loops of the strip. The scroll
        // sets one part of it -- one full loop per pinned range, linear in px
        // so the hand never feels ahead of or behind the screens -- and the
        // hand sets the other, by dragging and throwing. Neither writes to the
        // other, so they cannot fight; the scene draws their sum, and since it
        // draws the strip modulo one loop, the sum can run on for ever in
        // either direction without a seam.
        const place = { scroll: 0, hand: 0 }
        const apply = () => {
          scene.progress = place.scroll + place.hand
        }

        const trigger = ScrollTrigger.create({
          trigger: pinEl,
          pin: true,
          start: 'top top',
          end: () => `+=${Math.round(scene.loopPx() * SCROLL_RATE)}`,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: (self) => {
            measure()
            place.scroll = self.progress
            apply()
            render()
          },
          onUpdate: (self) => {
            place.scroll = self.progress
            apply()
            const t = Math.tanh(self.getVelocity() / VEL_NORM)
            pushV(t * Math.abs(t))
            if (hint.current) hint.current.style.opacity = self.progress > 0.02 ? '0' : ''
          },
        })
        // The scene renders on the ticker whenever any of it is on screen --
        // not only while pinned: the sheet keeps relaxing after the scroll
        // stops, and the cursor has to work when the page has landed exactly
        // on the pin's first pixel, which is where the hero's Enter puts it.
        const visible = ScrollTrigger.create({
          trigger: rootEl,
          start: 'top bottom',
          end: 'bottom top',
          onToggle: (self) => {
            if (self.isActive) gsap.ticker.add(render)
            else gsap.ticker.remove(render)
          },
        })
        // ScrollTrigger only reports velocity while moving; the settle is its own event
        const settle = () => pushV(0)
        ScrollTrigger.addEventListener('scrollEnd', settle)

        // ------------------------------------------------------------ the hand
        // The hand grabs the strip itself: a drag moves it with the finger,
        // one ribbon px per screen px, and a release keeps the hand's speed
        // and lets it die away. It moves the hand's share of the ribbon's
        // place, never the page, so it has no ends to meet: past the last
        // screen comes the first again. The sheet bends with the hand's speed
        // as it does with the wheel's.
        const drag = { on: false, moved: false, downX: 0, lastX: 0, lastT: 0, v: 0 }
        /** ribbon px/s to the wheel's scroll px/s, for the sheet's speed */
        const bend = (pxPerS: number) => {
          const t = Math.tanh((pxPerS * SCROLL_RATE) / VEL_NORM)
          pushV(t * Math.abs(t))
        }
        /** move the hand's share by ribbon px; kept within one loop, which draws the same */
        const nudge = (px: number) => {
          place.hand -= px / Math.max(1, scene.loopPx())
          place.hand -= Math.floor(place.hand)
          apply()
        }
        const fling = (_t: number, deltaMs: number) => {
          const dt = Math.min(deltaMs, 50) / 1000
          nudge(drag.v * dt)
          drag.v *= Math.exp(-dt / FLING_FRICTION_S)
          bend(drag.v)
          if (Math.abs(drag.v) < FLING_STOP) {
            drag.v = 0
            gsap.ticker.remove(fling)
            pushV(0)
          }
        }
        const stopFling = () => {
          drag.v = 0
          gsap.ticker.remove(fling)
        }
        const onDown = (e: PointerEvent) => {
          if (e.button !== 0 || (e.target as HTMLElement).closest('a, button')) return
          stopFling()
          drag.on = true
          drag.moved = false
          drag.downX = drag.lastX = e.clientX
          drag.lastT = e.timeStamp
          pinEl.setPointerCapture(e.pointerId)
          pinEl.style.cursor = 'grabbing'
          scene.press(true)
        }
        // the hand stirs the surface over the stage whether or not it is dragging
        const onMove = (e: PointerEvent) => {
          const r = pinEl.getBoundingClientRect()
          scene.stir(e.clientX - r.left, e.clientY - r.top)
          scene.hold(e.clientX - r.left, e.clientY - r.top)
          if (!drag.on) {
            pinEl.style.cursor = 'grab'
            return
          }
          const dx = e.clientX - drag.lastX
          const dt = Math.max(1, e.timeStamp - drag.lastT) / 1000
          drag.lastX = e.clientX
          drag.lastT = e.timeStamp
          if (Math.abs(e.clientX - drag.downX) > 6) drag.moved = true
          // the strip follows the finger
          nudge(dx)
          // speed, smoothed: what a release will keep, in ribbon px/s
          drag.v = drag.v * 0.5 + (dx / dt) * 0.5
          drag.v = Math.max(-FLING_MAX, Math.min(FLING_MAX, drag.v))
          bend(drag.v)
        }
        const onUp = (e: PointerEvent) => {
          scene.press(false)
          if (!drag.on) return
          drag.on = false
          if (pinEl.hasPointerCapture(e.pointerId)) pinEl.releasePointerCapture(e.pointerId)
          pinEl.style.cursor = 'grab'
          // a hand that paused before letting go throws nothing
          if (e.timeStamp - drag.lastT > 90) drag.v = 0
          if (Math.abs(drag.v) > FLING_STOP) gsap.ticker.add(fling)
          else pushV(0)
        }
        const onLeave = () => {
          scene.stir(null)
          scene.hold(null)
          if (!drag.on) pinEl.style.cursor = ''
        }
        // a click -- a press that did not drag -- on a screen opens the project
        const onClick = (e: MouseEvent) => {
          if (drag.moved) {
            drag.moved = false
            return
          }
          if ((e.target as HTMLElement).closest('a, button')) return
          const r = pinEl.getBoundingClientRect()
          const { index } = scene.hit(e.clientX - r.left, e.clientY - r.top)
          if (index < 0) return
          openProject(index, null)
        }
        const track = (e: PointerEvent) => {
          lastPointer.current = { x: e.clientX, y: e.clientY }
        }
        window.addEventListener('pointermove', track, { passive: true })
        pinEl.addEventListener('pointerdown', onDown)
        pinEl.addEventListener('pointermove', onMove)
        pinEl.addEventListener('pointerup', onUp)
        pinEl.addEventListener('pointercancel', onUp)
        pinEl.addEventListener('pointerleave', onLeave)
        pinEl.addEventListener('click', onClick)
        // the wheel takes over from a throw
        pinEl.addEventListener('wheel', stopFling, { passive: true })

        const ro = new ResizeObserver(() => {
          measure()
          ScrollTrigger.refresh()
        })
        ro.observe(pinEl)

        render()

        return () => {
          stage.current = null
          gsap.ticker.remove(render)
          ScrollTrigger.removeEventListener('scrollEnd', settle)
          trigger.kill()
          visible.kill()
          ro.disconnect()
          stopFling()
          window.removeEventListener('pointermove', track)
          pinEl.removeEventListener('pointerdown', onDown)
          pinEl.removeEventListener('pointermove', onMove)
          pinEl.removeEventListener('pointerup', onUp)
          pinEl.removeEventListener('pointercancel', onUp)
          pinEl.removeEventListener('pointerleave', onLeave)
          pinEl.removeEventListener('click', onClick)
          pinEl.removeEventListener('wheel', stopFling)
          pinEl.style.cursor = ''
          scene.canvas.remove()
          scene.dispose()
          rootEl.removeAttribute('data-stage')
          cards.forEach((el) => el.removeAttribute('data-active'))
        }
      })

      // ------------------------------------------------------- stacked column
      mm.add('(max-width: 899px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.utils.toArray<HTMLElement>('[data-work-card]').forEach((card) => {
          gsap.from(card, {
            y: 30,
            autoAlpha: 0,
            duration: 0.9,
            ease: 'expo.out',
            scrollTrigger: { trigger: card, start: 'top 88%' },
          })

          const video = card.querySelector<HTMLVideoElement>('video[data-work-media]')
          if (video) {
            ScrollTrigger.create({
              trigger: card,
              start: 'top 80%',
              end: 'bottom 20%',
              onToggle: (self) => {
                if (self.isActive) void video.play().catch(() => {})
                else video.pause()
              },
            })
          }
        })
      })
    },
    { scope: root, dependencies: [openProject] },
  )

  const total = pad2(PROJECTS.length)

  return (
    <section className="work" id="projects" ref={root} aria-labelledby="work-heading">
      <h2 className="sr-only" id="work-heading">
        Projects
      </h2>

      <div className="work__pin" ref={pin}>
        <div className="work__ribbon" ref={ribbon}>
          {PROJECTS.map((p, i) => (
            <article
              key={p.code}
              className="work__card"
              data-work-card
              data-work-caption={`${p.org} — ${p.metrics[0]}`}
            >
              <div className="work__screen">
                <Screen project={p} />
              </div>

              <h3 className="work__title">
                <button
                  className="work__open"
                  type="button"
                  onClick={(e) => openProject(i, e.currentTarget.closest('article'))}
                >
                  {p.title}
                </button>
              </h3>

              {p.repo ? (
                <a
                  className="work__go"
                  href={p.repo}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${p.title} — repository`}
                >
                  <span aria-hidden="true">&rarr;</span>
                </a>
              ) : null}
            </article>
          ))}
        </div>

        {/* the four corners: all the UI there is */}
        <div className="work__corner work__corner--tl mono">Selected work</div>
        <div className="work__corner work__corner--tr mono">
          <b ref={count}>01</b>
          <i> / </i>
          {total}
        </div>
        <div className="work__corner work__corner--bl mono" ref={caption}>
          {`${PROJECTS[0]?.org ?? ''} — ${PROJECTS[0]?.metrics[0] ?? ''}`}
        </div>
        <div className="work__corner work__corner--br mono" ref={hint} aria-hidden="true">
          Scroll
        </div>
      </div>

      {detail ? (
        <ProjectDetail
          key={detail.project.code}
          project={detail.project}
          origin={detail.origin}
          onCloseStart={onCloseStart}
          onClosed={onClosed}
        />
      ) : null}
    </section>
  )
}
