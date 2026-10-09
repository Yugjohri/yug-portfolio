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

/** The Story's own copy of index.html, served for /story (vercel.json): the
 *  same page, plus a head that asks at once for what the Story's first screen
 *  needs, instead of waiting for the code to ask -- the header's still (its
 *  largest picture) and the type its headline is set in. (Preloading the
 *  page's code and styles as well was tried: they competed with the first
 *  paint, which came later.) Keep the poster pair in step with POSTER in
 *  StoryHero.tsx. */
const storyHtml = (): Plugin => ({
  name: 'story-html',
  apply: 'build',
  writeBundle(options) {
    const dir = options.dir ?? path.resolve(__dirname, 'dist')
    const head = [
      '<link rel="preload" as="image" href="/story-header-poster.webp" imagesrcset="/story-header-poster-760.webp 760w, /story-header-poster.webp 1280w" imagesizes="(max-width: 899px) 90vw, 60vw" fetchpriority="high" />',
      ...['instrument-serif-italic-latin-v5', 'instrument-serif-latin-v5', 'anton-latin-v27'].map(
        (f) => `<link rel="preload" href="/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin />`,
      ),
    ]
    for (const f of ['instrument-serif-italic-latin-v5', 'instrument-serif-latin-v5', 'anton-latin-v27']) {
      if (!fs.existsSync(path.resolve(__dirname, 'public/fonts', `${f}.woff2`))) throw new Error(`story-html: no font ${f}`)
    }
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
    if (!html.includes('</head>')) throw new Error('story-html: index.html has no </head>')
    fs.writeFileSync(path.join(dir, 'story.html'), html.replace('</head>', `    ${head.join('\n    ')}\n  </head>`))
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
    plugins: [react(), vercelInsightsStub(), storyHtml()],
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
