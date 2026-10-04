import { useEffect, useRef } from 'react'

/**
 * The contact section's backdrop: its words set huge, and a knot of clear
 * glass turning in front of them, bending the letters behind it and leaning
 * after the pointer. After NIDAL's "Glass Hero" (codepen.io/Nidal95/pen/qERKExz):
 * the same scene -- a canvas-drawn text plane, a transmissive, dispersive torus
 * knot lit by a room environment -- here filling the section rather than the
 * window, in the page's own ground, ink and red.
 *
 * three.js is only fetched as the section approaches, and the scene only
 * renders while it is on screen. Without WebGL the text alone is shown; under
 * reduced motion the knot holds still.
 */

type Props = {
  /** the lines, top to bottom; the last is set in the accent */
  lines: string[]
  /** the elements the lines must stay between (selectors within the section): below the first, above the second */
  below?: string
  above?: string
}

const css = (el: Element, name: string, fallback: string) =>
  getComputedStyle(el).getPropertyValue(name).trim() || fallback

export default function ContactGlass({ lines, below, above }: Props) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = root.current
    if (!host) return
    let disposed = false
    let teardown: (() => void) | null = null
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // the type, drawn to a canvas: the glass's subject (and, without WebGL, all there is)
    const textCanvas = document.createElement('canvas')
    const drawText = (w: number, h: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      textCanvas.width = Math.max(1, Math.round(w * dpr))
      textCanvas.height = Math.max(1, Math.round(h * dpr))
      const c = textCanvas.getContext('2d')!
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.fillStyle = css(host, '--bg', '#e9e5de')
      c.fillRect(0, 0, w, h)
      c.textAlign = 'left'
      c.textBaseline = 'middle'
      const family = 'Anton, "Arial Narrow", Impact, sans-serif'
      const base = 100
      const gap = 1.0
      // the room between the labels above and the content below, measured in the section
      // (by layout offsets, not the screen: the content rises in as the section arrives)
      const section = host.parentElement
      const offTop = (el: HTMLElement) => {
        let y = 0
        for (let e: HTMLElement | null = el; e && e !== section; e = e.offsetParent as HTMLElement | null) y += e.offsetTop
        return y
      }
      const edge = (sel: string | undefined, side: 'top' | 'bottom', fallback: number) => {
        const el = sel && section ? section.querySelector<HTMLElement>(sel) : null
        return el ? offTop(el) + (side === 'bottom' ? el.offsetHeight : 0) : fallback
      }
      const pad = Math.max(16, h * 0.03)
      const top = edge(below, 'bottom', 0) + pad
      const bottom = edge(above, 'top', h * 0.6) - pad
      // set from the same left edge as the details under it (the email, the links)
      const inner = section?.querySelector<HTMLElement>('.contact__inner')
      const left = inner ? Math.max(0, inner.offsetLeft - host.offsetLeft) : w * 0.05
      const maxW = Math.min(w * 0.9, w - left - w * 0.03)
      const maxH = Math.max(40, bottom - top)
      c.font = `400 ${base}px ${family}`
      const sizes = lines.map((l) => base * (maxW / Math.max(1, c.measureText(l).width)))
      const total = sizes.reduce((s, z) => s + z * gap, 0)
      const fit = Math.min(1, maxH / total)
      let y = top + (maxH - total * fit) / 2
      lines.forEach((line, i) => {
        const size = sizes[i] * fit
        c.font = `400 ${size}px ${family}`
        c.fillStyle = i === lines.length - 1 ? css(host, '--red-hot', '#bc0202') : css(host, '--text', '#1a1618')
        y += (size * gap) / 2
        c.fillText(line, left, y)
        y += (size * gap) / 2
      })
      return { cx: left + (maxW * fit) / 2, cy: top + maxH / 2, block: total * fit }
    }

    const start = async () => {
      await document.fonts.load('100px Anton').catch(() => {})
      let THREE: typeof import('three') | null = null
      let RoomEnvironment: typeof import('three/examples/jsm/environments/RoomEnvironment.js').RoomEnvironment | null = null
      try {
        THREE = await import('three')
        RoomEnvironment = (await import('three/examples/jsm/environments/RoomEnvironment.js')).RoomEnvironment
      } catch {
        THREE = null
      }
      if (disposed) return

      const canvas = document.createElement('canvas')
      canvas.className = 'cglass__canvas'
      let renderer: import('three').WebGLRenderer | null = null
      try {
        if (!THREE || !RoomEnvironment) throw new Error('no three')
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
      } catch {
        // no WebGL: the type alone, still the section's backdrop
        textCanvas.className = 'cglass__canvas'
        host.appendChild(textCanvas)
        const fallback = () => drawText(host.clientWidth, host.clientHeight)
        fallback()
        const ro = new ResizeObserver(fallback)
        ro.observe(host)
        teardown = () => {
          ro.disconnect()
          textCanvas.remove()
        }
        return
      }
      if (!THREE || !RoomEnvironment) return
      host.appendChild(canvas)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(css(host, '--bg', '#e9e5de'))
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
      const CAMERA_Z = 5
      camera.position.z = CAMERA_Z
      const pmrem = new THREE.PMREMGenerator(renderer)
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      scene.environment = env

      let texture: import('three').CanvasTexture | null = null
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }))
      scene.add(plane)
      const knot = new THREE.Mesh(
        new THREE.TorusKnotGeometry(1, 0.3, 300, 48, 2, 3),
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0,
          roughness: 0,
          transmission: 1,
          thickness: 0.7,
          ior: 1.45,
          dispersion: 4,
          envMapIntensity: 1,
          toneMapped: false,
        }),
      )
      const KNOT_Z = 2.2
      knot.position.z = KNOT_Z
      scene.add(knot)
      // the knot floats nearer the camera than the words: perspective enlarges it and its
      // offsets by CAMERA_Z / (CAMERA_Z - KNOT_Z); this undoes that, so it sits on the words
      const depth = (CAMERA_Z - KNOT_Z) / CAMERA_Z

      // where the type's block sits, in the scene's units (the knot centres on it)
      const home = { x: 0, y: 0 }
      let visW = 1
      let visH = 1
      const resize = () => {
        const w = Math.max(1, host.clientWidth)
        const h = Math.max(1, host.clientHeight)
        renderer!.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        visH = 2 * CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
        visW = visH * camera.aspect
        plane.scale.set(visW, visH, 1)
        const { cx, cy, block } = drawText(w, h)
        // the knot sized to the words (the pen's words filled the screen; these share it)
        knot.scale.setScalar(Math.min(Math.min(visW, visH) * 0.16, (block / h) * visH * 0.48) * depth)
        home.y = (0.5 - cy / h) * visH * depth
        // and over the words, wherever they are set
        home.x = (cx / w - 0.5) * visW * depth
        texture?.dispose()
        texture = new THREE.CanvasTexture(textCanvas)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = renderer!.capabilities.getMaxAnisotropy()
        plane.material.map = texture
        plane.material.needsUpdate = true
      }
      resize()
      const ro = new ResizeObserver(resize)
      ro.observe(host)

      // the pointer turns the knot, and draws it a little way toward itself
      const pointer = { x: 0, y: 0 }
      const onMove = (e: PointerEvent) => {
        const r = host.getBoundingClientRect()
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
        pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1
      }
      window.addEventListener('pointermove', onMove, { passive: true })

      const clock = new THREE.Clock()
      const render = () => {
        const t = clock.getElapsedTime()
        if (!reduced) {
          knot.rotation.x = t * 0.35 + pointer.y * 0.15
          knot.rotation.y = t * 0.5 + pointer.x * 0.2
          knot.position.x += (home.x + pointer.x * visW * 0.1 * depth - knot.position.x) * 0.05
          knot.position.y += (home.y - pointer.y * visH * 0.05 * depth - knot.position.y) * 0.05
        } else {
          knot.rotation.set(0.6, 0.4, 0)
          knot.position.set(home.x, home.y, KNOT_Z)
        }
        renderer!.render(scene, camera)
      }
      knot.position.set(home.x, home.y, KNOT_Z)

      // only while it can be seen
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          if (reduced) render()
          else renderer!.setAnimationLoop(render)
        } else renderer!.setAnimationLoop(null)
      })
      io.observe(host)

      teardown = () => {
        io.disconnect()
        ro.disconnect()
        window.removeEventListener('pointermove', onMove)
        renderer!.setAnimationLoop(null)
        texture?.dispose()
        plane.geometry.dispose()
        plane.material.dispose()
        knot.geometry.dispose()
        knot.material.dispose()
        env.dispose()
        pmrem.dispose()
        renderer!.dispose()
        canvas.remove()
      }
    }

    // fetched as the section comes near, not with the page
    const near = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        near.disconnect()
        void start()
      },
      { rootMargin: '100% 0px' },
    )
    near.observe(host)

    return () => {
      disposed = true
      near.disconnect()
      teardown?.()
    }
  }, [lines, below, above])

  return <div className="cglass" ref={root} aria-hidden="true" />
}
