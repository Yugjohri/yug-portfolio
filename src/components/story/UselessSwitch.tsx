import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

/**
 * A useless machine: flip the switch and a bear's arm comes out and flips it
 * back. Keep at it and the bear peeks over, then puts its whole head up, and
 * eventually gets cross (eyebrows, and the odd word). After jh3y's "Useless
 * checkbox w/ React + GSAP" (codepen.io/jh3y/pen/ZjLKGY): the same drawing,
 * timings and escalation, moved into a small box of its own (the pen used
 * the whole window) and to GSAP 3; the switch wears the site's red.
 *
 * Everything is laid out on a 420 x 300 stage around one point (the centre of
 * the switch). The bear lives below that line and is clipped at it (the pen
 * painted a mask in the page's colour; a clip works over any ground), so it
 * rises from behind the switch.
 *
 * skin "mode": the prank. Dressed as a dark-mode toggle (a sun on the knob,
 * a moon and a dark track once it is flipped) and kept in the header, where
 * a theme switch is expected -- flip it and the bear will have none of it.
 */

const DUR = { arm: 0.2, bear: 0.25, box: 0.25, paw: 0.1 }
/** the "mode" skin's icon, after cameronknight's dark-mode toggle (codepen.io/cameronknight/pen/BaLWbae):
 *  a crescent that swells to a full disc as it crosses the pill, and back */
const MOON = 'M17.5 28C17.5 43.1878 28.5681 55.5 27.5 55.5C12.3122 55.5 0 43.1878 0 28C0 12.8122 12.3122 0.5 27.5 0.5C27.5 0.5 17.5 12.8122 17.5 28Z'
const SUN = 'M55 27.5C55 42.6878 42.6878 55 27.5 55C12.3122 55 0 42.6878 0 27.5C0 12.3122 12.3122 0 27.5 0C42.6878 0 55 12.3122 55 27.5Z'
const range = (max: number, min = 1) => Math.random() * (max - min) + min

