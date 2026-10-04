import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { useGSAP } from '@gsap/react'
import { addNote, isShared, listNotes, myNoteId, type Note, type NoteColor } from '../../lib/notesStore'

gsap.registerPlugin(useGSAP, Flip)

/**
 * The notes board, in Contact: a rounded cork board anyone can pin one note
 * to, anonymously (lib/notesStore.ts keeps it to one each).
 *
 * Docked, it sits beside the contact details and shows the whole board, small.
 * The round glass button (or a click on the board) opens it: it grows out of
 * its place to fill the screen at full size, and the board can be dragged
 * around. A blank note waits there for whoever has not left one: write on it,
 * drag it wherever it should go, pick a paper and pin it. The button again
 * (or Escape, or the dimmed page) closes it, and it shrinks back into place.
 *
 * Notes are kept with their place on the board, as shares of its size, so
 * the wall reads the same for everyone at any size.
 */

/** the board's own size, in its own px: notes are laid out on this */
const WORLD = { w: 2800, h: 2000 }
const NOTE = 200
const MAX = 140
const PAPERS: NoteColor[] = ['paper', 'blush', 'sage', 'butter']
/** Yug's own note, pinned up and to the left of the title */
const NOW = { body: 'now: just finished at CFEES, DRDO. open to AI engineering roles from October 2026.', x: 0.385, y: 0.29 }
/** docked, the board shows its middle this wide (in board px), so the title reads */
const DOCK_VIEW = 1350
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
/** older notes without a place go round the title, ring by ring */
const fallback = (i: number) => {
  const a = i * 2.39996
  const r = 0.2 + 0.035 * Math.floor(i / 6)
  return { x: clamp(0.02, 0.92, 0.47 + Math.cos(a) * r), y: clamp(0.02, 0.88, 0.45 + Math.sin(a) * r * 1.2) }
}
const clamp = gsap.utils.clamp

