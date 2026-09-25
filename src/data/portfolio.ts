/**
 * All page content in one place. The original build hand-repeated this markup
 * six times over for the sleeves and sixteen times for the stack grid; here it
 * is data, and the components render it.
 */

// The project clips, referenced where they live (../project mockup vids, beside
// the app) rather than copied in. Vite serves them in development and bundles
// them for a build.
import inventoryClip from '../../../project mockup vids/Employeeinventorymanagementsystemvid.mp4'
import ragClip from '../../../project mockup vids/RAG AI mockup vid.mp4'
import qloraClip from '../../../project mockup vids/frontier price predict mockup vid.mp4'
import portClip from '../../../project mockup vids/pythonrust.mp4'

/** A picture or clip in a project's case-study stream. */
export type ProjectMedia = {
  kind: 'image' | 'video'
  src: string
  /** Poster for a clip; ignored for a picture. */
  poster?: string
  alt?: string
  /** Width / height, so the stream lays out before the file lands. */
  aspect?: number
}

export type Sleeve = {
  code: string
  org: string
  kicker: string
  title: string
  /** Two lines as authored, for the sleeve caption. */
  capLines: [string, string]
  body: string
  /** One to three sentences: what the detail panel says under the title. */
  summary: string
  /** One small mark for the kind of work it is. */
  emoji: string
  metrics: string[]
  tags: string[]
  repo?: string
  /** The deployed site or demo, when there is one. Never invented. */
  live?: string
  /** The case-study stream, in order. Empty until real captures are supplied;
   *  the panel then shows the title card and the numbers alone. */
  media?: ProjectMedia[]
  /** Authored lean and jitter, kept so the shelf keeps its hand-placed feel. */
  jx: number
  jr: number
  /** Sleeve artwork. Not yet supplied — placeholders stay clean until it is. */
  art?: string
  /**
   * Optional looping clip for the projects strip; `art` doubles as its poster.
   * Muted, plays only while its plate is in view.
   */
  video?: string
}

export const SLEEVES: Sleeve[] = [
  {
    code: 'A1',
    org: 'CFEES, DRDO',
    kicker: 'A1 · CFEES, DRDO · 2026',
    title: 'Employee inventory management system',
    capLines: ['Employee inventory', 'management system'],
    body:
      'Sole developer replacing a paper approval workflow that took days to weeks. A per-page AI assistant runs on a locally hosted open-source model — no external API calls, because the network is air-gapped. Multi-level authentication with role-based access and tiered authorization across departments.',
    summary:
      'An air-gapped inventory and approvals system for a defence lab, with a per-page AI assistant on a locally hosted model — no call ever leaves the network.',
    emoji: '🔒',
    metrics: ['500+ personnel', '10k+ assets', 'Zero outbound calls'],
    tags: ['Python', 'React', 'PostgreSQL / Supabase', 'Ollama', 'RBAC'],
    video: inventoryClip,
    jx: -2,
    jr: 0.5,
  },
  {
    code: 'A2',
    org: 'Independent',
    kicker: 'A2 · Independent build',
    title: 'RAG-powered knowledge worker',
    capLines: ['RAG-powered', 'knowledge worker'],
    body:
      'An end-to-end retrieval system that ingests company documents and answers domain-specific questions, cutting lookup time by roughly 60%. Vector embeddings with semantic retrieval keep every response grounded in verified source data rather than the model’s memory.',
    summary:
      'A retrieval system that ingests company documents and answers questions from them, with every response grounded in a cited source.',
    emoji: '🔎',
    metrics: ['−60% lookup time', 'Cited answers', 'Local + API'],
    tags: ['LangChain', 'FAISS', 'ChromaDB', 'OpenAI API'],
    repo: 'https://github.com/Yugjohri',
    video: ragClip,
    jx: 3,
    jr: -0.6,
  },
  {
    code: 'B1',
    org: 'Independent',
    kicker: 'B1 · Independent build',
    title: 'Fine-tuned LLM on one GPU',
    capLines: ['Fine-tuned LLM', 'on one GPU'],
    body:
      'A QLoRA fine-tune that predicts product prices from free text, reaching accuracy competitive with GPT-4 on the task. 4-bit quantization through PEFT/LoRA cut GPU memory by about 70% — the whole training run fits on consumer hardware.',
    summary:
      'A QLoRA fine-tune that prices products from free text, trained in 4-bit on a single consumer GPU and competitive with GPT-4 on the task.',
    emoji: '🧠',
    metrics: ['−70% GPU memory', '4-bit quantized', 'GPT-4 accuracy peer'],
    tags: ['PyTorch', 'QLoRA', 'Hugging Face', 'PEFT'],
    repo: 'https://github.com/Yugjohri',
    video: qloraClip,
    jx: -1,
    jr: 0.4,
  },
  {
    code: 'B2',
    org: 'Independent',
    kicker: 'B2 · Independent build',
    title: 'Autonomous multi-agent bargain spotter',
    capLines: ['Multi-agent', 'bargain spotter'],
    body:
      'Specialized agents scan listings, read pricing trends and notify users when something is worth buying. Structured tool-use and inter-agent memory keep the coordination reliable instead of chatty.',
    summary:
      'Specialised agents that scan listings, read pricing trends and say when something is worth buying — coordinated through structured tool use and shared memory.',
    emoji: '🤖',
    metrics: ['Agent-to-agent memory', 'Structured tool use'],
    tags: ['Multi-agent', 'Python', 'Tool calling'],
    repo: 'https://github.com/Yugjohri',
    jx: 2,
    jr: -0.5,
  },
  {
    code: 'B4',
    org: 'Delite Kom',
    kicker: 'B4 · Delite Kom Ltd · 2025',
    title: 'Predictive models in production reporting',
    capLines: ['Predictive models', 'in production'],
    body:
      'Churn, customer segmentation and demand forecasting wired into incremental ETL and dashboards used daily by Sales, Ops and Finance. Ad-hoc validation scripts became a reusable data-integrity framework.',
    summary:
      'Churn, segmentation and demand models wired into incremental ETL and the dashboards Sales, Ops and Finance read every day.',
    emoji: '📊',
    metrics: ['3 models shipped', 'Daily use', 'Reusable QA framework'],
    tags: ['Pandas', 'SQL', 'Power BI', 'Power Query'],
    jx: 1,
    jr: -0.4,
  },
  {
    code: 'C1',
    org: 'Independent',
    kicker: 'C1 · Independent build',
    title: 'Python → Rust & C++, measured and verified',
    capLines: ['Python → Rust & C++', 'measured and verified'],
    body:
      'An LLM ports a Python program to Rust or C++. Both versions are compiled and executed in a sandbox on the same machine, so the speedup is measured rather than estimated — and the outputs are compared, because a fast translation that changes the answer is a broken one.',
    summary:
      'An LLM translates Python to Rust or C++; both are compiled and run in a sandbox, so the speedup is measured and the answers are checked.',
    emoji: '⚙️',
    metrics: ['Measured speedup', 'Output-checked', 'GPT-OSS 120B'],
    tags: ['LLM translation', 'Rust', 'C++', 'Sandboxed execution'],
    repo: 'https://github.com/Yugjohri',
    video: portClip,
    jx: -2,
    jr: 0.5,
  },
]

