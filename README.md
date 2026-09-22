# my-portfolio

React + TypeScript + Vite portfolio site.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build locally
```

## Structure

```
public/              static assets served as-is (favicon)
src/
  assets/            images + icons imported by components
  components/        Layout, Navbar, Footer, ProjectCard
  pages/             Home, About, Projects, Contact
  styles/index.css   tokens, reset, global styles
  App.tsx            routes
  main.tsx           entry point
```

Import from `src` with the `@` alias, e.g. `import hero from '@/assets/images/hero.jpg'`.