export default function NotesBoard() {
  const slot = useRef<HTMLDivElement>(null)
  const board = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const draft = useRef<HTMLLIElement>(null)
  const flipState = useRef<Flip.FlipState | null>(null)
  /** the board's view: pan (px) and scale */
  const view = useRef({ x: 0, y: 0, s: 1 })
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [mine, setMine] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [color, setColor] = useState<NoteColor>('paper')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  /** where the blank note is, in board px */
  const draftAt = useRef({ x: WORLD.w / 2 - NOTE / 2, y: WORLD.h / 2 + 150 })

  // ------------------------------------------------------------- the notes
  useEffect(() => {
    setMine(myNoteId())
    const el = slot.current
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

  // ------------------------------------------------------------- the view
  /** the scale and pan for the board's current box */
  const fit = useCallback((isOpen: boolean) => {
    const b = board.current
    if (!b) return view.current
    const bw = b.clientWidth
    const bh = b.clientHeight
    if (!isOpen) {
      // docked: the middle of the board around the title -- moved over to
      // leave room for the blank note while there is one (beside it; above it on a phone)
      const narrow = window.innerWidth < 700
      const s = bw / (narrow ? 1100 : DOCK_VIEW)
      const cx = mine ? 0.5 : narrow ? 0.5 : 0.31
      const cy = mine ? 0.5 : narrow ? 0.27 : 0.5
      return { s, x: bw * cx - (WORLD.w / 2) * s, y: bh * cy - (WORLD.h / 2 + 40) * s }
    }
    // open: full size (a little less on a phone), centred on the blank note if there is one
    const s = window.innerWidth < 700 ? 0.62 : 1
    const fx = (mine ? WORLD.w / 2 : draftAt.current.x + NOTE / 2) * s
    const fy = (mine ? WORLD.h / 2 : draftAt.current.y + NOTE / 2) * s
    return clampView({ s, x: bw / 2 - fx, y: bh / 2 - fy }, bw, bh)
  }, [mine])

  const clampView = (v: { s: number; x: number; y: number }, bw: number, bh: number) => {
    const ww = WORLD.w * v.s
    const wh = WORLD.h * v.s
    return {
      s: v.s,
      x: ww <= bw ? (bw - ww) / 2 : clamp(bw - ww, 0, v.x),
      y: wh <= bh ? (bh - wh) / 2 : clamp(bh - wh, 0, v.y),
    }
  }
  const apply = (v: { s: number; x: number; y: number }) => {
    view.current = v
    if (world.current) gsap.set(world.current, { x: v.x, y: v.y, scale: v.s, transformOrigin: '0 0' })
  }

  // docked: keep the board fitted as the column resizes
  useEffect(() => {
    const b = board.current
    if (!b) return
    const ro = new ResizeObserver(() => {
      if (!b.classList.contains('nboard--open')) apply(fit(false))
    })
    ro.observe(b)
    return () => ro.disconnect()
  }, [fit])

  // ------------------------------------------------------------- open / close
  const toggle = () => {
    const b = board.current
    if (!b) return
    flipState.current = Flip.getState(b)
    setOpen((o) => !o)
  }
  useLayoutEffect(() => {
    const b = board.current
    const state = flipState.current
    if (!b || !state) return
    flipState.current = null
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = fit(open)
    const lenis = window.__lenis
    if (open) lenis?.stop()
    else lenis?.start()
    if (reduced) {
      apply(target)
      return
    }
    Flip.from(state, { duration: 0.75, ease: 'power3.inOut', absolute: true, zIndex: 90 })
    const from = { ...view.current }
    gsap.to(from, {
      ...target,
      duration: 0.75,
      ease: 'power3.inOut',
      onUpdate: () => apply(from),
    })
  }, [open, fit])

  // Escape closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && toggle()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  useEffect(() => () => window.__lenis?.start(), [])

  // ------------------------------------------------------------- dragging
  // on the open board: the background pans it; the blank note moves itself
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!open || e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('button, input, a, [data-note-docked]')) return
    const onDraft = !!t.closest('[data-note-draft]')
    const inText = !!t.closest('textarea')
    const b = board.current!
    const start = { px: e.clientX, py: e.clientY, vx: view.current.x, vy: view.current.y, dx: draftAt.current.x, dy: draftAt.current.y }
    // on the text, a press only becomes a drag once it has travelled a little
    let dragging = !inText
    if (dragging) {
      b.setPointerCapture(e.pointerId)
      b.dataset.dragging = onDraft ? 'note' : 'board'
    }
    const move = (ev: PointerEvent) => {
      const mx = ev.clientX - start.px
      const my = ev.clientY - start.py
      if (!dragging) {
        if (Math.hypot(mx, my) < 6) return
        dragging = true
        ;(t as HTMLTextAreaElement).blur()
        window.getSelection()?.removeAllRanges()
        b.setPointerCapture(ev.pointerId)
        b.dataset.dragging = 'note'
      }
      ev.preventDefault()
      if (onDraft) {
        const s = view.current.s
        draftAt.current = {
          x: clamp(0, WORLD.w - NOTE, start.dx + mx / s),
          y: clamp(0, WORLD.h - NOTE, start.dy + my / s),
        }
        if (draft.current) draft.current.style.transform = `translate(${draftAt.current.x}px, ${draftAt.current.y}px)`
      } else {
        apply(clampView({ s: view.current.s, x: start.vx + mx, y: start.vy + my }, b.clientWidth, b.clientHeight))
      }
    }
    const up = () => {
      delete b.dataset.dragging
      b.removeEventListener('pointermove', move)
      b.removeEventListener('pointerup', up)
      b.removeEventListener('pointercancel', up)
    }
    b.addEventListener('pointermove', move)
    b.addEventListener('pointerup', up)
    b.addEventListener('pointercancel', up)
  }

  /** docked, the blank note can be dragged over the small board too: where it
   *  is let go is where it will be pinned (and where it waits on the open board) */
  const dockOff = useRef({ x: 0, y: 0 })
  const onDockDown = (e: React.PointerEvent<HTMLLIElement>) => {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('button, input')) return
    const el = e.currentTarget
    const b = board.current!
    const inText = !!t.closest('textarea')
    const start = { px: e.clientX, py: e.clientY, ox: dockOff.current.x, oy: dockOff.current.y }
    let dragging = !inText
    const bound = () => {
      // the note's resting box (without the drag), to keep it on the board
      const r = el.getBoundingClientRect()
      const br = b.getBoundingClientRect()
      return { r, br, rest: { left: r.left - dockOff.current.x, top: r.top - dockOff.current.y } }
    }
    const move = (ev: PointerEvent) => {
      const mx = ev.clientX - start.px
      const my = ev.clientY - start.py
      if (!dragging) {
        if (Math.hypot(mx, my) < 6) return
        dragging = true
        ;(t as HTMLTextAreaElement).blur()
        window.getSelection()?.removeAllRanges()
      }
      ev.preventDefault()
      el.setPointerCapture(ev.pointerId)
      b.dataset.dragging = 'note'
      const { r, br, rest } = bound()
      const x = clamp(br.left - rest.left, br.right - r.width - rest.left, start.ox + mx)
      const y = clamp(br.top - rest.top, br.bottom - r.height - rest.top, start.oy + my)
      dockOff.current = { x, y }
      el.style.translate = `${x}px ${y}px`
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      delete b.dataset.dragging
      if (!dragging) return
      // its place on the board: the note's top-left, through the docked view
      const r = el.getBoundingClientRect()
      const br = b.getBoundingClientRect()
      const v = view.current
      draftAt.current = {
        x: clamp(0, WORLD.w - NOTE, (r.left - br.left - v.x) / v.s),
        y: clamp(0, WORLD.h - NOTE, (r.top - br.top - v.y) / v.s),
      }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  // ------------------------------------------------------------- pinning
  const { contextSafe } = useGSAP({ scope: board })
  const drop = contextSafe((id: string) => {
    const el = board.current?.querySelector<HTMLElement>(`[data-note="${id}"]`)
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(el, { autoAlpha: 0, scale: 1.18, rotation: '+=9' }, { autoAlpha: 1, scale: 1, rotation: '-=9', duration: 0.7, ease: 'back.out(1.7)' })
  })
  const dropped = useRef<string | null>(null)
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
    const r = await addNote(text, color, draftAt.current.x / WORLD.w, draftAt.current.y / WORLD.h)
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

  /** the blank note: on the open board ('board', draggable) or docked over the board's corner ('docked') */
  const blank = (where: 'board' | 'docked') => (
    <li
      ref={where === 'board' ? draft : undefined}
      className={`note note--new note--${color}${where === 'docked' ? ' note--docked' : ''}`}
      data-note={where === 'board' ? 'new' : undefined}
      data-note-draft={where === 'board' ? '' : undefined}
      data-note-docked={where === 'docked' ? '' : undefined}
      onPointerDown={where === 'docked' ? onDockDown : undefined}
      style={
        where === 'board'
          ? ({ left: 0, top: 0, transform: `translate(${draftAt.current.x}px, ${draftAt.current.y}px)`, '--tilt': '0deg' } as React.CSSProperties)
          : undefined
      }
    >
      <span className="note__pin" aria-hidden="true" />
      <form className="note__form" onSubmit={submit}>
        <label className="note__label mono" htmlFor={`note-text-${where}`}>
          your note · drag me
        </label>
        <textarea
          id={`note-text-${where}`}
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
        </div>
        <button className="mono note__pin-it" type="submit" disabled={busy || !text.trim()}>
          {busy ? 'pinning…' : 'pin it'}
        </button>
      </form>
    </li>
  )

  const count = notes.length
  const placed = (n: Note, i: number) => (n.x == null || n.y == null ? fallback(i) : { x: n.x, y: n.y })

  return (
    <div className="nboard-slot" ref={slot}>
      {open ? <div className="nboard-dim" onClick={toggle} aria-hidden="true" /> : null}
      <div
        ref={board}
        className={open ? 'nboard nboard--open' : 'nboard'}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label="The notes board"
        data-lenis-prevent
        onPointerDown={onDown}
        onClick={(e) => {
          // docked, the whole board opens it
          if (!open && !(e.target as HTMLElement).closest('button, [data-note-docked]')) toggle()
        }}
      >
        <div className="nboard__world" ref={world} style={{ width: WORLD.w, height: WORLD.h }}>
          {/* the board's title, written on the cork; notes go over it */}
          <div className="nboard__title" aria-hidden="true">
            <span>Leave a note :)</span>
            <svg viewBox="0 0 600 40" preserveAspectRatio="none">
              <path d="M6 24 C 90 12, 170 30, 250 20 S 420 10, 500 22 S 570 28, 594 16" />
              <path d="M40 33 C 140 26, 260 36, 380 29 S 520 27, 560 31" />
            </svg>
          </div>
          <ol className="nboard__notes">
            <li className="note note--now" data-note="now" style={{ left: NOW.x * WORLD.w, top: NOW.y * WORLD.h, '--tilt': '-2deg' } as React.CSSProperties}>
              <span className="note__pin" aria-hidden="true" />
              <p className="note__body">{NOW.body}</p>
              <span className="mono note__meta">— yug</span>
            </li>
            {notes.map((n, i) => {
              const at = placed(n, i)
              return (
                <li
                  key={n.id}
                  className={`note note--${n.color}${n.id === mine ? ' note--mine' : ''}`}
                  data-note={n.id}
                  style={{ left: at.x * WORLD.w, top: at.y * WORLD.h, '--tilt': `${n.tilt}deg` } as React.CSSProperties}
                >
                  <span className="note__pin" aria-hidden="true" />
                  <p className="note__body">{n.body}</p>
                  <span className="mono note__meta">
                    {n.id === mine ? 'yours · ' : ''}
                    {when(n.created_at)}
                  </span>
                </li>
              )
            })}
            {/* the blank note on the open board, where it can be dragged into place */}
            {open && !mine ? blank('board') : null}
          </ol>
        </div>

        {/* docked, the blank note waits over the board's corner, ready to write on
            (pinned from here, it goes under the title; open the board to place it) */}
        {!open && !mine ? <ul className="nboard__dock-note">{blank('docked')}</ul> : null}

        {/* what the docked board says, and what the open one says */}
        <div className="nboard__label mono" aria-hidden={open}>
          {open
            ? mine
              ? 'drag to look around · esc to close'
              : 'write, drag your note anywhere, pin it'
            : `the wall · ${count + 1} note${count ? 's' : ''}${mine ? '' : ' · leave yours'}`}
        </div>
        {msg ? (
          <p className="nboard__msg" role="status">
            {msg}
          </p>
        ) : null}
        {!isShared && open ? <span className="nboard__preview mono">preview · saved in this browser only</span> : null}

        <button
          className="nboard__toggle"
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? 'Close the board' : 'Open the board'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {open ? (
              <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            ) : (
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            )}
          </svg>
        </button>
      </div>
    </div>
  )
}
