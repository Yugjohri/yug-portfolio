/**
 * Copy for the Brief Read page — the recruiter-facing quick scan.
 *
 * Roles, projects and receipts are reused from data/portfolio.ts rather than
 * duplicated; only the copy unique to this page lives here.
 */

export const BRIEF = {
  // the Story's own running band
  eyebrow: ['AI ENGINEERING', 'RAG', 'FULL-STACK'],
  name: 'Yug Johri',
  role: 'AI Engineer',
  location: 'Delhi, India',
  leadIn: 'i am not easily impressed.',
  intro:
    'that includes my own work: most of what i do is checking, and the building tends to be the quick part.',
}

export const PILLARS: { label: string; text: string }[] = [
  { label: 'Sources', text: 'say where you got that' },
  { label: 'Limits', text: 'a small budget forces a better idea' },
  { label: 'Proof', text: "i'd rather measure than argue" },
]

export const HIGHLIGHTS: { label: string; value: string }[] = [
  { label: 'Award', value: '2nd place, SEAS Ideathon 3.0' },
  { label: 'Education', value: 'B.Tech CSE, Bennett University · 8.0 CGPA' },
  { label: 'Built for', value: '500+ staff and 10,000+ assets at CFEES, DRDO' },
]

export const ABOUT_HEADING =
  'the interesting part is usually the part that does not show.'

export const ABOUT_PARAS: string[] = [
  'i learned this backwards. i read bad answers for a year before i tried to write good ones. strange education. i recommend it.',
  'since then i have not trusted much that i cannot check. it reads as caution. it is mostly curiosity: i want to know why the thing worked, not just that it did.',
  'badminton, martial arts, drums, sign language. i keep choosing things that only give way to repetition. it is a pattern i have stopped arguing with.',
]

export const ABOUT_CLOSER = 'bring me something that has to hold up.'

export const LINKS = {
  email: 'yugjohri8@gmail.com',
  github: 'https://github.com/Yugjohri',
  linkedin: 'https://www.linkedin.com/in/yug-johri-3a4373259/',
  site: 'https://yugjohri.me/',
  phone: '+91 99582 71560',
  /** the resume, served from public/ */
  resume: '/yug-johri-resume.pdf',
}

export const SKILLS: { group: string; items: string[] }[] = [
  { group: 'AI', items: ['RAG', 'LangChain', 'Multi-agent systems', 'QLoRA', 'PyTorch', 'Hugging Face'] },
  { group: 'Models & search', items: ['Ollama', 'FAISS', 'ChromaDB', 'OpenAI API', 'PEFT'] },
  { group: 'Apps & backend', items: ['Python', 'React', 'PostgreSQL', 'Supabase', 'Docker'] },
  { group: 'Data', items: ['Pandas', 'SQL', 'Power BI', 'Power Query', 'ETL'] },
]

/**
 * The About panel (Story): a two-line heading and three paragraphs, at the
 * length of the reference layout. Assembled only from copy already on the
 * site -- About's own lines, the Brief's intro and about paragraphs, and the
 * DRDO role from the Experience data -- nothing new is claimed.
 */
export const ABOUT_PANEL = {
  eyebrow: 'About',
  heading: ['Making the complex simple', 'and the simple meaningful'],
  paras: [
    "hi, i'm Yug Johri. i design, and i write code. i am not easily impressed, and that includes my own work: most of what i do is checking, and the building tends to be the quick part. the interesting part is usually the part that does not show.",
    'i learned this backwards. i read bad answers for a year before i tried to write good ones. strange education. i recommend it. since then i have not trusted much that i cannot check. it reads as caution. it is mostly curiosity: i want to know why the thing worked, not just that it did.',
    'most recently i was the sole developer of an inventory and approval system for 500+ staff and 10,000+ assets at CFEES, DRDO. away from the screen: badminton, martial arts, drums, sign language. i keep choosing things that only give way to repetition. bring me something that has to hold up.',
  ],
  // a short closing note under the paragraphs (the stack beside them is sized to the paragraphs alone)
  coda: 'how i work: write it down, build the smallest version that could be wrong, test it on the real thing, then make it nice.',
}
