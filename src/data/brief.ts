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
  // who, plainly, then the broad strokes; the depth is in My Story
  leadIn:
    "i'm an ai engineer who fine-tunes models, builds retrieval and agent systems, and ships the data pipelines and apps around them.",
  intro:
    "since 2024 i've worked across most of an ai product: writing and grading training data, training open models that compete with paid ones, building search that cites its sources, and turning messy data into dashboards teams use every day. along the way i've led teams at university, from hackathons to a game studio.",
}

/** what i do, one card each */
export const PILLARS: { label: string; text: string }[] = [
  { label: 'AI & ML', text: 'fine-tuning, RAG and agents, each tested against a fixed benchmark' },
  { label: 'Data', text: 'ETL pipelines, predictive models and Power BI dashboards' },
  { label: 'Full-stack', text: 'React, Express and PostgreSQL apps with role-based access' },
]

export const HIGHLIGHTS: { label: string; value: string }[] = [
  { label: 'Award', value: '2nd place, SEAS Ideathon 3.0' },
  { label: 'Education', value: 'B.Tech CSE, Bennett University · 8.0 CGPA' },
  { label: 'Languages', value: 'English, Hindi, learning ASL' },
]

// the Brief's about: the teams led at university, and a little off the screen
export const ABOUT_HEADING = 'beyond the code: teams and events.'

export const ABOUT_PARAS: string[] = [
  "as technical head of Bennett's ACM student club, i led a team of 8, ran 4 hackathons and workshops, managed Infuturum 2.0 with 8+ events running at once, and rebuilt the club's website end to end.",
  'at Solace Studios i was head of development, leading a team of 5 to ship 2 games in Unreal Engine. at the International Affairs Society i ran communications and the experience for international delegates.',
  'off the screen: MMA, badminton, drums, calisthenics and reading.',
]

/** the Brief's projects, in a line */
export const PROJECTS_LEDE =
  "what i've built, from fine-tuned models to tools that check their own answers. the long version of each is in My Story."

/** the Brief's own, shorter bullets for a role (its full ones are in My Story) */
export const BRIEF_ROLE_BULLETS: Record<string, string[]> = {
  'CFEES, DRDO': [
    'Sole developer of an inventory and approval system for 500+ staff and 10,000+ assets, replacing a paper process.',
    'Row-level security across 3 roles, tested against cross-group reads, replays and forged sessions.',
  ],
}

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
 * site and the resume -- About's own lines, the Brief's old intro and about
 * paragraphs, and the university roles -- nothing new is claimed.
 */
export const ABOUT_PANEL = {
  eyebrow: 'About',
  heading: ['Making the complex simple', 'and the simple meaningful'],
  paras: [
    "hi, i'm Yug Johri. i design, and i write code. i am not easily impressed, and that includes my own work: most of what i do is checking, and the building tends to be the quick part. the interesting part is usually the part that does not show.",
    'i learned this backwards. i read bad answers for a year before i tried to write good ones. strange education. i recommend it. since then i have not trusted much that i cannot check. it reads as caution. it is mostly curiosity: i want to know why the thing worked, not just that it did.',
    'at university i led tech at the ACM student club, development at Solace Studios, and multimedia at the International Affairs Society. away from the screen: badminton, martial arts, drums, sign language. i keep choosing things that only give way to repetition. bring me something that has to hold up.',
  ],
  // a short closing note under the paragraphs (the stack beside them is sized to the paragraphs alone)
  coda: 'how i work: write it down, build the smallest version that could be wrong, test it on the real thing, then make it nice.',
}
