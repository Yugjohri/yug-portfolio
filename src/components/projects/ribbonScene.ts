/**
 * The projects ribbon, drawn as one surface.
 *
 * Every card is a subdivided plane whose vertices all pass through the same
 * height field, so the row bends as one sheet rather than as separate tilted
 * cards: an S in depth across the frame (near through the left half, far
 * through the right), a bank read off that curve's own slope, a "door" tilt
 * across the width, and at speed a wring of the two sides against each other
 * plus a rear-up of the left side toward the camera. The strip wraps, so it
 * has no ends.
 *
 * Titles are drawn on the surface too, as a second texture per card, so the
 * type bends, recedes and lights exactly as the screen it belongs to. The
 * scene reports which card is under the pointer; the DOM handles the rest.
 *
 * WebGL1, no dependencies, same conventions as hero/heroSource.ts.
 */

import gsap from 'gsap'
import { THEME } from '../../theme'
import type { Sleeve } from '../../data/portfolio'

// ---------------------------------------------------------------- constants

/** Camera: what makes depth this legible. Half-height at z=0 is tan(fov/2)*z. */
const FOV = 75
const CAM_Z = 27
const NEAR = 0.1
const FAR = 220

/** Sheet dials, resting. See the shader for what each one is. */
const SHEET_T = 1.05 // how much of the frame the S spans: the near crest and far trough both inside it
const SHEET_DEPTH = 0.19 // wave amplitude as a share of the half-width -- the shape it has at rest
const SHEET_VEL_DEPTH = 0.4 // how much speed deepens it: a moderate add to an already-curved sheet
const DOOR = -0.1 // depth at the frame edge as a share of the half-width
const DENT = 0.0 // the card no longer bows as a whole: the cursor's own hollow does all the work

/** Card proportions, matched to the reference: a shade wider than 16:10, ~42% of the height. */
const CARD_H = 0.42
const CARD_ASPECT = 1.58
const GAP = 0.008 // of the viewport width (was 0.012: the cards now sit a third closer)
const CORNER_PX = 28

/** The same two numbers the shader uses, for the CPU copy of the sheet. */
const SHEET_TAIL = 0.85
const SHEET_SHIFT = -0.123

/**
 * The cursor. A hand pressed into cloth: a round hollow under the pointer,
 * with a low ridge where the pushed-aside material gathers, that follows the
 * hand with a lag. Moving leaves trailing hollows along the path that relax
 * in place, so a sweep drags the surface and it settles when the hand stops.
 * The hollow's slope displaces the picture and is lit as a real surface; the
 * cloth is also drawn a little toward the hand.
 */
const PRESS_DEPTH = 0.09 // how far the stamp presses the surface in, as a share of the card's height
const PRESS_RADIUS = 0.14 // the stamp's radius, as a share of the card's height
const PRESS_EDGE = 0.84 // where the floor starts turning up: flat inside this share of the radius
/* The cloth: a broad, soft swell that the moving hand raises and leaves
   behind, relaxing slowly -- what makes the surface heave like fabric rather
   than just carry a mark. Taps are wide and few; the memory is what reads. */
const BALL_TAPS = 6
const BALL_RADIUS = 0.55 // the swell's radius, as a share of the card's height
const BALL_LIFT = 0.16 // the unit the field's heights are in, as a share of the card's height
const BALL_WAKE = 0.6 // a swell's height at full amplitude, in that unit
/* The picture is NOT slid across the surface: the cloth bends in space and
   whatever is printed on it bends with it, so type and video stay true. */
const BALL_WARP = 0.0
const BALL_FOLLOW = 7 // hand lag, 1/s
const BALL_DECAY = 1.5 // how fast a swell relaxes, 1/s
const BALL_TAP_EVERY = 0.06 // seconds between trail samples
const LENS_PULL = 0.0 // the cloth is not dragged sideways: the dish stays even, the print unstretched
const LENS_RADIUS = 0.7 // of the card's height

/*
 * The card under the hand: a plate with weight. It rises a little toward the
 * reader and tips away from where the hand is -- press the right side and the
 * right side gives -- on a spring that is just under-damped, so a quick sweep
 * carries it past and it settles back, and the hand's own speed leans it the
 * way it is going. Pressing sinks it; letting go lifts it again. All of it is
 * an offset on the card's own surface, applied before the sheet bends it, so
 * the ribbon's geometry stays what it was.
 */
export const TILT_SLOPE = 0.025 // depth change per world unit across the card at full tip (~1.4deg): a lean, not a swing
export const TILT_K = 110 // spring stiffness, 1/s^2
export const TILT_ZETA = 0.8 // damping ratio: settles without swinging past
export const TILT_SPEED = 0.025 // how much the hand's speed (card widths/s) leans it
export const LIFT_K = 150
export const LIFT_ZETA = 0.85
export const LIFT_Z = 0.012 // rise under the hand, as a share of the card's height: well inside the gap to its neighbours
export const LIFT_PRESS = -0.45 // the pressed depth, in units of that rise

/*
 * The opened card. A click takes the card as it is -- tipped, lifted, bent
 * with the sheet -- and flies that same surface to the panel's frame: the
 * middle leads and the sides follow a little behind, so it billows out of the
 * ribbon and lays flat as it arrives, washing to the panel's paper on the way.
 * The rest of the stage darkens under it. The DOM panel then fades in over a
 * card that is already exactly where it is.
 */
const OPEN_LAG_X = 0.15 // how far behind the middle the side edges arrive, of the flight
const OPEN_LAG_Y = 0.05
const OPEN_BULGE = 0.06 // how far the card billows toward the reader mid-flight, of its height
const OPEN_CORNER_PX = 24 // the panel's radius
const VEIL = 0.52 // how far the stage darkens behind an opened card
const VEIL_RGB: [number, number, number] = [0.05, 0.05, 0.06]

const FLOOR_RUN = 70 // world units the floor recedes past the strip
const FLOOR_NEAR = 22 // world units it comes toward the camera

// ---------------------------------------------------- the surface (cursor)
//
// The hand does not touch the ribbon. It disturbs a thin sheet lying over the
// rendered picture: a displacement field, kept as a small texture, into which
// each frame's pointer movement is pushed, and which carries itself along,
// softens and settles on its own. The finished frame is read through that
// field, so the picture under the hand bends and the ribbon's geometry never
// moves. One field for the whole stage: a stroke runs across every screen
// and the gaps between them as one surface.

/** Field texels across; the height follows the canvas' aspect. */
export const SURFACE_RES = 192
/** The hand's reach into the sheet, as a fraction of the canvas height. */
export const STIR_RADIUS = 0.09
/** Displacement pushed per unit the hand moved this frame (both in height units). */
export const STIR_GAIN = 0.7
/** The most the sheet can be pushed anywhere, in height units: fast strokes saturate here. */
export const STIR_MAX = 0.06
/** Half-life of a disturbance, seconds: how briefly the sheet remembers. */
export const SURFACE_HALF_LIFE = 0.12
/** How far a disturbance is carried along its own flow each frame, and how much
 *  it blends with its neighbours: the drift and softening that make it fluid. */
export const SURFACE_DRIFT = 0.55
export const SURFACE_SPREAD = 0.3
/** How quickly the smoothed hand follows the pointer, seconds. */
export const HAND_LAG = 0.07

// ------------------------------------------------------------------ shaders

