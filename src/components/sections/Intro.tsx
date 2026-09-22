import { EMAIL, TICKER } from '../../data/portfolio'

/** The marquee band, doubled so the CSS loop is seamless. */
function Marquee() {
  const run = (
    <span>
      <span>Yug Johri</span>
      <em>•</em>
      <span>AI Engineer</span>
      <em>•</em>
    </span>
  )
  return (
    <div className="marq">
      {run}
      <span aria-hidden="true">
        <span>Yug Johri</span>
        <em>•</em>
        <span>AI Engineer</span>
        <em>•</em>
      </span>
    </div>
  )
}

export default function Intro() {
  return (
    <section id="intro" data-screen-label="Intro">
      <div />
      <div className="intro-mid">
        <div data-reveal className="intro-meta mono">
          <span id="clock">—:—:—</span>
          <span className="badge">
            <i />
            Open to roles
          </span>
        </div>

        <div data-reveal id="stage">
          <div className="marq-band">
            <Marquee />
          </div>
          <div className="portrait">
            <img src="/portrait.webp" alt="Yug Johri" />
          </div>
          {/* the same marquee again, clipped to the portrait, in white */}
          <div className="marq-mask" aria-hidden="true">
            <div>
              <Marquee />
            </div>
          </div>
        </div>

        <p data-reveal className="intro-lede">
          Retrieval, agents and fine-tuned models that hold up where the internet
          doesn&rsquo;t reach.
        </p>

        <div data-reveal className="intro-cta">
          <a href="#shelf" data-cursor data-magnetic className="btn btn--hot">
            The work ↓
          </a>
          <a href={`mailto:${EMAIL}`} data-cursor data-magnetic className="btn btn--ghost">
            Email me
          </a>
        </div>
      </div>

      <div data-reveal id="ticker">
        <div className="ticker-track">
          {[0, 1].map((dup) => (
            <span key={dup} aria-hidden={dup === 1 ? 'true' : undefined}>
              {TICKER.map((t) => (
                <span key={t} style={{ display: 'contents' }}>
                  <span>{t}</span>
                  <span className="hot">/</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
