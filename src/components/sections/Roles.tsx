import { ROLES } from '../../data/portfolio'

export default function Roles() {
  return (
    <section id="roles" data-screen-label="Roles">
      <div className="roles-head mono mono--wide muted">
        <span className="roles-head-lead">Where I&rsquo;ve worked</span>
        <span>Scroll through the stack</span>
      </div>

      <div data-roles-stage className="roles-stage">
        <div data-roles-deck className="roles-deck">
          {ROLES.map((role) => (
            <article data-role-card data-cursor className="role-card" key={role.org}>
              <div data-glow className="role-glow" />

              <div className="role-meta">
                <span className={role.current ? 'hot' : undefined}>{role.tag}</span>
                <span>{role.period}</span>
              </div>

              <div>
                <h3>{role.org}</h3>
                <div className="role-sub">{role.title}</div>
              </div>

              <ul>
                {role.bullets.map((b) => (
                  <li key={b}>
                    <span className="hot">—</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="role-stack">{role.stack}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