/** A technology on the Stack's ring: its name, a short mark, what it is for. */
export type Tech = {
  name: string
  /** Two or three characters, set small in the card's corner. */
  mark: string
  category: string
  /** Its logo in techLogos.ts, where a reliable one exists; without one the card keeps its type. */
  logo?: string
}

/** Only what the work above actually used. Order is the order round the ring. */
export const TECH: Tech[] = [
  { name: 'Python', mark: 'PY', category: 'Language', logo: 'python' },
  { name: 'C++', mark: 'C+', category: 'Language', logo: 'cplusplus' },
  { name: 'Java', mark: 'JV', category: 'Language', logo: 'java' },
  { name: 'PyTorch', mark: 'PT', category: 'Deep learning', logo: 'pytorch' },
  { name: 'React', mark: 'RE', category: 'Interface', logo: 'react' },
  { name: 'OpenAI API', mark: 'OA', category: 'Models', logo: 'openai' },
  { name: 'LangChain', mark: 'LC', category: 'Retrieval', logo: 'langchain' },
  { name: 'PostgreSQL', mark: 'PG', category: 'Database', logo: 'postgresql' },
  { name: 'Hugging Face', mark: 'HF', category: 'Models', logo: 'huggingface' },
  { name: 'TypeScript', mark: 'TS', category: 'Language', logo: 'typescript' },
  { name: 'JavaScript', mark: 'JS', category: 'Language', logo: 'javascript' },
  { name: 'Supabase', mark: 'SB', category: 'Backend', logo: 'supabase' },
  { name: 'Node.js', mark: 'NO', category: 'Runtime', logo: 'nodedotjs' },
  { name: 'Ollama', mark: 'OL', category: 'Local models', logo: 'ollama' },
  { name: 'Docker', mark: 'DK', category: 'Deployment', logo: 'docker' },
  { name: 'Git', mark: 'GT', category: 'Version control', logo: 'git' },
  { name: 'Pandas', mark: 'PD', category: 'Data', logo: 'pandas' },
  { name: 'NumPy', mark: 'NP', category: 'Data', logo: 'numpy' },
  { name: 'GSAP', mark: 'GS', category: 'Motion', logo: 'gsap' },
  { name: 'Unreal Engine', mark: 'UE', category: 'Real-time 3D', logo: 'unrealengine' },
]

