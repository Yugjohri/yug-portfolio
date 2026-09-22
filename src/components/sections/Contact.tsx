import { EMAIL } from '../../data/portfolio'

const LINKS = [
  { label: 'GitHub ↗', href: 'https://github.com/Yugjohri' },
  { label: 'Old site ↗', href: 'https://yugjohri.me/' },
  { label: 'LinkedIn ↗', href: 'https://www.linkedin.com/' },
  { label: '+91 99582 71560', href: 'tel:+919958271560' },
]

export default function Contact() {
  return (
    <section id="contact" data-screen-label="Contact">
      <div data-reveal className="contact-inner">
        <div className="mono mono--wide muted">
          Open to AI engineering roles from October 2026
        </div>
        <a href={`mailto:${EMAIL}`} data-cursor data-magnetic className="contact-mail">
          yugjohri8<span className="serif">@</span>gmail.com
        </a>
        <div className="contact-links">
          {LINKS.map(({ label, href }) => (
            <a key={label} href={href} data-cursor>
              {label}
            </a>
          ))}
        </div>
      </div>
      <div className="contact-foot">
        <span>Yug Johri — AI &amp; full-stack engineer</span>
        <span>Delhi, India</span>
        <span>© 2026</span>
      </div>
    </section>
  )
}
