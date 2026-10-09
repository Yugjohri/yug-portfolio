import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'

/** The headers every response gets in production (vercel.json's catch-all
 *  rule), so `npm run preview` is tested under the same CSP. */
function productionHeaders(): Record<string, string> {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'vercel.json'), 'utf8')) as {
    headers?: { source: string; headers: { key: string; value: string }[] }[]
  }
  const all = config.headers?.find((h) => h.source === '/(.*)')
  return Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]))
}

/** On Vercel, /_vercel/insights and /_vercel/speed-insights serve the
 *  analytics scripts, from Vercel itself. `npm run preview` has no such files,
 *  so it answers with an empty script instead of a 404 in the console. */
const vercelInsightsStub = (): Plugin => ({
  name: 'vercel-insights-stub',
  configurePreviewServer(server) {
    server.middlewares.use('/_vercel', (_req, res) => {
      res.setHeader('Content-Type', 'text/javascript')
      res.end('')
    })
  },
})

/** Each route's own copy of index.html (vercel.json sends each its own):
 *  - the landing's (index.html itself) asks at once for the landing's code,
 *    a chunk of its own so the other pages do not carry it (routes.ts);
 *  - the Story's (story.html) asks at once for what its first screen needs,
 *    instead of waiting for the code to ask: the header's still (its largest
 *    picture) and the type its headline is set in. (Preloading the page's
 *    code and styles as well was tried: they competed with the first paint,
 *    which came later.) Keep the poster pair in step with POSTER in
 *    StoryHero.tsx;
 *  - the Brief's (brief.html) is the plain page. */
const routeHtml = (): Plugin => ({
  name: 'route-html',
  apply: 'build',
  writeBundle(options, bundle) {
    const dir = options.dir ?? path.resolve(__dirname, 'dist')
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
    if (!html.includes('</head>')) throw new Error('route-html: index.html has no </head>')
    const withHead = (lines: string[]) => html.replace('</head>', `    ${lines.join('\n    ')}\n  </head>`)

    const fonts = ['instrument-serif-italic-latin-v5', 'instrument-serif-latin-v5', 'anton-latin-v27']
    for (const f of fonts) {
      if (!fs.existsSync(path.resolve(__dirname, 'public/fonts', `${f}.woff2`))) throw new Error(`route-html: no font ${f}`)
    }
    fs.writeFileSync(
      path.join(dir, 'story.html'),
      withHead([
        '<link rel="preload" as="image" href="/story-header-poster.webp" imagesrcset="/story-header-poster-760.webp 760w, /story-header-poster.webp 1280w" imagesizes="(max-width: 899px) 90vw, 60vw" fetchpriority="high" />',
        ...fonts.map((f) => `<link rel="preload" href="/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin />`),
      ]),
    )
    fs.writeFileSync(path.join(dir, 'brief.html'), html)

    const entry = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry)
    const home = Object.values(bundle).find(
      (c) => c.type === 'chunk' && !!c.facadeModuleId && /[\\/]pages[\\/]Home\.tsx$/.test(c.facadeModuleId),
    )
    if (!home || home.type !== 'chunk') throw new Error('route-html: no Home chunk in the build')
    const js = [home.fileName, ...home.imports.filter((f) => f !== entry?.fileName)]
    fs.writeFileSync(path.join(dir, 'index.html'), withHead(js.map((f) => `<link rel="modulepreload" crossorigin href="/${f}" />`)))
  },
})

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    // The notes board needs its Supabase project in production: without it the
    // board would quietly keep notes in each visitor's own browser. So a
    // production build without the keys stops here. (NOTES_LOCAL_PREVIEW=1
    // lets a build for local testing through, with the local-only board.)
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    if (!(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) && process.env.NOTES_LOCAL_PREVIEW !== '1') {
      throw new Error(
        'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for a production build (see .env.example). ' +
          'For a local test build only, set NOTES_LOCAL_PREVIEW=1.',
      )
    }
  }
  return {
    plugins: [react(), vercelInsightsStub(), routeHtml()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    preview: {
      headers: productionHeaders(),
    },
  }
})
