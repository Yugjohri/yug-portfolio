import { defineConfig, loadEnv } from 'vite'
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
    plugins: [react()],
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
