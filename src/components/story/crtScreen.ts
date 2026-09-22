import gsap from 'gsap'
import { GRADE_ID, INK, INK_DEEP, PAPER, type Grade } from '../../theme'

/**
 * The Story header's screen: a curved display that draws its picture as a
 * dense field of small type.
 *
 * The picture is read once per cell and each cell is drawn as a character
 * from a glyph atlas -- only the dense, ring-shaped ones -- inked in the
 * picture's own colour at that point. Value is carried by the ink, not by
 * the glyph choice, so a dark cell is a dim coloured mark rather than black,
 * and at reading distance the field resolves back into the picture. A soft
 * bloom lets bright areas spill between the marks. The tube is a shallow
 * pillow: a rectangle whose edges bow and whose corners stay sharp, with a
 * gentle fisheye on the picture inside it.
 *
 * The pointer leaves a short trail. Cells along that trail are dragged a
 * whole cell at a time in the direction of travel, only while the hand is
 * moving, and the trail decays on its own -- so a resting cursor does
 * nothing and a passing one briefly disturbs the surface.
 *
 * WebGL1, no dependencies beyond GSAP for the easing.
 */

// ------------------------------------------------------------------ dials

/** Cell pitch, CSS px. The reference's is 6 device px on a 2x display. */
const CELL_CSS = 3.2
const CELL_MIN_PX = 5

/** The characters a cell can be. Dense and holed, so every mark reads as a
 *  small ring rather than a dot or a block; ordered light to dark. */
const GLYPHS = '@#W$98&60'
/** How much of a glyph a cell shows: >1 crops to its centre, which is what
 *  makes neighbours nearly touch. */
const GLYPH_SCALE = 1.7

/** The tube: how much of the canvas the flat rectangle takes, and how far
 *  its edges bow, in half-canvas units. Sides barely; top and bottom more. */
const TUBE_W = 0.93
const TUBE_H = 0.8
const BULGE_SIDE = 0.035
const BULGE_TOP = 0.13
const BULGE_BOTTOM = 0.14
/** The picture's own curve inside the glass. */
const FISHEYE = 0.22

/** Colour: how far the picture is pulled toward grey, and its overall level. */
const SATURATION = 0.7
const EXPOSURE = 0.88
const BLOOM = 0.55

/** The pointer. Radius in CSS px around the head and along the trail; how far
 *  cells are pushed at full influence, in CSS px; how quickly the hand's speed
 *  is read as "moving"; how fast the trail forgets. */
const TRAIL_MAX = 24
const POINTER_RADIUS = 60
const POINTER_PUSH = 90
const POINTER_STRENGTH = 0.36
const SPEED_LOW = 0.0004 // uv per frame below which movement is ignored
const SPEED_HIGH = 0.012 // and above which it counts fully
const TRAIL_DECAY = 0.86
const TRAIL_LENGTH = 3.2
const IDLE_MS = 200

// ---------------------------------------------------------------- shaders

const VERT = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uTex;
uniform sampler2D uGlyphs;
uniform vec2 uRes;       // canvas, device px
uniform vec2 uTexSize;   // picture, px
uniform float uCell;     // device px
uniform float uGlyphN;
uniform float uGlyphScale;
uniform float uFisheye;
uniform float uSat;
uniform float uExposure;
uniform float uBloom;
uniform float uRadius;   // device px
uniform float uPush;     // device px
uniform float uStrength;
uniform float uTailLen;
uniform float uTime;
uniform float uAlpha;
uniform float uGrade;    // 0 lit, 1 printed: red ink on paper, 2 ember
uniform vec3 uPaperCol;
uniform vec3 uInk;
uniform vec3 uInkDeep;
uniform float uTrailN;
uniform vec4 uTrail[${TRAIL_MAX}]; // xy: uv, zw: velocity in uv/frame

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/* cover fit, biased up the source so a tall picture is read at the subject */
vec2 cover(vec2 uv) {
  float pr = uRes.x / uRes.y;
  float ir = uTexSize.x / uTexSize.y;
  vec2 o = uv;
  if (pr > ir) {
    float s = pr / ir;
    o.y = uv.y / s + (1.0 - 1.0 / s) * 0.5;
    o.y = o.y * 0.92 - 0.055;
  } else {
    float s = ir / pr;
    o.x = uv.x / s + (1.0 - 1.0 / s) * 0.5;
  }
  return clamp(o, 0.0, 1.0);
}

