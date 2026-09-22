import { useCallback, useEffect, useRef, useState } from 'react'
import { PortfolioMotion } from '../lib/motion'
import { SLEEVES } from '../data/portfolio'
import SplitHero from '../components/hero/SplitHero'
import Preloader from '../components/Preloader'
import SiteNav from '../components/SiteNav'
import Intro from '../components/sections/Intro'
import About from '../components/sections/About'
import Manifesto from '../components/sections/Manifesto'
import Proof from '../components/sections/Proof'
import Work from '../components/sections/Work'
import Roles from '../components/sections/Roles'
import Stack from '../components/sections/Stack'
import Now from '../components/sections/Now'
import Contact from '../components/sections/Contact'
import CaseModal from '../components/CaseModal'

export default function Portfolio() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const motion = useRef<PortfolioMotion | null>(null)

  // React renders the page; the motion module drives everything that moves.
  useEffect(() => {
    const m = new PortfolioMotion({
      accent: '#D8380F',
      onOpenDetail: (i) => setOpenIndex(i),
      onCloseDetail: () => setOpenIndex(null),
    })
    motion.current = m
    m.mount()
    return () => {
      m.unmount()
      motion.current = null
    }
  }, [])

  // hold the page still behind the modal
  useEffect(() => {
    motion.current?.lockScroll(openIndex !== null)
  }, [openIndex])

  const closeDetail = useCallback(() => setOpenIndex(null), [])

  return (
    <div className="page">
      <canvas id="fx" />
      <div id="ring" />
      <Preloader />
      <SiteNav />

      <SplitHero />
      <Intro />
      <About />
      <Manifesto />
      <Proof />
      <Work onOpen={setOpenIndex} />
      <Roles />
      <Stack />
      <Now />
      <Contact />

      <CaseModal
        sleeve={openIndex === null ? null : SLEEVES[openIndex]}
        onClose={closeDetail}
      />
    </div>
  )
}
