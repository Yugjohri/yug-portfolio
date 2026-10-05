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

/** The black hole is traced ray by ray, so its pass is kept to about this
 *  many pixels and drawn up to the panel's size: the picture is soft light,
 *  and the extra samples at the rim (below) keep the edges clean. */
const MAX_DPR = 1.5
const MAX_PIXELS = 1_050_000

/**
 * The ASCII panel reads its frame back at ~150 characters wide, so it does not
 * need a full-resolution pass. Rendering its warp smaller keeps the second pass
 * per frame close to free.
 */
const ASCII_PASS_SCALE = 0.35
const ASCII_PASS_MIN = 320

/** Mirrors of the shader's framing, for measuring the hole from outside it:
 *  the resting zoom, the shadow's radius (R_H), how far above centre the hole
 *  sits (0.031 / 2.50, in units of the short side), and the cursor's
 *  parallax (0.035 x CURSOR_K). */
export const ZOOM_REST = 2.1
const SHADOW_R = 0.28
/** and the near half of the disk, which crosses in front of the shadow: its
 *  inner edge (R_IN) comes within R_IN x SQ of the centre */
const CLEAR_R = 0.31 * 0.21

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
uniform float     uZoom;      // how far back the camera sits: 2.50 at rest
uniform float     uDive;      // 0 at rest; toward 1 the stars streak in toward the hole
uniform vec2      uCenter;    // where the hole sits, from the panel's centre, in short-side units

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

/* ---- The black hole, traced.
   Units: the Schwarzschild radius is 1. Each pixel is a ray from a pinhole
   camera thirty radii out, a little above the disk's plane; the ray is bent by
   the hole's gravity (the photon orbit equation, integrated in steps), picks up
   the accretion disk each time it crosses the plane, and ends either in the
   hole or out among the stars, which it then shows from the direction it left
   in. Everything the old painting faked -- the arc over the top, the thinner
   one beneath, the bright ring at the shadow's edge, the sky bent round it --
   falls out of the bending. */
const float R_H   = 0.28;    /* the shadow's radius on screen (mirrored in TS as SHADOW_R) */
const float B_CRIT = 2.598;  /* the shadow's radius in impact parameter: 3*sqrt(3)/2 */
const float CAM_D = 30.0;
const float INC   = 0.13;    /* the camera's height above the disk plane, radians */
const float TILT  = 0.0;     /* level, so the two halves mirror across the divider */
const float R_IN  = 3.0;     /* innermost stable orbit */
const float R_OUT = 10.5;
const float PI    = 3.14159265;

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

/* the sky behind it, by direction: faint nebula and three layers of stars,
   hashed in 3D so no seam runs anywhere a bent ray might look */
vec3 sky(vec3 d, float time) {
  vec3 c = BG;
  float n = fbm(d.xy * 2.4 + vec2(d.z * 1.7, -d.z));
  float n2 = fbm(d.yz * 3.1 - vec2(1.3, d.x));
  c += vec3(0.09, 0.03, 0.12) * smoothstep(0.42, 0.95, n) * 0.55;
  c += vec3(0.02, 0.04, 0.09) * smoothstep(0.35, 0.9, n2) * 0.55;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float k = 70.0 + fi * 65.0;
    vec3 q = d * k + fi * 13.7;
    vec3 cell = floor(q);
    float h = hash3(cell);
    if (h > 0.972) {
      vec3 off = vec3(hash3(cell + 1.3), hash3(cell + 2.7), hash3(cell + 4.1)) - 0.5;
      float dd = length(fract(q) - 0.5 - off * 0.5);
      float tw = 0.65 + 0.35 * sin(time * 1.8 + h * 90.0);
      vec3 tint = mix(vec3(1.0, 0.86, 0.72), vec3(0.72, 0.82, 1.0), fract(h * 97.0));
      c += tint * smoothstep(0.075, 0.0, dd) * tw * (1.5 - fi * 0.35);
    }
  }
  return c;
}

/* the disk at a crossing: colour (premultiplied) and opacity.
   Hotter inward; Doppler-boosted on the side turning toward the camera and
   dimmed on the other; reddened by the climb out of the hole's well. */
