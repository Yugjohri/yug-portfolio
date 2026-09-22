import { useLayoutEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import BriefRead from './pages/BriefRead'
import Story from './pages/Story'
import MusicPlayer from './components/MusicPlayer'
import { applyTheme } from './theme'

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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/brief" element={<BriefRead />} />
        <Route path="/story" element={<Story />} />
      </Routes>
      {/* on every route, in the corner; tracks in data/music.ts */}
      <MusicPlayer />
    </>
  )
}
