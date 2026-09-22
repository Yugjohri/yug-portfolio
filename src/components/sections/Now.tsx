import { NOTES } from '../../data/portfolio'

export default function Now() {
  return (
    <section id="now" data-screen-label="Now">
      <div className="section-head">
        <div className="stack-titles">
          <span className="mono mono--widest hot">Currently benchmarking</span>
          <span className="mono muted">September 2026 — drag a note</span>
        </div>
        <button type="button" id="board-reset" data-cursor>
          Tidy up
        </button>
      </div>

      <div id="board">
        <div aria-hidden="true" className="board-grain" />
        {NOTES.map(({ n, text, color, rotate }) => (
          <div
            key={n}
            data-note
            className="note"
            style={{ background: color, transform: `rotate(${rotate}deg)` }}
          >
            <div className="note-pin" />
            <span>{n}</span>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
