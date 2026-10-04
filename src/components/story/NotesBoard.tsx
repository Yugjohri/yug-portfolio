import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import StTitle from './StTitle'
import { addNote, isShared, listNotes, myNoteId, type Note, type NoteColor } from '../../lib/notesStore'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * A wall of sticky notes anyone can add to, anonymously, one note each
 * (lib/notesStore.ts keeps the rule with the server). Yug's own "now" note is
 * pinned first, in red; the visitors' notes follow, newest first, each on its
 * own paper, pinned and a little askew. A blank note at the end of the wall is
 * the pen: write, pick a paper, pin it -- it drops onto the board.
 *
 * The board reads the notes as it comes near and every half minute while it
 * is on screen, so new notes turn up without a reload.
 */

const MAX = 140
const PAPERS: NoteColor[] = ['paper', 'blush', 'sage', 'butter']
/** Yug's own note, pinned first */
const NOW = 'now: just finished at CFEES, DRDO. open to AI engineering roles from October 2026.'
const REASON: Record<string, string> = {
  already_posted: 'one note each, and yours is already up. thank you!',
  not_allowed: "that one can't go up (no links or rude words, please).",
  bad_length: 'a note needs a few words, at most 140 characters.',
  offline: "couldn't reach the board just now; try again in a moment.",
}

const when = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function NotesBoard() {
  const root = useRef<HTMLElement>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [mine, setMine] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [color, setColor] = useState<NoteColor>('paper')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const dropped = useRef<string | null>(null)

  // read the board as it comes near, then every half minute while it is on screen
  useEffect(() => {
    setMine(myNoteId())
    const el = root.current
    if (!el) return
    let timer = 0
    let alive = true
    const load = () =>
      listNotes()
        .then((n) => alive && setNotes(n))
        .catch(() => {})
    const io = new IntersectionObserver(
      ([e]) => {
        window.clearInterval(timer)
        if (!e.isIntersecting) return
        void load()
        timer = window.setInterval(load, 30000)
      },
      { rootMargin: '50% 0px' },
    )
    io.observe(el)
    return () => {
      alive = false
      io.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  // the notes come up the wall as it scrolls in; a new note of the reader's drops on
  const { contextSafe } = useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      ScrollTrigger.batch('[data-note]', {
        start: 'top 92%',
        once: true,
        onEnter: (batch) =>
          gsap.fromTo(batch, { autoAlpha: 0, y: 30, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out', stagger: 0.05, overwrite: true }),
      })
    },
    { scope: root, dependencies: [notes.length], revertOnUpdate: true },
  )

  const drop = contextSafe((id: string) => {
    const el = root.current?.querySelector<HTMLElement>(`[data-note="${id}"]`)
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // (its own tilt is the CSS rotate; this turn is on top of it and settles to nothing)
    gsap.fromTo(el, { autoAlpha: 0, y: -70, scale: 1.12, rotation: 8 }, { autoAlpha: 1, y: 0, scale: 1, rotation: 0, duration: 0.75, ease: 'back.out(1.6)' })
  })
  useEffect(() => {
    if (!dropped.current) return
    drop(dropped.current)
    dropped.current = null
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || mine) return
    setBusy(true)
    setMsg(null)
    const r = await addNote(text, color)
    setBusy(false)
    if (r.ok) {
      dropped.current = r.note.id
      setNotes((n) => [r.note, ...n.filter((x) => x.id !== r.note.id)])
      setMine(r.note.id)
      setText('')
    } else {
      if (r.reason === 'already_posted') setMine(myNoteId())
      setMsg(REASON[r.reason])
    }
  }

  return (
    <section className="notes" id="notes" ref={root} aria-labelledby="notes-heading">
      <div className="st-corner st-corner--tl mono">Guestbook</div>
      <div className="st-corner st-corner--tr mono">{isShared ? 'one note each · anonymous' : 'preview · saved in this browser only'}</div>

      <div className="st-wrap notes__inner">
        <StTitle id="notes-heading" text="Leave a note on the wall." accent="on the wall." />

        <ol className="notes__wall">
          {/* Yug's own, pinned first */}
          <li className="note note--now" data-note="now" style={{ '--tilt': '-1.5deg' } as React.CSSProperties}>
            <span className="note__pin" aria-hidden="true" />
            <p className="note__body">{NOW}</p>
            <span className="mono note__meta">— yug</span>
          </li>

          {/* the pen: a blank note, until this reader has left theirs */}
          {!mine ? (
            <li className={`note note--new note--${color}`} data-note="new" style={{ '--tilt': '1deg' } as React.CSSProperties}>
              <span className="note__pin" aria-hidden="true" />
              <form className="note__form" onSubmit={submit}>
                <label className="note__label mono" htmlFor="note-text">
                  your note
                </label>
                <textarea
                  id="note-text"
                  className="note__input"
                  value={text}
                  maxLength={MAX}
                  rows={4}
                  placeholder="say hi, leave a thought, a tip, a joke…"
                  onChange={(e) => setText(e.target.value)}
                />
                <div className="note__row">
                  <div className="note__papers" role="radiogroup" aria-label="Paper">
                    {PAPERS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={color === p}
                        aria-label={p}
                        className={`note__paper note--${p}`}
                        onClick={() => setColor(p)}
                      />
                    ))}
                  </div>
                  <span className="mono note__count">{MAX - text.length}</span>
                  <button className="mono note__pin-it" type="submit" disabled={busy || !text.trim()}>
                    {busy ? 'pinning…' : 'pin it'}
                  </button>
                </div>
                {msg ? (
                  <p className="note__msg" role="status">
                    {msg}
                  </p>
                ) : null}
              </form>
            </li>
          ) : null}

          {notes.map((n) => (
            <li
              key={n.id}
              className={`note note--${n.color}${n.id === mine ? ' note--mine' : ''}`}
              data-note={n.id}
              style={{ '--tilt': `${n.tilt}deg` } as React.CSSProperties}
            >
              <span className="note__pin" aria-hidden="true" />
              <p className="note__body">{n.body}</p>
              <span className="mono note__meta">
                {n.id === mine ? 'yours · ' : ''}
                {when(n.created_at)}
              </span>
            </li>
          ))}
        </ol>
        {mine && msg ? (
          <p className="note__msg" role="status">
            {msg}
          </p>
        ) : null}
      </div>
    </section>
  )
}
