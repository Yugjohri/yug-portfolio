import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSmoothScroll } from '../lib/useSmoothScroll'
import { isLight } from '../theme'
import { routeTransition, whenSettled } from '../motion/routeTransition.ts'
import { NOTES, ROLES, SLEEVES, type Sleeve } from '../data/portfolio'
// The Brief's ground: the wallpaper clip, referenced where it lives (../my
// brief backgrounds, beside the app) rather than copied in.
import briefWallpaper from '../../../my brief backgrounds/my brief background 1.mp4'
import {
  ABOUT_CLOSER,
  ABOUT_HEADING,
  ABOUT_PARAS,
  BRIEF,
  HIGHLIGHTS,
  LINKS,
  PILLARS,
  SKILLS,
} from '../data/brief'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/** Small glyphs on the secondary links, as in the reference. */
const GLYPH = {
  mail: 'M2 4.2h12v7.6H2V4.2Zm1.3 1L8 8.5l4.7-3.3',
  linkedin: 'M2.4 2.4h11.2v11.2H2.4V2.4Zm2 4.3h1.7v5H4.4v-5Zm.85-2.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM7.4 6.7H9v.7c.25-.45.85-.8 1.6-.8 1.25 0 1.9.8 1.9 2.2v2.9h-1.7V9.1c0-.65-.25-1-.8-1s-.9.4-.9 1.05v2.55H7.4v-5Z',
  github: 'M8 1.6a6.4 6.4 0 0 0-2 12.5c.3.05.42-.14.42-.3v-1.1c-1.75.38-2.12-.85-2.12-.85-.29-.73-.7-.92-.7-.92-.57-.39.05-.38.05-.38.63.05.96.65.96.65.56.96 1.47.68 1.83.52.06-.4.22-.68.4-.84-1.4-.16-2.87-.7-2.87-3.11 0-.69.25-1.25.65-1.69-.07-.16-.28-.8.06-1.67 0 0 .53-.17 1.73.64a6 6 0 0 1 3.15 0c1.2-.81 1.73-.64 1.73-.64.34.87.13 1.51.06 1.67.4.44.65 1 .65 1.69 0 2.42-1.47 2.95-2.88 3.1.23.2.43.58.43 1.17v1.73c0 .17.11.36.42.3A6.4 6.4 0 0 0 8 1.6Z',
}