const SHEET_GLSL = /* glsl */ `
const float PI = 3.141592653589793;
const float SHEET_BANK = -0.14;
const float SHEET_DIAG = 0.03;
const float SHEET_REAR_Y = 0.07;
const float SHEET_REAR_Z = 0.12;
const float SHEET_VTWIST = 1.8;
const float SHEET_TAIL = 0.85;
const float SHEET_SHIFT = -0.123;

uniform float uSheetW; // frustum half-width at z=0
uniform float uSheetD; // the wave's amplitude, world units
uniform float uSheetT; // how much of the frame the S spans
uniform float uSheetC; // 0 = symmetric bowl, 1 = the near-to-far S
uniform float uSheetP; // sheet strength
uniform float uSheetV; // scroll speed, 0..1
uniform float uLeanA;  // door: depth at the frame edge
uniform float uLeanW;  // door: half-width

float sheetQ(float wx) { return wx / max(uSheetW, 0.0001) * uSheetT + SHEET_SHIFT; }

/* The tail is heavier on the far side. A plain sine comes back toward the
   viewer past the trough, so a card entering at the right edge would first
   sit at mid depth, dive, then rise; killing that overshoot lets it come in
   distant and only ever approach -- the way the reference's cards arrive. */
float sheetTail(float q) {
  return SHEET_TAIL * (1.0 + 1.1 * smoothstep(0.35, 1.05, q));
}
float sheetShape(float q) {
  return mix(1.0 - q * q, sin(PI * q), uSheetC) * exp(-sheetTail(q) * q * q);
}
/* its slope, by central difference: exact enough for the bank and the light,
   and it cannot fall out of step with the shape however that changes */
float sheetShapeSlope(float q) {
  return (sheetShape(q + 0.002) - sheetShape(q - 0.002)) / 0.004;
}
float sheetZ(float wx) { return -uSheetD * sheetShape(sheetQ(wx)); }

float sheetRoll(float wx) {
  return SHEET_BANK * sheetShapeSlope(sheetQ(wx)) / PI * uSheetC * uSheetP;
}

/* roll about the ribbon's centreline (y = z = 0), plus the velocity wring:
   past the mask each side turns the opposite way, nothing at the centre */
vec4 sheetWind(vec4 w) {
  float a = sheetRoll(w.x);
  if (uSheetV > 0.001) {
    float qe = w.x / uSheetW;
    a += SHEET_VTWIST * uSheetV * smoothstep(0.3, 0.9, abs(qe)) * sign(qe) * uSheetP;
  }
  float s = sin(a);
  float c = cos(a);
  return vec4(w.x, w.y * c - w.z * s, w.y * s + w.z * c, w.w);
}

vec4 sheet(vec4 w) {
  w = sheetWind(w);
  w.z += sheetZ(w.x) * uSheetP;
  float qw = w.x / uSheetW;
  w.y += SHEET_DIAG * w.x * uSheetP;
  if (uSheetV > 0.001) {
    /* the rear-up: speed lifts the left side and brings it nearer */
    float m = 1.0 - smoothstep(-1.0, 0.3, qw);
    w.y += SHEET_REAR_Y * uSheetW * uSheetV * m * uSheetP;
    w.z += SHEET_REAR_Z * uSheetW * uSheetV * m * uSheetP;
  }
  return w;
}

float leanRamp(float s) { s = clamp(s, -1.0, 1.0); return s * (1.5 - 0.5 * s * s); }
float leanSlope(float s) { s = min(abs(s), 1.0); return 1.5 * (1.0 - s * s); }
vec4 lean(vec4 w, float k) {
  w.z += uLeanA * leanRamp(w.x / uLeanW) * k;
  return w;
}

/* the hover dome: 1 at the centre, 0 along every edge */
float sheetDome(vec2 uv) {
  vec2 q = uv * 2.0 - 1.0;
  return (1.0 - q.x * q.x) * (1.0 - q.y * q.y);
}

/* The cursor, in the card's own uv. The PRESS is a round STAMP: a disc of
   even depth under the hand -- flat across its floor, so the point under the
   cursor is no deeper than the rest -- whose wall turns up smoothly between
   uEdge and the rim, then blends into the flat cloth. The WAKE is a run of
   shallower soft hollows along the path the hand just took, each relaxing in
   place, so a sweep drags the surface behind it. */
uniform vec3 uPress;    // xy: centre; z: depth (positive = pushed in)
uniform vec2 uPressR;   // radius in uv, per axis (the card is not square)
uniform float uEdge;    // share of the radius that is flat floor
uniform vec3 uBall[6];  // the wake: xy centre, z depth
uniform vec2 uBallR;
/* 1 on the floor, 0 outside, a smooth turn between */
float stamp(float r) {
  return 1.0 - smoothstep(uEdge, 1.0, r);
}
float ballField(vec2 uv) {
  vec2 dp = (uv - uPress.xy) / uPressR;
  float h = -uPress.z * stamp(length(dp));
  for (int i = 0; i < 6; i++) {
    vec2 d = (uv - uBall[i].xy) / uBallR;
    h += uBall[i].z * exp(-dot(d, d));
  }
  return h;
}
vec2 ballGrad(vec2 uv) {
  vec2 dp = (uv - uPress.xy) / uPressR;
  float r = max(length(dp), 0.0001);
  /* d/dr of the smoothstep wall, zero on the floor and outside */
  float t = clamp((r - uEdge) / (1.0 - uEdge), 0.0, 1.0);
  float wall = 6.0 * t * (1.0 - t) / (1.0 - uEdge);
  vec2 g = uPress.z * wall * (dp / r) / uPressR;
  for (int i = 0; i < 6; i++) {
    vec2 d = (uv - uBall[i].xy) / uBallR;
    g += uBall[i].z * exp(-dot(d, d)) * (-2.0 * d / uBallR);
  }
  return g;
}
`

const CARD_VERT = /* glsl */ `
attribute vec2 aPos;
attribute vec2 aUv;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec2 uCentre; // card centre, world
uniform vec2 uRes;    // card size, world
uniform float uHover;
uniform float uDent;
uniform float uBallZ;  // bump height at amplitude 1, world units
uniform vec2 uLens;    // pointer in uv
uniform float uLensA;  // pull toward it, world units at the centre
uniform vec2 uLensR;   // its reach in uv, per axis
uniform vec2 uTilt;    // the weighted plate: depth per world unit across and up the card
uniform float uLift;   // and how far it has risen, world units
uniform float uOpen;   // 0 on the ribbon, 1 laid flat in the panel's frame
uniform vec4 uRect;    // that frame at z = 0: left, top, right, bottom, world
uniform float uBulge;  // how far it billows toward the reader on the way, world units
varying vec2 vUv;
varying vec3 vFlat;
${SHEET_GLSL}
void main() {
  vUv = aUv;
  vec3 rest = vec3(uCentre + aPos * uRes, 0.0);
  vFlat = rest;
  vec4 w = vec4(rest, 1.0);
  w.z += uLift + uTilt.x * aPos.x * uRes.x + uTilt.y * aPos.y * uRes.y;
  w.z -= uHover * uDent * uRes.y * sheetDome(aUv);
  /* the cursor: the surface rises under the finger's path and is drawn a
     little toward the finger itself, both fading to nothing away from it */
  w.z += ballField(aUv) * uBallZ;
  vec2 q = (aUv - uLens) / uLensR;
  float k = max(1.0 - dot(q, q), 0.0);
  w.xy -= (aUv - uLens) * uRes * uLensA * uHover * k * k;
  w = sheet(w);
  w = lean(w, uSheetP);
  if (uOpen > 0.0001) {
    /* the middle leads, the sides follow: it billows, then lays flat */
    vec2 e = abs(aUv - 0.5) * 2.0;
    float lag = ${OPEN_LAG_X.toFixed(3)} * e.x * e.x + ${OPEN_LAG_Y.toFixed(3)} * e.y * e.y;
    float p = clamp((uOpen - lag) / (1.0 - lag), 0.0, 1.0);
    vec3 to = vec3(mix(uRect.x, uRect.z, aUv.x), mix(uRect.w, uRect.y, aUv.y), 0.0);
    to.z += uBulge * sin(PI * p) * (1.0 - 0.5 * e.x * e.x);
    w.xyz = mix(w.xyz, to, p);
  }
  gl_Position = uProj * uView * w;
}
`

