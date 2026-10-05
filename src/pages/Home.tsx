import { useEffect } from 'react'
import SplitHero from '../components/hero/SplitHero'
import { markBoot } from '../boot/boot'

/**
 * The active page: the split hero. Each panel is a route of its own --
 * Brief Read at /brief, My Story at /story -- so nothing renders below it.
 *
 * The previous full page is preserved untouched at pages/Portfolio.tsx, with
 * all of its sections, data and motion still in the project. See LEGACY.md for
 * what is there and how to bring any of it back.
 */
export default function Home() {
  useEffect(() => markBoot('route'), [])
  return (
    <div className="site">
      <SplitHero />
    </div>
  )
}