vec4 disk(vec3 hit, vec3 rd, float time, float dive) {
  float r = length(hit.xz);
  float edge = smoothstep(R_IN, R_IN + 0.7, r) * (1.0 - smoothstep(R_OUT * 0.55, R_OUT, r));
  if (edge <= 0.0) return vec4(0.0);
  float phi = atan(hit.z, hit.x);
  float beta = min(sqrt(0.5 / max(r - 1.0, 0.5)), 0.7);
  vec3 vel = normalize(vec3(-hit.z, 0.0, hit.x)) * beta;
  float gamma = inversesqrt(1.0 - beta * beta);
  float g = 1.0 / (gamma * (1.0 - dot(vel, -rd))) * sqrt(max(1.0 - 1.0 / r, 0.05));

  /* turbulence carried round at the orbit's own rate (inner laps outer); the
     angle enters through cos/sin so the texture closes on itself */
  float sw = phi - time * (0.9 + 2.2 * dive) * pow(R_IN / r, 1.5);
  vec2 ring = vec2(cos(sw), sin(sw));
  float n = fbm4(ring * 1.9 + vec2(r * 0.85, r * 0.55));
  float fil = noise(ring * 4.6 + vec2(r * 2.4, -r * 1.2)) * 0.65 + noise(ring * 9.0 + vec2(r * 4.1, r)) * 0.35;
  float dens = (0.45 + 1.0 * n) * (0.62 + 0.7 * fil);

  float temp = pow(R_IN / r, 0.78);
  float lum = dens * edge * temp * temp * pow(g, 3.4) * 3.4;
  float t = clamp(temp * g * 1.08, 0.0, 1.4);
  vec3 c = mix(vec3(0.45, 0.06, 0.03), vec3(0.98, 0.30, 0.07), smoothstep(0.15, 0.45, t));
  c = mix(c, vec3(1.0, 0.68, 0.30), smoothstep(0.45, 0.78, t));
  c = mix(c, vec3(1.0, 0.95, 0.86), smoothstep(0.82, 1.15, t));
  float alpha = clamp(dens * edge * 1.15, 0.0, 0.96);
  return vec4(c * lum, alpha);
}

/* one ray, from impact parameter b (in hole radii) on the camera's image plane */
vec3 trace(vec2 b, float time, float dive) {
  vec3 cam = vec3(0.0, sin(INC), -cos(INC)) * CAM_D;
  vec3 fw = -cam / CAM_D;
  vec3 rt = vec3(1.0, 0.0, 0.0);
  vec3 up = cross(fw, rt);
  vec3 p = cam;
  vec3 v = normalize(fw * CAM_D + rt * b.x + up * b.y);
  vec3 hv = cross(p, v);
  float h2 = dot(hv, hv);

  vec3 col = vec3(0.0);
  float T = 1.0;
  bool caught = false;
  float nb = length(b);
  int n = 0; /* which crossing of the disk plane this is */
  for (int i = 0; i < 180; i++) {
    float r2 = dot(p, p);
    float r = sqrt(r2);
    if (r < 1.0) { caught = true; break; }
    if (r > CAM_D + 2.0 && dot(p, v) > 0.0) break;
    float dt = clamp(0.065 * r - 0.03, 0.025, 2.0);
    vec3 prev = p;
    v += -1.5 * h2 * p / (r2 * r2 * r) * dt;
    p += v * dt;
    if (prev.y * p.y < 0.0) {
      vec3 hit = mix(prev, p, prev.y / (prev.y - p.y));
      vec4 d = disk(hit, normalize(v), time, dive);
      n++;
      float r_hit = length(hit.xz);
      /* the second image -- the strip bent under the hole -- is kept to the
         disk's inner part, so it reads as a thin band */
      if (n == 2) d *= 1.0 - smoothstep(R_IN + 1.6, R_IN + 3.6, r_hit);
      /* the arcs fade just before the photon ring instead of running into its
         edge, so they read as passing behind it. The ring itself (rays within a
         hair of the critical radius, and every third-or-later crossing) is
         untouched. */
      /* (a crossing after the ray's closest pass, i.e. light that has gone round the hole) */
      if (n <= 2 && nb > B_CRIT + 0.06 && dot(prev, v) > 0.0) d *= smoothstep(B_CRIT + 0.06, B_CRIT + 0.7, nb);
      col += T * d.rgb;
      T *= 1.0 - d.a;
      if (T < 0.02) break;
    }
  }
  if (!caught) col += T * sky(normalize(v), time);
  return col;
}

