import { SLEEVES, type Sleeve } from '../../data/portfolio'

type Props = { onOpen: (index: number) => void }

function SleeveCard({
  sleeve,
  index,
  onOpen,
}: {
  sleeve: Sleeve
  index: number
  onOpen: (i: number) => void
}) {
  const { capLines, jx, jr, art, repo, code, org } = sleeve

  return (
    <div
      data-sleeve
      data-jx={jx}
      data-jr={jr}
      data-filled={art ? '' : undefined}
      className="sleeve"
      style={{ transform: `translateX(${jx}px) rotate(${jr}deg)` }}
      onClick={() => onOpen(index)}
    >
      <div data-face className="sleeve-face">
        {art ? (
          <img className="sleeve-art" src={art} alt="" />
        ) : (
          <div className="sleeve-empty">
            Sleeve art {String(index + 1).padStart(2, '0')}
          </div>
        )}

        <div className="sleeve-scrim" />

        <div className="sleeve-cap">
          <div className="sleeve-cap-kicker">
            {code} · {org}
          </div>
          <b>
            {capLines[0]}
            <br />
            {capLines[1]}
          </b>
        </div>

        <div data-acts className="sleeve-acts">
          <button
            type="button"
            data-cursor
            className="pill"
            onClick={(e) => {
              e.stopPropagation()
              if (repo) window.open(repo, '_blank', 'noopener')
              else onOpen(index)
            }}
          >
            Open
          </button>
          <button
            type="button"
            data-cursor
            className="pill"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(index)
            }}
          >
            Details
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Work({ onOpen }: Props) {
  const rows = [SLEEVES.slice(0, 3), SLEEVES.slice(3, 6)]

  return (
    <section id="shelf" data-screen-label="Work">
      <div className="shelf-head">
        <div className="mono mono--widest hot">Work</div>

        <div data-stairs-stage className="stairs-stage">
          <div data-stairs-plane className="stairs-plane">
            <h2 data-work-heading data-stairs>
              Systems, shipped where{' '}
              <span className="serif">failure isn&rsquo;t an option</span>
              <span className="hot">.</span>
            </h2>
          </div>
        </div>

        <p className="shelf-lede">
          Six records: a defence-lab system on an air-gapped network, retrieval that cites
          its sources, a fine-tune that fits on one GPU. Hover a sleeve to open it.
        </p>
      </div>

      <div id="crate">
        {rows.map((row, r) => (
          <div className="shelf-row" key={r}>
            <div className="shelf-rack">
              {row.map((sleeve, i) => (
                <SleeveCard
                  key={sleeve.code}
                  sleeve={sleeve}
                  index={r * 3 + i}
                  onOpen={onOpen}
                />
              ))}
            </div>
            <div className="plank" />
          </div>
        ))}
      </div>
    </section>
  )
}
