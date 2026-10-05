/**
 * The opened project's pictures, answering the hand the way the ribbon does.
 *
 * One canvas over the panel draws each picture in the stream where its DOM
 * element sits -- the element stays, invisible, for layout, scrolling and the
 * panel's own reveal, which this reads back (its box, its opacity) every
 * frame -- and then reads the whole frame through the same surface field the
 * ribbon uses, so a stroke of the hand bends the pictures exactly as it bends
 * the ribbon's screens. The picture under the hand is also a weighted plate,
 * on the ribbon's springs: it tips away from the hand and rises a little, and
 * settles flat when the hand leaves.
 *
 * WebGL1, like ribbonScene.ts, whose field shaders and dials it shares.
 */

import gsap from 'gsap'
import {
  FIELD_FRAG,
  HAND_LAG,
  LIFT_K,
  LIFT_ZETA,
  LIFT_Z,
  QUAD_VERT,
  STIR_GAIN,
  STIR_MAX,
  STIR_RADIUS,
  SURFACE_DRIFT,
  SURFACE_FRAG,
  SURFACE_HALF_LIFE,
  SURFACE_RES,
  SURFACE_SPREAD,
  TILT_K,
  TILT_SLOPE,
  TILT_SPEED,
  TILT_ZETA,
  program,
  spring,
} from './ribbonScene'
import { softwareGpu } from '../../lib/gpu'

/** The pictures' corner radius, CSS px: the stream's own. */
const RADIUS_PX = 10

const ITEM_VERT = /* glsl */ `
attribute vec2 aPos; // 0..1 across, 0..1 down
uniform vec4 uBox;   // x, y, w, h in canvas px, y down
uniform vec2 uView;  // canvas size, CSS px
uniform vec2 uTilt;  // depth per px across and up
uniform float uLift; // px toward the reader
uniform float uPersp;
varying vec2 vUv;
void main() {
  vUv = aPos;
  vec2 c = uBox.xy + 0.5 * uBox.zw;
  vec2 p = uBox.xy + aPos * uBox.zw;
  float z = uLift + uTilt.x * (p.x - c.x) + uTilt.y * (c.y - p.y);
  /* seen from straight in front of its own centre: nearer is larger */
  float w = max(0.2, 1.0 - z / uPersp);
  vec2 q = c * w + (p - c);
  gl_Position = vec4(q.x / uView.x * 2.0 - w, w - q.y / uView.y * 2.0, 0.0, w);
}
`