/* the picture's curve inside the glass */
vec2 fisheye(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float a = uRes.x / uRes.y;
  p.x *= a;
  p *= 1.0 + uFisheye * dot(p, p);
  p.x /= a;
  return p * 0.5 + 0.5;
}

/* The tube. A rectangle in half-canvas units whose width grows toward the
   vertical middle and whose height grows toward the horizontal middle, so
   the edges bow while the corners -- where one bow meets the other -- stay
   sharp. Chebyshev distance, not euclidean, is what keeps them sharp. */
float tube(vec2 p) {
  float yn = clamp(p.y / ${TUBE_H.toFixed(2)}, -1.0, 1.0);
  float w = ${TUBE_W.toFixed(2)} + ${BULGE_SIDE.toFixed(3)} * (1.0 - yn * yn);
  float xn = clamp(p.x / ${TUBE_W.toFixed(2)}, -1.0, 1.0);
  float vb = p.y < 0.0 ? ${BULGE_BOTTOM.toFixed(2)} : ${BULGE_TOP.toFixed(2)};
  float h = ${TUBE_H.toFixed(2)} + vb * (1.0 - xn * xn);
  vec2 d = abs(p) - vec2(w, h);
  return max(d.x, d.y);
}

vec3 pic(vec2 uv) {
  vec3 c = texture2D(uTex, cover(uv)).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat) * uExposure;
  if (uGrade > 1.5) {
    /* ember: the footage's own warmth kept, the rest pulled toward crimson.
       Shadow goes to black, mids to a deep red, highlights stay warm. */
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 ramp = mix(vec3(0.0), uInkDeep, smoothstep(0.0, 0.3, lum));
    ramp = mix(ramp, uInk, smoothstep(0.26, 0.62, lum));
    ramp = mix(ramp, vec3(1.0, 0.86, 0.76), smoothstep(0.6, 1.0, lum));
    float warmth = smoothstep(0.0, 0.25, c.r - c.b); // what was already warm keeps more of itself
    c = mix(ramp, c, 0.22 + 0.3 * warmth);
    c *= 0.82 + 0.18 * smoothstep(0.0, 0.08, lum);
  }
  return c;
}

