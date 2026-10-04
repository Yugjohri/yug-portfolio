import StoryHero from '../components/story/StoryHero'
import ProjectsStrip from '../components/projects/ProjectsStrip'
import Experience from '../components/story/Experience'
import Contact from '../components/story/Contact'
import NotesBoard from '../components/story/NotesBoard'
import { useSmoothScroll } from '../lib/useSmoothScroll'
import SiteHeader from '../components/story/SiteHeader'
import AboutPanel from '../components/story/AboutPanel'

/**
 * The Story route -- where the hero's My Story panel leads. Its header, then
 * 01 about (with the stack), 02 experience, 03 the ribbon, the notes wall, 04 contact.
 * (The red thread that once ran between them, StoryThread, is retired.)
 */
export default function Story() {
  useSmoothScroll()

  return (
    <main className="story">
      <StoryHero videoSrc="/story-header.mp4" />
      {/* About: carried in by the header's walls, then the real section takes over in place */}
      <AboutPanel variant="section" />
      <Experience />
      <ProjectsStrip />
      <NotesBoard />
      <Contact />
      <SiteHeader />
    </main>
  )
}
