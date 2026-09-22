const PARAS = [
  'I treat a model like a capable but unreliable coworker — useful the moment its output is checkable, dangerous the moment it isn’t. Two and a half years of building on that assumption: a defence research lab, an analytics firm, and a year inside model-evaluation loops at Outlier AI.',
  'At Outlier I rated roughly 500 outputs a month and learned what a bad answer actually looks like before I ever tried to prevent one. At CFEES I’m the sole developer on a system for 500+ personnel that cannot call the internet — retrieval before generation, evaluation before deployment.',
  'Constraint is a design input, not an excuse: an air-gapped intranet, one consumer GPU, a team that can’t tolerate a hallucinated asset record. Those limits produce better architecture than an unlimited budget does.',
]

const FACTS = ['B.Tech CSE, Bennett University', 'CGPA 8.0', '2nd place, SEAS Ideathon 3.0']

export default function About() {
  return (
    <section id="about" data-screen-label="About">
      <div className="about-wrap">
        <div data-reveal className="about-head">
          <div className="mono mono--widest hot">About</div>
          <h2 data-about-heading>
            Retrieval, evaluation, constraint — enough range to{' '}
            <span className="serif underline">
              ship AI that gets trusted
              <i />
            </span>
            .
          </h2>
          <div className="rule" style={{ marginTop: 'clamp(12px,2vh,26px)' }} />
        </div>

        <div className="about-cols">
          <div data-reveal className="about-copy">
            {PARAS.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <p className="faint">
              Outside the terminal: badminton at district level, martial arts, drums, and
              learning ASL — repetition until the hard thing looks easy.
            </p>
            <p className="pull">Let&rsquo;s build something that holds up.</p>
            <div className="about-facts mono">
              {FACTS.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
          </div>
          {/* reserved for the 3D model — deliberately left empty */}
          <div aria-hidden="true" className="about-slot" />
        </div>
      </div>
    </section>
  )
}
