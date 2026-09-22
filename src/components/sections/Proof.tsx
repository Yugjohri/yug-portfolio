import { RECEIPTS } from '../../data/portfolio'

export default function Proof() {
  return (
    <section id="proof" data-screen-label="Proof">
      <div className="proof-head mono mono--wide muted">Receipts</div>
      <div className="receipts">
        {RECEIPTS.map(({ value, prefix, suffix, label, hot }) => (
          <div className="receipt" key={label}>
            <b
              data-count={value}
              data-count-prefix={prefix}
              data-count-suffix={suffix}
              className={hot ? 'hot' : undefined}
            >
              {(prefix ?? '') + value + (suffix ?? '')}
            </b>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
