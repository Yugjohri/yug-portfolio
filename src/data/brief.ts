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
  leadIn: 'AI engineer who builds for the worst case.',
  intro:
    'Retrieval, agents and fine-tuned models that hold up where the internet does not reach. I treat a model like a capable but unreliable coworker — useful the moment its output is checkable, dangerous the moment it is not.',
}

export const PILLARS: { label: string; text: string }[] = [
  { label: 'Retrieval', text: 'Answers grounded in cited sources' },
  { label: 'Constraint', text: 'Air-gapped, one GPU, no excuses' },
  { label: 'Evals', text: 'Measuring what actually matters' },
]

export const HIGHLIGHTS: { label: string; value: string }[] = [
  { label: 'Award', value: '2nd place, SEAS Ideathon 3.0' },
  { label: 'Education', value: 'B.Tech CSE, Bennett University · 8.0 CGPA' },
  { label: 'Scale', value: '500+ personnel served · 10k+ assets tracked' },
]

export const ABOUT_HEADING =
  'I like building systems that keep working when the network, the budget and the model all refuse to cooperate.'

export const ABOUT_PARAS: string[] = [
  'Two and a half years of building on one assumption: a model is only useful once its output is checkable. That has taken me through a defence research lab, an analytics firm, and a year inside model-evaluation loops at Outlier AI.',
  'At Outlier I rated roughly 500 outputs a month and learned what a bad answer actually looks like before I ever tried to prevent one. At CFEES I am the sole developer on a system for 500+ personnel that cannot call the internet — retrieval before generation, evaluation before deployment.',
  'Constraint is a design input, not an excuse. An air-gapped intranet, one consumer GPU, and a team that cannot tolerate a hallucinated asset record produce better architecture than an unlimited budget does.',
  'Outside the terminal: badminton at district level, martial arts, drums, and learning ASL — repetition until the hard thing looks easy.',
]

export const ABOUT_CLOSER = 'Bring me something that has to hold up.'

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