const CARD_FRAG = /* glsl */ `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform sampler2D uTex;
uniform sampler2D uLabel; // the title and its button, drawn on the surface
uniform vec2 uSize;   // source px, for the cover fit
uniform vec2 uRes;
uniform float uHover;
uniform float uDent;
uniform float uCorner; // radius, normalized to the plane's height
uniform float uShade;
uniform float uShadeS;
uniform float uScrim;
uniform float uAlpha;
uniform vec3 uCam;
uniform float uBallWarp;
uniform vec2 uFit;     // the plane's size for the picture's fit and the corners: the card's, or the panel's as it opens
uniform vec2 uTilt;    // the weighted plate's tip, so the light moves across it
uniform float uOpen;
uniform vec3 uPaper;   // the panel's paper, which an opening card washes to
uniform float uVeil;   // the stage darkening behind an opened card
uniform vec3 uVeilC;
varying vec2 vUv;
varying vec3 vFlat;
${SHEET_GLSL}

const vec3 LIGHT_DIR = normalize(vec3(-0.4, 0.5, 1.0));
const float LIGHT_GLOSS = 22.0;
const float LIGHT_SPEC = 0.16;
const float LIGHT_DIFF = 0.2;

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
float roundedBox(vec2 p, vec2 mid, float r) {
  vec2 q = abs(p - mid) - (mid - r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

/* 0 at the crests, 1 in the troughs; the dent counts toward it */
float sheetShade(float wx, vec2 uv) {
  float d = clamp((uSheetD - sheetZ(wx)) / (2.0 * uSheetD), 0.0, 1.0) * uSheetP;
  d += (uHover * uDent * uRes.y * sheetDome(uv)) / (2.0 * uSheetD);
  return clamp(d, 0.0, 1.0);
}
float sheetOffset(float wx, vec2 uv) {
  float z = sheetZ(wx) * uSheetP;
  z += uLeanA * leanRamp(wx / uLeanW) * uSheetP;
  z -= uHover * uDent * uRes.y * sheetDome(uv);
  return z;
}
/* the surface's normal, analytically, so the gloss has no facets to find */
vec3 sheetNormal(float wx, vec2 uv) {
  float dzdx = -uSheetD * sheetShapeSlope(sheetQ(wx)) * uSheetT / uSheetW * uSheetP;
  dzdx += (uLeanA / uLeanW) * leanSlope(wx / uLeanW) * uSheetP;
  float dzdy = 0.0;
  dzdx += uTilt.x;
  dzdy += uTilt.y;
  if (uHover > 0.0001) {
    vec2 q = uv * 2.0 - 1.0;
    float a = uHover * uDent;
    dzdx += 4.0 * a * uRes.y * q.x * (1.0 - q.y * q.y) / max(uRes.x, 0.0001);
    dzdy += 4.0 * a * q.y * (1.0 - q.x * q.x);
  }
  vec3 n = normalize(vec3(-dzdx, -dzdy, 1.0));
  float a = sheetRoll(wx);
  float s = sin(a);
  float c = cos(a);
  return vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c);
}
vec3 sheetLit(vec3 col, vec3 n, vec3 v, float amt) {
  float d = dot(n, LIGHT_DIR) * 0.5 + 0.5;
  col *= 1.0 - LIGHT_DIFF * amt * (1.0 - d);
  vec3 h = normalize(LIGHT_DIR + v);
  return col + pow(max(dot(n, h), 0.0), LIGHT_GLOSS) * LIGHT_SPEC * amt;
}

void main() {
  /* the picture slides down the bump's slope, so the finger visibly moves
     the image and not just the silhouette */
  vec2 grad = ballGrad(vUv);
  vec2 uvw = vUv - grad * uBallWarp;
  vec4 tex = texture2D(uTex, uvCover(uFit, uSize, uvw));

  float depth = sheetShade(vFlat.x, vUv);
  tex.rgb = mix(tex.rgb, vec3(0.059), uShade * 0.8 * pow(depth, uShadeS));

  /* the scrim the title sits on, then the title itself: on the surface, so
     it takes the same bend, depth and light as the picture under it. An
     opening card lets both go first: the panel sets its own title. */
  float keep = 1.0 - smoothstep(0.0, 0.35, uOpen);
  float g = 1.0 - smoothstep(0.0, 0.5, vUv.y);
  tex.rgb = mix(tex.rgb, vec3(0.0), uScrim * 0.65 * g * g * keep);
  vec4 label = texture2D(uLabel, uvw);
  tex.rgb = mix(tex.rgb, label.rgb, label.a * keep);
  /* the hollow is lit as a surface: its normal from the field's slope, so the
     wall facing the lamp brightens and the wall turned from it falls into shadow */
  vec3 hn = normalize(vec3(-grad * 0.16, 1.0));
  float flatL = dot(vec3(0.0, 0.0, 1.0), LIGHT_DIR);
  tex.rgb *= clamp(1.0 + (dot(hn, LIGHT_DIR) - flatL) * 0.55, 0.86, 1.14);

  vec3 p = vFlat + vec3(0.0, 0.0, sheetOffset(vFlat.x, vUv));
  tex.rgb = sheetLit(tex.rgb, sheetNormal(vFlat.x, vUv), normalize(uCam - p), uShade);

  /* opening, the picture washes to the panel's paper as it lays flat */
  tex.rgb = mix(tex.rgb, uPaper, smoothstep(0.3, 0.88, uOpen));
  tex.rgb = mix(tex.rgb, uVeilC, uVeil);

  vec2 sz = vec2(uFit.x / max(uFit.y, 0.0001), 1.0);
  vec2 mid = sz * 0.5;
  float r = min(uCorner, min(mid.x, mid.y));
  float d = roundedBox(vUv * sz, mid, r);
  float aa = max(fwidth(d) * 1.4, 0.0001);
  float alpha = uAlpha * (1.0 - smoothstep(-aa, aa, d));

  gl_FragColor = vec4(tex.rgb * alpha, alpha);
}
`

const FLOOR_VERT = /* glsl */ `
attribute vec2 aPos; // 0..1 across, 0..1 along the run
uniform mat4 uProj;
uniform mat4 uView;
uniform float uHalfW;
uniform float uFloorY;
uniform float uRun;
uniform float uNearZ;
varying vec2 vUv;
varying float vFar;
${SHEET_GLSL}
void main() {
  vUv = aPos;
  float x = (aPos.x * 2.0 - 1.0) * uHalfW * 3.0;
  float z = mix(uNearZ, -uRun, aPos.y);
  vec4 w = vec4(x, uFloorY, z, 1.0);
  vFar = -w.z / uRun;
  w = lean(w, 1.0);
  gl_Position = uProj * uView * w;
}
`

const FLOOR_FRAG = /* glsl */ `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec3 uC0;    // what it dissolves into: the page ground
uniform vec3 uC1;    // the near tint
uniform vec3 uLine;  // the grid's own colour, at full strength
uniform float uGrid;
uniform vec2 uGridF; // cells across, cells along
uniform float uVeil;
uniform vec3 uVeilC;
varying vec2 vUv;
varying float vFar;
void main() {
  float fade = 1.0 - smoothstep(0.2, 0.95, vFar);
  float contact = exp(-abs(vFar) * 14.0);
  vec3 col = mix(uC1, uC0, smoothstep(0.0, 0.8, vFar));
  col *= 1.0 - contact * 0.55;
  vec2 g = vec2(vUv.x * uGridF.x, vFar * uGridF.y);
  vec2 gf = abs(fract(g) - 0.5);
  vec2 gw = fwidth(g) * 1.5;
  vec2 lines = vec2(1.0) - smoothstep(vec2(0.0), gw, gf);
  float line = max(lines.x, lines.y);
  col = mix(col, uLine, line * uGrid * fade);
  /* the near edge dissolves before it reaches the camera */
  float near = smoothstep(-0.32, -0.05, vFar);
  col = mix(uC0, col, near);
  gl_FragColor = vec4(mix(col, uVeilC, uVeil), 1.0);
}
`

// ------------------------------------------------------------------ helpers

export const QUAD_VERT = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

/* The field's step. Read where the flow carries this texel from, soften with
   the neighbours there, let it settle, then push the hand's movement in
   under a soft disc. Values are displacement in height units; on a device
   without half-float render targets they are packed into bytes about 0.5. */
