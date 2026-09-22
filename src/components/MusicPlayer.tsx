import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { TRACKS } from '../data/music'

/**
 * A small player, fixed to the page's bottom-left corner.
 *
 * Rewind, play/pause, next, mute, and the track's name, on a dark translucent
 * plate. The seek bar stays folded away until the pointer is over the player;
 * then the plate warms a little, grows a touch, and the bar unfolds. Clicking
 * or dragging the bar seeks. Tracks come from data/music.ts.
 */

const ICON = {
  prev: 'M11 3 4 8l7 5V3Zm1 0h1.5v10H12V3Z',
  next: 'M5 3l7 5-7 5V3Zm-3.5 0H3v10H1.5V3Z',
  play: 'M4.5 2.5 13 8l-8.5 5.5v-11Z',
  pause: 'M4 2.5h2.6v11H4v-11Zm5.4 0H12v11H9.4v-11Z',
  sound: 'M2 5.5h2.6L8.5 2.5v11L4.6 10.5H2v-5Zm9 .3a3 3 0 0 1 0 4.4M11.2 3a5.6 5.6 0 0 1 0 10',
  muted: 'M2 5.5h2.6L8.5 2.5v11L4.6 10.5H2v-5Zm8.2.9 3.6 3.6m0-3.6-3.6 3.6',
}

function Icon({ d, stroke = false }: { d: string; stroke?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={stroke ? 'mp__icon mp__icon--stroke' : 'mp__icon'}>
      <path d={d} />
    </svg>
  )
}

const fmt = (s: number) => {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function MusicPlayer() {
  const root = useRef<HTMLDivElement>(null)
  const seek = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const scrubbing = useRef(false)

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const track = TRACKS[index]
  const has = !!track

  // ------------------------------------------------------------ the element
  useEffect(() => {
    const el = audio.current
    if (!el) return
    const onTime = () => {
      if (!scrubbing.current) setTime(el.currentTime)
    }
    const onMeta = () => setDuration(el.duration)
    const onEnd = () => setIndex((i) => (i + 1) % Math.max(1, TRACKS.length))
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('ended', onEnd)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
    }
  }, [])

  // a track change keeps playing if it was playing
  useEffect(() => {
    const el = audio.current
    if (!el || !track) return
    el.src = track.src
    el.load()
    setTime(0)
    setDuration(0)
    if (playing) void el.play().catch(() => setPlaying(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // ----------------------------------------------------------------- hover
  useEffect(() => {
    const rootEl = root.current
    const seekEl = seek.current
    if (!rootEl || !seekEl) return
    gsap.set(seekEl, { height: 0, autoAlpha: 0 })
    const over = () => {
      gsap.to(rootEl, { scale: 1.04, '--mp-alpha': 0.92, duration: 0.45, ease: 'power3.out' })
      gsap.to(seekEl, { height: 22, autoAlpha: 1, duration: 0.45, ease: 'power3.out' })
    }
    const out = () => {
      if (scrubbing.current) return
      gsap.to(rootEl, { scale: 1, '--mp-alpha': 0.68, duration: 0.5, ease: 'power3.out' })
      gsap.to(seekEl, { height: 0, autoAlpha: 0, duration: 0.4, ease: 'power3.inOut' })
    }
    rootEl.addEventListener('pointerenter', over)
    rootEl.addEventListener('pointerleave', out)
    rootEl.addEventListener('focusin', over)
    rootEl.addEventListener('focusout', out)
    return () => {
      rootEl.removeEventListener('pointerenter', over)
      rootEl.removeEventListener('pointerleave', out)
      rootEl.removeEventListener('focusin', over)
      rootEl.removeEventListener('focusout', out)
    }
  }, [])

  // -------------------------------------------------------------- controls
  const toggle = () => {
    const el = audio.current
    if (!el || !has) return
    if (el.paused) void el.play().catch(() => setPlaying(false))
    else el.pause()
  }
  const prev = () => {
    const el = audio.current
    if (!el || !has) return
    // early in a track, step back a track; otherwise back to its start
    if (el.currentTime > 3 || TRACKS.length === 1) {
      el.currentTime = 0
      setTime(0)
    } else setIndex((i) => (i - 1 + TRACKS.length) % TRACKS.length)
  }
  const next = () => {
    if (!has) return
    if (TRACKS.length === 1) {
      const el = audio.current
      if (el) el.currentTime = 0
      return
    }
    setIndex((i) => (i + 1) % TRACKS.length)
  }
  const mute = () => {
    const el = audio.current
    if (!el) return
    el.muted = !el.muted
    setMuted(el.muted)
  }

  // the bar: click or drag to seek
  const seekTo = (clientX: number) => {
    const el = audio.current
    const b = bar.current
    if (!el || !b || !has || !duration) return
    const r = b.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    setTime(f * duration)
    el.currentTime = f * duration
  }
  const onBarDown = (e: React.PointerEvent<HTMLDivElement>) => {
    scrubbing.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    seekTo(e.clientX)
  }
  const onBarMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubbing.current) seekTo(e.clientX)
  }
  const onBarUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing.current) return
    scrubbing.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const progress = duration ? time / duration : 0

  return (
    <div className="mp" ref={root} data-has={has ? '' : undefined} aria-label="Music player">
      <audio ref={audio} preload="metadata" />

      <div className="mp__row">
        <button className="mp__btn" type="button" onClick={prev} disabled={!has} aria-label="Previous">
          <Icon d={ICON.prev} />
        </button>
        <button className="mp__btn mp__btn--play" type="button" onClick={toggle} disabled={!has} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon d={playing ? ICON.pause : ICON.play} />
        </button>
        <button className="mp__btn" type="button" onClick={next} disabled={!has} aria-label="Next">
          <Icon d={ICON.next} />
        </button>

        <span className="mp__title mono" title={track ? `${track.title}${track.artist ? ` — ${track.artist}` : ''}` : undefined}>
          {track ? track.title : 'No track'}
        </span>

        <button className="mp__btn mp__btn--mute" type="button" onClick={mute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
          <Icon d={muted ? ICON.muted : ICON.sound} stroke />
        </button>
      </div>

      <div className="mp__seek" ref={seek}>
        <span className="mp__time mono">{fmt(time)}</span>
        <div
          className="mp__bar"
          ref={bar}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          tabIndex={has ? 0 : -1}
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerCancel={onBarUp}
          onKeyDown={(e) => {
            const el = audio.current
            if (!el || !has) return
            if (e.key === 'ArrowRight') el.currentTime = Math.min(duration, el.currentTime + 5)
            if (e.key === 'ArrowLeft') el.currentTime = Math.max(0, el.currentTime - 5)
          }}
        >
          <i className="mp__fill" style={{ transform: `scaleX(${progress})` }} />
          <i className="mp__knob" style={{ left: `${progress * 100}%` }} />
        </div>
        <span className="mp__time mono">{fmt(duration)}</span>
      </div>
    </div>
  )
}
