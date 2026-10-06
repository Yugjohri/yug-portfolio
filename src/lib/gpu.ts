/**
 * Is WebGL running on the CPU? On a machine with no usable graphics chip (or
 * with hardware acceleration switched off) the browser still offers WebGL, but
 * draws it in software -- SwiftShader, llvmpipe, Microsoft's Basic Render
 * Driver -- and the site's full-screen shaders then take seconds a frame. The
 * scenes check this and fall back: the landing's black hole is drawn once and
 * held still; the Story's screens take the paths they already have for no
 * WebGL at all.
 *
 * The renderer's own name decides. Only when a browser hides it is the other
 * signal used: refusing a context that has "a major performance caveat" while
 * granting an ordinary one. (That refusal alone misfires on real chips --
 * a GPU process still busy at page load, or one just recovered from a lost
 * context -- and froze the landing's hole on a machine that could run it.)
 * Probed once, with a throwaway context.
 */
let cached: boolean | null = null

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i

export function softwareGpu(): boolean {
  if (cached !== null) return cached
  cached = false
  if (typeof document === 'undefined') return cached
  try {
    // ?gpu=software forces the fallbacks, to look at them on a normal machine
    if (new URLSearchParams(window.location.search).get('gpu') === 'software') return (cached = true)
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl')
    if (!gl) return cached
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '') : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    if (name) return (cached = SOFTWARE.test(name))
    const fast = document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true })
    cached = !fast
    ;(fast as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}