export const FIELD_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uField;
uniform vec2 uTexel;
uniform float uAspect;
uniform vec2 uStir;    // the hand, uv
uniform vec2 uPush;    // what it pushes this frame, height units
uniform float uRadius; // height units
uniform float uDecay;
uniform float uDrift;
uniform float uSpread;
uniform float uMax;
uniform float uPacked;
varying vec2 vUv;
vec2 field(vec2 uv) {
  vec2 v = texture2D(uField, uv).xy;
  if (uPacked > 0.5) {
    v = (v - 0.5) * 0.25;
    v *= step(0.0015, length(v));
  }
  return v;
}
void main() {
  vec2 here = field(vUv);
  vec2 from = vUv - vec2(here.x / uAspect, here.y) * uDrift;
  vec2 v = field(from);
  vec2 n = field(from + vec2(uTexel.x, 0.0)) + field(from - vec2(uTexel.x, 0.0))
         + field(from + vec2(0.0, uTexel.y)) + field(from - vec2(0.0, uTexel.y));
  v = mix(v, n * 0.25, uSpread);
  v *= uDecay;
  vec2 d = vUv - uStir;
  d.x *= uAspect;
  v += uPush * exp(-dot(d, d) / (uRadius * uRadius));
  /* a soft ceiling: fast strokes saturate at uMax instead of tearing */
  float len = max(length(v), 1e-6);
  float e = exp(-2.0 * len / uMax);
  v *= uMax * ((1.0 - e) / (1.0 + e)) / len;
  if (uPacked > 0.5) v = v * 4.0 + 0.5;
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`

/* The frame, read through the field. */
export const SURFACE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uField;
uniform float uAspect;
uniform float uPacked;
varying vec2 vUv;
void main() {
  vec2 v = texture2D(uField, vUv).xy;
  if (uPacked > 0.5) v = (v - 0.5) * 0.25;
  vec2 off = vec2(v.x / uAspect, v.y);
  gl_FragColor = texture2D(uScene, clamp(vUv - off, 0.001, 0.999));
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)
  if (!sh) throw new Error('shader')
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`ribbon shader: ${log ?? 'compile failed'}`)
  }
  return sh
}

export function program(gl: WebGLRenderingContext, vert: string, frag: string) {
  const p = gl.createProgram()
  if (!p) throw new Error('program')
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vert))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`ribbon program: ${gl.getProgramInfoLog(p) ?? 'link failed'}`)
  }
  return p
}

/** A unit grid of quads: positions in [-0.5, 0.5] (or [0, 1]), uvs in [0, 1]. */
function grid(cols: number, rows: number, centred: boolean) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const u = i / cols
      const v = j / rows
      pos.push(centred ? u - 0.5 : u, centred ? v - 0.5 : v)
      uv.push(u, v)
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i
      const b = a + 1
      const c = a + cols + 1
      const d = c + 1
      idx.push(a, b, c, b, d, c)
    }
  }
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), idx: new Uint16Array(idx) }
}

function perspective(fovDeg: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360)
  const nf = 1 / (near - far)
  // column-major
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ])
}

const VIEW = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -CAM_Z, 1])

/** '#06060f' or 'rgb(6, 6, 15)' (what getComputedStyle hands back) → 0..1 */
function parseColor(c: string): [number, number, number] {
  const m = c.match(/\d+(\.\d+)?/g)
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  if (m && m.length >= 3) return [+m[0] / 255, +m[1] / 255, +m[2] / 255]
  return [0, 0, 0]
}

// ------------------------------------------------------- the title card

const TEX_W = 1600
const TEX_H = 1000

/**
 * What a screen shows until it has artwork: the project's own numbers, set
 * like a title card. Drawn once per project at texture size; redrawn when the
 * web fonts land so the type is never the fallback face.
 */
function drawTitleCard(c: CanvasRenderingContext2D, p: Sleeve) {
  const w = TEX_W
  const h = TEX_H
  const base = c.createLinearGradient(0, 0, 0, h)
  base.addColorStop(0, THEME === 'noir' ? '#1a1214' : '#191c2a')
  base.addColorStop(0.65, THEME === 'noir' ? '#0f0b0c' : '#10121b')
  base.addColorStop(1, THEME === 'noir' ? '#080607' : '#0a0b12')
  c.fillStyle = base
  c.fillRect(0, 0, w, h)

  // black-and-red: the two glows are the theme's crimson and its deep; else the original's orange and blue
  const noir = THEME === 'noir'
  const warm = c.createRadialGradient(w, 0, 0, w, 0, w * 0.75)
  warm.addColorStop(0, noir ? 'rgba(200,16,46,0.16)' : 'rgba(255,170,65,0.14)')
  warm.addColorStop(1, noir ? 'rgba(200,16,46,0)' : 'rgba(255,170,65,0)')
  c.fillStyle = warm
  c.fillRect(0, 0, w, h)
  const cool = c.createRadialGradient(0, h, 0, 0, h, w * 0.55)
  cool.addColorStop(0, noir ? 'rgba(90,9,18,0.35)' : 'rgba(121,164,255,0.12)')
  cool.addColorStop(1, noir ? 'rgba(90,9,18,0)' : 'rgba(121,164,255,0)')
  c.fillStyle = cool
  c.fillRect(0, 0, w, h)

  // the dot matrix, fading down the card
  c.save()
  const dots = c.createLinearGradient(0, 0, 0, h)
  dots.addColorStop(0, 'rgba(255,255,255,0.075)')
  dots.addColorStop(0.7, 'rgba(255,255,255,0)')
  c.fillStyle = dots
  for (let y = 5; y < h; y += 10) {
    for (let x = 5; x < w; x += 10) {
      c.fillRect(x, y, 2, 2)
    }
  }
  c.restore()

  const pad = w * 0.06
  const mono = (size: number) => `500 ${size}px "JetBrains Mono", ui-monospace, monospace`
  const track = (text: string) => text.toUpperCase().split('').join(String.fromCharCode(8202))

  c.fillStyle = 'rgba(246,241,234,0.6)'
  c.font = mono(24)
  c.textBaseline = 'top'
  c.fillText(track(p.code), pad, h * 0.055)
  c.textAlign = 'right'
  c.fillText(track(p.org), w - pad, h * 0.055)
  c.textAlign = 'left'

  const [lead, ...rest] = p.metrics
  c.fillStyle = '#f6f1ea'
  c.font = `italic 400 ${Math.round(w * 0.086)}px "Instrument Serif", Georgia, serif`
  c.textBaseline = 'alphabetic'
  const leadY = h * 0.66
  c.fillText(lead, pad - 4, leadY)

  if (rest.length) {
    c.fillStyle = 'rgba(156,157,168,1)'
    c.font = mono(22)
    c.textBaseline = 'top'
    c.fillText(track(rest.join('   ·   ')), pad, leadY + 28)
  }
}

/**
 * The title and its button, as the reference sets them: the name at the
 * screen's bottom-left, a small round arrow at its bottom-right. Drawn to a
 * transparent texture at the screen's own aspect, so it lands on the surface
 * and bends with it.
 */
function drawLabel(c: CanvasRenderingContext2D, p: Sleeve) {
  const w = TEX_W
  const h = TEX_H
  c.clearRect(0, 0, w, h)
  const inset = w * 0.042
  const bottom = h * (1 - 0.055)
  const size = h * 0.042

  c.fillStyle = '#ffffff'
  c.font = `500 ${Math.round(size)}px "Bricolage Grotesque", Inter, system-ui, sans-serif`
  c.textBaseline = 'alphabetic'
  c.shadowColor = 'rgba(0,0,0,0.5)'
  c.shadowBlur = 18
  c.shadowOffsetY = 2
  // -0.02em tracking by hand; canvas letterSpacing is not everywhere yet
  let x = inset
  for (const ch of p.title) {
    c.fillText(ch, x, bottom)
    x += c.measureText(ch).width - size * 0.02
  }
  c.shadowColor = 'transparent'

  if (p.repo) {
    const r = h * 0.031
    const cx = w - inset - r
    const cy = bottom - r * 0.72
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.fillStyle = 'rgba(0,0,0,0.55)'
    c.fill()
    c.lineWidth = Math.max(1.5, h * 0.0015)
    c.strokeStyle = 'rgba(255,255,255,0.22)'
    c.stroke()
    c.fillStyle = '#ffffff'
    c.font = `400 ${Math.round(r * 1.05)}px Inter, system-ui, sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('\u2192', cx, cy + r * 0.04)
    c.textAlign = 'left'
  }
}

// -------------------------------------------------------------------- scene

type Card = {
  project: Sleeve
  tex: WebGLTexture
  label: WebGLTexture
  size: [number, number]
  hover: number
  hoverTarget: number
  video?: HTMLVideoElement
  /** in the drawn set this frame: the ribbon's own idea of "on screen" */
  onScreen: boolean
  live: boolean
  /** last time (ms) a stuck "live" video was kicked with another play() */
  kickedAt: number
  /** the cursor on this card, in its uv: where it is, where the bump is, how tall */
  ball: {
    tx: number
    ty: number
    x: number
    y: number
    amp: number
    since: number
    trail: Float32Array // BALL_TAPS × (x, y, amp)
  }
  /** the weighted plate: its tip (-1..1 across and up) and rise, each a spring */
  plate: { tx: number; ty: number; x: number; y: number; vx: number; vy: number; lift: number; liftV: number }
}

/** A spring step, semi-implicit: position and velocity toward a target. */
export function spring(x: number, v: number, to: number, k: number, zeta: number, dt: number): [number, number] {
  const c = 2 * Math.sqrt(k) * zeta
  v += (k * (to - x) - c * v) * dt
  return [x + v * dt, v]
}

export class RibbonScene {
  readonly canvas: HTMLCanvasElement
  readonly supported: boolean

  private gl!: WebGLRenderingContext
  private cardProg!: WebGLProgram
  private floorProg!: WebGLProgram
  private cardGeo!: { pos: WebGLBuffer; uv: WebGLBuffer; idx: WebGLBuffer; count: number }
  private floorGeo!: { pos: WebGLBuffer; idx: WebGLBuffer; count: number }
  private cards: Card[] = []
  private uniforms = new Map<string, WebGLUniformLocation | null>()
  private floorUniforms = new Map<string, WebGLUniformLocation | null>()

  private width = 1
  private height = 1
  private dpr = 1
  private proj = perspective(FOV, 1, NEAR, FAR)

  /** world half-extents of the frustum at z = 0 */
  private halfH = Math.tan((FOV * Math.PI) / 360) * CAM_Z
  private halfW = this.halfH

  /** scroll along the loop, 0..1, and the smoothed speed, 0..1 */
  progress = 0
  velocity = 0
  /** 0..n-1: the card nearest the centre, after the last render */
  nearest = 0

  /** the pointer for the weighted plate, CSS px over the canvas, or null */
  private plateAt: { x: number; y: number } | null = null
  private platePrev = { x: 0, y: 0 }
  private pressed = false
  /** the card under the hand after the last render, or -1 */
  private under = -1
  private underUv = { u: 0.5, v: 0.5 }
  /** the opened card, or -1; how far it has flown (0..1); the frame it flies to, world */
  private opened = -1
  openProgress = 0
  /** how far the page behind it has darkened, 0..1: the panel's curve, shared with the page's own veil */
  openVeil = 0
  /** Lifted over the page: where the section's top sits in the canvas, CSS px; null in place. */
  private band: number | null = null
  private openRect = { l: 0, t: 0, r: 0, b: 0, wPx: 1, hPx: 1 }
  private paper: [number, number, number] = [0.953, 0.945, 0.929]

  private ground: [number, number, number]

  // the surface: the frame's render target, the field's two textures, the quad
  private fieldProg!: WebGLProgram
  private surfaceProg!: WebGLProgram
  private fieldU = new Map<string, WebGLUniformLocation | null>()
  private surfaceU = new Map<string, WebGLUniformLocation | null>()
  private quad!: WebGLBuffer
  private sceneTex!: WebGLTexture
  private sceneFbo!: WebGLFramebuffer
  private field: { tex: WebGLTexture; fbo: WebGLFramebuffer }[] = []
  private fieldW = SURFACE_RES
  private fieldH = SURFACE_RES
  private packed = false
  private surfaceOn = false
  /** the pointer over the canvas, CSS px, or null when it has left */
  private stirTarget: { x: number; y: number } | null = null
  private hand = { x: 0, y: 0 }
  private handPrev = { x: 0, y: 0 }
  private handTo!: { x: (v: number) => void; y: (v: number) => void }

