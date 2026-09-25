/**
 * Copy for the Brief Read page — the recruiter-facing quick scan.
 *
 * Roles, projects and receipts are reused from data/portfolio.ts rather than
 * duplicated; only the copy unique to this page lives here.
 */

export const BRIEF = {
  eyebrow: ['AI', 'RETRIEVAL', 'LLM EVALS'],
  name: 'Yug Johri',
  role: 'AI Engineer',
  location: 'Delhi, India',
  leadIn: 'i am not easily impressed.',
  intro:
    'that includes my own work. most of what i do is checking — the building tends to be the quick part.',
}

export const PILLARS: { label: string; text: string }[] = [
  { label: 'Retrieval', text: 'say where you got that' },
  { label: 'Constraint', text: 'limits make better arguments' },
  { label: 'Evals', text: 'i would rather measure than argue' },
]

export const HIGHLIGHTS: { label: string; value: string }[] = [
  { label: 'Award', value: '2nd place, SEAS Ideathon 3.0' },
  { label: 'Education', value: 'B.Tech CSE, Bennett University · 8.0 CGPA' },
  { label: 'Scale', value: '500+ personnel served · 10k+ assets tracked' },
]

export const ABOUT_HEADING =
  'the interesting part is usually the part that does not show.'

export const ABOUT_PARAS: string[] = [
  'i learned this backwards. i read bad answers for a year before i tried to write good ones. strange education. i recommend it.',
  'since then i have not trusted much that i cannot check. it reads as caution. it is mostly curiosity — i want to know why the thing worked, not just that it did.',
  'badminton, martial arts, drums, sign language. i keep choosing things that only give way to repetition. it is a pattern i have stopped arguing with.',
]

export const ABOUT_CLOSER = 'bring me something that has to hold up.'

export const LINKS = {
  email: 'yugjohri8@gmail.com',
  github: 'https://github.com/Yugjohri',
  linkedin: 'https://www.linkedin.com/',
  site: 'https://yugjohri.me/',
  phone: '+91 99582 71560',
}

export const SKILLS: { group: string; items: string[] }[] = [
  { group: 'AI', items: ['RAG', 'LangChain', 'Multi-agent systems', 'QLoRA', 'PyTorch', 'Hugging Face'] },
  { group: 'Serving', items: ['Ollama', 'FAISS', 'ChromaDB', 'OpenAI API', 'PEFT'] },
  { group: 'Platform', items: ['Python', 'React', 'PostgreSQL', 'Supabase', 'Docker'] },
  { group: 'Data', items: ['Pandas', 'SQL', 'Power BI', 'Power Query', 'ETL'] },
]
