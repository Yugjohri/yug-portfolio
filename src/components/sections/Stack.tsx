import { STACK } from '../../data/portfolio'

export default function Stack() {
  return (
    <section id="stack" data-screen-label="Stack">
      <div className="section-head">
        <div className="stack-titles">
          <span className="mono mono--widest hot">Stack</span>
          <span className="mono muted">Sixteen tools, in daily rotation</span>
        </div>
        <span className="mono muted">{STACK.length}</span>
      </div>
      <div data-grid-stage className="grid-stage">
        <div id="tech-grid">
          {STACK.map(({ name, col, hot }) => (
            <div
              key={name}
              data-grid-item
              data-col={col}
              className={hot ? 'tile tile--hot' : 'tile'}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
