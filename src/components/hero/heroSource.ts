/**
 * The single source of truth for the hero visual.
 *
 * One WebGL canvas renders one frame. Both hero panels read *that* canvas, so
 * they cannot drift apart — there is only ever one clock and one image.
 *
 * By default the frame is a procedurally animated black hole (loops forever,
 * no asset needed). Pass `videoSrc` and the same pipeline samples a video
 * texture instead — still one source, still rendered twice downstream.
 */

export type HeroSourceOptions = {
  /** Optional looping video used as the source instead of the procedural render. */
  videoSrc?: string
  /** How the frame is read: lit, printed on paper, or graded toward ember. */
  grade?: Grade
}

import { GRADE_ID, INK, INK_DEEP, PAPER, type Grade } from '../../theme'

const MAX_DPR = 2

/**
 * The ASCII panel reads its frame back at ~150 characters wide, so it does not
 * need a full-resolution pass. Rendering its warp smaller keeps the second pass
 * per frame close to free.
 */
const ASCII_PASS_SCALE = 0.35
const ASCII_PASS_MIN = 320

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;

varying vec2 vUv;

uniform vec2      uRes;
uniform float     uTime;
uniform vec2      uPointer;    // same space as uv
uniform float     uPointerAmt; // 0 = idle, 1 = cursor over the hero
uniform float     uUseVideo;
uniform sampler2D uVideo;
uniform float     uGrade;     // 0 lit, 1 printed on paper, 2 ember
uniform vec3      uPaperCol;
uniform vec3      uInk;
uniform vec3      uInkDeep;

const vec3 BG = vec3(0.024, 0.024, 0.059);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

/* Four octaves for the disk. The fifth is the first to fall below a pixel once
   the shear winds up, which is what turns the filaments into moire. */
float fbm4(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v / 0.9375;
}

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

/* Black-hole geometry, in screen units where the panel's short side is 1. */
const float R_H   = 0.28;   /* shadow radius */
const float SQ    = 0.21;   /* disk squash: sin of the viewing inclination */
const float R_IN  = 0.31;   /* disk inner edge, disk-plane units */
const float R_OUT = 1.85;   /* disk outer edge */
const float TILT  = -0.21;  /* disk rotation on screen */
const float ARC_T = 0.05;   /* thickness of the lensed far-side arc at the top */
const float PI    = 3.14159265;

/* Colour + intensity of the disk at disk-plane polar (rho, phi).
   rgb is premultiplied by intensity; a is the intensity itself. */
vec4 diskTex(float rho, float phi, float time) {
  /* Rotation in two parts: a rigid spin, plus a gentler keplerian shear so the
     inner material still laps the outer. Only the shear varies with radius, and
     it is the radial rate of change that aliases -- so it is kept small. */
  float swirl = phi + time * 0.40 + time * 0.26 / pow(max(rho, 0.36), 1.05);

  /* Sample the turbulence on a ring rather than on the angle itself. atan()
     jumps from +PI to -PI along one radius; feeding that straight into the
     noise put a 2PI step in its input and tore a seam across the disk.
     cos/sin are continuous there, so the texture closes on itself. The ring is
     deliberately small: its radius multiplies the radial rate above. */
  vec2 ring = vec2(cos(swirl), sin(swirl)) * 2.3;
  float turb = fbm4(ring + vec2(rho * 3.0, rho * 1.9));
  turb = 0.55 + 0.9 * turb;

  float band = smoothstep(R_IN, R_IN + 0.09, rho) * (1.0 - smoothstep(1.15, R_OUT, rho));
  float amt = band * turb / (1.0 + rho * rho * 0.85);

  /* relativistic beaming: the approaching side burns brighter */
  amt *= 1.0 + 0.26 * cos(phi);
  amt = clamp(amt, 0.0, 1.6);

  float t = clamp(amt * 1.35, 0.0, 1.0);
  vec3 c = mix(vec3(0.30, 0.05, 0.30), vec3(0.90, 0.16, 0.06), smoothstep(0.10, 0.40, t));
  c = mix(c, vec3(1.00, 0.55, 0.18), smoothstep(0.40, 0.70, t));
  c = mix(c, vec3(1.00, 0.96, 0.92), smoothstep(0.72, 0.96, t));

  return vec4(c * amt, amt);
}

vec3 starfield(vec2 p, float time) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 q = p * (150.0 + fi * 110.0) + fi * 31.0;
    float h = hash(floor(q));
    vec2 f = fract(q) - 0.5;
    float tw = 0.55 + 0.45 * sin(time * 2.2 + h * 63.0);
    vec3 tint = mix(mix(vec3(0.45, 1.00, 0.55), vec3(0.55, 0.70, 1.00), step(0.5, fi)),
                    vec3(1.00, 0.45, 0.45), step(1.5, fi));
    c += tint * step(0.9915, h) * smoothstep(0.42, 0.0, length(f)) * tw;
  }
  return c * 0.85;
}

