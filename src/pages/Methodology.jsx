import { Link } from 'react-router-dom'
import { METRIC_DESCRIPTIONS, NEUTRAL_MAP_NOTE } from '../utils/metricDescriptions'
import styles from './Methodology.module.css'

// Standalone reference page — moved out of the result modal so results stay
// tight. Linked from the landing and from the modal footer.
export default function Methodology() {
  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <Link to="/" className={styles.wordmark}>ZEROMANDER</Link>
        <span className={styles.kicker}>Methodology &amp; Sources</span>
      </header>

      <main className={styles.body}>
        <h1 className={styles.title}>How the numbers work</h1>
        <p className={styles.lede}>
          Zeromander is strictly nonpartisan, and its fairness math isn't invented — it comes from
          the redistricting literature. Here's every metric, what it measures, and where it's from.
        </p>

        <section className={styles.block}>
          <h2 className={styles.h2}>The neutral map</h2>
          <p className={styles.prose}>{NEUTRAL_MAP_NOTE}</p>
        </section>

        <section className={styles.block}>
          <h2 className={styles.h2}>The metrics</h2>
          <dl className={styles.metrics}>
            {Object.values(METRIC_DESCRIPTIONS).map(m => (
              <div key={m.title} className={styles.metric}>
                <dt className={styles.metricTitle}>{m.title}</dt>
                <dd className={styles.metricBody}>{m.body}</dd>
                {m.source && <dd className={styles.metricSource}>Source: {m.source}</dd>}
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.block}>
          <h2 className={styles.h2}>Key references</h2>
          <ul className={styles.links}>
            <li><a href="https://chicagounbound.uchicago.edu/uclrev/vol82/iss2/4/" target="_blank" rel="noopener noreferrer">Stephanopoulos &amp; McGhee — Partisan Gerrymandering and the Efficiency Gap (2015)</a></li>
            <li><a href="https://mggg.org" target="_blank" rel="noopener noreferrer">MGGG Redistricting Lab — redistricting ensemble methods</a></li>
            <li>Gill v. Whitford, 585 U.S. ___ (2018) — the Wisconsin efficiency-gap case</li>
            <li>Reynolds v. Sims, 377 U.S. 533 (1964) — one person, one vote</li>
          </ul>
        </section>

        <p className={styles.nonpartisan}>
          <strong>Strictly nonpartisan.</strong> Every party in the game is fictional, and the Daily
          Heist assigns you a different side each day — so over any week you rig the map for both. The
          lesson isn't "they cheat," it's that the same votes can produce opposite outcomes depending
          on who draws the lines.
        </p>

        <div className={styles.actions}>
          <Link to="/" className={styles.backCta}>← Back to Zeromander</Link>
          <a href="https://github.com/Naadzik/zeromander" target="_blank" rel="noopener noreferrer" className={styles.ghLink}>Open source on GitHub ↗</a>
        </div>
      </main>
    </div>
  )
}
