import StoryHero from '../components/story/StoryHero'
import ProjectsStrip from '../components/projects/ProjectsStrip'
import About from '../components/story/About'
import TechStack from '../components/story/TechStack'
import Experience from '../components/story/Experience'
import Proof from '../components/story/Proof'
import Contact from '../components/story/Contact'
import { useSmoothScroll } from '../lib/useSmoothScroll'
import StoryThread from '../motion/StoryThread'
import StoryNav, { StoryStatus } from '../components/story/StoryNav'

/**
 * The Story route -- where the hero's My Story panel leads. Its header, then
 * 01 about, 02 experience, 03 the ribbon, 04 proof, 05 the stack, 06 contact.
 * One red thread runs through all of them (StoryThread).
 */
export default function Story() {
  useSmoothScroll()

  return (
    <main className="story">
      <StoryHero videoSrc="/story-header.mp4" />
      <About />
      <Experience />
      <ProjectsStrip />
      <Proof />
      <TechStack />
      <Contact />
      <StoryNav />
      <StoryStatus />
      {/* last, so its triggers are made after the pins they measure through */}
      <StoryThread />
    </main>
  )
}
