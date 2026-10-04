import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

/**
 * A spark at every click: eight short strokes that shoot out from the point
 * and are gone in two-thirds of a second. After hexagoncircle's "Click Spark"
 * (codepen.io/hexagoncircle/pen/bGZdWyw) -- the same figure, size, timing and
 * curve -- with the animation in GSAP, and a fresh spark per click so quick
 * clicks each get their own.
 *
 * It sits in a fixed layer over everything (popups included), takes no
 * pointer events, and skips a "click" that was really a drag (the projects
 * ribbon is dragged by hand). Off for reduced motion.
 */

/** the pen's spark: 30px, viewBox 100, strokes from y 30 to y 4, turned -20deg */
const SIZE = 30
const RAYS = 8
const LEN = 30 // the stroke's dash, and how far in from the edge it starts
const DURATION = 0.66
/** a press that travelled further than this was a drag, not a click */
const DRAG_PX = 6
const SVG_NS = 'http://www.w3.org/2000/svg'

CustomEase.create('clickSpark', '0.25,1,0.5,1')

function makeSpark(x: number, y: number) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'click-spark')
  svg.setAttribute('width', String(SIZE))
  svg.setAttribute('height', String(SIZE))
  svg.setAttribute('viewBox', '0 0 100 100')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('stroke-width', '4')
  svg.style.left = `${x - SIZE / 2}px`
  svg.style.top = `${y - SIZE / 2}px`
  const lines: SVGLineElement[] = []
  const turn = document.createElementNS(SVG_NS, 'g')
  turn.setAttribute('transform', 'rotate(-20 50 50)')
  for (let i = 0; i < RAYS; i++) {
    // each ray turned to its place round the centre; the stroke itself then
    // travels outward along it (the pen's rotate(..) translateY(..))
    const g = document.createElementNS(SVG_NS, 'g')
    g.setAttribute('transform', `rotate(${(i * 360) / RAYS} 50 50)`)
    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', '50')
    line.setAttribute('x2', '50')
    // given from the start (as the pen's markup does): GSAP's attr tween reads them, and an empty one is an error
    line.setAttribute('y1', '30')
    line.setAttribute('y2', '4')
    line.setAttribute('stroke-dasharray', String(LEN))
    g.appendChild(line)
    turn.appendChild(g)
    lines.push(line)
  }
  svg.appendChild(turn)
  return { svg, lines }
}

export default function ClickSpark() {
  const layer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layerEl = layer.current
    if (!layerEl) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let down: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
    }
    const onClick = (e: MouseEvent) => {
      // a keyboard "click" has no point to spark from
      if (e.detail === 0) return
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_PX) return
      const { svg, lines } = makeSpark(e.clientX, e.clientY)
      layerEl.appendChild(svg)
      // from: the dash still hidden, half a stroke further in; to: the dash
      // has passed through and out, at the stroke's place
      const off = LEN / 2
      gsap.fromTo(
        lines,
        { strokeDashoffset: LEN * 3, attr: { y1: 30 + off, y2: 4 + off } },
        {
          strokeDashoffset: LEN,
          attr: { y1: 30, y2: 4 },
          duration: DURATION,
          ease: 'clickSpark',
          onComplete: () => svg.remove(),
        },
      )
    }
    window.addEventListener('pointerdown', onDown, { capture: true, passive: true })
    window.addEventListener('click', onClick, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', onDown, { capture: true })
      window.removeEventListener('click', onClick, { capture: true })
      gsap.killTweensOf(layerEl.querySelectorAll('line'))
      layerEl.replaceChildren()
    }
  }, [])

  return <div className="click-spark-layer" ref={layer} aria-hidden="true" />
}