export type Role = {
  tag: string
  period: string
  org: string
  title: string
  bullets: string[]
  stack: string
  current?: boolean
}

export const ROLES: Role[] = [
  {
    tag: 'Now',
    period: 'Jun 2026 —',
    org: 'CFEES, DRDO',
    title: 'AI & Full-Stack Engineer Intern · Delhi',
    bullets: [
      'Sole developer on an inventory system for an air-gapped intranet.',
      'Offline AI assistant on a locally hosted model, as a per-page widget.',
      'RBAC with tiered authorization across departments.',
    ],
    stack: 'Python · React · Supabase · Ollama',
    current: true,
  },
  {
    tag: 'Data',
    period: 'Aug 2025 — Jan 2026',
    org: 'Delite Kom Ltd',
    title: 'Data Analyst Intern · New Delhi',
    bullets: [
      'Churn, segmentation and demand models wired into reporting.',
      'Incremental ETL with staging layers and slowly changing dimensions.',
      'Validation scripts generalized into a reusable integrity framework.',
    ],
    stack: 'Pandas · SQL · Power BI · Power Query',
  },
  {
    tag: 'Models',
    period: 'Feb 2024 — Mar 2025',
    org: 'Outlier AI',
    title: 'AI Model Contributor · Remote',
    bullets: [
      '200+ data samples and 500+ output evaluations a month.',
      '~18% accuracy gains across iterative fine-tuning cycles.',
      'Rating quality in the top 10% of contributors.',
    ],
    stack: 'GPT evaluation · Prompt engineering',
  },
]

/** `col` drives the grid-zoom stagger; `hot` paints the tile in the accent. */
export const STACK: { name: string; col: 0 | 1 | 2 | 3; hot?: boolean }[] = [
  { name: 'RAG', col: 0, hot: true },
  { name: 'LangChain', col: 1 },
  { name: 'Multi-agent systems', col: 2 },
  { name: 'PyTorch', col: 3, hot: true },
  { name: 'QLoRA', col: 0, hot: true },
  { name: 'FAISS', col: 1 },
  { name: 'Ollama', col: 3 },
  { name: 'Hugging Face', col: 2 },
  { name: 'OpenAI API', col: 1 },
  { name: 'Python', col: 2, hot: true },
  { name: 'React', col: 3 },
  { name: 'PostgreSQL', col: 0 },
  { name: 'Supabase', col: 1 },
  { name: 'Docker', col: 2 },
  { name: 'Pandas', col: 1 },
  { name: 'SQL', col: 3 },
]

export const RECEIPTS: {
  value: number
  prefix?: string
  suffix?: string
  label: string
  hot?: boolean
}[] = [
  { value: 500, suffix: '+', label: 'Personnel served' },
  { value: 60, suffix: '%', label: 'Faster document lookup', hot: true },
  { value: 70, prefix: '−', suffix: '%', label: 'GPU memory, fine-tuning' },
]

export const NOTES: { n: string; text: string; color: string; rotate: number }[] = [
  {
    n: '01',
    text:
      'Benchmarking local models and self-hosted Postgres against the interim Supabase + Ollama stack at CFEES.',
    color: '#F3DE8A',
    rotate: -3.2,
  },
  {
    n: '02',
    text:
      'Agreeing one shared database schema with the parallel teams — cross-linked modules, a single source of truth.',
    color: '#CFE3D4',
    rotate: 2.4,
  },
  {
    n: '03',
    text: 'Eval harnesses for retrieval quality, so a model change is measurable instead of vibes.',
    color: '#F1CFC7',
    rotate: -1.8,
  },
  {
    n: '04',
    text: 'Reading about small-model distillation. The offline constraint keeps getting more interesting.',
    color: '#CBD9EC',
    rotate: 3,
  },
]

export const NAV = [
  { label: 'Work', href: '#shelf' },
  { label: 'Roles', href: '#roles' },
  { label: 'Stack', href: '#stack' },
  { label: 'About', href: '#about' },
  { label: 'Available', href: 'mailto:yugjohri8@gmail.com', hot: true },
]

export const TICKER = [
  'RAG',
  'LangChain',
  'Multi-agent systems',
  'QLoRA',
  'PyTorch',
  'Ollama',
  'FAISS',
  'Supabase',
  'React',
  'ETL',
]

export const EMAIL = 'yugjohri8@gmail.com'
