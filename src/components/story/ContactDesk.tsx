import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import deskSvg from '../../assets/contact-desk.svg?raw'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * A desk that builds itself beside the contact details: the panel opens, the
 * table drops in, the lamp assembles joint by joint, the monitor, keyboard,
 * mouse and mug arrive -- then the lamp flickers on. After thiennhat's "SVG
 * animation" (codepen.io/thiennhat/pen/BNByzJ): the same drawing and the
 * same choreography, moved to GSAP 3.
 *
 * The one change is the light. In the pen the room floods yellow; here the
 * panel starts as the site's dark plate, the lamp's flicker lets the page's
 * cream show through it, and when the light holds the panel *becomes* the
 * page's ground -- the lights come on and the desk is standing on the page.
 *
 * It plays once, the first time the contact section comes into view (or at
 * once, with playNow: the error screen, which cannot count on the scroll).
 * Under reduced motion the desk is simply there, lit.
 */
export default function ContactDesk({ playNow = false }: { playNow?: boolean }) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const el = root.current
      if (!el) return
      const q = (sel: string) => gsap.utils.toArray<SVGElement>(sel, el)
      const bgd = q('#cdk-background rect')
      // the lit room is the page itself
      const lit = getComputedStyle(el).getPropertyValue('--bg').trim() || '#e9e5de'

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(bgd, { fill: lit })
        gsap.set(q('#cdk-lamp > .light'), { opacity: 0.2 })
        return
      }

      const tl = gsap.timeline({ paused: true })
      tl.from(bgd, { duration: 0.2, opacity: 0, scale: 0, transformOrigin: '50% 50%' })
        .from(q('#cdk-table_legs, #cdk-table'), { duration: 0.2, y: '-=200', opacity: 0, ease: 'elastic.out', stagger: 0.1 })
        .from(q('#cdk-lamp > .lamp-leg'), { duration: 0.2, opacity: 0, x: -200, ease: 'elastic.out' })
        .from(q('#cdk-lamp-bottom'), { duration: 0.2, opacity: 0, scale: 0, transformOrigin: '50% 50%' })
        .from(q('#cdk-lamp-line-b'), { duration: 0.3, opacity: 0, transformOrigin: '100% 100%', rotation: -180 })
        .from(q('#cdk-lamp-circle'), { duration: 0.1, opacity: 0, x: '-=100', y: '-=100' })
        .from(q('#cdk-lamp-line-t'), { duration: 0.3, opacity: 0, transformOrigin: '0% 100%', rotation: -180 })
        .from(q('#cdk-lamp-head'), { duration: 0.2, opacity: 0, scale: 0, ease: 'elastic.out' })
        .from(q('#cdk-lamp-header'), { duration: 0.5, transformOrigin: '60% 60%', rotation: 60 })
        .from(q('#cdk-lamp-body'), { duration: 0.5, transformOrigin: '70% 70%', rotation: -25 })
        .from(q('#cdk-computer > *'), { duration: 1, opacity: 0, scale: 0, transformOrigin: '50% 50%', ease: 'back.out', stagger: 0.2 })
        .from(q('#cdk-keyboard > *'), { duration: 0.5, opacity: 0, y: '-=100', ease: 'none', stagger: 0.05 })
        .from(q('#cdk-computer_mouse > *, #cdk-coffee_mug > *'), { duration: 0.5, opacity: 0, stagger: 0.05 })

      // the lamp catches: three flickers (labels a, b, c, as in the pen), the
      // dark panel thinning with each so the cream shows through, then it holds
      const light = q('#cdk-lamp > .light')
      const glow = q('#cdk-lamp-line')
      tl.addLabel('a')
        .to(light, { duration: 0.2, opacity: 0.8, ease: 'elastic.out', delay: 0.5 }, 'a')
        .addLabel('b')
        .to(light, { duration: 0.1, opacity: 0 }, 'b')
        .addLabel('c')
        .to(light, { duration: 0.1, opacity: 0.2 }, 'c')
        .to(bgd, { duration: 0.2, opacity: 0.1, delay: 0.5 }, 'a-=0.05')
        .to(bgd, { duration: 0.1, opacity: 1 }, 'b-=0.05')
        .to(bgd, { duration: 0.1, opacity: 0.5 }, 'c-=0.05')
        // where the pen floods yellow: the panel turns the page's own ground
        .to(bgd, { duration: 0.45, opacity: 1, fill: lit, ease: 'power2.inOut' })
        .fromTo(glow, { opacity: 0 }, { duration: 0.2, opacity: 0.2, delay: 0.5 }, 'a-=0.05')
        .to(glow, { duration: 0.1, opacity: 1 }, 'b-=0.05')
        .to(glow, { duration: 0.1, opacity: 0.5 }, 'c-=0.05')

      if (playNow) {
        tl.play()
        return
      }
      ScrollTrigger.create({
        trigger: el,
        start: 'top 80%',
        once: true,
        onEnter: () => (document.hidden ? tl.progress(1) : tl.play()),
      })
    },
    { scope: root },
  )

  return <div className="cdesk" ref={root} aria-hidden="true" dangerouslySetInnerHTML={{ __html: deskSvg }} />
}
