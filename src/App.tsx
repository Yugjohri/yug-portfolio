import { Suspense, lazy, useLayoutEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import { loadBrief, loadStory } from './routes'
import MusicPlayer from './components/MusicPlayer'
import RouteTransition from './motion/RouteTransition.tsx'
import { applyTheme } from './theme'

const BriefRead = lazy(loadBrief)
const Story = lazy(loadStory)

/** Each route wears its own theme: the Story is black-and-red, the rest the original dark. */
function ThemeByRoute() {
  const { pathname } = useLocation()
  useLayoutEffect(() => applyTheme(pathname), [pathname])
  return null
}

/**
 * Active route tree.
 *
 * To bring the old portfolio back, swap Home for Portfolio here and re-enable
 * the portfolio.css import in styles/index.css. Nothing else needs changing.
 */
export default function App() {
  return (
    <>
      <ThemeByRoute />
      {/* while a route's chunk arrives: only its ground, so a transition's overlay hands off over the same colour */}
      <Suspense fallback={<div className="route-wait" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/brief" element={<BriefRead />} />
          <Route path="/story" element={<Story />} />
        </Routes>
      </Suspense>
      {/* the layer route transitions play in: over every page, under the player */}
      <RouteTransition />
      {/* on every route, in the corner; tracks in data/music.ts */}
      <MusicPlayer />
    </>
  )
}