function Glyph({ d }: { d: string }) {
  return (
    <svg className="bf-glyph" viewBox="0 0 16 16" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/** The page's sections, in order: the rail, the top row and the inline nav all read from this. */
const SECTIONS = [
  { id: 'about', label: 'About', d: 'M10 10a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 10 10Zm0 1.8c-3.4 0-6.2 1.9-6.2 4.2V17h12.4v-1c0-2.3-2.8-4.2-6.2-4.2Z' },
  { id: 'projects', label: 'Projects', d: 'M3.5 3.5h6v6h-6v-6Zm7 0h6v6h-6v-6Zm-7 7h6v6h-6v-6Zm7 0h6v6h-6v-6Z' },
  { id: 'experience', label: 'Experience', d: 'M7.5 4.5V3.6c0-.6.5-1.1 1.1-1.1h2.8c.6 0 1.1.5 1.1 1.1v.9h3.4c.6 0 1.1.5 1.1 1.1v10c0 .6-.5 1.1-1.1 1.1H4.1c-.6 0-1.1-.5-1.1-1.1v-10c0-.6.5-1.1 1.1-1.1h3.4Zm1.6 0h1.8v-.4H9.1v.4Z' },
  { id: 'skills', label: 'Stack', d: 'M7.6 5.2 3.4 10l4.2 4.8 1.2-1.1L5.4 10l3.4-3.7-1.2-1.1Zm4.8 0-1.2 1.1L14.6 10l-3.4 3.7 1.2 1.1L16.6 10l-4.2-4.8Z' },
  { id: 'notes', label: 'Notes', d: 'M4 15.2 4.9 12l7.6-7.6 2.3 2.3L7.2 14.3 4 15.2Zm9.4-11.7 1.4-1.4 2.3 2.3-1.4 1.4-2.3-2.3Z' },
  { id: 'contact', label: 'Contact', d: 'M3 5.5h14v9H3v-9Zm1.6 1.2L10 10.4l5.4-3.7' },
]

/** Mono label with a rule running to the right, as on every section. */
function SectionLabel({ children, id }: { children: string; id?: string }) {
  return (
    <div className="bf-seclabel" id={id}>
      <span>{children}</span>
      <i />
    </div>
  )
}

/** The dithered band the reference lays between its sections. Drawn as type
 *  so it costs nothing; it drifts slowly, on GSAP, only while in view. */
const DITHER = '░▒▓█▓▒░ '.repeat(48)
function Divider() {
  return (
    <div className="bf-divider" aria-hidden="true" data-divider>
      <span data-divider-run>{DITHER}</span>
    </div>
  )
}

/** A project tile: the stat plate the ribbon draws, here in CSS, with the name
 *  set large along the bottom and a panel that reads on hover, as the reference's. */
function ProjectTile({ project, index }: { project: Sleeve; index: number }) {
  const [lead, ...rest] = project.metrics
  const summary = project.body.split(/(?<=\.)\s/)[0]
  return (
    <article className="bf-tile" data-tile style={{ '--i': index } as React.CSSProperties}>
      <div className="bf-tile__plate" aria-hidden="true">
        <span className="bf-tile__bar mono">
          <span>{project.code}</span>
          <span>{project.org}</span>
        </span>
        <span className="bf-tile__lead">{lead}</span>
        {rest[0] ? <span className="bf-tile__sub mono">{rest.join('  ·  ')}</span> : null}
      </div>

      <div className="bf-tile__name">
        <h3>{project.capLines[0]}</h3>
        <span className="mono">Hover to read</span>
      </div>

      <div className="bf-tile__read">
        <h3 className="mono">
          {project.title} <span aria-hidden="true">→</span>
        </h3>
        <p>{summary}</p>
        <p className="mono bf-tile__metrics">{project.metrics.join(' · ')}</p>
        <div className="bf-tags">
          {project.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="bf-tile__links mono">
          {project.repo ? (
            <a href={project.repo} target="_blank" rel="noreferrer">
              GitHub <span aria-hidden="true">↗</span>
            </a>
          ) : null}
          <Link to="/story">
            In the story <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  )
}

/** A grid of tiles that brings itself in: with the scroll for the featured
 *  three, at once for the ones "view all" adds -- so opening more never
 *  replays anything else on the page. */
function TileGrid({ items, onScroll }: { items: Sleeve[]; onScroll: boolean }) {
  const grid = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.from('[data-tile]', {
        y: 22,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'expo.out',
        scrollTrigger: onScroll ? { trigger: grid.current, start: 'top 92%' } : undefined,
      })
    },
    { scope: grid },
  )
  return (
    <div className={`bf-tiles${onScroll ? '' : ' bf-tiles--more'}`} ref={grid}>
      {items.map((s, i) => (
        <ProjectTile project={s} index={i} key={s.code} />
      ))}
    </div>
  )
}

export default function BriefRead() {
  const root = useRef<HTMLElement>(null)
  const grain = useRef<HTMLCanvasElement>(null)
  const [showAll, setShowAll] = useState(false)

  useSmoothScroll()

  // ------------------------------------------------------------- the grain
  // The reference's ground moves: a fine dither that never sits still. A small
  // noise tile is redrawn a few times a second and laid over the page as a
  // pattern -- cheap, and it reads as film rather than as an overlay.
  useEffect(() => {
    const canvas = grain.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const TILE = 160
    const tile = document.createElement('canvas')
    tile.width = TILE
    tile.height = TILE
    const tctx = tile.getContext('2d')
    if (!tctx) return
    const img = tctx.createImageData(TILE, TILE)
    const px = new Uint32Array(img.data.buffer)
    // light grains lift a dark ground; on paper the grain is ink
    const grainRgb = isLight() ? 0x000000 : 0xffffff

    const size = () => {
      canvas.width = Math.ceil(window.innerWidth / 2)
      canvas.height = Math.ceil(window.innerHeight / 2)
    }
    const stamp = () => {
      for (let i = 0; i < px.length; i++) {
        // grey noise, mostly dark, a few bright grains: alpha carries the value
        const v = Math.random()
        const a = v > 0.82 ? 200 : v > 0.5 ? 90 : 30
        px[i] = (a << 24) | grainRgb
      }
      tctx.putImageData(img, 0, 0)
      const pattern = ctx.createPattern(tile, 'repeat')
      if (!pattern) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    size()
    stamp()
    if (reduced) return

    // every fourth frame: ~15fps is how the reference's grain reads, and it
    // keeps the page's other work unbothered
    let n = 0
    const tick = () => {
      if (++n % 4) return
      stamp()
    }
    gsap.ticker.add(tick)
    const onResize = () => {
      size()
      stamp()
    }
    window.addEventListener('resize', onResize)
    return () => {
      gsap.ticker.remove(tick)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // ------------------------------------------------------------- the motion
  useGSAP(
    () => {
      // arrived by Glyph Drain: the band is still on screen, over a cover
      const arrival = routeTransition.consume('brief')
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (arrival) routeTransition.end()
        return
      }

      // the entrance, which waits for the band when there is one
      const entrance = gsap
        .timeline({ defaults: { ease: 'expo.out', duration: 1 }, paused: !!arrival })
        .from('[data-rise]', { y: 26, autoAlpha: 0, stagger: 0.07 }, 0.15)
        .from('[data-portrait]', { y: 34, autoAlpha: 0, duration: 1.2 }, 0.3)
        .from('[data-pillar]', { y: 20, autoAlpha: 0, stagger: 0.08 }, 0.6)

      // The band sweeps down and the page opens from its line; the entrance
      // starts once 40% of the screen is open, and the name takes focus at the end.
      const sweep = arrival
        ? routeTransition.briefIn({
            divider: root.current?.querySelector<HTMLElement>('[data-divider]') ?? null,
            onOpen: () => entrance.play(),
            onDone: () => {
              const name = root.current?.querySelector<HTMLElement>('.bf-name')
              if (name) {
                name.tabIndex = -1
                name.focus({ preventScroll: true })
              }
              routeTransition.end()
            },
          })
        : null
      const cancel = sweep ? whenSettled(() => sweep.play()) : null

      // everything below the fold arrives as it comes into frame
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          y: 28,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'expo.out',
          // 99% rather than 88%: About is deliberately left peeking at the
          // fold, and an 88% trigger would keep that sliver invisible
          scrollTrigger: { trigger: el, start: 'top 99%' },
        })
      })

      // the dither bands drift, slowly, and only while on screen
      gsap.utils.toArray<HTMLElement>('[data-divider]').forEach((band) => {
        const run = band.querySelector('[data-divider-run]')
        if (!run) return
        const drift = gsap.to(run, { xPercent: -12, duration: 40, ease: 'none', repeat: -1, yoyo: true, paused: true })
        ScrollTrigger.create({
          trigger: band,
          start: 'top bottom',
          end: 'bottom top',
          onToggle: (self) => (self.isActive ? drift.play() : drift.pause()),
        })
      })

      return () => {
        cancel?.()
        sweep?.kill()
      }
    },
    { scope: root },
  )

  const featured = SLEEVES.slice(0, 3)
  const more = SLEEVES.slice(3)

  return (
    <main className="brief" ref={root}>
      <div className="brief__bg" aria-hidden="true">
        <video className="brief__bg-video" src={briefWallpaper} muted loop autoPlay playsInline preload="auto" />
      </div>
      <div className="brief__grid" aria-hidden="true" />
      <canvas className="brief__grain" ref={grain} aria-hidden="true" />

      <nav className="bf-rail" aria-label="Section navigation">
        {SECTIONS.map((r) => (
          <a key={r.id} href={`#${r.id}`} aria-label={r.label}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d={r.d} />
            </svg>
          </a>
        ))}
      </nav>

      <div className="bf-wrap">
        {/* --------------------------------------------------------- top row */}
        <nav className="bf-top mono" aria-label="Page navigation">
          <div className="bf-top__links">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.label}
              </a>
            ))}
          </div>
          <Link className="bf-top__story" to="/story">
            My Story <span aria-hidden="true">→</span>
          </Link>
        </nav>

        {/* The hero block owns the first screen, so About is always left just
            peeking at the fold regardless of how tall the viewport is. */}
        <div className="bf-fold">
          {/* -------------------------------------------------------- hero */}
          <header className="bf-hero">
            <div className="bf-hero__text">
              <div className="bf-eyebrow mono" data-rise>
                {BRIEF.eyebrow.map((e, i) => (
                  <span key={e}>
                    {i > 0 ? <i>·</i> : null}
                    {e}
                  </span>
                ))}
              </div>

              <h1 className="bf-name" data-rise>
                {BRIEF.name}
                <em>.</em>
              </h1>

              <div className="bf-meta mono" data-rise>
                <span>{BRIEF.role}</span>
                <i>/</i>
                <span>{BRIEF.location}</span>
              </div>

              <p className="bf-intro" data-rise>
                <b>{BRIEF.leadIn}</b> {BRIEF.intro}
              </p>

              <div className="bf-actions" data-rise>
                <a className="bf-btn" href="#projects">
                  View projects <span aria-hidden="true">→</span>
                </a>
                <a className="bf-link mono" href={`mailto:${LINKS.email}`}>
                  <Glyph d={GLYPH.mail} />
                  Email <span aria-hidden="true">↗</span>
                </a>
                <a className="bf-link mono" href={LINKS.linkedin} target="_blank" rel="noreferrer">
                  <Glyph d={GLYPH.linkedin} />
                  LinkedIn <span aria-hidden="true">↗</span>
                </a>
                <a className="bf-link mono" href={LINKS.github} target="_blank" rel="noreferrer">
                  <Glyph d={GLYPH.github} />
                  GitHub <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>

            <div className="bf-portrait" data-portrait>
              <img src="/portrait.webp" alt="Yug Johri" />
              <i className="bf-portrait__tick" aria-hidden="true" />
            </div>
          </header>

          <div className="bf-pillars">
            {PILLARS.map((p) => (
              <div className="bf-pillar" key={p.label} data-pillar>
                <span className="mono">{p.label}</span>
                <p>{p.text}</p>
              </div>
            ))}
          </div>

          <nav className="bf-inline mono" aria-label="Jump to section">
            <a href="#projects">Projects</a>
            <i />
            <a href="#notes">Notes</a>
            <i />
            <a href="#about">About</a>
          </nav>
        </div>

        {/* ------------------------------------------------------- about */}
        <section className="bf-section" data-reveal>
          <SectionLabel id="about">About</SectionLabel>
          <div className="bf-about">
            <div className="bf-about__copy">
              <h2>{ABOUT_HEADING}</h2>
              {ABOUT_PARAS.map((p) => (
                <p key={p.slice(0, 20)}>{p}</p>
              ))}
              <p className="bf-closer">{ABOUT_CLOSER}</p>
            </div>

            <aside className="bf-card bf-highlights">
              <div className="bf-card__head mono">Highlights</div>
              {HIGHLIGHTS.map((h) => (
                <div className="bf-highlight" key={h.label}>
                  <span className="mono">{h.label}</span>
                  <p>{h.value}</p>
                </div>
              ))}
            </aside>
          </div>
        </section>

        <Divider />

        {/* ---------------------------------------------------- projects */}
        <section className="bf-section" data-reveal>
          <SectionLabel id="projects">Projects</SectionLabel>
          <p className="bf-lede">
            Systems built where failure is expensive — a defence-lab platform on an
            air-gapped network, retrieval that cites its sources, a fine-tune that fits on
            one GPU.
          </p>

          <TileGrid items={featured} onScroll />
          {showAll ? <TileGrid items={more} onScroll={false} /> : null}

          <div className="bf-actions bf-actions--row">
            {more.length ? (
              <button
                type="button"
                className="bf-btn"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
              >
                {showAll ? 'Show fewer' : `View all (${SLEEVES.length})`}{' '}
                <span aria-hidden="true">{showAll ? '↑' : '↓'}</span>
              </button>
            ) : null}
            <Link className="bf-link mono" to="/story">
              Open the story <span aria-hidden="true">→</span>
            </Link>
            <a className="bf-link mono" href={LINKS.github} target="_blank" rel="noreferrer">
              GitHub <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <Divider />

        {/* -------------------------------------------------- experience */}
        <section className="bf-section" data-reveal>
          <SectionLabel id="experience">Experience</SectionLabel>

          <ol className="bf-timeline">
            {ROLES.map((r) => (
              <li className="bf-role" key={r.org} data-now={r.current ? '' : undefined}>
                <i className="bf-role__dot" aria-hidden="true" />
                <div className="bf-role__head">
                  <h3>
                    {r.title.split(' · ')[0]} <em>· {r.org}</em>
                    {r.current ? <b className="mono">now</b> : null}
                  </h3>
                  <span className="mono">{r.period}</span>
                </div>
                <p className="bf-role__where mono">{r.title.split(' · ')[1]}</p>
                <ul className="bf-role__bullets">
                  {r.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <div className="bf-tags">
                  {r.stack.split(' · ').map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <Divider />

        {/* ------------------------------------------------------ skills */}
        <section className="bf-section" data-reveal>
          <SectionLabel id="skills">Tech stack</SectionLabel>
          <div className="bf-skills">
            {SKILLS.map((g) => (
              <div className="bf-skillrow" key={g.group}>
                <span className="mono">{g.group}</span>
                <div className="bf-chips">
                  {g.items.map((i) => (
                    <span key={i}>{i}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <Divider />

        {/* ------------------------------------------------------- notes */}
        <section className="bf-section" data-reveal>
          <SectionLabel id="notes">Notes</SectionLabel>
          <p className="bf-lede">
            Working notes — what is on the bench right now, before it is finished enough
            to be a project.
          </p>
          <ol className="bf-notes">
            {NOTES.map((n) => (
              <li className="bf-note" key={n.n}>
                <span className="mono">{n.n}</span>
                <p>{n.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <Divider />

        {/* ----------------------------------------------------- contact */}
        <section className="bf-section bf-section--last" data-reveal>
          <SectionLabel id="contact">Contact</SectionLabel>
          <div className="bf-contact">
            <div className="bf-contact__copy">
              <h2 className="bf-contact__title">
                Let&rsquo;s work
                <br />
                together<em>.</em>
              </h2>
              <p className="bf-lede">
                Open to AI engineering roles from October 2026 — retrieval, agents and
                fine-tuned models that have to hold up in production. Bring me something
                that has to work.
              </p>
              <dl className="bf-facts mono">
                <div>
                  <dt>Based in</dt>
                  <dd>{BRIEF.location}</dd>
                </div>
                <div>
                  <dt>Timezone</dt>
                  <dd>
                    <i aria-hidden="true" /> IST · UTC+5:30
                  </dd>
                </div>
              </dl>
              <a className="bf-btn" href={`mailto:${LINKS.email}`}>
                Email me <span aria-hidden="true">→</span>
              </a>
            </div>

            <aside className="bf-card bf-channels">
              <div className="bf-card__head mono">Channels</div>
              <a className="bf-channel" href={`mailto:${LINKS.email}`}>
                <span className="mono">Email</span>
                <span>
                  {LINKS.email} <i aria-hidden="true">→</i>
                </span>
              </a>
              <a className="bf-channel" href={LINKS.github} target="_blank" rel="noreferrer">
                <span className="mono">GitHub</span>
                <span>
                  {LINKS.github.replace('https://', '')} <i aria-hidden="true">↗</i>
                </span>
              </a>
              <a className="bf-channel" href={LINKS.linkedin} target="_blank" rel="noreferrer">
                <span className="mono">LinkedIn</span>
                <span>
                  in/yugjohri <i aria-hidden="true">↗</i>
                </span>
              </a>
              <a className="bf-channel" href={`tel:${LINKS.phone.replace(/\s/g, '')}`}>
                <span className="mono">Phone</span>
                <span>
                  {LINKS.phone} <i aria-hidden="true">→</i>
                </span>
              </a>
              <Link className="bf-channel" to="/story">
                <span className="mono">My Story</span>
                <span>
                  An immersive tour <i aria-hidden="true">→</i>
                </span>
              </Link>
              <Link className="bf-channel" to="/">
                <span className="mono">Home</span>
                <span>
                  Back to the split <i aria-hidden="true">←</i>
                </span>
              </Link>
            </aside>
          </div>

          <div className="bf-foot mono">
            <span>Yug Johri — AI &amp; full-stack engineer</span>
            <span>Delhi, India</span>
            <span>© 2026</span>
          </div>
        </section>
      </div>
    </main>
  )
}
