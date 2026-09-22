/**
 * The site's themes, by route. 'dark' is the original -- the landing page
 * and the Brief keep it; 'noir' (black first, red second) is the Story's;
 * 'light' is the white-and-red pass, kept for reference. The stylesheets
 * read the theme from <html data-theme> (absent for 'dark', whose tokens are
 * the base ones); the WebGL surfaces read it from here by the route they
 * are on.
 */
export type Theme = 'light' | 'dark' | 'noir'

/** Which theme a route wears. */
export function themeFor(pathname: string): Theme {
  return pathname.startsWith('/story') ? 'noir' : 'dark'
}

/** The theme of the page being shown. */
export const currentTheme = (): Theme =>
  typeof window === 'undefined' ? 'dark' : themeFor(window.location.pathname)

/** Kept for the Story's surfaces, which were built against it. */
export const THEME = 'noir' as Theme

export const isLight = () => currentTheme() === 'light'

/**
 * How a surface that draws its own pixels interprets its picture:
 * lit as on a screen, printed as ink on paper, or graded toward ember --
 * deep blacks, crimson mids, warm highlights. Read for the page it is on.
 */
export type Grade = 'lit' | 'paper' | 'ember'
export const GRADE_ID: Record<Grade, number> = { lit: 0, paper: 1, ember: 2 }
export const grade = (): Grade => {
  const t = currentTheme()
  return t === 'light' ? 'paper' : t === 'noir' ? 'ember' : 'lit'
}

/** The colours those surfaces are built on. Mirror of the tokens in the
 *  theme stylesheets. */
export const PAPER = { r: 1, g: 1, b: 1 }
export const INK = THEME === 'noir'
  ? { r: 0.784, g: 0.063, b: 0.18 } // #c8102e
  : { r: 0.878, g: 0.07, b: 0.184 } // #e0122f
export const INK_DEEP = THEME === 'noir'
  ? { r: 0.353, g: 0.035, b: 0.07 } // #5a0912
  : { r: 0.478, g: 0.039, b: 0.102 } // #7a0a1a

/** Dress <html> for a route: the base tokens for 'dark', an attribute for the rest. */
export function applyTheme(pathname: string = window.location.pathname) {
  const t = themeFor(pathname)
  if (t === 'dark') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}
