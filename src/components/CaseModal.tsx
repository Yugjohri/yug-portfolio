import { useEffect } from 'react'
import type { Sleeve } from '../data/portfolio'

type Props = { sleeve: Sleeve | null; onClose: () => void }

/**
 * The case-study modal.
 *
 * The original build lost this markup at some point while the page script kept
 * querying for it, so "Details" quietly did nothing (openDetail bailed on a null
 * #detail). Here it renders from the same data the shelf does.
 */
export default function CaseModal({ sleeve, onClose }: Props) {
  useEffect(() => {
    if (!sleeve) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sleeve, onClose])

  if (!sleeve) return null

  return (
    <div
      className="detail"
      data-shown=""
      role="dialog"
      aria-modal="true"
      aria-label={sleeve.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="detail-card">
        <button
          type="button"
          className="detail-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="mono mono--wide hot">{sleeve.kicker}</div>
        <h3>{sleeve.title}</h3>
        <p className="detail-body">{sleeve.body}</p>

        <div className="detail-art">
          {sleeve.art ? <img src={sleeve.art} alt="" /> : null}
        </div>

        <div className="detail-metrics">
          {sleeve.metrics.map((m) => (
            <div key={m}>{m}</div>
          ))}
        </div>

        <div className="detail-tags">
          {sleeve.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>

        {sleeve.repo ? (
          <a
            className="btn btn--hot detail-repo"
            href={sleeve.repo}
            target="_blank"
            rel="noreferrer"
          >
            View repo ↗
          </a>
        ) : null}
      </div>
    </div>
  )
}
