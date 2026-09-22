import { NAV } from '../data/portfolio'

export default function SiteNav() {
  return (
    <header id="nav">
      <a href="#top" data-cursor className="nav-brand">
        <b>Yug Johri</b>
        <span className="mono muted">AI Engineer</span>
      </a>
      <nav className="nav-links mono">
        {NAV.map(({ label, href, hot }) => (
          <a key={label} href={href} data-cursor className={hot ? 'hot' : undefined}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  )
}
