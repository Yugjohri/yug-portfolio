/**
 * The two routes behind the landing, each its own chunk: the landing no
 * longer downloads the Story's WebGL ribbon and screen or the Brief before
 * anyone asks for them. The landing fetches one as soon as its door is
 * hovered or focused, so a route transition never waits on a download.
 */
export const loadBrief = () => import('./pages/BriefRead')
export const loadStory = () => import('./pages/Story')
