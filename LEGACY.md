# Preserved: the original portfolio

Nothing was deleted. The old page no longer renders, but every component, style,
asset and piece of motion logic is still in the project and still type-checks.
This is the map for bringing any of it back.

## How it was switched off

Two edits, both reversible:

| File | Change |
|---|---|
| `src/App.tsx` | renders `pages/Home` instead of `pages/Portfolio` |
| `src/styles/index.css` | the `@import './portfolio.css'` line is commented out |

`pages/Portfolio.tsx` itself was **not modified**. Neither was any section
component, `motion.js`, `portfolio.css`, or any asset.

Because nothing imports them, Vite tree-shakes them out of the build — the
shipped bundle went from 56 modules to 41, and CSS from 23 kB to 4.8 kB.

## Full restore

1. In `src/App.tsx`, swap `Home` back to `Portfolio`.
2. In `src/styles/index.css`, uncomment `@import './portfolio.css';`.

That is the whole procedure.

## What is preserved, and what each part does

### Page + content

| File | Contents |
|---|---|
| `src/pages/Portfolio.tsx` | Assembles all 9 sections, mounts the motion module, owns the case-study modal state |
| `src/data/portfolio.ts` | 6 sleeves, 3 roles, 16 stack tools, 4 pin notes, 3 receipts, nav, ticker |
| `src/styles/portfolio.css` | Every class for the sections (~1,060 lines) |

### Section components (`src/components/sections/`)

`Intro` (marquee + portrait + ticker), `About`, `Manifesto`, `Proof` (counters),
`Work` (record shelf, 6 sleeves), `Roles` (3D card deck), `Stack` (16-tile grid),
`Now` (draggable pin board), `Contact`.

Plus `components/Preloader.tsx`, `components/SiteNav.tsx`, `components/CaseModal.tsx`.

### Motion (`src/lib/motion.js`, 712 lines)

Ported from the original single-file build rather than rewritten, so the
hard-won fixes survive: rAF watchdogs for hidden tabs, the guard that stops a
stale Lenis ticker from freezing GSAP's tick loop, and line breaking measured
from the browser instead of assumed.

| Method | What it drives |
|---|---|
| `preload` / `enter` | Preloader curtain, counter and progress bar, staggered fly-in |
| `setupScroll` | Rebuilds ScrollTriggers after a remount; no-ops if they are alive |
| `initScroll` | Scroll reveals, number counters, sleeve lean/jitter, nav hide-on-scroll, Lenis smooth scroll, and the manifesto's line-by-line lighting |
| `initStairs` | Work heading climbing a rotated 3D plane |
| `initRoleDeck` | Role cards arriving out of deep Z, one at a time |
| `initGrid` | Stack grid scrubbed from `scale: 3.4` back to frame |
| `initNotes` | Pin-board layout, pointer drag with a velocity spring, board clamping, "Tidy up" reset |
| `initShelf` | Sleeve hover lift, shadow swap, action buttons; click opens the modal |
| `initCanvas` / `ring` / `initTilt` / `bindBasics` / `loop` | Cursor canvas trail, custom ring cursor, magnetic buttons, card tilt, ticker velocity integration, parallax |
| `startClock` | Live 24-hour clock |
| `lockScroll` | Stops Lenis behind the modal |

`src/lib/motion.d.ts` types the class for TypeScript.

### Assets (`public/`)

- `portrait.webp` — recovered from the base64 in the original
  `.image-slots.state.json`; the saved pan is approximated in CSS as
  `object-position: 50% 71%`
- `grain.png` — pin-board paper texture

## Restoring only part of it

Import a single section into `pages/Home.tsx` — but two dependencies come with it:

1. **Styles.** Every section needs `portfolio.css`; re-enable the import.
2. **Motion.** Animated sections do nothing on their own. `PortfolioMotion`
   finds them by `id` and `data-` attribute, so it must be mounted (see
   `pages/Portfolio.tsx` for the mount/unmount pattern). The sections that are
   inert without it: Intro, Proof, Work, Roles, Stack, Now. `About`, `Manifesto`
   and `Contact` render fine statically, minus their reveals.

Note that `motion.js` also expects the preloader markup (`#pre`, `#pre-num`,
`#pre-bar`) and the cursor layers (`#fx`, `#ring`) to exist, as they do in
`pages/Portfolio.tsx`.