  constructor(projects: Sleeve[], ground: string) {
    this.canvas = document.createElement('canvas')
    this.ground = parseColor(ground)
    const gl = this.canvas.getContext('webgl', {
      // clear where the canvas is lifted over the page with an opened card;
      // opaque everywhere else, as the frame always paints its ground
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    })
    this.supported = !!gl
    if (!gl) return
    this.gl = gl
    gl.getExtension('OES_standard_derivatives')

    this.cardProg = program(gl, CARD_VERT, CARD_FRAG)
    this.floorProg = program(gl, FLOOR_VERT, FLOOR_FRAG)
    for (const name of [
      'uProj', 'uView', 'uCentre', 'uRes', 'uHover', 'uDent', 'uTex', 'uLabel', 'uSize', 'uCorner',
      'uShade', 'uShadeS', 'uScrim', 'uAlpha', 'uCam', 'uSheetW', 'uSheetD', 'uSheetT',
      'uSheetC', 'uSheetP', 'uSheetV', 'uLeanA', 'uLeanW', 'uBall', 'uBallR', 'uBallZ',
      'uBallWarp', 'uLens', 'uLensA', 'uLensR', 'uPress', 'uPressR', 'uEdge',
      'uTilt', 'uLift', 'uOpen', 'uRect', 'uBulge', 'uFit', 'uPaper', 'uVeil', 'uVeilC',
    ]) {
      this.uniforms.set(name, gl.getUniformLocation(this.cardProg, name))
    }
    for (const name of [
      'uProj', 'uView', 'uHalfW', 'uFloorY', 'uRun', 'uNearZ', 'uC0', 'uC1', 'uLine', 'uGrid', 'uGridF',
      'uSheetW', 'uSheetD', 'uSheetT', 'uSheetC', 'uSheetP', 'uSheetV', 'uLeanA', 'uLeanW',
      'uVeil', 'uVeilC',
    ]) {
      this.floorUniforms.set(name, gl.getUniformLocation(this.floorProg, name))
    }

    // 96 x 40 facets: the S reads as a curve, and the stamp's narrow wall --
    // thinner than a coarser cell -- stays a circle rather than a polygon
    const cg = grid(96, 40, true)
    this.cardGeo = {
      pos: this.buffer(cg.pos),
      uv: this.buffer(cg.uv),
      idx: this.buffer(cg.idx, gl.ELEMENT_ARRAY_BUFFER),
      count: cg.idx.length,
    }
    const fg = grid(24, 24, false)
    this.floorGeo = { pos: this.buffer(fg.pos), idx: this.buffer(fg.idx, gl.ELEMENT_ARRAY_BUFFER), count: fg.idx.length }

    this.handTo = {
      x: gsap.quickTo(this.hand, 'x', { duration: HAND_LAG, ease: 'power2.out' }),
      y: gsap.quickTo(this.hand, 'y', { duration: HAND_LAG, ease: 'power2.out' }),
    }
    this.setupSurface()

    this.cards = projects.map((project) => ({
      project,
      tex: this.texture(),
      label: this.texture(),
      size: [TEX_W, TEX_H],
      hover: 0,
      hoverTarget: 0,
      onScreen: false,
      live: false,
      kickedAt: 0,
      ball: { tx: 0.5, ty: 0.5, x: 0.5, y: 0.5, amp: 0, since: 0, trail: new Float32Array(BALL_TAPS * 3) },
      plate: { tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0, lift: 0, liftV: 0 },
    }))
    this.cards.forEach((card) => {
      this.paint(card)
      this.paintLabel(card)
    })

    // the type goes up in whatever face is loaded, and again in the real one
    void document.fonts.ready.then(() =>
      this.cards.forEach((card) => {
        this.paint(card)
        this.paintLabel(card)
      }),
    )

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
  }

  // ---------------------------------------------------------------- setup

  private buffer(data: BufferSource, target: number = this.gl.ARRAY_BUFFER) {
    const gl = this.gl
    const b = gl.createBuffer()
    if (!b) throw new Error('buffer')
    gl.bindBuffer(target, b)
    gl.bufferData(target, data, gl.STATIC_DRAW)
    return b
  }

  private texture() {
    const gl = this.gl
    const t = gl.createTexture()
    if (!t) throw new Error('texture')
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    return t
  }