void main() {
  float m = min(uRes.x, uRes.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / m;

  /* Cursor reads as mass: it drags the image toward itself and parallaxes the
     whole field. Each panel passes its own cursor, so only the panel under the
     pointer is warped. */
  /* the hole sits where the panel is told (on the line between the two
     panels, so each shows its half); the cursor reads as a small extra mass,
     pulling the picture toward itself where it rests */
  vec2 toCursor = uv - uPointer;
  float reach = 0.013;
  float pull = uPointerAmt * reach / (dot(toCursor, toCursor) + reach);
  uv -= normalize(toCursor + vec2(1e-5)) * pull * 0.05;

  vec3 col;
  float r;
  if (uUseVideo > 0.5) {
    r = length(uv);
    vec2 tex = (uv * m + 0.5 * uRes) / uRes;
    col = texture2D(uVideo, tex).rgb;
    col = pow(max(col, 0.0), vec3(1.30));
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, 1.35);
  } else {
    uv -= uCenter;
    uv *= uZoom;
    r = length(uv);
    /* screen to impact parameter: the shadow's edge lands at R_H */
    vec2 q = uv * rot(TILT) * (B_CRIT / R_H);
    /* a dive streaks the sky in toward the hole */
    q *= 1.0 + 0.25 * uDive * smoothstep(0.0, 2.5, length(q) / 12.0);
    float px = uZoom * (B_CRIT / R_H) / m;
    float rb = length(q);
    /* one ray a pixel, four at the rim -- the shadow, the photon ring and the
       arcs over and under, where one ray a pixel leaves stair-steps */
    if (abs(rb - B_CRIT) < 0.9 + 3.0 * px || (abs(q.y) < 0.9 && rb < R_OUT + 1.0)) {
      col = vec3(0.0);
      for (int s = 0; s < 4; s++) {
        vec2 o = vec2(mod(float(s), 2.0) - 0.5, floor(float(s) / 2.0) - 0.5) * px * 0.5;
        o = vec2(o.x * 0.97 - o.y * 0.24, o.x * 0.24 + o.y * 0.97);
        col += trace(q + o, uTime, uDive);
      }
      col *= 0.25;
    } else {
      col = trace(q, uTime, uDive);
    }
    /* a faint warmth round the hole, as its light scatters */
    col += vec3(1.0, 0.45, 0.18) * 0.022 * exp(-pow((r - R_H) / 0.45, 2.0)) * smoothstep(R_H - 0.01, R_H + 0.03, r);
  }

  /* vignette back down to the page colour */
  /* vignette back down to the page colour, measured in the pulled-back units:
     the same place on screen it always began, so the band's far ends survive */
  col = mix(BG, col, 1.0 - smoothstep(1.6, 3.2, r) * 0.70);

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
  /** the canvas' size in CSS px, as last given to resize() */
  private cssW = 1
  private cssH = 1
  /** the disk's clock: equal to the caller's time while spin is 1 */
  private clock = { last: Number.NaN, offset: 0 }

  /** How far back the camera sits (the shader's uZoom). 2.50 is the landing's framing. */
  zoom = ZOOM_REST
  /** How fast the disk turns, as a multiple of its own speed. */
  spin = 1
  /** 0.5..1: a share of the full resolution. The hero lowers it when frames
   *  run slow (a weak graphics chip) and raises it again when they recover;
   *  at 1 on any ordinary machine. Takes effect at the next resize(). */
  quality = 1
  /** 0..1: how far the stars are drawn in toward the hole by a dive. */
  dive = 0
  /** Where each panel's pass puts the hole, from the panel's centre in short-side
   *  units: on the line between the panels, so the Brief shows its left half
   *  in ASCII and the Story its right half, lit. Set by the hero from layout. */
  centers: Record<'brief' | 'story', { x: number; y: number }> = { brief: { x: 0, y: 0 }, story: { x: 0, y: 0 } }

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
      'uGrade', 'uPaperCol', 'uInk', 'uInkDeep', 'uZoom', 'uDive', 'uCenter',
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

  /**
   * The hole's centre in the canvas, CSS px from its top-left. The shader
   * places it a little above centre, and the cursor's parallax drifts the
   * whole field; the pull right under the cursor is local and not counted.
   * `pointer` and `amount` are what the panel is rendering with.
   */
  holeCentrePx(_pointerX = 0, _pointerY = 0, _amount = 0, which: 'brief' | 'story' = 'story') {
    const m = Math.min(this.cssW, this.cssH)
    const c = this.centers[which]
    return { x: this.cssW / 2 + c.x * m, y: this.cssH / 2 - c.y * m }
  }

  /** The shadow's radius in CSS px at the current zoom. */
  shadowRadiusPx() {
    return (SHADOW_R / this.zoom) * Math.min(this.cssW, this.cssH)
  }

  /** How much of the shadow, from its centre, nothing crosses: the near half
   *  of the disk passes in front of the rest. CSS px at the current zoom. */
  clearRadiusPx() {
    return (CLEAR_R / this.zoom) * Math.min(this.cssW, this.cssH)
  }

  /** Size the source to one panel, in CSS pixels. */
  resize(width: number, height: number) {
    this.cssW = Math.max(1, width)
    this.cssH = Math.max(1, height)
    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    dpr = Math.min(dpr, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)))
    dpr *= this.quality
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
    which: 'brief' | 'story' = 'story',
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

    // spin speeds the disk by running its clock faster from here on; while
    // it is 1 the offset never moves and the clock is exactly the caller's
    if (!Number.isNaN(this.clock.last) && this.spin !== 1) {
      this.clock.offset += (time - this.clock.last) * (this.spin - 1)
    }
    this.clock.last = time

    gl.uniform2f(this.u.uRes, w, h)
    gl.uniform1f(this.u.uTime, time + this.clock.offset)
    gl.uniform1f(this.u.uZoom, this.zoom)
    gl.uniform1f(this.u.uDive, this.dive)
    gl.uniform2f(this.u.uCenter, this.centers[which].x, this.centers[which].y)
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
