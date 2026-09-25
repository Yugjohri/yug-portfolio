/**
 * The left panel's rendering of the shared source.
 *
 * Downsamples whatever frame the source just drew onto a character grid and
 * maps luminance to a glyph ramp. It never advances time on its own — it is
 * handed a frame, so it cannot fall out of step with the right panel.
 */

/** Standard 70-step luminance ramp, dark to bright. */
const RAMP = " .'`^,:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"

/** Target width of one character cell, in CSS pixels. Smaller = finer grid. */
const CELL_PX = 6

/** Most monospace faces advance 0.6em, but measure rather than assume. */
const FALLBACK_ADVANCE = 0.6

const LINE_HEIGHT = 0.87

/** The drain's ramp: five steps, blank to solid. */
const BLOCKS = ' ░▒▓█'

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

export class AsciiRenderer {
  private sampler: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null
  private cols = 0
  private rows = 0

  /**
   * The glyph drain, 0..1. Rising, every row is squeezed toward `drainMid`
   * until the whole picture is one band a few rows high, and its glyphs go
   * over to the five-step block ramp. At 0 the pass draws exactly as always.
   */
  drain = 0
  /** where the drain squeezes to, as a share of the height from the top */
  drainMid = 0.5

  constructor(private pre: HTMLPreElement) {
    this.sampler = document.createElement('canvas')
    this.ctx = this.sampler.getContext('2d', { willReadFrequently: true })
  }

  /** Recompute the grid so the glyphs exactly fill a panel of this size. */
  layout(width: number, height: number) {
    if (width <= 0 || height <= 0) return

    const cols = Math.max(24, Math.round(width / CELL_PX))
    const charWidth = width / cols
    const fontSize = charWidth / this.advanceRatio(charWidth)
    const rows = Math.max(12, Math.ceil(height / (fontSize * LINE_HEIGHT)))

    this.cols = cols
    this.rows = rows
    this.sampler.width = cols
    this.sampler.height = rows

    this.pre.style.fontSize = `${fontSize}px`
    this.pre.style.lineHeight = `${LINE_HEIGHT}`
  }

  /** Measure the real advance ratio of the resolved monospace font. */
  private advanceRatio(charWidth: number) {
    const ctx = this.ctx
    if (!ctx || charWidth <= 0) return FALLBACK_ADVANCE
    const probe = 100
    ctx.font = `${probe}px ${getComputedStyle(this.pre).fontFamily}`
    const width = ctx.measureText('M'.repeat(20)).width / 20
    return width > 0 ? width / probe : FALLBACK_ADVANCE
  }

  /**
   * Render one frame of the shared source as text.
   *
   * The source may have drawn this panel's pass into a sub-rectangle rather
   * than the whole canvas, so the region to sample can be given explicitly.
   */
  draw(source: CanvasImageSource, sx = 0, sy = 0, sw?: number, sh?: number) {
    const ctx = this.ctx
    if (!ctx || this.cols === 0) return

    ctx.clearRect(0, 0, this.cols, this.rows)
    if (sw !== undefined && sh !== undefined) {
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, this.cols, this.rows)
    } else {
      ctx.drawImage(source, 0, 0, this.cols, this.rows)
    }
    const { data } = ctx.getImageData(0, 0, this.cols, this.rows)

    const last = RAMP.length - 1
    let out = ''

    if (this.drain > 0) {
      this.pre.textContent = this.drained(data)
      return
    }

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const i = (y * this.cols + x) * 4
        let l = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255

        // crush the background to blank space so the disk reads as a shape
        // against real negative space, then dither to break up ramp banding
        l = Math.max(0, (l - 0.06) / 0.94)
        l = Math.pow(l, 1.5)
        l += (Math.random() - 0.5) * (1 / last)

        const step = Math.round(Math.max(0, Math.min(1, l)) * last)
        out += RAMP[step]
      }
      if (y < this.rows - 1) out += '\n'
    }

    this.pre.textContent = out
  }

  /**
   * One frame of the drain. Each output row stands for the stretch of the
   * picture that the squeeze packs into it -- src = mid + (row - mid) / keep,
   * `keep` falling from 1 to 0.03 -- and takes the brightest of it, so the
   * disk flattens into a band instead of being sampled away. Rows the
   * picture no longer reaches are blank. The luminance treatment is the
   * pass's own; past p = 0.35 a growing share of cells take the block ramp.
   */
  private drained(data: Uint8ClampedArray) {
    const p = Math.min(this.drain, 1)
    const keep = 1 - 0.97 * p
    const mid = this.drainMid * this.rows
    const blocks = smoothstep(0.35, 0.6, p)
    const last = RAMP.length - 1
    const blank = ' '.repeat(this.cols)
    let out = ''

    for (let y = 0; y < this.rows; y++) {
      const s0 = Math.max(0, Math.floor(mid + (y - mid) / keep))
      const s1 = Math.min(this.rows - 1, Math.ceil(mid + (y + 1 - mid) / keep) - 1)
      if (s1 < s0) {
        out += blank
      } else {
        for (let x = 0; x < this.cols; x++) {
          let l = 0
          for (let s = s0; s <= s1; s++) {
            const i = (s * this.cols + x) * 4
            l = Math.max(l, (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255)
          }
          l = Math.max(0, (l - 0.06) / 0.94)
          l = Math.pow(l, 1.5)
          if (Math.random() < blocks) {
            l += (Math.random() - 0.5) * 0.25
            out += BLOCKS[Math.round(Math.max(0, Math.min(1, l)) * 4)]
          } else {
            l += (Math.random() - 0.5) * (1 / last)
            out += RAMP[Math.round(Math.max(0, Math.min(1, l)) * last)]
          }
        }
      }
      if (y < this.rows - 1) out += '\n'
    }
    return out
  }
}