export default function UselessSwitch({ skin = 'plain' }: { skin?: 'plain' | 'mode' }) {
  const root = useRef<HTMLDivElement>(null)
  const bear = useRef<SVGSVGElement>(null)
  const armWrap = useRef<HTMLDivElement>(null)
  const arm = useRef<SVGSVGElement>(null)
  const paw = useRef<HTMLDivElement>(null)
  const swear = useRef<HTMLDivElement>(null)
  const bg = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLDivElement>(null)
  const icon = useRef<SVGSVGElement>(null)
  const iconPath = useRef<SVGPathElement>(null)

  // when the bear starts to show itself, to put its head up, and to lose its temper (per visit, as in the pen)
  const [limits] = useState(() => {
    const armLimit = range(2, 0)
    const headLimit = range(armLimit + 3, armLimit + 1)
    const angerLimit = range(headLimit + 3, headLimit + 1)
    return { armLimit, headLimit, angerLimit }
  })
  const [checked, setChecked] = useState(false)
  const [count, setCount] = useState(0)
  const live = useRef({ checked: false, count: 0 })
  live.current = { checked, count }

  const colours = () => {
    const cs = getComputedStyle(root.current!)
    return { off: cs.getPropertyValue('--us-off').trim(), on: cs.getPropertyValue('--us-on').trim() }
  }

  const { contextSafe } = useGSAP(
    () => {
      // every moving part's resting place, set here rather than in CSS so GSAP owns the transforms
      gsap.set(bear.current, { yPercent: 100 })
      gsap.set(armWrap.current, { yPercent: -50, x: 0 })
      gsap.set(arm.current, { xPercent: -35, yPercent: -50, scaleX: 1, transformOrigin: '0% 50%' })
      gsap.set(paw.current, { x: 80, y: -15, scaleX: 0, transformOrigin: '100% 50%' })
      gsap.set(indicator.current, { xPercent: 0 })
    },
    { scope: root },
  )

  const grabBear = contextSafe(() => {
    const { count: n } = live.current
    const { armLimit, headLimit, angerLimit } = limits
    let lift: number | null = null
    if (n > armLimit && n < headLimit) lift = 40
    else if (n >= headLimit) lift = 0
    const showSwear = Math.random() > 0.5 && n > angerLimit
    const base = DUR.arm + DUR.arm + DUR.paw
    const pre = range(1, 0)
    const delay = n > armLimit ? base + DUR.bear + pre : base
    const tl = gsap.timeline({
      delay: Math.random(),
      onComplete: () => {
        setChecked(false)
        setCount(n + 1)
      },
    })
    if (n > armLimit && lift !== null) {
      tl.to(bear.current, {
        duration: DUR.bear,
        yPercent: lift,
        onComplete: () => {
          if (showSwear && swear.current) swear.current.style.display = 'block'
        },
      })
    }
    tl.to(armWrap.current, { duration: DUR.arm, x: 50 }, n > armLimit ? pre : 0)
      .to(arm.current, { duration: DUR.arm, scaleX: 0.7 })
      .to(paw.current, {
        duration: DUR.paw,
        scaleX: 0.8,
        onComplete: () => {
          if (swear.current) swear.current.style.display = 'none'
        },
      })
      .to(bg.current, { duration: DUR.box, backgroundColor: colours().off }, delay)
      .to(indicator.current, { duration: DUR.box, xPercent: 0 }, delay)
      .add(iconTo(false, DUR.box * 2), delay)
      .to(paw.current, { duration: DUR.paw, scaleX: 0 }, delay)
      .to(arm.current, { duration: DUR.paw, scaleX: 1 }, delay + DUR.paw)
      .to(armWrap.current, { duration: DUR.arm, x: 0 }, delay + DUR.paw)
      .to(bear.current, { duration: DUR.bear, yPercent: 100 }, delay + DUR.paw)
    return tl
  })

  /** the icon's half of a flip: the crescent turns half round and swells to a disc (or back) */
  const iconTo = (on: boolean, duration: number) => {
    const tl = gsap.timeline()
    if (!icon.current || !iconPath.current) return tl
    return tl
      .to(icon.current, { rotation: on ? -180 : 0, duration, ease: 'power2.out', transformOrigin: '50% 50%' }, 0)
      .to(iconPath.current, { attr: { d: on ? SUN : MOON }, duration, ease: 'power2.out' }, 0)
  }

  const flip = contextSafe(() => {
    gsap
      .timeline()
      .to(bg.current, { duration: DUR.box, backgroundColor: colours().on })
      .to(indicator.current, { duration: DUR.box, xPercent: 100 }, 0)
      .add(iconTo(true, DUR.box * 2), 0)
      .add(grabBear(), DUR.box)
  })

  const onChange = () => {
    if (live.current.checked) return
    setChecked(true)
    live.current.checked = true
    flip()
  }
  const onHover = contextSafe(() => {
    if (Math.random() > 0.5 && live.current.count > limits.armLimit) {
      gsap.to(bear.current, { duration: DUR.bear / 2, yPercent: 40 })
    }
  })
  const offHover = contextSafe(() => {
    if (!live.current.checked) gsap.to(bear.current, { duration: DUR.bear / 2, yPercent: 100 })
  })

  const cross = count >= limits.angerLimit
  return (
    <div className={skin === 'mode' ? 'useless useless--mode' : 'useless'} ref={root} data-on={checked ? '' : undefined}>
      <div className="useless__stage">
        {/* the bear's room: everything above the switch's centre line, and nothing below it */}
        <div className="useless__bear-clip">
        <div className="useless__bear-wrap">
          <div className="useless__swear" ref={swear} aria-hidden="true">
            #@$%*!
          </div>
          <svg ref={bear} className="useless__bear" viewBox="0 0 284.94574 359.73706" preserveAspectRatio="xMinYMin" aria-hidden="true">
            <g transform="translate(-7.5271369,-761.38595)">
              <g transform="matrix(1.2335313,0,0,1.2335313,-35.029693,-212.83637)">
                <path d="M 263.90933,1081.4151 A 113.96792,96.862576 0 0 0 149.99132,985.71456 113.96792,96.862576 0 0 0 36.090664,1081.4151 l 227.818666,0 z" fill="#784421" />
                <path d="m 250.42825,903.36218 c 2e-5,66.27108 -44.75411,114.99442 -102.42825,114.99442 -57.674143,0 -98.428271,-48.72334 -98.428251,-114.99442 4e-6,-66.27106 40.754125,-92.99437 98.428251,-92.99437 57.67413,0 102.42825,26.72331 102.42825,92.99437 z" fill="#784421" />
                <path d="m 217,972.86218 c 2e-5,21.53911 -30.44462,42.00002 -68,42.00002 -37.55538,0 -66.000019,-20.46091 -66,-42.00002 0,-21.53911 28.44464,-36 66,-36 37.55536,0 68,14.46089 68,36 z" fill="#e9c6af" />
                <path d="m 181.5,944.36218 c 0,8.28427 -20.59974,26.5 -32.75,26.5 -12.15026,0 -34.75,-18.21573 -34.75,-26.5 0,-8.28427 22.59974,-13.5 34.75,-13.5 12.15026,0 32.75,5.21573 32.75,13.5 z" fill="#000" />
                <g>
                  <ellipse cx="69" cy="823.07269" rx="34.5" ry="33.289474" fill="#784421" />
                  <path
                    d="M 69,47.310547 A 24.25,23.399124 0 0 0 44.75,70.710938 24.25,23.399124 0 0 0 64.720703,93.720703 c 0.276316,-0.40734 0.503874,-0.867778 0.787109,-1.267578 1.70087,-2.400855 3.527087,-4.666237 5.470704,-6.798828 1.943616,-2.132591 4.004963,-4.133318 6.179687,-6.003906 2.174725,-1.870589 4.461274,-3.611714 6.855469,-5.226563 2.394195,-1.614848 4.896019,-3.10338 7.498047,-4.46875 0.539935,-0.283322 1.133058,-0.500695 1.68164,-0.773437 A 24.25,23.399124 0 0 0 69,47.310547 Z"
                    fill="#e9c6af"
                    transform="translate(0,752.36216)"
                  />
                </g>
                <g transform="matrix(-1,0,0,1,300,0)">
                  <ellipse cx="69" cy="823.07269" rx="34.5" ry="33.289474" fill="#784421" />
                  <path
                    d="M 69,47.310547 A 24.25,23.399124 0 0 0 44.75,70.710938 24.25,23.399124 0 0 0 64.720703,93.720703 c 0.276316,-0.40734 0.503874,-0.867778 0.787109,-1.267578 1.70087,-2.400855 3.527087,-4.666237 5.470704,-6.798828 1.943616,-2.132591 4.004963,-4.133318 6.179687,-6.003906 2.174725,-1.870589 4.461274,-3.611714 6.855469,-5.226563 2.394195,-1.614848 4.896019,-3.10338 7.498047,-4.46875 0.539935,-0.283322 1.133058,-0.500695 1.68164,-0.773437 A 24.25,23.399124 0 0 0 69,47.310547 Z"
                    fill="#e9c6af"
                    transform="translate(0,752.36216)"
                  />
                </g>
                <ellipse cx="105.83063" cy="900.38916" rx="9.2701159" ry="9.6790915" fill="#000" />
                <ellipse cx="186.89894" cy="900.38916" rx="9.2701159" ry="9.6790915" fill="#000" />
                {cross ? (
                  <>
                    <path d="m 92.05833,865.4614 39.42665,22.76299" stroke="#000" strokeWidth={4.86408424} strokeLinecap="round" />
                    <path d="m 202.82482,865.4614 -39.42664,22.76299" stroke="#000" strokeWidth={4.86408424} strokeLinecap="round" />
                  </>
                ) : null}
              </g>
            </g>
          </svg>
        </div>
        </div>

        <div className="useless__arm-wrap" ref={armWrap} aria-hidden="true">
          <svg ref={arm} className="useless__arm" viewBox="0 0 250.00001 99.999997" preserveAspectRatio="xMinYMin">
            <g transform="translate(868.57141,-900.93359)">
              <path
                d="m -619.43416,945.05124 c 4.18776,73.01076 -78.25474,53.24342 -150.21568,52.94118 -82.38711,-0.34602 -98.92158,-19.44459 -98.92157,-47.05883 0,-27.61424 4.78794,-42.54902 73.82353,-42.54902 69.03559,0 171.43607,-30.93764 175.31372,36.66667 z"
                fill="#784421"
              />
              <ellipse cx="-683.02264" cy="950.98572" rx="29.910826" ry="29.414362" fill="#e9c6af" />
            </g>
          </svg>
        </div>
        <div className="useless__paw" ref={paw} aria-hidden="true" />

        <div className="useless__switch" onMouseOver={onHover} onMouseOut={offHover} title={skin === 'mode' ? 'Dark mode' : undefined}>
          <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            aria-label={skin === 'mode' ? 'Dark mode (a joke: there is a bear who will not allow it)' : 'A switch that does not want to be switched'}
          />
          <div className="useless__bg" ref={bg} />
          <div className="useless__indicator" ref={indicator}>
            {skin === 'mode' ? (
              <svg className="useless__icon" ref={icon} viewBox="0 0 55 56" aria-hidden="true">
                <path ref={iconPath} d={MOON} />
              </svg>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
