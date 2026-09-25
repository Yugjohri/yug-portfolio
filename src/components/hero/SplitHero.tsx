import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { HeroSource } from './heroSource'
import { AsciiRenderer } from './asciiRenderer'
import { grade } from '../../theme'

gsap.registerPlugin(useGSAP, ScrollTrigger)

type PanelKey = 'brief' | 'story'

const PANELS: { key: PanelKey; name: string; descriptor: string; href: string }[] = [
  {
    key: 'brief',
    name: 'Brief Read',
    descriptor: 'the short version. one page, no warm-up.',
    href: '/brief',
  },
  {
    key: 'story',
    name: 'My Story',
    descriptor: 'the long version. how i actually think.',
    href: '/story',
  },
]

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Hand off to Lenis when the page has it, so the scroll matches the rest of the site. */
function scrollTo(href: string) {
  const target = document.querySelector<HTMLElement>(href)
  if (!target) return
  if (window.__lenis) window.__lenis.scrollTo(target)
  else target.scrollIntoView({ behavior: 'smooth' })
}

type SplitHeroProps = {
  /**
   * Optional looping video. When set it replaces the procedural black hole as
   * the source — both panels still read the one canvas, so they stay locked.
   */
  videoSrc?: string
}

export default function SplitHero({ videoSrc }: SplitHeroProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const colorRef = useRef<HTMLDivElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const panelEls = useRef<Partial<Record<PanelKey, HTMLAnchorElement | null>>>({})
  const busy = useRef(false)

  const [hovered, setHovered] = useState<PanelKey | null>(null)
  const [unsupported, setUnsupported] = useState(false)

  // ---------------------------------------------------------------- rendering
  useEffect(() => {
    const pre = preRef.current
    const host = colorRef.current
    const root = rootRef.current
    if (!pre || !host || !root) return

    const source = new HeroSource({ videoSrc, grade: grade() })
    if (!source.supported) {
      setUnsupported(true)
      source.dispose()
      return
    }

    source.canvas.className = 'hero__canvas'
    host.appendChild(source.canvas)
    const ascii = new AsciiRenderer(pre)

    // Each panel keeps its own cursor state. They share the source and the
    // clock, never the pointer — so only the panel under the cursor reacts.
    const blank = () => ({ x: 0, y: 0, amt: 0 })
    const target = { brief: blank(), story: blank() }
    const current = { brief: blank(), story: blank() }

    type P = { x: number; y: number; amt: number }
    const ease = (c: P, t: P) => {
      c.x += (t.x - c.x) * 0.07
      c.y += (t.y - c.y) * 0.07
      c.amt += (t.amt - c.amt) * 0.06
    }

    const reduced = prefersReducedMotion()
    let visible = true
    let raf = 0

    const measure = () => {
      const left = pre.parentElement?.getBoundingClientRect()
      const right = host.getBoundingClientRect()
      if (right.width > 0) source.resize(right.width, right.height)
      if (left && left.width > 0) ascii.layout(left.width, left.height)
      if (reduced) {
        const { width: aw, height: ah } = source.asciiPass
        source.render(0, 0, 0, 0, aw, ah, 'lit')
        ascii.draw(source.canvas, 0, source.canvas.height - ah, aw, ah)
        source.render(0, 0, 0, 0)
      }
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible) return

      // ease each cursor so its distortion trails it instead of snapping
      ease(current.brief, target.brief)
      ease(current.story, target.story)

      const time = now / 1000
      const { width: aw, height: ah } = source.asciiPass

      // Two passes, one clock. Identical `time` means both panels always show
      // the same moment of the same source; only the warp differs. The ASCII
      // pass runs first, at reduced size, and is read back immediately...
      source.render(time, current.brief.x, current.brief.y, current.brief.amt, aw, ah, 'lit')
      ascii.draw(source.canvas, 0, source.canvas.height - ah, aw, ah)

      // ...then the full-size pass overwrites the canvas, which *is* the right
      // panel, so what stays on screen carries only the story cursor.
      source.render(time, current.story.x, current.story.y, current.story.amt)
    }

    const onPointerMove = (event: PointerEvent) => {
      const panel = (event.target as HTMLElement).closest('[data-hero-panel]')
      const key = panel?.getAttribute('data-hero-panel')

      if (key !== 'brief' && key !== 'story') {
        target.brief.amt = 0
        target.story.amt = 0
        return
      }

      const box = (panel as HTMLElement).getBoundingClientRect()
      const m = Math.min(box.width, box.height) || 1
      const t = target[key]
      t.x = (event.clientX - box.left - box.width / 2) / m
      t.y = (box.top + box.height / 2 - event.clientY) / m
      t.amt = 1

      // the panel being left releases, so the interaction hands over smoothly
      target[key === 'brief' ? 'story' : 'brief'].amt = 0
    }

    const onPointerLeave = () => {
      target.brief.amt = 0
      target.story.amt = 0
    }

    measure()
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(root)

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
      },
      { threshold: 0 },
    )
    intersectionObserver.observe(root)

    if (!reduced) {
      root.addEventListener('pointermove', onPointerMove)
      root.addEventListener('pointerleave', onPointerLeave)
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerleave', onPointerLeave)
      source.canvas.remove()
      source.dispose()
    }
  }, [videoSrc])

  // ------------------------------------------------------------------ motion
  // useGSAP scopes the selectors to this component and reverts on unmount.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return

      gsap
        .timeline()
        .from('[data-hero-panel="brief"]', {
          xPercent: -6,
          autoAlpha: 0,
          duration: 0.8,
          ease: 'expo.out',
        })
        .from(
          '[data-hero-panel="story"]',
          { xPercent: 6, autoAlpha: 0, duration: 0.8, ease: 'expo.out' },
          '<',
        )

      // Scrolling away parts the two halves and hands off to the section below.
      // The inner wrapper is animated so this never fights the entrance tween.
      gsap
        .timeline({
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.4,
          },
        })
        .to('[data-hero-panel="brief"] [data-hero-shift]', { xPercent: -12, ease: 'none' }, 0)
        .to('[data-hero-panel="story"] [data-hero-shift]', { xPercent: 12, ease: 'none' }, 0)
        .to('[data-hero-shift]', { opacity: 0.15, scale: 0.96, ease: 'none' }, 0)
    },
    { scope: rootRef },
  )

  // --------------------------------------------------------------- selection
  const navigate = useNavigate()

  // a panel either routes to its own page or scrolls to a section on this one
  const go = useCallback(
    (href: string) => {
      if (href.startsWith('/')) navigate(href)
      else scrollTo(href)
    },
    [navigate],
  )

  const select = useCallback((event: React.MouseEvent, key: PanelKey, href: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    if (busy.current) return

    if (prefersReducedMotion()) {
      go(href)
      return
    }

    busy.current = true
    const chosen = panelEls.current[key]
    const other = panelEls.current[key === 'brief' ? 'story' : 'brief']

    const tl = gsap.timeline({
      onComplete: () => {
        go(href)
        // routing unmounts the hero, so there is nothing left to restore
        if (href.startsWith('/')) return
        // the veil and panels are restored once the page has moved on
        gsap.to([veilRef.current, other, chosen].filter(Boolean), {
          autoAlpha: (i: number) => (i === 0 ? 0 : 1),
          xPercent: 0,
          scale: 1,
          y: 0,
          duration: 0.4,
          delay: 0.35,
          onComplete: () => {
            busy.current = false
          },
        })
      },
    })

    if (other) {
      tl.to(
        other,
        {
          autoAlpha: 0,
          xPercent: key === 'brief' ? 2 : -2,
          duration: 0.3,
          ease: 'power2.in',
        },
        0,
      )
    }
    if (chosen) {
      tl.to(
        chosen,
        key === 'story'
          ? { scale: 1.02, duration: 0.42, ease: 'power2.out' }
          : { y: -8, duration: 0.42, ease: 'power2.out' },
        0,
      )
    }
    if (veilRef.current) {
      tl.to(veilRef.current, { autoAlpha: 1, duration: 0.3, ease: 'power2.inOut' }, 0.14)
    }
  }, [go])

  return (
    <div className="hero" id="top" ref={rootRef}>
      {PANELS.map(({ key, name, descriptor, href }) => (
        <a
          key={key}
          href={href}
          ref={(el) => {
            panelEls.current[key] = el
          }}
          data-hero-panel={key}
          data-dimmed={hovered !== null && hovered !== key ? '' : undefined}
          className="hero__panel"
          onClick={(event) => select(event, key, href)}
          onMouseEnter={() => setHovered(key)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(key)}
          onBlur={() => setHovered(null)}
        >
          <div className="hero__inner" data-hero-shift>
            <div className="hero__media" aria-hidden="true">
              {key === 'brief' ? (
                <pre className="hero__ascii" ref={preRef} />
              ) : (
                <div className="hero__color" ref={colorRef} />
              )}
              {unsupported ? <div className="hero__fallback" /> : null}
              <div className="hero__scrim" />
            </div>

            <span className="hero__dot" aria-hidden="true" />

            <div className="hero__content">
              <h2 className="hero__title">{name}</h2>
              <p className="hero__descriptor">{descriptor}</p>
              <span className="hero__enter">
                Enter
                <span aria-hidden="true">&rarr;</span>
              </span>
            </div>
          </div>
        </a>
      ))}

      <div className="hero__divider" aria-hidden="true" />
      <div className="hero__veil" ref={veilRef} aria-hidden="true" />
    </div>
  )
}
