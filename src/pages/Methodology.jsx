import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { METHODOLOGY_SECTIONS, HONESTY_BOX, KEY_REFERENCES } from '../utils/methodologyContent'
import styles from './Methodology.module.css'

// In-page jumps are driven explicitly, and INSTANTLY, on purpose.
//
// The app sets `scroll-behavior: smooth` globally, and native fragment
// navigation obeys that CSS — so a plain `<a href="#id">` here set the hash
// and then scrolled nowhere whenever the smooth animation didn't run
// (measured: 0px moved after two seconds, while an instant scroll landed the
// section exactly). A reference page this long must be navigable even when an
// animation is unavailable or the reader prefers reduced motion, so we ask
// for the jump outright. replaceState keeps the URL shareable without handing
// the navigation back to the router.
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'instant', block: 'start' });
  window.history.replaceState(null, '', `#${id}`);
}

// The public accounting. Every formula the game computes, every parameter we
// chose, where each one comes from — and, just as important, exactly where the
// game simplifies reality.
//
// Layered on purpose: "in plain words" is the in-game register a curious
// player can read, "the fine print" is the formal definition a reviewer
// expects. Content lives in utils/methodologyContent.js so the numbers quoted
// here sit next to a comment naming the file each one is defined in.
export default function Methodology() {
  // A shared deep link (…/methodology#litigation) must land on its section
  // too. Two things fight it: layout isn't settled on the first frame, and the
  // browser's own scroll restoration lands AFTER our effect and overwrites it
  // (measured — a reload of a #honesty link kept the previous position 900px
  // short). So: take restoration off automatic for the visit, scroll once the
  // frame is laid out, and re-assert shortly after in case restoration still
  // won the race. Restoration is put back on unmount so the rest of the app
  // keeps its normal back-button behaviour.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;

    const previous = window.history.scrollRestoration;
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

    const jump = () => document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
    const raf = requestAnimationFrame(jump);
    const retry = setTimeout(jump, 150);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(retry);
      if ('scrollRestoration' in window.history) window.history.scrollRestoration = previous || 'auto';
    };
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <Link to="/" className={styles.wordmark}>ZEROMANDER</Link>
        <span className={styles.kicker}>Methodology &amp; Sources</span>
      </header>

      <main className={styles.body}>
        <h1 className={styles.title}>How the numbers work</h1>
        <p className={styles.lede}>
          Zeromander is strictly nonpartisan, and its fairness math isn&apos;t invented — it comes from
          the redistricting literature and the case law. This page states every formula we compute,
          every parameter we chose, where each one comes from, and — just as important —
          exactly where the game simplifies reality.
        </p>
        <p className={styles.claim}>
          If you find a claim on this page that the cited source doesn&apos;t support, that&apos;s a bug.
          Please report it.
        </p>

        <nav className={styles.toc} aria-label="Contents">
          {[...METHODOLOGY_SECTIONS, { id: 'honesty', title: 'The honesty box' }].map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={styles.tocLink}
              onClick={(e) => { e.preventDefault(); scrollToSection(s.id); }}
            >
              {s.title}
            </a>
          ))}
        </nav>

        {METHODOLOGY_SECTIONS.map(section => (
          <section key={section.id} id={section.id} className={styles.block}>
            <h2 className={styles.h2}>{section.title}</h2>

            <p className={styles.plain}>
              <span className={styles.plainLabel}>In plain words</span>
              {section.plain}
            </p>

            {section.fine.length > 0 && (
              <div className={styles.fine}>
                <span className={styles.fineLabel}>The fine print</span>
                {section.fine.map((para, i) => (
                  <p key={i} className={styles.finePara}>{para}</p>
                ))}
              </div>
            )}

            {section.disclosure && (
              <p className={styles.disclosure}>{section.disclosure}</p>
            )}

            {section.sources && (
              <p className={styles.sources}>Sources: {section.sources}</p>
            )}
          </section>
        ))}

        <section id="honesty" className={styles.block}>
          <h2 className={styles.h2}>The honesty box</h2>
          <p className={styles.plain}>
            <span className={styles.plainLabel}>Every known simplification, in one place</span>
            A game is a model, and every model leaves things out. Here is what this one leaves out,
            why, and what it changes.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Simplification</th>
                  <th scope="col">Why we chose it</th>
                  <th scope="col">What it changes</th>
                </tr>
              </thead>
              <tbody>
                {HONESTY_BOX.map(row => (
                  <tr key={row.simplification}>
                    <th scope="row">{row.simplification}</th>
                    <td>{row.why}</td>
                    <td>{row.effect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.block}>
          <h2 className={styles.h2}>Key references</h2>
          <ul className={styles.links}>
            {KEY_REFERENCES.map(ref => (
              <li key={ref.text}>
                {ref.href
                  ? <a href={ref.href} target="_blank" rel="noopener noreferrer">{ref.text}</a>
                  : ref.text}
              </li>
            ))}
          </ul>
        </section>

        <p className={styles.nonpartisan}>
          <strong>Strictly nonpartisan.</strong> Every party in the game is fictional, and the Daily
          Heist assigns you a different side each day — so over any week you rig the map for both. The
          lesson isn&apos;t &ldquo;they cheat.&rdquo; It&apos;s that the same votes can produce opposite outcomes
          depending on who draws the lines.
        </p>

        <div className={styles.actions}>
          <Link to="/" className={styles.backCta}>← Back to Zeromander</Link>
          <a href="https://github.com/Naadzik/zeromander" target="_blank" rel="noopener noreferrer" className={styles.ghLink}>Open source on GitHub ↗</a>
        </div>
      </main>
    </div>
  )
}
