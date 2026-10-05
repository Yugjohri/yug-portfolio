/**
 * Is WebGL running on the CPU? On a machine with no usable graphics chip (or
 * with hardware acceleration switched off) the browser still offers WebGL, but
 * draws it in software -- SwiftShader, llvmpipe, Microsoft's Basic Render
 * Driver -- and the site's full-screen shaders then take seconds a frame. The
 * scenes check this and fall back: the landing's black hole is drawn once and
 * held still; the Story's screens take the paths they already have for no
 * WebGL at all.
 *
 * Two signals, either is enough: the browser refusing a context that has "a
 * major performance caveat" while granting an ordinary one, and the renderer's
 * own name. Probed once, with a throwaway context.
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
    const fast = document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true })
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '')
    cached = !fast || SOFTWARE.test(name)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    ;(fast as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}
