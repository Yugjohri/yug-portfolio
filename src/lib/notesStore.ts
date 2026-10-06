/**
 * Where the notes board's notes live (NotesBoard.tsx).
 *
 * With VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set, notes are read from
 * the project's `notes` table and added through its `add_note` function
 * (supabase/migrations/..._notes_board.sql), which keeps it to one note per
 * person. Plain fetch against Supabase's REST API -- no client library.
 *
 * Without them the board runs as a local preview -- notes kept in this browser
 * only -- which is for `npm run dev`. A production build refuses to run
 * without them (vite.config.ts), so the live site can never quietly fall back
 * to it. Hidden notes (supabase/migrations/..._notes_moderation.sql) are left
 * out by the table's own read policy.
 */

export type NoteColor = 'paper' | 'blush' | 'sage' | 'butter'
/** x, y: where it is pinned on the board, as shares of the board's width and height (null: older notes, laid out in order) */
/** name: what its writer signed it with, after a "-" in its corner (optional) */
export type Note = { id: string; body: string; color: NoteColor; tilt: number; x: number | null; y: number | null; created_at: string; name?: string | null }

export type AddResult = { ok: true; note: Note } | { ok: false; reason: 'already_posted' | 'not_allowed' | 'bad_length' | 'blocked_spot' | 'offline' }

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const isShared = Boolean(URL_ && KEY)

const LIMIT = 60

/** this browser's own random id: one half of "one note per person" (the server keeps the other) */
export function clientId() {
  const k = 'notes.client'
  try {
    let id = localStorage.getItem(k)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(k, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

/** the note this browser left, remembered so the board can mark it and not offer another */
const MINE = 'notes.mine'
export const myNoteId = (): string | null => {
  try {
    return localStorage.getItem(MINE)
  } catch {
    return null
  }
}
const rememberMine = (id: string) => {
  try {
    localStorage.setItem(MINE, id)
  } catch {
    /* private mode: the server still keeps the rule */
  }
}

// A publishable key (sb_publishable_...) goes in `apikey` alone; a legacy anon
// key is a JWT and is also sent as the bearer token, as Supabase expects of it.
const headers = (): Record<string, string> => ({
  apikey: KEY!,
  ...(KEY!.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}),
  'Content-Type': 'application/json',
})

export async function listNotes(): Promise<Note[]> {
  if (!isShared) return localNotes()
  const get = (cols: string) =>
    fetch(`${URL_}/rest/v1/notes?select=${cols}&order=created_at.desc&limit=${LIMIT}`, { headers: headers() })
  // with the signatures; without them where the project has not had that migration yet
  let res = await get('id,body,color,tilt,x,y,created_at,name')
  if (res.status === 400) res = await get('id,body,color,tilt,x,y,created_at')
  if (!res.ok) throw new Error(`notes ${res.status}`)
  return res.json()
}

export async function addNote(body: string, color: NoteColor, x: number, y: number, name = ''): Promise<AddResult> {
  if (myNoteId()) return { ok: false, reason: 'already_posted' }
  const signed = name.replace(/\s+/g, ' ').trim().slice(0, 24)
  if (!isShared) return addLocal(body, color, x, y, signed)
  const post = (withName: boolean) =>
    fetch(`${URL_}/rest/v1/rpc/add_note`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ p_body: body, p_color: color, p_client: clientId(), p_x: x, p_y: y, ...(withName ? { p_name: signed } : {}) }),
    })
  let res: Response
  try {
    res = await post(!!signed)
    // a project without the signatures migration does not know p_name: pinned unsigned rather than not at all
    if (signed && res.status === 404) res = await post(false)
  } catch {
    return { ok: false, reason: 'offline' }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = String(err?.message ?? '')
    if (msg.includes('already_posted')) {
      rememberMine('server')
      return { ok: false, reason: 'already_posted' }
    }
    if (msg.includes('not_allowed')) return { ok: false, reason: 'not_allowed' }
    if (msg.includes('bad_length')) return { ok: false, reason: 'bad_length' }
    if (msg.includes('blocked_spot')) return { ok: false, reason: 'blocked_spot' }
    return { ok: false, reason: 'offline' }
  }
  const note: Note = await res.json()
  rememberMine(note.id)
  return { ok: true, note }
}

// ---------------------------------------------------------------- your own note
// Only the browser that wrote a note can move or delete it: the server checks
// this browser's id against the one recorded with the note (migration
// ..._notes_own.sql).

/** move your note to a new place on the board (shares of its width and height) */
export async function moveMyNote(x: number, y: number): Promise<boolean> {
  const id = myNoteId()
  if (!id) return false
  if (!isShared) return moveLocal(id, x, y)
  try {
    const res = await fetch(`${URL_}/rest/v1/rpc/move_my_note`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ p_client: clientId(), p_x: x, p_y: y }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** take your note down; you may then pin a new one */
export async function deleteMyNote(): Promise<boolean> {
  const id = myNoteId()
  if (!id) return false
  if (isShared) {
    try {
      const res = await fetch(`${URL_}/rest/v1/rpc/delete_my_note`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ p_client: clientId() }),
      })
      if (!res.ok) return false
    } catch {
      return false
    }
  } else {
    try {
      localStorage.setItem(LOCAL, JSON.stringify(localNotes().filter((n) => n.id !== id)))
    } catch {
      /* nothing kept, nothing to remove */
    }
  }
  try {
    localStorage.removeItem(MINE)
  } catch {
    /* private mode */
  }
  return true
}

// ---------------------------------------------------------------- local preview

function moveLocal(id: string, x: number, y: number) {
  try {
    const clampShare = (v: number) => Math.min(1, Math.max(0, v))
    localStorage.setItem(LOCAL, JSON.stringify(localNotes().map((n) => (n.id === id ? { ...n, x: clampShare(x), y: clampShare(y) } : n))))
  } catch {
    /* nothing to keep it in */
  }
  return true
}

const LOCAL = 'notes.local'
function localNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) ?? '[]')
  } catch {
    return []
  }
}
function addLocal(body: string, color: NoteColor, x: number, y: number, name = ''): AddResult {
  const text = body.replace(/\s+/g, ' ').trim()
  if (!text || text.length > 140) return { ok: false, reason: 'bad_length' }
  if (/(https?:\/\/|www\.)/i.test(text)) return { ok: false, reason: 'not_allowed' }
  const note: Note = {
    id: crypto.randomUUID(),
    body: text,
    color,
    tilt: Math.round((Math.random() * 7 - 3.5) * 100) / 100,
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    created_at: new Date().toISOString(),
    name: name || null,
  }
  try {
    localStorage.setItem(LOCAL, JSON.stringify([note, ...localNotes()].slice(0, LIMIT)))
  } catch {
    /* nothing to keep it in: it still shows until reload */
  }
  rememberMine(note.id)
  return { ok: true, note }
}
