/**
 * Each route's title and description, set on the document as the route
 * changes. The landing's are also the static ones in index.html (which link
 * previews read, as they don't run JS); the canonical follows the route, so
 * /story and /brief are not taken for copies of the landing.
 */
const SITE = 'https://yugjohri.me'

const META: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Yug Johri — AI Engineer',
    description: "Yug Johri — AI engineer. Retrieval, agents and fine-tuned models that hold up where the internet doesn't reach.",
  },
  '/story': {
    title: 'My Story | Yug Johri, AI Engineer',
    description:
      'The long version: how Yug Johri thinks and builds. Projects in retrieval, agents and fine-tuned models, the work at CFEES, DRDO, and a board to leave a note on.',
  },
  '/brief': {
    title: 'Brief Read | Yug Johri, AI Engineer',
    description:
      "The short version, on one page: Yug Johri's projects, experience and stack as an AI engineer working on retrieval, agents and fine-tuned models.",
  },
}

function tag<T extends HTMLElement>(selector: string, make: () => T): T {
  return document.head.querySelector<T>(selector) ?? document.head.appendChild(make())
}

export function applyRouteMeta(pathname: string) {
  const key = pathname.startsWith('/story') ? '/story' : pathname.startsWith('/brief') ? '/brief' : '/'
  const meta = META[key]
  document.title = meta.title
  tag('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' })).content = meta.description
  tag('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' })).href = SITE + key
}