## Removed as dead code during the migration

For the record, these were dropped and are **not** recoverable from this project
— they were already non-functional in the original:

- `initShelfOld` / `layoutShelfOld` — superseded crate-carousel layout
- `initPhysics` — matter.js bin; the library was never loaded on the page
- `initSnap` — scroll snapping, never called (the brief says it was removed on purpose)
- `syncSleeveCaptions` — replaced by declarative caption gating in `Work.tsx`


## Preserved: the black-hole header on the Story route

On 2026-09-16 the Story header's visual (`src/components/story/StoryHero.tsx`)
was switched from the black-hole field to the curved dot-matrix screen in
`src/components/story/crtScreen.ts`. **Nothing about the black hole was
deleted**: `src/components/hero/heroSource.ts` is intact and still drives the
homepage's split hero. The scroll gesture in `StoryHero` was not touched by the
swap, so reverting the visual is three local edits and nothing else.

### To bring the black hole back

1. In `StoryHero.tsx`, replace the import
   `import { CrtScreen } from './crtScreen'` with
   `import { HeroSource } from '../hero/heroSource'`.

2. Replace the `useEffect` block headed `// --- the screen` with the original,
   reproduced here verbatim:

```tsx
  // -------------------------------------------------------------- the field
  useEffect(() => {
    const host = media.current
    const rootEl = root.current
    if (!host || !rootEl) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const source = new HeroSource({ videoSrc })
    if (!source.supported) {
      source.dispose()
      return
    }
    source.canvas.className = 'shero__canvas'
    host.appendChild(source.canvas)

    // a gentle cursor, eased, as on the front door's story panel
    const target = { x: 0, y: 0, amt: 0 }
    const current = { x: 0, y: 0, amt: 0 }
    let raf = 0
    let visible = true

    const measure = () => {
      const r = host.getBoundingClientRect()
      if (r.width > 0) source.resize(r.width, r.height)
    }
    const frameLoop = (now: number) => {
      raf = requestAnimationFrame(frameLoop)
      // once the strip has become the rule there is nothing of the field left to show
      if (!visible || progress.current > 0.78) return
      current.x += (target.x - current.x) * 0.06
      current.y += (target.y - current.y) * 0.06
      current.amt += (target.amt - current.amt) * 0.05
      source.render(now / 1000, current.x, current.y, current.amt)
    }
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      const m = Math.min(r.width, r.height) || 1
      target.x = (e.clientX - r.left - r.width / 2) / m
      target.y = (r.top + r.height / 2 - e.clientY) / m
      target.amt = 0.7
    }
    const onLeave = () => {
      target.amt = 0
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    io.observe(rootEl)
    rootEl.addEventListener('pointermove', onMove)
    rootEl.addEventListener('pointerleave', onLeave)
    raf = requestAnimationFrame(frameLoop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      rootEl.removeEventListener('pointermove', onMove)
      rootEl.removeEventListener('pointerleave', onLeave)
      source.canvas.remove()
      source.dispose()
    }
  }, [videoSrc])
```

3. In the JSX, put back the full-bleed media layer in place of the screen:

```tsx
        <div className="shero__media" ref={media} aria-hidden="true">
          <div className="shero__scrim" />
        </div>
```

   and in `src/styles/story.css` replace the `.shero__screen` / `.shero__canvas`
   rules (and the `.shero__screen` line inside the `max-width: 899px` block)
   with the originals:

```css
.shero__media {
  position: absolute;
  inset: 0;
  background: #000;
}
.shero__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
.shero__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgb(6 6 15 / 0.9) 0%, rgb(6 6 15 / 0.35) 38%, transparent 68%);
}
```

`crtScreen.ts` can then be left in place or deleted; nothing else imports it.

### Also changed alongside the screen (2026-09-16, second pass)

The Story header's headline was brought down to make room for a display
sized like the reference's. To restore it with the black hole, set
`.shero__title` back to `font-size: clamp(3rem, 9.4vw, 10.5rem); line-height: 0.9;
letter-spacing: -0.038em;` and its narrow-screen rule to
`clamp(2.6rem, 12vw, 5rem)`.

