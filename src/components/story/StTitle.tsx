import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { BEAT, EASE } from '../../motion/tokens'

gsap.registerPlugin(useGSAP, ScrollTrigger)

type StTitleProps = {
  /** the whole line, as it reads */
  text: string
  /** the one phrase in the red serif italic: a run of whole words in `text` */
  accent?: string
  as?: 'h2' | 'h3' | 'p'
  id?: string
  className?: string
  /** where the rise starts, as a ScrollTrigger start */
  start?: string
}

/**
 * Every Story section's headline: one sans line with one phrase in the red
 * serif italic, and one way in -- each word rises out of its own line, a
 * word at a time, when the headline comes up the screen, and sinks back
 * when the reader scrolls back above it. The same size, the same voice and
 * the same arrival in every section, so they read as one set.
 *
 * Under reduced motion it is simply there.
 */
export default function StTitle({ text, accent, as: Tag = 'h2', id, className, start = 'top 86%' }: StTitleProps) {
  const root = useRef<HTMLHeadingElement>(null)

  useGSAP(
    () => {
      const el = root.current
      if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const words = gsap.utils.toArray<HTMLElement>('[data-rise]', el)
      const rise = gsap.timeline({ paused: true })
      rise.fromTo(
        words,
        { yPercent: 118 },
        { yPercent: 0, duration: BEAT * 1.7, ease: EASE.unfold, stagger: 0.055 },
      )

      ScrollTrigger.create({
        trigger: el,
        start,
        // in a hidden tab the ticker sleeps: land the words rather than strand them
        onEnter: () => (document.hidden ? rise.progress(1) : rise.play()),
        onLeaveBack: () => (document.hidden ? rise.progress(0) : rise.reverse()),
      })
    },
    { scope: root },
  )

  const words = split(text, accent)
  return (
    <Tag className={className ? `st-title ${className}` : 'st-title'} id={id} ref={root}>
      {words.map(({ w, hot }, i) =>
        hot ? (
          <span className="st-word st-word--hot" key={i}>
            <em data-rise>{w}</em>
          </span>
        ) : (
          <span className="st-word" key={i}>
            <span data-rise>{w}</span>
          </span>
        ),
      )}
    </Tag>
  )
}

/** The line's words, the accent's marked. */
function split(text: string, accent?: string) {
  const at = accent ? text.indexOf(accent) : -1
  const run = (s: string, hot: boolean) =>
    s
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => ({ w, hot }))
  if (at < 0 || !accent) return run(text, false)
  return [
    ...run(text.slice(0, at), false),
    ...run(accent, true),
    ...run(text.slice(at + accent.length), false),
  ]
}
