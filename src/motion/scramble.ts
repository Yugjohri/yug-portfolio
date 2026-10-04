import gsap from 'gsap'

/**
 * Text that decodes itself: every character starts as a random glyph and
 * settles into the real one, left to right, each after a short flicker of its
 * own. After soulwire's "Text Scramble Effect" (codepen.io/soulwire/pen/mEMPrK)
 * -- the same glyph set and per-character start/end -- driven by GSAP's ticker
 * and working on an element's text nodes in place, so markup inside it (an
 * accent <em>) keeps its styling. Spaces stay spaces, so the words keep their
 * shape while the letters churn.
 *
 * Returns a function that stops it and puts the real text back.
 */
const GLYPHS = '!<>-_\\/[]{}—=+*^?#________'

type Slot = { to: string; start: number; end: number; glyph: string }

export function scrambleIn(el: HTMLElement, { duration = 1.1, stagger = 0.55 } = {}) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const nodes: { node: Text; text: string; slots: Slot[] }[] = []
  // characters across all the nodes, so the resolve runs left to right through the whole element
  const total = Math.max(1, el.textContent?.length ?? 1)
  let index = 0
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text
    const text = node.nodeValue ?? ''
    const slots = [...text].map((ch) => {
      const at = index++ / total
      const start = at * stagger + Math.random() * 0.12
      const end = start + (1 - stagger) * (0.35 + Math.random() * 0.65)
      return { to: ch, start, end, glyph: '' }
    })
    nodes.push({ node, text, slots })
  }
  if (!nodes.length) return () => {}

  const t0 = gsap.ticker.time
  let done = false
  const restore = () => {
    if (done) return
    done = true
    gsap.ticker.remove(tick)
    nodes.forEach(({ node, text }) => (node.nodeValue = text))
  }
  const tick = () => {
    const p = (gsap.ticker.time - t0) / duration
    if (p >= 1) return restore()
    nodes.forEach(({ node, slots }) => {
      let out = ''
      for (const s of slots) {
        if (s.to === ' ' || p >= s.end) out += s.to
        else if (p >= s.start) {
          // a fresh glyph now and then, as in the pen, rather than every frame
          if (!s.glyph || Math.random() < 0.28) s.glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          out += s.glyph
        } else out += s.to === '\n' ? s.to : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      }
      node.nodeValue = out
    })
  }
  tick()
  gsap.ticker.add(tick)
  return restore
}
