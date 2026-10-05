import gsap from 'gsap'
import { scrambleIn } from '../motion/scramble'

/**
 * The loading screen. Its markup and styles are static, in index.html, so it
 * is on screen before any of the code has arrived; this drives it once the
 * code is here.
 *
 * A small black hole spins in the middle (after uiforfree's "Black hole
 * loader", codepen.io/uiforfree/pen/QWJqZJY, in the hero's orange), and under
 * it a short log reports what is actually loading, each line decoding as its
 * step is done (after filipz's terminal preloader, codepen.io/filipz/pen/wBBmqEX).
 * When everything is in, it fades and the page shows through.
 *
 * The steps are real: the code (this module running), the type (the fonts),
 * the route (its page mounted) and the scene (its first frame drawn). The
 * pages report the last two through markBoot().
 */

export type BootStep = 'code' | 'type' | 'route' | 'scene'

/** each step's share of the counter */
const WEIGHT: Record<BootStep, number> = { code: 0.25, type: 0.2, route: 0.25, scene: 0.3 }
/** the least time the screen stays up on a first visit, so it reads, s */
const MIN_FIRST = 2.2
/** ... and once this session has seen it, s (the files are cached by then) */
const MIN_AGAIN = 0.35
/** the most it ever waits: a step that has not reported by now is let go, s */
const MAX_WAIT = 9
const SEEN_KEY = 'yj-boot-seen'


const root = typeof document !== 'undefined' ? document.getElementById('boot') : null
const done = new Set<BootStep>()
const waiting: (() => void)[] = []
let revealed = !root
const shown = { n: 0 }
let ticked = 0

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function seenBefore() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function remember() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* private mode: it just plays again */
  }
}

/** what each line reads once its step is done, by the page it is on */
function doneText(step: BootStep): string {
  const path = window.location.pathname
  const page = path.startsWith('/story') ? 'story' : path.startsWith('/brief') ? 'brief' : 'landing'
  switch (step) {
    case 'code':
      return 'loaded'
    case 'type':
      return 'set'
    case 'route':
      return `${page} ready`
    case 'scene':
      return page === 'landing' ? 'black hole up' : page === 'story' ? 'screen on' : 'drawn'
  }
}

const line = (step: string) => root?.querySelector<HTMLElement>(`[data-boot-step="${step}"]`) ?? null

function settle(step: string, text: string) {
  const li = line(step)
  const v = li?.querySelector<HTMLElement>('.boot__v')
  if (!li || !v) return
  li.classList.add('is-done')
  v.textContent = text
  if (!reduced()) scrambleIn(v, { duration: 0.45, stagger: 0.4 })
}

function progress() {
  let p = 0
  done.forEach((s) => (p += WEIGHT[s]))
  return p
}

/** the counter and bar, eased toward what is actually done */
function draw() {
  if (!root) return
  const n = Math.round(shown.n * 100)
  const num = root.querySelector<HTMLElement>('[data-boot-num]')
  if (num) num.textContent = String(n).padStart(3, '0')
  root.style.setProperty('--boot-p', String(shown.n))
}

/** A step is done. Pages call this for 'route' and 'scene'. */
export function markBoot(step: BootStep) {
  if (revealed || done.has(step)) return
  done.add(step)
  settle(step, doneText(step))
  gsap.to(shown, { n: progress(), duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: draw })
  maybeLeave()
}

/** A page with no scene of its own to report: mounted now, and drawn two frames on. */
export function markPage() {
  markBoot('route')
  requestAnimationFrame(() => requestAnimationFrame(() => markBoot('scene')))
}

/** Runs `go` once the loading screen has begun to leave (at once if there is none). Returns a cancel. */
export function afterBoot(go: () => void) {
  if (revealed) {
    go()
    return () => {}
  }
  let live = true
  const run = () => {
    if (live) go()
  }
  waiting.push(run)
  return () => {
    live = false
  }
}

/** the loading screen is still up */
export const booting = () => !revealed

function reveal() {
  if (revealed) return
  revealed = true
  waiting.splice(0).forEach((f) => f())
}

let leaving = false
function maybeLeave() {
  if (leaving || !root) return
  if (done.size < 4) return
  leaving = true
  const min = seenBefore() ? MIN_AGAIN : MIN_FIRST
  const wait = Math.max(0, min - performance.now() / 1000)
  gsap.delayedCall(wait, leave)
}

function leave() {
  if (!root) return
  remember()
  clearTimeout(ticked)
  const hole = root.querySelector<HTMLElement>('.boot__hole')
  const term = root.querySelector<HTMLElement>('.boot__term')
  const curve = root.querySelector<HTMLElement>('.boot__curve')
  const finish = () => {
    root.remove()
    reveal()
  }
  shown.n = 1
  draw()
  settle('horizon', 'crossed')

  if (reduced()) {
    gsap.to(root, { autoAlpha: 0, duration: 0.3, delay: 0.25, onStart: reveal, onComplete: finish })
    return
  }

  // the log and the hole fade where they are; the page shows through as the ground lifts
  const tl = gsap.timeline({ delay: 0.35, onComplete: finish })
  tl.to([term, curve, hole], { autoAlpha: 0, duration: 0.4, ease: 'power2.in', stagger: 0.04 }, 0)
  tl.call(reveal, undefined, 0.25)
  tl.to(root, { autoAlpha: 0, duration: 0.5, ease: 'power1.inOut' }, 0.3)
}

/** Starts the loader: called once, from main.tsx, before the app renders. */
export function startBoot() {
  if (!root) return
  root.classList.add('is-live')
  draw()
  markBoot('code')
  const fonts = document.fonts?.ready
  if (fonts) fonts.then(() => markBoot('type'), () => markBoot('type'))
  else markBoot('type')
  // whatever has not reported by then is let go, so the site is never held hostage
  ticked = window.setTimeout(() => {
    ;(['type', 'route', 'scene'] as BootStep[]).forEach((s) => {
      if (!done.has(s)) {
        done.add(s)
        settle(s, 'late')
      }
    })
    shown.n = 1
    draw()
    maybeLeave()
  }, MAX_WAIT * 1000)
}