  private upload(card: Card, source: TexImageSource, w: number, h: number) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, card.tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    card.size = [w, h]
  }

  /** Fill a card: its clip, its artwork, or the drawn title card. */
  private paint(card: Card) {
    const { project } = card
    if (project.video) {
      const video = document.createElement('video')
      video.src = project.video
      if (project.art) video.poster = project.art
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.autoplay = true
      // buffered before the card reaches the edge of the view, so it is
      // already running by the time it is on screen rather than starting there
      video.preload = 'auto'
      video.crossOrigin = 'anonymous'
      card.video = video
      // until the first frame arrives the poster (or the card) shows
      if (project.art) this.image(card, project.art)
      else this.title(card)
      return
    }
    if (project.art) {
      this.title(card)
      this.image(card, project.art)
      return
    }
    this.title(card)
  }

  private paintLabel(card: Card) {
    const gl = this.gl
    const c = document.createElement('canvas')
    c.width = TEX_W
    c.height = TEX_H
    const ctx = c.getContext('2d')
    if (!ctx) return
    drawLabel(ctx, card.project)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, card.label)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c)
  }

  private title(card: Card) {
    const c = document.createElement('canvas')
    c.width = TEX_W
    c.height = TEX_H
    const ctx = c.getContext('2d')
    if (!ctx) return
    drawTitleCard(ctx, card.project)
    this.upload(card, c, TEX_W, TEX_H)
  }

  private image(card: Card, src: string) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      if (!card.video || !card.live) this.upload(card, img, img.naturalWidth, img.naturalHeight)
    }
    img.src = src
  }

  // --------------------------------------------------------------- surface

  private setupSurface() {
    const gl = this.gl
    this.fieldProg = program(gl, QUAD_VERT, FIELD_FRAG)
    this.surfaceProg = program(gl, QUAD_VERT, SURFACE_FRAG)
    for (const n of ['uField', 'uTexel', 'uAspect', 'uStir', 'uPush', 'uRadius', 'uDecay', 'uDrift', 'uSpread', 'uMax', 'uPacked']) {
      this.fieldU.set(n, gl.getUniformLocation(this.fieldProg, n))
    }
    for (const n of ['uScene', 'uField', 'uAspect', 'uPacked']) {
      this.surfaceU.set(n, gl.getUniformLocation(this.surfaceProg, n))
    }
    this.quad = this.buffer(new Float32Array([-1, -1, 3, -1, -1, 3]))

    // the frame's own target; sized with the canvas
    this.sceneTex = this.texture()
    this.sceneFbo = gl.createFramebuffer()!

    // the field: half float where it can be rendered to, else bytes, packed
    const half = gl.getExtension('OES_texture_half_float')
    gl.getExtension('OES_texture_half_float_linear')
    gl.getExtension('EXT_color_buffer_half_float')
    const make = (type: number) => {
      const tex = this.texture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.fieldW, this.fieldH, 0, gl.RGBA, type, null)
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
      gl.viewport(0, 0, this.fieldW, this.fieldH)
      if (this.packed) gl.clearColor(0.5, 0.5, 0, 1)
      else gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private sizeSurface() {
    const gl = this.gl
    if (!this.surfaceOn) return
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTex, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this.surfaceOn = false
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    // the field keeps the canvas' aspect at its own resolution
    const fh = Math.max(16, Math.round((SURFACE_RES * this.height) / this.width))
    if (fh !== this.fieldH) {
      this.fieldH = fh
      const type = this.packed ? gl.UNSIGNED_BYTE : gl.getExtension('OES_texture_half_float')!.HALF_FLOAT_OES
      for (const f of this.field) {
        gl.bindTexture(gl.TEXTURE_2D, f.tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.fieldW, this.fieldH, 0, gl.RGBA, type, null)
      }
      this.clearField()
    }
  }

  /**
   * The hand over the canvas, in CSS px, or null when it has left. Only its
   * movement between frames reaches the field: a resting hand does nothing,
   * and on arrival it is placed, not pushed.
   */
  stir(px: number | null, py = 0) {
    if (px === null) {
      this.stirTarget = null
      return
    }
    if (!this.stirTarget) {
      gsap.killTweensOf(this.hand)
      this.hand.x = this.handPrev.x = px
      this.hand.y = this.handPrev.y = py
    }
    this.stirTarget = { x: px, y: py }
    this.handTo.x(px)
    this.handTo.y(py)
  }

  private drawQuad(prog: WebGLProgram) {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad)
    const a = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(a)
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /** one step of the sheet, then the frame read through it */
  private stepSurface(dt: number) {
    const gl = this.gl
    const H = this.height
    const aspect = this.width / this.height
    // what the hand did this frame, in height units
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
    // ---- the field's step, ping to pong
    const [src, dst] = this.field
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
    gl.viewport(0, 0, this.fieldW, this.fieldH)
    gl.useProgram(this.fieldProg)
    const f = (n: string) => this.fieldU.get(n) ?? null
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, src.tex)
    gl.uniform1i(f('uField'), 0)
    gl.uniform2f(f('uTexel'), 1 / this.fieldW, 1 / this.fieldH)
    gl.uniform1f(f('uAspect'), aspect)
    gl.uniform2f(f('uStir'), this.hand.x / this.width, 1 - this.hand.y / H)
    gl.uniform2f(f('uPush'), px, py)
    gl.uniform1f(f('uRadius'), STIR_RADIUS)
    gl.uniform1f(f('uDecay'), Math.pow(0.5, dt / SURFACE_HALF_LIFE))
    gl.uniform1f(f('uDrift'), SURFACE_DRIFT)
    gl.uniform1f(f('uSpread'), SURFACE_SPREAD)
    gl.uniform1f(f('uMax'), STIR_MAX)
    gl.uniform1f(f('uPacked'), this.packed ? 1 : 0)
    this.drawQuad(this.fieldProg)
    this.field = [dst, src]

    // ---- the frame, through the sheet
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
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
    this.drawQuad(this.surfaceProg)
    gl.enable(gl.BLEND)
  }

  // -------------------------------------------------------------- geometry

  resize(width: number, height: number) {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    this.canvas.width = Math.round(this.width * this.dpr)
    this.canvas.height = Math.round(this.height * this.dpr)
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`
    const aspect = this.width / this.height
    this.proj = perspective(FOV, aspect, NEAR, FAR)
    this.halfW = this.halfH * aspect
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
      this.sizeSurface()
    }
  }

  /** world units per CSS px, and the card/loop layout in world units */
  private layout() {
    const unit = (2 * this.halfW) / this.width
    const ch = 2 * this.halfH * CARD_H
    const cw = ch * CARD_ASPECT
    const gap = 2 * this.halfW * GAP
    const pitch = cw + gap
    const loop = pitch * this.cards.length
    return { unit, cw, ch, gap, pitch, loop, cy: 2 * this.halfH * 0.02 }
  }

  /** The scroll that plays one full loop, in CSS px. */
  loopPx() {
    const l = this.layout()
    return l.loop / l.unit
  }

  /** Card i's centre x for the current progress, wrapped so the strip has no ends. */
  private cardX(i: number, l: ReturnType<RibbonScene['layout']>) {
    const shift = this.progress * l.loop
    let x = i * l.pitch - shift
    x = ((((x + l.loop / 2) % l.loop) + l.loop) % l.loop) - l.loop / 2
    return x
  }

  // ----------------------------------------------------------- CPU sheet

  /** The same displacement the vertex stage applies, for placing DOM type. */
  private sheetPoint(x: number, y: number, vel: number, W: number, D: number, dz = 0) {
    const T = SHEET_T
    const q = (x / W) * T + SHEET_SHIFT
    const shapeAt = (qq: number) => {
      const t = Math.min(1, Math.max(0, (qq - 0.35) / 0.7))
      const tail = SHEET_TAIL * (1 + 1.1 * t * t * (3 - 2 * t))
      return Math.sin(Math.PI * qq) * Math.exp(-tail * qq * qq)
    }
    const shape = shapeAt(q)
    const slope = (shapeAt(q + 0.002) - shapeAt(q - 0.002)) / 0.004
    let a = (-0.14 * slope) / Math.PI
    const qe = x / W
    if (vel > 0.001) {
      const t = Math.min(1, Math.max(0, (Math.abs(qe) - 0.3) / 0.6))
      a += 1.8 * vel * t * t * (3 - 2 * t) * Math.sign(qe)
    }
    let wy = y * Math.cos(a)
    let wz = y * Math.sin(a)
    wz += -D * shape
    wy += 0.03 * x
    if (vel > 0.001) {
      const t = Math.min(1, Math.max(0, (qe + 1) / 1.3))
      const m = 1 - t * t * (3 - 2 * t)
      wy += 0.07 * W * vel * m
      wz += 0.12 * W * vel * m
    }
    const s = Math.max(-1, Math.min(1, x / W))
    wz += DOOR * W * s * (1.5 - 0.5 * s * s)
    return { x, y: wy, z: wz + dz }
  }

  /** world → CSS px through the same camera */
  private project(p: { x: number; y: number; z: number }) {
    const depth = CAM_Z - p.z
    const f = 1 / Math.tan((FOV * Math.PI) / 360)
    const aspect = this.width / this.height
    const nx = (p.x * f) / aspect / depth
    const ny = (p.y * f) / depth
    return {
      x: (nx * 0.5 + 0.5) * this.width,
      y: (0.5 - ny * 0.5) * this.height,
      scale: CAM_Z / depth,
    }
  }

  /** Where a point of card i's surface (in its uv) lands on screen. */
  private surface(i: number, u: number, v: number, l: ReturnType<RibbonScene['layout']>, W: number, D: number) {
    const cx = this.cardX(i, l)
    // the point under the pointer sits on the stamp's floor, which is pressed in,
    // and the plate is tipped and lifted as the shader has it
    const pl = this.plate(this.cards[i], l)
    const dz = -PRESS_DEPTH * l.ch * this.cards[i].hover + pl.lift + pl.sx * (u - 0.5) * l.cw + pl.sy * (v - 0.5) * l.ch
    return this.project(
      this.sheetPoint(cx - l.cw / 2 + u * l.cw, l.cy - l.ch / 2 + v * l.ch, this.velocity, W, D, dz),
    )
  }

  /**
   * Card i's footprint on screen, in CSS px over the canvas: the box around
   * its four projected corners, and the corner radius at its near scale. The
   * detail panel opens from and closes back to this.
   */
  cardRect(i: number) {
    const l = this.layout()
    const W = this.halfW
    const D = W * SHEET_DEPTH * (1 + SHEET_VEL_DEPTH * this.velocity)
    const pts = [
      this.surface(i, 0, 1, l, W, D),
      this.surface(i, 1, 1, l, W, D),
      this.surface(i, 0, 0, l, W, D),
      this.surface(i, 1, 0, l, W, D),
    ]
    const x0 = Math.min(...pts.map((p) => p.x))
    const x1 = Math.max(...pts.map((p) => p.x))
    const y0 = Math.min(...pts.map((p) => p.y))
    const y1 = Math.max(...pts.map((p) => p.y))
    const scale = pts.reduce((a, p) => a + p.scale, 0) / 4
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, radius: CORNER_PX * scale }
  }

  /**
   * Which card is under a CSS-px point, and where on it (uv), or index -1.
   * The surface is curved, so the flat-rectangle guess is only a start: a few
   * Newton steps through the same projection put the mark exactly under the
   * pointer instead of a little to one side of it.
   */
  hit(px: number, py: number) {
    const l = this.layout()
    const W = this.halfW
    const D = W * SHEET_DEPTH * (1 + SHEET_VEL_DEPTH * this.velocity)
    for (let i = 0; i < this.cards.length; i++) {
      const cx = this.cardX(i, l)
      if (Math.abs(cx) > W + l.cw) continue
      const tl = this.surface(i, 0, 1, l, W, D)
      const br = this.surface(i, 1, 0, l, W, D)
      const pad = 0.08
      let u = (px - tl.x) / (br.x - tl.x)
      let v = 1 - (py - tl.y) / (br.y - tl.y)
      if (u < -pad || u > 1 + pad || v < -pad || v > 1 + pad) continue
      const e = 0.01
      for (let k = 0; k < 3; k++) {
        const p0 = this.surface(i, u, v, l, W, D)
        const pu = this.surface(i, u + e, v, l, W, D)
        const pv = this.surface(i, u, v + e, l, W, D)
        const a = (pu.x - p0.x) / e
        const b = (pv.x - p0.x) / e
        const c = (pu.y - p0.y) / e
        const d = (pv.y - p0.y) / e
        const det = a * d - b * c
        if (Math.abs(det) < 1e-6) break
        const ex = px - p0.x
        const ey = py - p0.y
        u += (d * ex - b * ey) / det
        v += (-c * ex + a * ey) / det
      }
      if (u < 0 || u > 1 || v < 0 || v > 1) continue
      return { index: i, u, v }
    }
    return { index: -1, u: 0, v: 0 }
  }

  /** The pointer, in CSS px over the canvas; null when it has left. */
  pointer(px: number | null, py = 0) {
    if (px === null) {
      this.cards.forEach((c) => {
        c.hoverTarget = 0
      })
      return -1
    }
    const h = this.hit(px, py)
    this.cards.forEach((c, i) => {
      c.hoverTarget = i === h.index ? 1 : 0
      if (i === h.index) {
        c.ball.tx = h.u
        c.ball.ty = h.v
      }
    })
    return h.index
  }

  // ------------------------------------------------ the plate and the opening

  /** The hand over the stage, for the weighted plate, CSS px over the canvas; null when it has left. */
  hold(px: number | null, py = 0) {
    this.plateAt = px === null ? null : { x: px, y: py }
  }

  /** The hand pressed down on the stage, or let go. */
  press(on: boolean) {
    this.pressed = on
  }

  /**
   * Card i leaves the ribbon for the panel. From here the plate stops
   * following the hand -- the card keeps the tip it had when it was clicked
   * -- and `openProgress` (0..1, driven by the panel's timeline) flies it.
   */
  open(i: number) {
    this.opened = i
    this.openProgress = 0
    this.pressed = false
  }

  /** It is back on the ribbon: the hand has the stage again. */
  closed() {
    this.opened = -1
    this.openProgress = 0
    this.openVeil = 0
  }

  /**
   * While a card is open the canvas is lifted out of its section to cover
   * the viewport, so the card can fly anywhere on the page and the page
   * around it can darken with the ribbon: `top` is where the section's top
   * now sits in the canvas (CSS px), null when the canvas is back in place.
   */
  lift(top: number | null) {
    this.band = top
  }

  /** The page-level veil that matches the ribbon's own darkening, as CSS. */
  static veilCss() {
    const [r, g, b] = VEIL_RGB.map((c) => Math.round(c * 255))
    return `rgba(${r}, ${g}, ${b}, ${VEIL})`
  }

  /** The panel's frame, CSS px over the canvas, and its paper colour. */
  openFrame(x: number, y: number, width: number, height: number, paper?: string) {
    this.openRect = { l: x, t: y, r: x + width, b: y + height, wPx: Math.max(1, width), hPx: Math.max(1, height) }
    if (paper) this.paper = parseColor(paper)
  }

  /** The plate's offsets for a card, world units: its rise and its tip as depth per unit across and up. */
  private plate(card: Card, l: ReturnType<RibbonScene['layout']>) {
    return {
      lift: card.plate.lift * LIFT_Z * l.ch,
      sx: -TILT_SLOPE * card.plate.x,
      sy: -TILT_SLOPE * card.plate.y,
    }
  }

  /**
   * One frame of the plates. The card under the hand tips away from the hand
   * and rises, leaning further the way the hand is moving; every other card
   * settles flat. While a card is open nothing follows the hand: the opened
   * one holds its tip into the flight, and lifts clear of any press.
   */
  private stepPlates(dt: number) {
    const h = dt > 0 ? Math.min(dt, 1 / 30) : 0
    if (this.opened < 0) {
      // A moving ribbon carries cards under a still hand: the plate stands
      // down while it moves, so no card tips or rises in the stream and none
      // is pushed into its neighbours. It takes the hand again once it slows.
      const moving = Math.abs(this.velocity) > 0.02
      const hit = this.plateAt && !moving ? this.hit(this.plateAt.x, this.plateAt.y) : { index: -1, u: 0.5, v: 0.5 }
      // the lean is the hand's own speed, not the ribbon's: only a moved hand leans the card
      const handMoved = !!this.plateAt && (this.plateAt.x !== this.platePrev.x || this.plateAt.y !== this.platePrev.y)
      if (this.plateAt) this.platePrev = { x: this.plateAt.x, y: this.plateAt.y }
      let du = 0
      let dv = 0
      if (handMoved && hit.index >= 0 && hit.index === this.under && h > 0) {
        du = (hit.u - this.underUv.u) / h
        dv = (hit.v - this.underUv.v) / h
      }
      this.under = hit.index
      this.underUv = { u: hit.u, v: hit.v }
      this.cards.forEach((card, i) => {
        const p = card.plate
        if (i === hit.index) {
          const clamp = (n: number, m: number) => Math.max(-m, Math.min(m, n))
          p.tx = clamp((hit.u - 0.5) * 2 + clamp(du * TILT_SPEED, 0.6), 1.2)
          p.ty = clamp((hit.v - 0.5) * 2 + clamp(dv * TILT_SPEED * CARD_ASPECT, 0.6), 1.2)
        } else {
          p.tx = 0
          p.ty = 0
        }
      })
    }
    this.cards.forEach((card, i) => {
      const p = card.plate
      let liftTo = 0
      if (this.opened >= 0) liftTo = i === this.opened ? 1 : 0
      else if (i === this.under) liftTo = this.pressed ? LIFT_PRESS : 1
      ;[p.x, p.vx] = spring(p.x, p.vx, p.tx, TILT_K, TILT_ZETA, h)
      ;[p.y, p.vy] = spring(p.y, p.vy, p.ty, TILT_K, TILT_ZETA, h)
      ;[p.lift, p.liftV] = spring(p.lift, p.liftV, liftTo, LIFT_K, LIFT_ZETA, h)
    })
  }

  /**
   * One frame of the cursor's physics on a card. The bump chases the pointer
   * (BALL_FOLLOW), grows with how fast the pointer is moving, and otherwise
   * decays (BALL_DECAY). Every BALL_TAP_EVERY seconds the trail shifts and
   * takes the bump's current place, so a stroke lingers as a path.
   */
  private stepBall(card: Card, dt: number) {
    const b = card.ball
    const follow = 1 - Math.exp(-BALL_FOLLOW * dt)
    const px = b.x
    const py = b.y
    if (card.hoverTarget > 0) {
      b.x += (b.tx - b.x) * follow
      b.y += (b.ty - b.y) * follow
    }
    // speed in card heights per second; a resting hand leaves no wake
    const speed = Math.hypot((b.x - px) * CARD_ASPECT, b.y - py) / Math.max(dt, 1e-3)
    const drive = Math.tanh(Math.max(0, speed - 0.08) / 1.2)
    b.amp = Math.max(b.amp * Math.exp(-BALL_DECAY * dt), drive * BALL_WAKE * card.hover)

    const t = b.trail
    for (let i = 0; i < BALL_TAPS; i++) t[i * 3 + 2] *= Math.exp(-BALL_DECAY * dt)
    b.since += dt
    if (b.since >= BALL_TAP_EVERY) {
      b.since = 0
      for (let i = BALL_TAPS - 1; i > 0; i--) {
        t[i * 3] = t[(i - 1) * 3]
        t[i * 3 + 1] = t[(i - 1) * 3 + 1]
        t[i * 3 + 2] = t[(i - 1) * 3 + 2]
      }
    }
    t[0] = b.x
    t[1] = b.y
    t[2] = b.amp
  }

  // ---------------------------------------------------------------- video

  /**
   * Play the clip on every card in the drawn set, pause the rest.
   *
   * The drawn set reaches a card's width past each edge of the view, so a
   * clip is already looping before its card is visible: scrolling uncovers a
   * video that is running, never one that starts because it arrived.
   *
   * A play() call can fail two ways: its promise rejects (our own pause() a
   * frame later, or the browser refusing outright), or it neither resolves
   * nor rejects -- just hangs, which a freshly created, still-unbuffered
   * video can do on the very first frame the page is alive, before the rest
   * of the page has settled. The first is handled by falling back to
   * not-live on rejection, so the render loop's own check retries next
   * frame. The second cannot be caught from the promise at all, so the same
   * check also watches the element's own `paused`: a card that believes
   * itself live but is not actually playing gets kicked with another play(),
   * on a short cooldown so a genuinely stuck video is retried steadily
   * rather than hammered every frame.
   */
  private syncVideo(now = 0) {
    this.cards.forEach((card) => {
      if (!card.video) return
      const want = card.onScreen
      if (want && (!card.live || (card.video.paused && now - card.kickedAt > 400))) {
        const video = card.video
        card.live = true
        card.kickedAt = now
        video
          .play()
          .then(() => {
            // a card that changed its mind (scrolled away) before this landed
            if (!card.onScreen) video.pause()
          })
          .catch(() => {
            if (card.video === video) card.live = false
          })
      } else if (!want && card.live) {
        card.live = false
        card.video.pause()
      }
    })
  }

  // --------------------------------------------------------------- render

  render(dt = 1 / 60) {
    const gl = this.gl
    if (!gl) return
    const l = this.layout()
    const W = this.halfW
    const v = Math.min(1, Math.abs(this.velocity))
    const D = W * SHEET_DEPTH * (1 + SHEET_VEL_DEPTH * v)
    this.stepPlates(dt)
    // the stage darkens behind an opened card, as it leaves
    const op = this.opened >= 0 ? this.openProgress : 0
    const veil = VEIL * (this.opened >= 0 ? this.openVeil : 0)
    const mixVeil = (c: number, k: number) => c + (VEIL_RGB[k] - c) * veil

    // Lifted off the page, the canvas covers the viewport and the ribbon is
    // drawn where its section sits in it: the camera is shifted down by the
    // section's offset, and everything but the opened card is kept inside the
    // section's band, the rest of the canvas left clear for the page under it.
    let proj = this.proj
    const lifted = this.band !== null
    if (lifted) {
      proj = this.proj.slice()
      proj[9] += (2 * this.band!) / this.height
    }
    const bandScissor = () => {
      if (!lifted) return
      const top = Math.max(0, this.band!)
      const bottom = Math.min(this.height, this.band! + this.height)
      const y = Math.round((this.height - bottom) * this.dpr)
      gl.enable(gl.SCISSOR_TEST)
      gl.scissor(0, y, this.canvas.width, Math.max(0, Math.round((this.height - top) * this.dpr) - y))
    }

    // the frame is drawn to its own target, and read through the surface after
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.surfaceOn ? this.sceneFbo : null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    if (lifted) {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    bandScissor()
    gl.clearColor(mixVeil(this.ground[0], 0), mixVeil(this.ground[1], 1), mixVeil(this.ground[2], 2), 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // ---- floor
    gl.useProgram(this.floorProg)
    const fu = (n: string) => this.floorUniforms.get(n) ?? null
    gl.uniformMatrix4fv(fu('uProj'), false, proj)
    gl.uniformMatrix4fv(fu('uView'), false, VIEW)
    gl.uniform1f(fu('uHalfW'), W)
    gl.uniform1f(fu('uFloorY'), l.cy - l.ch / 2 - l.ch * 0.02)
    gl.uniform1f(fu('uRun'), FLOOR_RUN)
    gl.uniform1f(fu('uNearZ'), FLOOR_NEAR)
    gl.uniform3f(fu('uC0'), this.ground[0], this.ground[1], this.ground[2])
    // the reference: a neutral grey a shade over its black, ~18 lines across;
    // on a light ground the same shade, under it
    const [gr, gg, gb] = this.ground
    const light = gr * 0.2126 + gg * 0.7152 + gb * 0.0722 > 0.5
    if (light) {
      gl.uniform3f(fu('uC1'), gr - 0.03, gg - 0.03, gb - 0.03)
      gl.uniform3f(fu('uLine'), gr - 0.1, gg - 0.1, gb - 0.1)
    } else {
      gl.uniform3f(fu('uC1'), gr + 0.012, gg + 0.012, gb + 0.02)
      gl.uniform3f(fu('uLine'), 0.1, 0.1, 0.11)
    }
    gl.uniform1f(fu('uGrid'), 1.0)
    gl.uniform2f(fu('uGridF'), 66, 44)
    gl.uniform1f(fu('uVeil'), veil)
    gl.uniform3f(fu('uVeilC'), VEIL_RGB[0], VEIL_RGB[1], VEIL_RGB[2])
    this.sheetUniforms(fu, W, D, v)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.floorGeo.pos)
    const fa = gl.getAttribLocation(this.floorProg, 'aPos')
    gl.enableVertexAttribArray(fa)
    gl.vertexAttribPointer(fa, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.floorGeo.idx)
    gl.drawElements(gl.TRIANGLES, this.floorGeo.count, gl.UNSIGNED_SHORT, 0)

    // ---- cards, far to near so the blend composes
    gl.useProgram(this.cardProg)
    const u = (n: string) => this.uniforms.get(n) ?? null
    gl.uniformMatrix4fv(u('uProj'), false, proj)
    gl.uniformMatrix4fv(u('uView'), false, VIEW)
    gl.uniform2f(u('uRes'), l.cw, l.ch)
    gl.uniform1f(u('uDent'), DENT)
    gl.uniform1f(u('uCorner'), CORNER_PX / (CARD_H * this.height))
    gl.uniform1f(u('uShade'), 1)
    gl.uniform1f(u('uShadeS'), 1)
    gl.uniform1f(u('uScrim'), 0.55)
    gl.uniform1f(u('uAlpha'), 1)
    gl.uniform3f(u('uCam'), 0, 0, CAM_Z)
    gl.uniform1i(u('uTex'), 0)
    gl.uniform1i(u('uLabel'), 1)
    this.sheetUniforms(u, W, D, v)
    // the cursor's reach, in the card's own uv: round on screen, so x is
    // divided by the aspect
    gl.uniform2f(u('uBallR'), BALL_RADIUS / CARD_ASPECT, BALL_RADIUS)
    gl.uniform2f(u('uPressR'), PRESS_RADIUS / CARD_ASPECT, PRESS_RADIUS)
    gl.uniform1f(u('uEdge'), PRESS_EDGE)
    gl.uniform1f(u('uBallZ'), BALL_LIFT * l.ch) // heights in the field are in units of the wake's lift
    gl.uniform1f(u('uBallWarp'), BALL_WARP)
    gl.uniform2f(u('uLensR'), LENS_RADIUS / CARD_ASPECT, LENS_RADIUS)
    gl.uniform1f(u('uLensA'), LENS_PULL)
    gl.uniform1f(u('uOpen'), 0)
    gl.uniform2f(u('uFit'), l.cw, l.ch)
    gl.uniform3f(u('uPaper'), this.paper[0], this.paper[1], this.paper[2])
    gl.uniform1f(u('uVeil'), veil)
    gl.uniform3f(u('uVeilC'), VEIL_RGB[0], VEIL_RGB[1], VEIL_RGB[2])

    const pa = gl.getAttribLocation(this.cardProg, 'aPos')
    const ua = gl.getAttribLocation(this.cardProg, 'aUv')
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cardGeo.pos)
    gl.enableVertexAttribArray(pa)
    gl.vertexAttribPointer(pa, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cardGeo.uv)
    gl.enableVertexAttribArray(ua)
    gl.vertexAttribPointer(ua, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cardGeo.idx)

    let nearest = 0
    let nearestX = Infinity
    const order: { i: number; x: number }[] = []
    // whether any card with a clip crossed into or out of the drawn set
    let castChanged = false
    for (let i = 0; i < this.cards.length; i++) {
      const x = this.cardX(i, l)
      if (Math.abs(x) < nearestX) {
        nearestX = Math.abs(x)
        nearest = i
      }
      const onScreen = Math.abs(x) < W + l.cw
      if (onScreen) order.push({ i, x })
      const card = this.cards[i]
      if (card.onScreen !== onScreen) {
        card.onScreen = onScreen
        if (card.video) castChanged = true
      }
    }
    // the S puts the right half far and the left half near: draw right first;
    // an opened card is over everything, so it goes last
    order.sort((a, b) => b.x - a.x)
    if (this.opened >= 0) {
      const k = order.findIndex((o) => o.i === this.opened)
      const [o] = k >= 0 ? order.splice(k, 1) : [{ i: this.opened, x: this.cardX(this.opened, l) }]
      order.push(o)
    }

    for (const { i, x } of order) {
      const card = this.cards[i]
      const pl = this.plate(card, l)
      gl.uniform2f(u('uTilt'), pl.sx, pl.sy)
      gl.uniform1f(u('uLift'), pl.lift)
      if (i === this.opened) {
        // over everything, the page included: out of the section's band
        gl.disable(gl.SCISSOR_TEST)
        // world frame of the panel at z = 0, from its CSS px over the section
        const R = this.openRect
        const toX = (px: number) => (px / this.width) * 2 * W - W
        const toY = (py: number) => this.halfH - (py / this.height) * 2 * this.halfH
        const rw = toX(R.r) - toX(R.l)
        const rh = toY(R.t) - toY(R.b)
        gl.uniform1f(u('uOpen'), op)
        gl.uniform4f(u('uRect'), toX(R.l), toY(R.t), toX(R.r), toY(R.b))
        gl.uniform1f(u('uBulge'), OPEN_BULGE * l.ch)
        gl.uniform2f(u('uFit'), l.cw + (rw - l.cw) * op, l.ch + (rh - l.ch) * op)
        const c0 = CORNER_PX / (CARD_H * this.height)
        gl.uniform1f(u('uCorner'), c0 + (OPEN_CORNER_PX / R.hPx - c0) * op)
        gl.uniform1f(u('uShade'), 1 - op)
        gl.uniform1f(u('uVeil'), 0)
      }
      card.hover += (card.hoverTarget - card.hover) * (1 - Math.exp(-6 * dt))
      this.stepBall(card, dt)
      gl.uniform3fv(u('uBall'), card.ball.trail)
      gl.uniform2f(u('uLens'), card.ball.x, card.ball.y)
      // the press is the hover itself, at the smoothed pointer: no speed needed
      gl.uniform3f(u('uPress'), card.ball.x, card.ball.y, card.hover * PRESS_DEPTH / BALL_LIFT)
      if (card.video && card.live && card.video.readyState >= 2) {
        this.upload(card, card.video, card.video.videoWidth || 16, card.video.videoHeight || 10)
      }
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, card.tex)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, card.label)
      gl.uniform2f(u('uSize'), card.size[0], card.size[1])
      gl.uniform2f(u('uCentre'), x, l.cy)
      gl.uniform1f(u('uHover'), card.hover)
      gl.drawElements(gl.TRIANGLES, this.cardGeo.count, gl.UNSIGNED_SHORT, 0)
    }

    // the caption still follows the middle card; the clips follow the set
    this.nearest = nearest
    if (castChanged) this.syncVideo(performance.now())
    else if (this.cards.some((c) => c.video && c.onScreen && (!c.live || c.video.paused))) {
      this.syncVideo(performance.now())
    }

    gl.disable(gl.SCISSOR_TEST)
    if (this.surfaceOn) this.stepSurface(dt)
  }

  private sheetUniforms(u: (n: string) => WebGLUniformLocation | null, W: number, D: number, v: number) {
    const gl = this.gl
    gl.uniform1f(u('uSheetW'), W)
    gl.uniform1f(u('uSheetD'), D)
    gl.uniform1f(u('uSheetT'), SHEET_T)
    gl.uniform1f(u('uSheetC'), 1)
    gl.uniform1f(u('uSheetP'), 1)
    gl.uniform1f(u('uSheetV'), v)
    gl.uniform1f(u('uLeanA'), W * DOOR)
    gl.uniform1f(u('uLeanW'), W)
  }

  dispose() {
    const gl = this.gl
    if (!gl) return
    this.cards.forEach((c) => {
      gl.deleteTexture(c.tex)
      gl.deleteTexture(c.label)
      if (c.video) {
        c.video.pause()
        c.video.removeAttribute('src')
        c.video.load()
      }
    })
    gl.deleteProgram(this.cardProg)
    gl.deleteProgram(this.floorProg)
    gsap.killTweensOf(this.hand)
    if (this.fieldProg) gl.deleteProgram(this.fieldProg)
    if (this.surfaceProg) gl.deleteProgram(this.surfaceProg)
    if (this.sceneTex) gl.deleteTexture(this.sceneTex)
    if (this.sceneFbo) gl.deleteFramebuffer(this.sceneFbo)
    for (const f of this.field) {
      gl.deleteTexture(f.tex)
      gl.deleteFramebuffer(f.fbo)
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
