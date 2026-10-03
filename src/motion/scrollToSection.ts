import gsap from 'gsap'

/**
 * Glide the page to a section by id, through Lenis when it is running (the
 * longer the way, the longer the glide), or straight there under reduced
 * motion. Returns false when the section is not on this page.
 */
export function scrollToSection(id: string): boolean {
  const target = document.getElementById(id)
  if (!target) return false
  const lenis = window.__lenis
  const y = target.getBoundingClientRect().top + window.scrollY
  if (!lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo({ top: y, behavior: 'auto' })
    return true
  }
  const distance = Math.abs(y - window.scrollY) / window.innerHeight
  lenis.scrollTo(target, { duration: gsap.utils.clamp(0.9, 1.8, 0.9 + distance * 0.12), force: true })
  return true
}
