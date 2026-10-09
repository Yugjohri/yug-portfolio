import { preloadable } from './lib/preloadable'

/**
 * The two routes behind the landing, each its own chunk: the landing no
 * longer downloads the Story's WebGL ribbon and screen or the Brief before
 * anyone asks for them. The landing fetches one as soon as its door is
 * hovered or focused, so a route transition never waits on a download.
 */
export const loadBrief = () => import('./pages/BriefRead')
export const loadStory = () => import('./pages/Story')

/**
 * The landing too is its own chunk, so the Story and the Brief no longer
 * carry its black hole's code. Opened at /, index.html already asks for the
 * chunk (vite.config.ts) and main.tsx starts it before the first render;
 * elsewhere it is fetched once the page is idle, so going back to it draws
 * it at once, as before.
 */
export const home = preloadable(() => import('./pages/Home'))
