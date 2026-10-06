import gsap from 'gsap'

/**
 * Text that decodes itself: every character starts as a random glyph and
 * settles into the real one, left to right, each after a short flicker of its
 * own. After soulwire's "Text Scramble Effect" (codepen.io/soulwire/pen/mEMPrK)
 * -- the same glyph set and per-character start/end -- driven by GSAP's ticker
 * and working on an element's text in place, so markup inside it (an accent
 * <em>) keeps its styling.
 *
 * Nothing moves while it runs: each character is set in a box of its own real
 * width (measured once, before the first glyph), so a wide glyph standing in
 * for a narrow letter cannot push the rest of the line along. (Swapping the
 * text alone did -- the Story headline's "Code." shifted dozens of times as it
 * decoded, all of that page's layout shift.) Each word's boxes are kept
 * together, so the line still only breaks between words; the plain text is
 * put back when it is done.
 *
 * Returns a function that stops it and puts the real text back.
 */
const GLYPHS = '!<>-_\\/[]{}—=+*^?#________'

type Slot = { to: string; start: number; end: number; glyph: string; box: HTMLSpanElement | null }

const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]

export function scrambleIn(el: HTMLElement, { duration = 1.1, stagger = 0.55 } = {}) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n as Text).nodeValue) texts.push(n as Text)
  if (!texts.length) return () => {}

  // characters across all the nodes, so the resolve runs left to right through the whole element
  const total = Math.max(1, el.textContent?.length ?? 1)
  let index = 0
  const slots: Slot[] = []
  // each text node, and what stands in for it while it decodes
  const swaps: { text: Text; stand: DocumentFragment | null; parts: Node[] }[] = []
  const range = document.createRange()

  for (const text of texts) {
    const value = text.nodeValue ?? ''
    // every character's width as laid out now (one read, before anything changes)
    const widths = [...value].map((_, i) => {
      range.setStart(text, i)
      range.setEnd(text, i + 1)
      return range.getBoundingClientRect().width
    })
    const frag = document.createDocumentFragment()
    const parts: Node[] = []
    let word: HTMLSpanElement | null = null
    ;[...value].forEach((ch, i) => {
      const at = index++ / total
      const start = at * stagger + Math.random() * 0.12
      const end = start + (1 - stagger) * (0.35 + Math.random() * 0.65)
      if (/\s/.test(ch)) {
        // spaces stay real spaces, where the line may break
        word = null
        const space = document.createTextNode(ch)
        frag.appendChild(space)
        parts.push(space)
        slots.push({ to: ch, start, end, glyph: '', box: null })
        return
      }
      if (!word) {
        word = document.createElement('span')
        word.style.cssText = 'display:inline-block;white-space:nowrap'
        frag.appendChild(word)
        parts.push(word)
      }
      const box = document.createElement('span')
      box.style.cssText = `display:inline-block;width:${widths[i].toFixed(2)}px;text-align:center;white-space:pre`
      box.textContent = glyph()
      word.appendChild(box)
      slots.push({ to: ch, start, end, glyph: '', box })
    })
    swaps.push({ text, stand: frag, parts })
  }
  range.detach?.()
  // put the boxes in, each run of them where its text was
  for (const s of swaps) {
    s.text.parentNode?.insertBefore(s.stand!, s.text)
    s.text.remove()
    s.stand = null
  }

  const t0 = gsap.ticker.time
  let done = false
  const restore = () => {
    if (done) return
    done = true
    gsap.ticker.remove(tick)
    for (const s of swaps) {
      const first = s.parts[0]
      first?.parentNode?.insertBefore(s.text, first)
      s.parts.forEach((p) => p.parentNode?.removeChild(p))
    }
  }
  const tick = () => {
    const p = (gsap.ticker.time - t0) / duration
    if (p >= 1) return restore()
    for (const s of slots) {
      if (!s.box) continue
      let out: string
      if (p >= s.end) out = s.to
      else if (p >= s.start) {
        // a fresh glyph now and then, as in the pen, rather than every frame
        if (!s.glyph || Math.random() < 0.28) s.glyph = glyph()
        out = s.glyph
      } else out = glyph()
      if (s.box.textContent !== out) s.box.textContent = out
    }
  }
  tick()
  gsap.ticker.add(tick)
  return restore
}