void main() {
  float m = min(uRes.x, uRes.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / m;

  /* Cursor reads as mass: it drags the image toward itself and parallaxes the
     whole field. Each panel passes its own cursor, so only the panel under the
     pointer is warped. */
  vec2 toCursor = uv - uPointer;
  float pull = uPointerAmt * 0.055 / (dot(toCursor, toCursor) + 0.055);
  uv -= normalize(toCursor + vec2(1e-5)) * pull * 0.10;
  uv -= uPointer * uPointerAmt * 0.035;

  /* frame the hole: pulled back a little, sitting just above centre */
  if (uUseVideo < 0.5) {
    uv *= 1.20;
    uv.y -= 0.015;
  }

  float r = length(uv);
  vec3 col;

  if (uUseVideo > 0.5) {
    vec2 tex = (uv * m + 0.5 * uRes) / uRes;
    col = texture2D(uVideo, tex).rgb;
    col = pow(max(col, 0.0), vec3(1.30));
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, 1.35);
  } else {
    col = BG + starfield(uv * 0.9, uTime);

    /* disk-plane coordinates: tilted on screen, squashed by inclination */
    vec2 p = uv * rot(TILT);
    vec2 e = vec2(p.x, p.y / SQ);
    float rho = length(e);
    float phi = atan(e.y, e.x);

    /* one continuous band. The far half is behind the hole: dimmer and redder,
       blended through phi so the left/right extremes do not step. */
    vec4 fb = diskTex(rho, phi, uTime);
    float farW = smoothstep(-0.15, 0.45, sin(phi));
    vec3 farC = fb.rgb * (0.14 * farW) * mix(vec3(1.0), vec3(1.0, 0.58, 0.48), farW);

    /* lensing: far-side material close to the hole is bent over the top of the
       shadow and compressed into a thin bright arc hugging its edge. Radial
       offset from the shadow edge maps onto disk radius. */
    float ang = atan(uv.y, uv.x);
    float up = clamp(sin(ang), 0.0, 1.0);
    float T = ARC_T * pow(up, 0.5) + 1e-4;
    float off = r - R_H;
    float u = off / T;
    vec4 arcT = diskTex(R_IN + clamp(u, 0.0, 1.0) * 1.3, PI - ang, uTime);
    float arcEnv = smoothstep(-0.005, 0.005, off) * (1.0 - smoothstep(0.7, 1.0, u)) * pow(up, 0.45);
    vec3 arc = arcT.rgb * (arcEnv * 1.15);

    /* --- behind the hole */
    col += farC + arc;

    /* the shadow eats everything behind it */
    col *= smoothstep(R_H - 0.012, R_H + 0.004, r);

    /* photon ring at the shadow edge, brightest where the arc lands */
    float ring = exp(-pow((r - (R_H + 0.003)) / 0.0085, 2.0)) * (0.7 + 0.5 * up);
    col += vec3(1.00, 0.80, 0.55) * (ring * 0.95);
    col += vec3(1.00, 0.45, 0.18) * 0.05 * exp(-pow((r - R_H - 0.02) / 0.075, 2.0));

    /* --- in front of the hole: the near half of the band, composited OVER so
       it occludes the ring and the lower part of the shadow outline */
    vec3 nearC = fb.rgb * (1.0 - farW);
    float nearA = clamp(fb.a * (1.0 - farW) * 1.6, 0.0, 1.0);
    col = col * (1.0 - nearA) + nearC;
  }

  /* vignette back down to the page colour */
  col = mix(BG, col, 1.0 - smoothstep(0.46, 0.95, r) * 0.80);

  /* filmic tonemap keeps the ring white-hot instead of clipping it flat */
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

  /* grain */
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * 0.035;

  /* printed: what was light is ink on paper. The disk lays down the red, the
     white-hot ring the deepest ink, and the shadow is the paper left bare. */
  if (uGrade > 1.5) {
    /* ember: the disk's own warmth kept, but pulled toward crimson; the
       blacks deepened, the ring left warm rather than white */
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    vec3 ramp = mix(vec3(0.0), uInkDeep, smoothstep(0.0, 0.32, lum));
    ramp = mix(ramp, uInk, smoothstep(0.28, 0.66, lum));
    ramp = mix(ramp, vec3(1.0, 0.84, 0.74), smoothstep(0.62, 1.0, lum));
    col = mix(col, ramp, 0.7);
    col *= smoothstep(0.0, 0.05, lum) * 0.15 + 0.85;
  } else if (uGrade > 0.5) {
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    vec3 inkCol = mix(uInk, uInkDeep, smoothstep(0.5, 1.0, lum));
    col = mix(uPaperCol, inkCol, smoothstep(0.03, 0.85, lum));
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[hero] shader compile failed:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export class HeroSource {
  /** The one canvas both panels read from. */
  readonly canvas: HTMLCanvasElement
  readonly video: HTMLVideoElement | null = null

  private gl: WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private buffer: WebGLBuffer | null = null
  private texture: WebGLTexture | null = null
  private u: Record<string, WebGLUniformLocation | null> = {}
  private asciiW = 1
  private asciiH = 1
  private grade: Grade

  constructor({ videoSrc, grade = 'lit' }: HeroSourceOptions = {}) {
    this.canvas = document.createElement('canvas')
    this.grade = grade

    const gl = this.canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      // the ASCII pass reads this canvas back every frame
      preserveDrawingBuffer: true,
    }) as WebGLRenderingContext | null
    if (!gl) return

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    const program = vs && fs ? gl.createProgram() : null
    if (!vs || !fs || !program) return

    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[hero] program link failed:', gl.getProgramInfoLog(program))
      return
    }
    gl.deleteShader(vs)
    gl.deleteShader(fs)

    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    gl.useProgram(program)
    for (const name of [
      'uRes', 'uTime', 'uPointer', 'uPointerAmt', 'uUseVideo', 'uVideo',
      'uGrade', 'uPaperCol', 'uInk', 'uInkDeep',
    ]) {
      this.u[name] = gl.getUniformLocation(program, name)
    }
    gl.uniform3f(this.u.uPaperCol, PAPER.r, PAPER.g, PAPER.b)
    gl.uniform3f(this.u.uInk, INK.r, INK.g, INK.b)
    gl.uniform3f(this.u.uInkDeep, INK_DEEP.r, INK_DEEP.g, INK_DEEP.b)

    this.gl = gl
    this.program = program

    if (videoSrc) {
      const video = document.createElement('video')
      video.src = videoSrc
      video.loop = true
      video.muted = true
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      video.play().catch(() => {})

      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.uniform1i(this.u.uVideo, 0)

      this.video = video
      this.texture = texture
    }
  }

  get supported() {
    return this.gl !== null
  }

  /** Dimensions of the reduced-resolution pass the ASCII panel reads. */
  get asciiPass() {
    return { width: this.asciiW, height: this.asciiH }
  }

  /** Size the source to one panel, in CSS pixels. */
  resize(width: number, height: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const w = Math.max(1, Math.round(width * dpr))
    const h = Math.max(1, Math.round(height * dpr))
    if (this.canvas.width === w && this.canvas.height === h) return
    this.canvas.width = w
    this.canvas.height = h

    // one scale for both axes, so the reduced pass keeps the same composition
    const scale = Math.min(1, Math.max(ASCII_PASS_SCALE, ASCII_PASS_MIN / Math.min(w, h)))
    this.asciiW = Math.max(1, Math.round(w * scale))
    this.asciiH = Math.max(1, Math.round(h * scale))
  }

  /**
   * Draw one frame. `pointer` is in the shader's uv space; `amount` is 0..1.
   *
   * `width`/`height` render into a sub-rectangle anchored at the canvas'
   * bottom-left instead of the whole canvas. Both panels call this with the
   * same `time` but their own pointer, so they show the same moment of the same
   * source while reacting to their own cursor independently.
   *
   * `grade` overrides the source's own setting for this pass: the ASCII pass
   * reads luminance back, so it always wants the lit frame.
   */
  render(
    time: number,
    pointerX: number,
    pointerY: number,
    amount: number,
    width?: number,
    height?: number,
    grade = this.grade,
  ) {
    const gl = this.gl
    if (!gl || !this.program) return

    const w = width ?? this.canvas.width
    const h = height ?? this.canvas.height
    gl.viewport(0, 0, w, h)

    if (this.video && this.texture && this.video.readyState >= 2) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.video)
    }

    gl.uniform2f(this.u.uRes, w, h)
    gl.uniform1f(this.u.uTime, time)
    gl.uniform2f(this.u.uPointer, pointerX, pointerY)
    gl.uniform1f(this.u.uPointerAmt, amount)
    gl.uniform1f(this.u.uUseVideo, this.video ? 1 : 0)
    gl.uniform1f(this.u.uGrade, GRADE_ID[grade])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  dispose() {
    const gl = this.gl
    this.video?.pause()
    if (!gl) return
    if (this.texture) gl.deleteTexture(this.texture)
    if (this.buffer) gl.deleteBuffer(this.buffer)
    if (this.program) gl.deleteProgram(this.program)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    this.gl = null
  }
}
