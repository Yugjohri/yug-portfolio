import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

/**
 * The motion language's vocabulary: one clock and three eases.
 *
 * Every new motion on the site is one of a few verbs -- collapse (leaving:
 * plane to line to point), unfold (entering: point to line to plane), carry
 * (one object surviving a boundary) -- and it is timed in beats of one clock.
 * Existing sections keep their own eases; only new code reads from here.
 */

gsap.registerPlugin(CustomEase)

/** One beat, seconds. Micro interactions are half a beat, UI responses one,
 *  transitions two, route changes at most four. */
export const BEAT = 0.469

/** n beats, in seconds. */
export const beats = (n: number) => n * BEAT

/** The eases, registered once, by name. */
export const EASE = {
  /** leaving: accelerating in, so the last of a shape goes fastest */
  collapse: 'collapse',
  /** entering or opening: the site's own --hero-ease, cubic-bezier(0.2, 0, 0, 1) */
  unfold: 'unfold',
  /** continuity: one object carried across a seam, even at both ends */
  carry: 'carry',
} as const

CustomEase.create(EASE.collapse, 'M0,0 C0.55,0 0.9,0.35 1,1')
CustomEase.create(EASE.unfold, 'M0,0 C0.2,0 0,1 1,1')
// the power3.inOut family (an in-out quart), as a named curve
CustomEase.create(EASE.carry, 'M0,0 C0.77,0 0.175,1 1,1')

/** Colours the transitions carry, mirrored from the stylesheets. */
export const TONE = {
  /** the Story's first screen, behind the CRT (theme-noir .shero__frame::before) */
  storyBlack: '#050405',
  /** the landing and Brief's ground (index.css --bg) */
  baseBg: '#06060f',
  /** a lit phosphor: the Story's light ink */
  phosphor: '#f1ebe8',
} as const
