import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      // the project clips are imported from ../project mockup vids, beside the app
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, '..', 'project mockup vids'),
        path.resolve(__dirname, '..', 'my brief backgrounds'),
      ],
    },
  },
})
