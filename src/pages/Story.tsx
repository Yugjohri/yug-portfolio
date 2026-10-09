// this page's styles, loaded with it (in the order index.css had them)
import '../styles/projects.css'
import '../styles/story.css'
import '../styles/detail.css'
import '../styles/stack.css'
import StoryHero from '../components/story/StoryHero'
import ProjectsStrip from '../components/projects/ProjectsStrip'
import Experience from '../components/story/Experience'
import Contact from '../components/story/Contact'
import RunningBand from '../components/story/RunningBand'
import { useSmoothScroll } from '../lib/useSmoothScroll'
import { useSectionTransitions } from '../motion/sectionTransitions'
import SiteHeader from '../components/story/SiteHeader'
import AboutPanel from '../components/story/AboutPanel'
import { useEffect } from 'react'
import { markPage } from '../boot/boot'

/**
 * The Story route -- where the hero's My Story panel leads. Its header, then
 * 01 about (with the stack), 02 experience, 03 the ribbon, 04 contact (with the notes board).
 * (The red thread that once ran between them, StoryThread, is retired.)
 */
const headerClip = () =>
  window.matchMedia('(max-width: 700px)').matches ? '/story-header-mobile.mp4' : '/story-header.mp4'

export default function Story() {
  useSmoothScroll()
  // the scroll transitions between sections (each one switched in motion/sectionTransitions.ts)
  useSectionTransitions()
  useEffect(markPage, [])

  return (
    <main className="story">
      {/* a phone gets the smaller clip (its screen is a third the size) */}
      <StoryHero videoSrc={headerClip()} />
      {/* About: carried in by the header's walls, then the real section takes over in place */}
      <AboutPanel variant="section" />
      <Experience />
      <ProjectsStrip />
      {/* a breath between the work and the invitation */}
      <RunningBand />
      <Contact />
      <SiteHeader />
    </main>
  )
}
