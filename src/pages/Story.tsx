import StoryHero from '../components/story/StoryHero'
import ProjectsStrip from '../components/projects/ProjectsStrip'
import About from '../components/story/About'
import TechStack from '../components/story/TechStack'
import { useSmoothScroll } from '../lib/useSmoothScroll'

/**
 * The Story route -- where the hero's My Story panel leads. Its header, then
 * about, the ribbon, and the stack.
 *
 * Proof (components/story/Proof.tsx, with its rules in story.css) is built
 * and kept, but not on the page for now. To bring it back, import it and
 * place it where it belongs in the order above.
 */
export default function Story() {
  useSmoothScroll()

  return (
    <main className="story">
      <StoryHero videoSrc="/story-header.mp4" />
      <About />
      <ProjectsStrip />
      <TechStack />
    </main>
  )
}
