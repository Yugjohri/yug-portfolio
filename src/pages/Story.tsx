import StoryHero from '../components/story/StoryHero'
import ProjectsStrip from '../components/projects/ProjectsStrip'
import Experience from '../components/story/Experience'
import Contact from '../components/story/Contact'
import RunningBand from '../components/story/RunningBand'
import { useSmoothScroll } from '../lib/useSmoothScroll'
import { useSectionTransitions } from '../motion/sectionTransitions'
import SiteHeader from '../components/story/SiteHeader'
import AboutPanel from '../components/story/AboutPanel'

/**
 * The Story route -- where the hero's My Story panel leads. Its header, then
 * 01 about (with the stack), 02 experience, 03 the ribbon, 04 contact (with the notes board).
 * (The red thread that once ran between them, StoryThread, is retired.)
 */
export default function Story() {
  useSmoothScroll()
  // the scroll transitions between sections (each one switched in motion/sectionTransitions.ts)
  useSectionTransitions()

  return (
    <main className="story">
      <StoryHero videoSrc="/story-header.mp4" />
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