const ITEM_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uSize;  // source px, for the cover fit
uniform vec4 uBox;
uniform float uRadius;
uniform float uAlpha;
varying vec2 vUv;
vec2 uvCover(vec2 planeSize, vec2 imageSize, vec2 uv) {
  float planeRatio = planeSize.x / planeSize.y;
  float imageRatio = imageSize.x / imageSize.y;
  vec2 newSize = planeRatio < imageRatio
    ? vec2(imageSize.x * (planeSize.y / imageSize.y), planeSize.y)
    : vec2(planeSize.x, imageSize.y * (planeSize.x / imageSize.x));
  vec2 newOffset = (planeRatio < imageRatio
    ? vec2((newSize.x - planeSize.x) / 2.0, 0.0)
    : vec2(0.0, (newSize.y - planeSize.y) / 2.0)) / newSize;
  return uv * planeSize / newSize + newOffset;
}
void main() {
  vec2 sz = uBox.zw;
  vec4 tex = texture2D(uTex, uvCover(sz, uSize, vUv));
  vec2 q = abs(vUv * sz - sz * 0.5) - (sz * 0.5 - uRadius);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float a = clamp(0.5 - d, 0.0, 1.0) * uAlpha;
  a *= tex.a;
  gl_FragColor = vec4(tex.rgb * a, a);
}
`

type Item = {
  media: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  /** the figure the panel reveals: its opacity and visibility are the picture's */
  frame: HTMLElement
  /** a text block: drawn from a raster of `el`, flows with the field but does not tip */
  text?: { el: HTMLElement; pad: number; dirtyUntil: number }
  tex: WebGLTexture
  size: [number, number]
  loaded: boolean
  plate: { tx: number; ty: number; x: number; y: number; vx: number; vy: number; lift: number; liftV: number }
}

export class PopupSurface {
  readonly canvas: HTMLCanvasElement
  readonly supported: boolean

  private gl!: WebGLRenderingContext
  private itemProg!: WebGLProgram
  private fieldProg!: WebGLProgram
  private surfaceProg!: WebGLProgram
  private itemU = new Map<string, WebGLUniformLocation | null>()
  private fieldU = new Map<string, WebGLUniformLocation | null>()
  private surfaceU = new Map<string, WebGLUniformLocation | null>()
  private unitQuad!: WebGLBuffer
  private triangle!: WebGLBuffer
  private sceneTex!: WebGLTexture
  private sceneFbo!: WebGLFramebuffer
  private field: { tex: WebGLTexture; fbo: WebGLFramebuffer }[] = []
  private fieldH = SURFACE_RES
  private packed = false
  private surfaceOn = false

  private items: Item[] = []
  private width = 1
  private height = 1
  private dpr = 1
  private origin = { x: 0, y: 0 }

  private stirTarget: { x: number; y: number } | null = null
  private hand = { x: 0, y: 0 }
  private handPrev = { x: 0, y: 0 }
  private handTo!: { x: (v: number) => void; y: (v: number) => void }
  private under = -1
  private underUv = { u: 0.5, v: 0.5 }

  constructor() {
    this.canvas = document.createElement('canvas')
    const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true })
    // (on a software renderer the scene stands down: lib/gpu.ts)
    this.supported = !!gl && !softwareGpu()
    if (!gl) return
    this.gl = gl
    this.itemProg = program(gl, ITEM_VERT, ITEM_FRAG)
    this.fieldProg = program(gl, QUAD_VERT, FIELD_FRAG)
    this.surfaceProg = program(gl, QUAD_VERT, SURFACE_FRAG)
    for (const n of ['uBox', 'uView', 'uTilt', 'uLift', 'uPersp', 'uTex', 'uSize', 'uRadius', 'uAlpha']) {
      this.itemU.set(n, gl.getUniformLocation(this.itemProg, n))
    }
    for (const n of ['uField', 'uTexel', 'uAspect', 'uStir', 'uPush', 'uRadius', 'uDecay', 'uDrift', 'uSpread', 'uMax', 'uPacked']) {
      this.fieldU.set(n, gl.getUniformLocation(this.fieldProg, n))
    }
    for (const n of ['uScene', 'uField', 'uAspect', 'uPacked']) {
      this.surfaceU.set(n, gl.getUniformLocation(this.surfaceProg, n))
    }
    this.unitQuad = this.buffer(new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]))
    this.triangle = this.buffer(new Float32Array([-1, -1, 3, -1, -1, 3]))
    this.handTo = {
      x: gsap.quickTo(this.hand, 'x', { duration: HAND_LAG, ease: 'power2.out' }),
      y: gsap.quickTo(this.hand, 'y', { duration: HAND_LAG, ease: 'power2.out' }),
    }
    this.setupSurface()
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  // ---------------------------------------------------------------- setup

  private buffer(data: Float32Array) {
    const gl = this.gl
    const b = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, b)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    return b
  }

  private texture() {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
    return t
  }

  /** the frame's own target and the field, as the ribbon has them */
  private setupSurface() {
    const gl = this.gl
    this.sceneTex = this.texture()
    this.sceneFbo = gl.createFramebuffer()!
    const half = gl.getExtension('OES_texture_half_float')
    gl.getExtension('OES_texture_half_float_linear')
    gl.getExtension('EXT_color_buffer_half_float')
    const make = (type: number) => {
      const tex = this.texture()
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SURFACE_RES, this.fieldH, 0, gl.RGBA, type, null)
      const fbo = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      if (!ok) {
        gl.deleteTexture(tex)
        gl.deleteFramebuffer(fbo)
        return null
      }
      return { tex, fbo }
    }
    let a = half ? make(half.HALF_FLOAT_OES) : null
    let b = a ? make(half!.HALF_FLOAT_OES) : null
    if (!a || !b) {
      this.packed = true
      a = make(gl.UNSIGNED_BYTE)
      b = make(gl.UNSIGNED_BYTE)
    }
    if (a && b) {
      this.field = [a, b]
      this.surfaceOn = true
      this.clearField()
    }
  }

  private clearField() {
    const gl = this.gl
    for (const f of this.field) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo)
      gl.viewport(0, 0, SURFACE_RES, this.fieldH)
      gl.clearColor(this.packed ? 0.5 : 0, this.packed ? 0.5 : 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /** The canvas' size and where it sits on the page (viewport px). */
  resize(width: number, height: number, x: number, y: number) {
    const gl = this.gl
    this.origin = { x, y }
    if (!gl) return
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(this.width * this.dpr)
    this.canvas.height = Math.round(this.height * this.dpr)
    if (!this.surfaceOn) return
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTex, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this.surfaceOn = false
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    const fh = Math.max(16, Math.round((SURFACE_RES * this.height) / this.width))
    if (fh !== this.fieldH) {
      this.fieldH = fh
      const type = this.packed ? gl.UNSIGNED_BYTE : gl.getExtension('OES_texture_half_float')!.HALF_FLOAT_OES
      for (const f of this.field) {
        gl.bindTexture(gl.TEXTURE_2D, f.tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SURFACE_RES, this.fieldH, 0, gl.RGBA, type, null)
      }
      this.clearField()
    }
  }

  /** A picture to draw in place of its element; `frame` is the figure the panel reveals. */
  add(media: HTMLImageElement | HTMLVideoElement, frame: HTMLElement) {
    if (!this.gl) return
    this.items.push({
      media,
      frame,
      tex: this.texture(),
      size: [16, 10],
      loaded: false,
      plate: { tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0, lift: 0, liftV: 0 },
    })
  }

  /**
   * A block of the panel's type, drawn here so the hand's fluid moves it with
   * the pictures. The element is rasterised -- its own boxes (fills, borders,
   * radii) and every word where the browser laid it out -- and the element is
   * then marked so the stylesheet makes its ink transparent: it keeps its
   * layout, its links and its selection, and this draws what it would have.
   */
  addText(el: HTMLElement, frame: HTMLElement = el) {
    if (!this.gl) return
    const item: Item = {
      media: document.createElement('canvas'),
      frame,
      tex: this.texture(),
      size: [16, 10],
      loaded: false,
      plate: { tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0, lift: 0, liftV: 0 },
      text: { el, pad: 16, dirtyUntil: 0 },
    }
    this.items.push(item)
    this.rasterize(item)
  }

  /** Redraw every text block (the panel was resized, so the type reflowed). */
  rerasterize() {
    this.items.forEach((it) => it.text && this.rasterize(it))
  }

  /** A text block changed state (a link is hovered): redraw it while its transition runs. */
  touch(target: Element | null) {
    if (!target) return
    const now = performance.now()
    this.items.forEach((it) => {
      if (it.text && it.text.el.contains(target)) it.text.dirtyUntil = now + 400
    })
  }

  private rasterize(item: Item) {
    const t = item.text
    if (!t) return
    const el = t.el
    const canvas = item.media as HTMLCanvasElement
    // read the real ink: unmark for the measurement (no paint happens in between),
    // with transitions held off so the computed colours are the settled ones
    el.setAttribute('data-gl-raster', '')
    el.removeAttribute('data-gl-text')
    const r = el.getBoundingClientRect()
    const dpr = this.dpr
    const W = Math.max(1, Math.ceil((r.width + 2 * t.pad) * dpr))
    const H = Math.max(1, Math.ceil((r.height + 2 * t.pad) * dpr))
    if (canvas.width !== W) canvas.width = W
    if (canvas.height !== H) canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.setTransform(dpr, 0, 0, dpr, (t.pad - r.left) * dpr, (t.pad - r.top) * dpr)

    // boxes: the element and its descendants, in document order
    const boxes = [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))]
    for (const b of boxes) {
      const cs = getComputedStyle(b)
      const bg = cs.backgroundColor
      const bw = parseFloat(cs.borderTopWidth) || 0
      const bc = cs.borderTopColor
      const hasBg = bg && !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)|transparent/.test(bg)
      const hasBorder = bw > 0 && cs.borderTopStyle !== 'none' && !/,\s*0\s*\)$|transparent/.test(bc)
      if (!hasBg && !hasBorder) continue
      const br = b.getBoundingClientRect()
      const rad = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, br.height / 2, br.width / 2)
      ctx.beginPath()
      ctx.roundRect(br.left, br.top, br.width, br.height, rad)
      if (hasBg) {
        ctx.fillStyle = bg
        ctx.fill()
      }
      if (hasBorder) {
        ctx.beginPath()
        ctx.roundRect(br.left + bw / 2, br.top + bw / 2, br.width - bw, br.height - bw, Math.max(0, rad - bw / 2))
        ctx.lineWidth = bw
        ctx.strokeStyle = bc
        ctx.stroke()
      }
    }

    // words, each where the browser put it
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const node = n as Text
      const parent = node.parentElement
      if (!parent || !node.data.trim()) continue
      const cs = getComputedStyle(parent)
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing
      ctx.fillStyle = cs.color
      ctx.textBaseline = 'alphabetic'
      const upper = cs.textTransform === 'uppercase'
      const re = /\S+/g
      let m: RegExpExecArray | null
      while ((m = re.exec(node.data))) {
        range.setStart(node, m.index)
        range.setEnd(node, m.index + m[0].length)
        const rects = range.getClientRects()
        if (!rects.length) continue
        const word = upper ? m[0].toUpperCase() : m[0]
        // a word the browser broke across lines: draw it piecewise by character
        if (rects.length > 1) {
          for (let i = 0; i < m[0].length; i++) {
            range.setStart(node, m.index + i)
            range.setEnd(node, m.index + i + 1)
            const cr = range.getBoundingClientRect()
            const ch = upper ? m[0][i].toUpperCase() : m[0][i]
            const asc = ctx.measureText(ch).fontBoundingBoxAscent
            ctx.fillText(ch, cr.left, cr.top + asc)
          }
          continue
        }
        const wr = rects[0]
        const asc = ctx.measureText(word).fontBoundingBoxAscent
        ctx.fillText(word, wr.left, wr.top + asc)
      }
    }
    range.detach()
    el.setAttribute('data-gl-text', '')
    getComputedStyle(el).color // settle the re-mark while transitions are still off
    el.removeAttribute('data-gl-raster')
    item.loaded = false
    item.size = [W, H]
  }

  // ----------------------------------------------------------------- hand

  /** The hand, viewport px, or null when it has left the panel. */
  stir(px: number | null, py = 0) {
    if (px === null) {
      this.stirTarget = null
      return
    }
    const x = px - this.origin.x
    const y = py - this.origin.y
    if (!this.stirTarget) {
      gsap.killTweensOf(this.hand)
      this.hand.x = this.handPrev.x = x
      this.hand.y = this.handPrev.y = y
    }
    this.stirTarget = { x, y }
    this.handTo.x(x)
    this.handTo.y(y)
  }

  // --------------------------------------------------------------- render

  /** Where an item's element is, canvas px, and how visible its figure is. */
  private boxOf(item: Item) {
    const fs = item.frame.style
    const alpha = fs.visibility === 'hidden' ? 0 : fs.opacity === '' ? 1 : parseFloat(fs.opacity)
    if (item.text) {
      const r = item.text.el.getBoundingClientRect()
      const p = item.text.pad
      return { x: r.left - p - this.origin.x, y: r.top - p - this.origin.y, w: r.width + 2 * p, h: r.height + 2 * p, alpha }
    }
    const r = item.media.getBoundingClientRect()
    return { x: r.left - this.origin.x, y: r.top - this.origin.y, w: r.width, h: r.height, alpha }
  }

  private upload(item: Item) {
    const gl = this.gl
    const m = item.media
    let w = 0
    let h = 0
    if (m instanceof HTMLCanvasElement) {
      if (item.loaded) return
      w = m.width
      h = m.height
    } else if (m instanceof HTMLVideoElement) {
      if (m.readyState < 2) return
      w = m.videoWidth
      h = m.videoHeight
    } else {
      if (item.loaded || !m.complete || !m.naturalWidth) return
      w = m.naturalWidth
      h = m.naturalHeight
    }
    gl.bindTexture(gl.TEXTURE_2D, item.tex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, m)
    item.size = [w || 16, h || 10]
    item.loaded = true
  }

  render(dt = 1 / 60) {
    const gl = this.gl
    if (!gl) return
    const h = Math.min(Math.max(dt, 0), 1 / 30)
    const boxes = this.items.map((it) => this.boxOf(it))

    // ---- the plate under the hand
    let hit = -1
    let hu = 0.5
    let hv = 0.5
    if (this.stirTarget) {
      const { x, y } = this.stirTarget
      boxes.forEach((b, i) => {
        if (hit < 0 && !this.items[i].text && b.alpha > 0.01 && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          hit = i
          hu = (x - b.x) / b.w
          hv = (y - b.y) / b.h
        }
      })
    }
    let du = 0
    let dv = 0
    if (hit >= 0 && hit === this.under && h > 0) {
      du = (hu - this.underUv.u) / h
      dv = (hv - this.underUv.v) / h
    }
    this.under = hit
    this.underUv = { u: hu, v: hv }
    const clamp = (n: number, m: number) => Math.max(-m, Math.min(m, n))
    this.items.forEach((it, i) => {
      const p = it.plate
      const b = boxes[i]
      if (i === hit) {
        p.tx = clamp((hu - 0.5) * 2 + clamp(du * TILT_SPEED, 0.6), 1.2)
        p.ty = clamp((0.5 - hv) * 2 - clamp(dv * TILT_SPEED * (b.h / Math.max(1, b.w)), 0.6), 1.2)
      } else {
        p.tx = 0
        p.ty = 0
      }
      ;[p.x, p.vx] = spring(p.x, p.vx, p.tx, TILT_K, TILT_ZETA, h)
      ;[p.y, p.vy] = spring(p.y, p.vy, p.ty, TILT_K, TILT_ZETA, h)
      ;[p.lift, p.liftV] = spring(p.lift, p.liftV, i === hit ? 1 : 0, LIFT_K, LIFT_ZETA, h)
    })

    // ---- the pictures, into the frame's own target
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.surfaceOn ? this.sceneFbo : null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.itemProg)
    const u = (n: string) => this.itemU.get(n) ?? null
    gl.uniform2f(u('uView'), this.width, this.height)
    gl.uniform1f(u('uRadius'), RADIUS_PX)
    gl.uniform1i(u('uTex'), 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.unitQuad)
    const a = gl.getAttribLocation(this.itemProg, 'aPos')
    gl.enableVertexAttribArray(a)
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    gl.activeTexture(gl.TEXTURE0)
    this.items.forEach((it, i) => {
      const b = boxes[i]
      // only what is on the canvas, and shown
      if (b.alpha <= 0.001 || b.y > this.height || b.y + b.h < 0 || b.w < 1 || b.h < 1) return
      if (it.text && it.text.dirtyUntil > performance.now()) this.rasterize(it)
      if (it.media instanceof HTMLVideoElement || !it.loaded) this.upload(it)
      if (!it.loaded) return
      gl.uniform1f(u('uRadius'), it.text ? 0 : RADIUS_PX)
      // the ribbon's plate at this picture's scale: its reach is its own width
      const persp = Math.max(b.w, b.h)
      gl.bindTexture(gl.TEXTURE_2D, it.tex)
      gl.uniform4f(u('uBox'), b.x, b.y, b.w, b.h)
      gl.uniform2f(u('uTilt'), -TILT_SLOPE * it.plate.x, -TILT_SLOPE * it.plate.y)
      gl.uniform1f(u('uLift'), it.plate.lift * LIFT_Z * 0.64 * persp)
      gl.uniform1f(u('uPersp'), persp)
      gl.uniform2f(u('uSize'), it.size[0], it.size[1])
      gl.uniform1f(u('uAlpha'), b.alpha)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    })

    if (this.surfaceOn) this.stepSurface(dt)
  }

  private drawTriangle(prog: WebGLProgram) {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.triangle)
    const a = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(a)
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /** one step of the field, then the frame read through it: the ribbon's own */
  private stepSurface(dt: number) {
    const gl = this.gl
    const H = this.height
    const aspect = this.width / this.height
    let px = 0
    let py = 0
    if (this.stirTarget) {
      px = ((this.hand.x - this.handPrev.x) / H) * STIR_GAIN
      py = (-(this.hand.y - this.handPrev.y) / H) * STIR_GAIN
      const m = Math.hypot(px, py)
      if (m > STIR_MAX) {
        px *= STIR_MAX / m
        py *= STIR_MAX / m
      }
    }
    this.handPrev.x = this.hand.x
    this.handPrev.y = this.hand.y

    gl.disable(gl.BLEND)
    const [src, dst] = this.field
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
    gl.viewport(0, 0, SURFACE_RES, this.fieldH)
    gl.useProgram(this.fieldProg)
    const f = (n: string) => this.fieldU.get(n) ?? null
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, src.tex)
    gl.uniform1i(f('uField'), 0)
    gl.uniform2f(f('uTexel'), 1 / SURFACE_RES, 1 / this.fieldH)
    gl.uniform1f(f('uAspect'), aspect)
    gl.uniform2f(f('uStir'), this.hand.x / this.width, 1 - this.hand.y / H)
    gl.uniform2f(f('uPush'), px, py)
    gl.uniform1f(f('uRadius'), STIR_RADIUS)
    gl.uniform1f(f('uDecay'), Math.pow(0.5, dt / SURFACE_HALF_LIFE))
    gl.uniform1f(f('uDrift'), SURFACE_DRIFT)
    gl.uniform1f(f('uSpread'), SURFACE_SPREAD)
    gl.uniform1f(f('uMax'), STIR_MAX)
    gl.uniform1f(f('uPacked'), this.packed ? 1 : 0)
    this.drawTriangle(this.fieldProg)
    this.field = [dst, src]

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.surfaceProg)
    const su = (n: string) => this.surfaceU.get(n) ?? null
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, dst.tex)
    gl.uniform1i(su('uScene'), 0)
    gl.uniform1i(su('uField'), 1)
    gl.uniform1f(su('uAspect'), aspect)
    gl.uniform1f(su('uPacked'), this.packed ? 1 : 0)
    this.drawTriangle(this.surfaceProg)
    gl.enable(gl.BLEND)
  }

  dispose() {
    const gl = this.gl
    if (!gl) return
    gsap.killTweensOf(this.hand)
    this.items.forEach((it) => {
      gl.deleteTexture(it.tex)
      it.text?.el.removeAttribute('data-gl-text')
    })
    this.items = []
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