void main() {
  vec2 frag = vUv * uRes;
  vec2 cellId = floor(frag / uCell);
  vec2 centre = (cellId + 0.5) * uCell;
  vec2 cellUv = centre / uRes;

  /* --- the pointer's trail: which cells are being dragged, and which way */
  vec2 drag = vec2(0.0);
  float accum = 0.0;
  if (uTrailN > 0.5) {
    vec2 head = uTrail[0].xy * uRes;
    float hd = distance(centre, head);
    float hm = 1.0 - smoothstep(uRadius * 0.2, uRadius * 0.95, hd);
    float hs = smoothstep(${SPEED_LOW}, ${SPEED_HIGH}, length(uTrail[0].zw));
    drag += normalize(uTrail[0].zw + vec2(0.0001)) * hm * hs * 0.55;
    accum += hm * hs * 0.55;
  }
  for (int i = 0; i < ${TRAIL_MAX - 1}; i++) {
    if (float(i + 1) >= uTrailN) break;
    vec2 a = uTrail[i].xy * uRes;
    vec2 b = uTrail[i + 1].xy * uRes;
    vec2 seg = b - a;
    float len2 = dot(seg, seg);
    if (len2 < 0.0001) continue;
    float h = clamp(dot(centre - a, seg) / len2, 0.0, 1.0);
    float dist = distance(centre, a + seg * h);
    float wpx = uRadius * 0.4;
    float m = 1.0 - smoothstep(wpx, wpx * 2.2, dist);
    m *= mix(1.0, 0.65, h);
    m *= exp(-float(i) / uTailLen);
    float speed = length(uTrail[i].zw) + length(uTrail[i + 1].zw);
    m *= smoothstep(${SPEED_LOW}, ${SPEED_HIGH}, speed);
    /* breaks the trail into cells rather than a smooth smear */
    m *= smoothstep(0.1, 0.95, hash(cellId + vec2(float(i) * 11.7, floor(uTime * 19.0))));
    drag += normalize(seg) * m;
    accum += m;
  }
  float influence = clamp(accum * uStrength * 1.25, 0.0, 1.0);

  /* the push, a whole cell at a time, so the surface's own grid is what moves */
  vec2 stepUv = vec2(uCell) / uRes;
  vec2 pushUv = drag * (uPush / uRes) * influence;
  pushUv = floor(pushUv / stepUv + 0.5) * stepUv;

  /* --- where this cell reads the picture */
  vec2 readUv = fisheye(cellUv + pushUv);
  readUv = clamp(readUv, 0.001, 0.999);
  /* a little tighter under the hand: the cells coarsen as they are pushed */
  float coarse = mix(1.0, 0.45, influence);
  vec2 quant = uRes / uCell * coarse;
  readUv = (floor(readUv * quant) + 0.5) / quant;

  /* colour splits along the drag, faintly, as the reference's does */
  vec2 chroma = normalize(drag + vec2(0.0001)) * 0.0018 * influence;
  vec3 col;
  col.r = pic(readUv + chroma).r;
  col.g = pic(readUv).g;
  col.b = pic(readUv - chroma).b;

  /* --- the mark: a dense glyph, chosen by value, inked in the picture's colour */
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  float idx = floor((1.0 - clamp(luma, 0.0, 1.0)) * (uGlyphN - 1.0) + 0.5);
  vec2 local = (mod(frag, uCell) - uCell * 0.5) / (uCell * 0.5 * uGlyphScale);
  vec2 guv = clamp(local * 0.5 + 0.5, 0.0, 1.0);
  float ink = texture2D(uGlyphs, vec2((idx + guv.x) / uGlyphN, guv.y)).r;
  /* the cells the hand pushes also flare a little, as a disturbed phosphor would */
  col *= 1.0 + 0.35 * influence;
  vec3 mark = col * ink;

  /* --- bloom: the picture itself, blurred, where it is bright */
  vec2 px = 2.0 / uRes;
  vec3 blur = (pic(readUv + vec2(px.x, 0.0)) + pic(readUv - vec2(px.x, 0.0))
             + pic(readUv + vec2(0.0, px.y)) + pic(readUv - vec2(0.0, px.y))) * 0.25;
  float bright = max(max(blur.r, blur.g), blur.b);
  vec3 bloom = blur * smoothstep(0.55, 1.0, bright) * uBloom;

  /* --- the glass */
  float sd = tube(vUv * 2.0 - 1.0);
  float fall = uCell * 0.8 * (2.0 / min(uRes.x, uRes.y));
  float mask = (1.0 - smoothstep(0.0, fall, sd)) * uAlpha;

  vec3 out3 = clamp(mark + bloom, 0.0, 1.0);

  /* printed: the same marks, but as ink on paper. Shadow takes the most ink
     and the deepest red, light the least, so the picture prints as a
     halftone rather than glowing. */
  if (uGrade > 0.5 && uGrade < 1.5) {
    float dens = 1.0 - clamp(luma, 0.0, 1.0);
    vec3 inkCol = mix(uInk, uInkDeep, dens * dens);
    out3 = mix(uPaperCol, inkCol, ink * (0.25 + 0.75 * dens));
  }
  gl_FragColor = vec4(out3 * mask, mask);
}
`

// ---------------------------------------------------------------- helpers

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)
  if (!sh) throw new Error('shader')
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`screen shader: ${log ?? 'compile failed'}`)
  }
  return sh
}

/** The glyph atlas: one row of characters, white on black, in the site's mono. */
function glyphAtlas(chars: string, size = 56) {
  const c = document.createElement('canvas')
  c.width = chars.length * size
  c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // bold, and a chunky fallback: the marks want weight, or they read as hairlines
  ctx.font = `700 ${Math.floor(size * 0.8)}px "JetBrains Mono", Consolas, Menlo, Monaco, monospace`
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], i * size + size * 0.5, size * 0.54)
  }
  return c
}

type Options = {
  /** A looping clip. When absent the still below is the picture. */
  videoSrc?: string
  /** The still the screen shows until (or unless) a clip is given. */
  posterSrc: string
  /** How the picture is read: lit in glass, printed on paper, or graded toward ember. */
  grade?: Grade
}

type TrailPoint = { x: number; y: number; dx: number; dy: number }

export class CrtScreen {
  readonly canvas: HTMLCanvasElement
  readonly supported: boolean

  private gl!: WebGLRenderingContext
  private prog!: WebGLProgram
  private tex!: WebGLTexture
  private glyphs!: WebGLTexture
  private u = new Map<string, WebGLUniformLocation | null>()
  private texSize: [number, number] = [16, 10]
  private video?: HTMLVideoElement
  private dpr = 1

  private trail: TrailPoint[] = []
  private trailData = new Float32Array(TRAIL_MAX * 4)
  private last = { x: 0.5, y: 0.5, t: 0 }
  /** 0..1, how present the hand is; eased by GSAP toward moving / idle */
  private energy = { v: 0 }
  private energyTo: (v: number) => void

  alpha = 1
  private grade: Grade

  constructor({ videoSrc, posterSrc, grade = 'lit' }: Options) {
    this.canvas = document.createElement('canvas')
    this.grade = grade
    this.energyTo = gsap.quickTo(this.energy, 'v', { duration: 0.45, ease: 'power2.out' })
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: 'low-power',
    })
    this.supported = !!gl
    if (!gl) return
    this.gl = gl

    this.prog = gl.createProgram()!
    gl.attachShader(this.prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(this.prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(this.prog)
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      throw new Error(`screen program: ${gl.getProgramInfoLog(this.prog) ?? 'link failed'}`)
    }
    for (const n of [
      'uTex', 'uGlyphs', 'uRes', 'uTexSize', 'uCell', 'uGlyphN', 'uGlyphScale', 'uFisheye', 'uSat',
      'uExposure', 'uBloom', 'uRadius', 'uPush', 'uStrength', 'uTailLen', 'uTime', 'uAlpha', 'uTrailN',
      'uGrade', 'uPaperCol', 'uInk', 'uInkDeep',
    ]) {
      this.u.set(n, gl.getUniformLocation(this.prog, n))
    }
    this.u.set('uTrail', gl.getUniformLocation(this.prog, 'uTrail[0]'))

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(this.prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    this.tex = this.texture()
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([8, 8, 10, 255]))

    this.glyphs = this.texture()
    this.uploadGlyphs()
    // the mono may not be loaded yet; redraw the atlas when it is
    void document.fonts.ready.then(() => this.uploadGlyphs())

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.disable(gl.DEPTH_TEST)

    this.load(videoSrc, posterSrc)
  }

  // ---------------------------------------------------------------- setup

  private texture() {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    return t
  }

  private uploadGlyphs() {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.glyphs)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glyphAtlas(GLYPHS))
  }

  private load(videoSrc: string | undefined, posterSrc: string) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      if (this.video?.readyState) return
      this.upload(img, img.naturalWidth, img.naturalHeight)
    }
    img.src = posterSrc

    if (!videoSrc) return
    const video = document.createElement('video')
    video.src = videoSrc
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.autoplay = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'
    void video.play().catch(() => {})
    this.video = video
  }

  private upload(source: TexImageSource, w: number, h: number) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    this.texSize = [w || 16, h || 10]
  }

  // -------------------------------------------------------------- pointer

  /** The hand moved to (u, v) on the glass, v up. Only movement is recorded. */
  pointerMove(u: number, v: number, now: number) {
    const dx = u - this.last.x
    const dy = v - this.last.y
    if (this.last.t !== 0) this.trail.unshift({ x: u, y: v, dx, dy })
    if (this.trail.length > TRAIL_MAX) this.trail.length = TRAIL_MAX
    this.last = { x: u, y: v, t: now }
    this.energyTo(1)
  }

  pointerLeave() {
    this.last.t = 0
    this.energyTo(0)
  }

  /** each frame: the trail drifts, fades and forgets; the hand's presence lapses when still */
  private stepTrail(now: number) {
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i]
      p.dx *= TRAIL_DECAY
      p.dy *= TRAIL_DECAY
      p.x += p.dx * 0.15
      p.y += p.dy * 0.15
      if (Math.abs(p.dx) + Math.abs(p.dy) < 0.00006) this.trail.splice(i, 1)
    }
    if (this.last.t !== 0 && now - this.last.t > IDLE_MS) this.energyTo(0)
    this.trailData.fill(0)
    const n = Math.min(this.trail.length, TRAIL_MAX)
    for (let i = 0; i < n; i++) {
      const p = this.trail[i]
      this.trailData.set([p.x, p.y, p.dx, p.dy], i * 4)
    }
    return n
  }

  // -------------------------------------------------------------- geometry

  resize(width: number, height: number) {
    if (!this.gl || width <= 0 || height <= 0) return
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    // only the drawing buffer is sized here; the element fills its host from
    // the stylesheet, so it can never feed a size back into the host
    this.canvas.width = Math.round(width * this.dpr)
    this.canvas.height = Math.round(height * this.dpr)
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  // ---------------------------------------------------------------- render

  render(time: number) {
    const gl = this.gl
    if (!gl || !this.canvas.width) return
    const nowMs = time * 1000
    const n = this.stepTrail(nowMs)

    const video = this.video
    if (video && video.readyState >= 2) this.upload(video, video.videoWidth, video.videoHeight)

    gl.useProgram(this.prog)
    const u = (k: string) => this.u.get(k) ?? null
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.glyphs)
    gl.uniform1i(u('uTex'), 0)
    gl.uniform1i(u('uGlyphs'), 1)
    gl.uniform2f(u('uRes'), this.canvas.width, this.canvas.height)
    gl.uniform2f(u('uTexSize'), this.texSize[0], this.texSize[1])
    gl.uniform1f(u('uCell'), Math.max(CELL_CSS * this.dpr, CELL_MIN_PX))
    gl.uniform1f(u('uGlyphN'), GLYPHS.length)
    gl.uniform1f(u('uGlyphScale'), GLYPH_SCALE)
    gl.uniform1f(u('uFisheye'), FISHEYE)
    gl.uniform1f(u('uSat'), SATURATION)
    gl.uniform1f(u('uExposure'), EXPOSURE)
    gl.uniform1f(u('uBloom'), BLOOM)
    gl.uniform1f(u('uRadius'), POINTER_RADIUS * this.dpr)
    gl.uniform1f(u('uPush'), POINTER_PUSH * this.dpr)
    gl.uniform1f(u('uStrength'), POINTER_STRENGTH * (0.15 + this.energy.v * 0.85))
    gl.uniform1f(u('uTailLen'), TRAIL_LENGTH)
    gl.uniform1f(u('uTime'), time)
    gl.uniform1f(u('uAlpha'), this.alpha)
    gl.uniform1f(u('uTrailN'), n)
    gl.uniform4fv(u('uTrail'), this.trailData)
    gl.uniform1f(u('uGrade'), GRADE_ID[this.grade])
    gl.uniform3f(u('uPaperCol'), PAPER.r, PAPER.g, PAPER.b)
    gl.uniform3f(u('uInk'), INK.r, INK.g, INK.b)
    gl.uniform3f(u('uInkDeep'), INK_DEEP.r, INK_DEEP.g, INK_DEEP.b)

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  dispose() {
    const gl = this.gl
    gsap.killTweensOf(this.energy)
    if (!gl) return
    if (this.video) {
      this.video.pause()
      this.video.removeAttribute('src')
      this.video.load()
    }
    gl.deleteTexture(this.tex)
    gl.deleteTexture(this.glyphs)
    gl.deleteProgram(this.prog)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
