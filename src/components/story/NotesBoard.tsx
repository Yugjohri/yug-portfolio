import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { Flip as FlipPlugin } from 'gsap/Flip'
import { useGSAP } from '@gsap/react'
import { whenIdle } from '../../lib/idle'
import { addNote, deleteMyNote, isShared, listNotes, moveMyNote, myNoteId, type Note, type NoteColor } from '../../lib/notesStore'

gsap.registerPlugin(useGSAP)

/** GSAP's Flip, for opening and closing the board, in a chunk of its own: fetched once the page is idle, or when a pointer first nears the board. */
let Flip: typeof FlipPlugin | null = null
let flipLoad: Promise<void> | null = null
const loadFlip = () =>
  (flipLoad ??= import('gsap/Flip').then(
    (m) => {
      gsap.registerPlugin(m.Flip)
      Flip = m.Flip
    },
    () => {
      flipLoad = null
    },
  ))

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
/** Dexter, a friend's drawing: lifted off a photo of the sticky note (the ink
 *  alone, public/notes/dexter.webp) and pinned on a clean yellow note of the
 *  board's own, under the title -- in view docked and opened */
const DEXTER = { x: 0.37, y: 0.585, tilt: 3 }
const NOW = { body: 'now: just finished at CFEES, DRDO. open to AI engineering roles from October 2026.', x: 0.385, y: 0.29 }
/** docked, the board shows its middle this wide (in board px), so the title reads */
const DOCK_VIEW = 1350
/** room kept clear round Yug's note and Dexter, world px */
const GUARD_AIR = 14
const REASON: Record<string, string> = {
  already_posted: 'one note each, and yours is already up. thank you!',
  not_allowed: "that one can't go up (no links or rude words, please).",
  bad_length: 'a note needs a few words, at most 140 characters.',
  blocked_spot: "that spot covers one of the pinned notes; try a little to the side.",
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
  // Flip, before anyone opens the board
  useEffect(() => whenIdle(() => void loadFlip()), [])
  const world = useRef<HTMLDivElement>(null)
  const draft = useRef<HTMLLIElement>(null)
  const flipState = useRef<ReturnType<typeof FlipPlugin.getState> | null>(null)
  /** the board's view: pan (px) and scale */
  const view = useRef({ x: 0, y: 0, s: 1 })
  const [open, setOpen] = useState(false)
  // a phone: docked, the blank note is drawn at the cork's own scale, as small
  // as the notes on it, and a tap on it opens the board to write there
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 699px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 699px)')
    const on = () => setPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const [notes, setNotes] = useState<Note[]>([])
  const [mine, setMine] = useState<string | null>(null)
  const [text, setText] = useState('')
  // the signature in the note's corner (a name, a nickname, initials -- or nothing)
  const [sign, setSign] = useState('')
  const [color, setColor] = useState<NoteColor>('paper')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  // your note's delete asks once more before it goes
  const [confirmDel, setConfirmDel] = useState(false)
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
      let s = bw / (narrow ? 1100 : DOCK_VIEW)
      let cx = 0.5
      const cy = mine ? 0.5 : narrow ? 0.27 : 0.5
      if (!mine && !narrow) {
        // beside the blank note: the title fits the room left of it, centred there
        const note = b.querySelector<HTMLElement>('.nboard__dock-note')
        const title = b.querySelector<HTMLElement>('.nboard__title')
        const room = bw - (note ? note.offsetWidth + 36 : 0) - 16
        if (title) s = Math.min(s, (room * 0.92) / title.offsetWidth)
        cx = (16 + room / 2) / bw
      }
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
    // the cork's scale, for the docked blank note on a phone (story.css)
    board.current?.style.setProperty('--dock-k', String(v.s))
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
    // (opened before Flip has arrived: once it has)
    if (!Flip) {
      void loadFlip().then(() => Flip && toggle())
      return
    }
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
    Flip?.from(state, { duration: 0.75, ease: 'power3.inOut', absolute: true, zIndex: 90 })
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
  /**
   * The two notes nobody may cover -- Yug's own and Dexter -- as boxes on the
   * cork (world px, with a little air round them), and the nearest place for a
   * note of size w x h that covers neither: pushed out past the side it is
   * least far into, and kept on the board. (The server holds to the same.)
   */
  const guarded = () =>
    (['now', 'dexter'] as const)
      .map((k) => world.current?.querySelector<HTMLElement>(`[data-note="${k}"]`))
      .filter((el): el is HTMLElement => !!el)
      .map((el) => ({ x1: el.offsetLeft - GUARD_AIR, y1: el.offsetTop - GUARD_AIR, x2: el.offsetLeft + el.offsetWidth + GUARD_AIR, y2: el.offsetTop + el.offsetHeight + GUARD_AIR }))
  const clearSpot = (x: number, y: number, w: number, h: number) => {
    const boxes = guarded()
    const hits = (px: number, py: number) => boxes.find((r) => px < r.x2 && px + w > r.x1 && py < r.y2 && py + h > r.y1)
    const keep = (px: number, py: number) => ({ x: clamp(0, WORLD.w - w, px), y: clamp(0, WORLD.h - h, py) })
    let at = keep(x, y)
    for (let i = 0; i < 4; i++) {
      const r = hits(at.x, at.y)
      if (!r) return at
      const ways = [keep(r.x1 - w, at.y), keep(r.x2, at.y), keep(at.x, r.y1 - h), keep(at.x, r.y2)]
        .filter((c) => !hits(c.x, c.y))
        .sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))
      at = ways[0] ?? keep(r.x2, r.y2)
    }
    return at
  }

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('button, input, a, [data-note-docked]')) return
    // your own note, once pinned, can be moved -- on the open board and the small one alike:
    // dragged like the blank one, saved where it is let go
    const mineEl = t.closest<HTMLElement>('[data-note-mine]')
    if (!open && !mineEl) return
    const onDraft = !!t.closest('[data-note-draft]')
    const inText = !!t.closest('textarea')
    const b = board.current!
    if (mineEl) {
      const from = { left: parseFloat(mineEl.style.left) || 0, top: parseFloat(mineEl.style.top) || 0 }
      const at = { ...from }
      let moved = false
      b.setPointerCapture(e.pointerId)
      b.dataset.dragging = 'note'
      const moveMine = (ev: PointerEvent) => {
        const s = view.current.s
        const mx = (ev.clientX - e.clientX) / s
        const my = (ev.clientY - e.clientY) / s
        if (!moved && Math.hypot(mx * s, my * s) < 6) return
        moved = true
        ev.preventDefault()
        at.left = clamp(0, WORLD.w - NOTE, from.left + mx)
        at.top = clamp(0, WORLD.h - NOTE, from.top + my)
        mineEl.style.left = `${at.left}px`
        mineEl.style.top = `${at.top}px`
      }
      const upMine = () => {
        delete b.dataset.dragging
        b.removeEventListener('pointermove', moveMine)
        b.removeEventListener('pointerup', upMine)
        b.removeEventListener('pointercancel', upMine)
        if (!moved) return
        // never over Yug's note or Dexter: slid off them to the nearest clear place
        const c = clearSpot(at.left, at.top, mineEl.offsetWidth, mineEl.offsetHeight)
        if (c.x !== at.left || c.y !== at.top) {
          at.left = c.x
          at.top = c.y
          gsap.to(mineEl, { left: c.x, top: c.y, duration: 0.35, ease: 'power3.out' })
        }
        const x = at.left / WORLD.w
        const y = at.top / WORLD.h
        setNotes((list) => list.map((n) => (n.id === mine ? { ...n, x, y } : n)))
        void moveMyNote(x, y).then((ok) => {
          if (!ok) setMsg(REASON.offline)
        })
      }
      b.addEventListener('pointermove', moveMine)
      b.addEventListener('pointerup', upMine)
      b.addEventListener('pointercancel', upMine)
      return
    }
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
      // the blank note let go over Yug's note or Dexter: slid off to the nearest clear place
      if (onDraft && draft.current) {
        const c = clearSpot(draftAt.current.x, draftAt.current.y, draft.current.offsetWidth, draft.current.offsetHeight)
        if (c.x !== draftAt.current.x || c.y !== draftAt.current.y) {
          draftAt.current = c
          gsap.to(draft.current, { x: c.x, y: c.y, duration: 0.35, ease: 'power3.out', onComplete: () => {
            if (draft.current) draft.current.style.transform = `translate(${c.x}px, ${c.y}px)`
          } })
        }
      }
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
    // (pinned only where it covers neither of the two that stay: from the small board too)
    draftAt.current = clearSpot(draftAt.current.x, draftAt.current.y, draft.current?.offsetWidth || NOTE, draft.current?.offsetHeight || 230)
    const r = await addNote(text, color, draftAt.current.x / WORLD.w, draftAt.current.y / WORLD.h, sign)
    setBusy(false)
    if (r.ok) {
      dropped.current = r.note.id
      setNotes((n) => [r.note, ...n.filter((x) => x.id !== r.note.id)])
      setMine(r.note.id)
      setText('')
      setSign('')
    } else {
      if (r.reason === 'already_posted') setMine(myNoteId())
      setMsg(REASON[r.reason])
    }
  }

  /** the blank note: on the open board ('board', draggable) or docked over the board's corner ('docked') */
  const mini = phone && !open
  const blank = (where: 'board' | 'docked') => (
    <li
      ref={where === 'board' ? draft : undefined}
      className={`note note--new note--${color}${where === 'docked' ? ' note--docked' : ''}`}
      data-note={where === 'board' ? 'new' : undefined}
      data-note-draft={where === 'board' ? '' : undefined}
      data-note-docked={where === 'docked' ? '' : undefined}
      onPointerDown={where === 'docked' && !mini ? onDockDown : undefined}
      style={
        where === 'board'
          ? ({ left: 0, top: 0, transform: `translate(${draftAt.current.x}px, ${draftAt.current.y}px)`, '--tilt': '0deg' } as React.CSSProperties)
          : undefined
      }
    >
      <span className="note__pin" aria-hidden="true" />
      {where === 'docked' && mini ? (
        <button type="button" className="note__open" onClick={toggle} aria-label="Write a note (opens the board)" />
      ) : null}
      {/* (inert while it is only the small picture of the note: React 18 knows the attribute only in lowercase) */}
      <form className="note__form" onSubmit={submit} {...(where === 'docked' && mini ? ({ inert: '' } as Record<string, string>) : {})}>
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
        {/* signed in the corner, as Yug's own note is */}
        <label className="note__sign">
          <span aria-hidden="true">-</span>
          <input
            className="note__sign-input"
            value={sign}
            maxLength={24}
            placeholder="your name"
            aria-label="Sign it: your name, a nickname or initials (optional)"
            onChange={(e) => setSign(e.target.value)}
          />
        </label>
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

  /** your note comes down (a second tap confirms); the blank note returns to write another */
  const removeMine = async () => {
    if (!confirmDel) {
      setConfirmDel(true)
      return
    }
    setConfirmDel(false)
    const id = mine
    if (!(await deleteMyNote())) {
      setMsg(REASON.offline)
      return
    }
    setNotes((list) => list.filter((n) => n.id !== id))
    setMine(null)
    setMsg(null)
  }

  const count = notes.length
  const placed = (n: Note, i: number) => (n.x == null || n.y == null ? fallback(i) : { x: n.x, y: n.y })

  return (
    <div className="nboard-slot" ref={slot} onPointerEnter={() => void loadFlip()}>
      {open ? <div className="nboard-dim" onClick={toggle} aria-hidden="true" /> : null}
      <div
        ref={board}
        className={open ? 'nboard nboard--open' : 'nboard'}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label="The notes board"
        data-lenis-prevent
        onPointerDown={onDown}
      >
        {/* (it opens only from its own button, nboard__toggle, not from a click anywhere on it) */}
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
            <li className="note note--butter note--art" data-note="dexter" style={{ left: DEXTER.x * WORLD.w, top: DEXTER.y * WORLD.h, '--tilt': `${DEXTER.tilt}deg` } as React.CSSProperties}>
              <span className="note__pin" aria-hidden="true" />
              <img className="note__art" src="/notes/dexter.webp" width={640} height={646} alt="Dexter: a little robot with big round eyes and an antenna, drawn in pen on a sticky note by a friend" loading="lazy" decoding="async" />
            </li>
            {notes.map((n, i) => {
              const at = placed(n, i)
              return (
                <li
                  key={n.id}
                  className={`note note--${n.color}${n.id === mine ? ' note--mine' : ''}`}
                  data-note={n.id}
                  data-note-mine={n.id === mine ? '' : undefined}
                  style={{ left: at.x * WORLD.w, top: at.y * WORLD.h, '--tilt': `${n.tilt}deg` } as React.CSSProperties}
                >
                  <span className="note__pin" aria-hidden="true" />
                  {n.id === mine ? (
                    <button
                      type="button"
                      className={`mono note__del${confirmDel ? ' note__del--ask' : ''}`}
                      onClick={removeMine}
                      onBlur={() => setConfirmDel(false)}
                      aria-label={confirmDel ? 'Delete your note: tap again to confirm' : 'Delete your note'}
                    >
                      {confirmDel ? 'delete?' : '×'}
                    </button>
                  ) : null}
                  <p className="note__body">{n.body}</p>
                  {n.name ? <span className="note__by">- {n.name}</span> : null}
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
