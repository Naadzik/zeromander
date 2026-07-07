import { useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import DailySpecimen from '../components/DailySpecimen'
import { getDailyChallenge } from '../utils/dailyChallenge'
import { hasPlayedToday } from '../utils/dailyHistory'
import styles from './Landing.module.css'

export default function Landing() {
  const daily = getDailyChallenge();
  const lessonDone = (() => { try { return !!localStorage.getItem('zeromander.lessonDone'); } catch { return false; } })();
  const smallDone = hasPlayedToday(daily.date, 'small');
  const fullDone = hasPlayedToday(daily.date, 'full');
  const dailyCta = !smallDone
    ? `Play Daily Heist #${daily.dayNumber}`
    : !fullDone
      ? `Daily #${daily.dayNumber}: the Full Job is open`
      : `Daily #${daily.dayNumber} ✓✓ — view results`;
  const dailyHref = smallDone && !fullDone ? '/game?daily&tier=full' : '/game?daily';
  const navigate = useNavigate();
  const location = useLocation();

  // Shared links use the short form naadzik.github.io/zeromander/?daily —
  // forward straight into the day's board.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('daily')) {
      navigate('/game?daily', { replace: true });
    } else if (params.has('board')) {
      // Challenge links shared as /?board=… land here — forward intact.
      navigate(`/game?${params.toString()}`, { replace: true });
    }
  }, [location.search]);

  return (
    <div className={styles.landing}>
      {/* Masthead */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.masthead}>
            <h1>Zeromander</h1>
            <span className={styles.mastKicker}>Special coverage: who draws the lines?</span>
          </div>
          <a href="https://github.com/Naadzik/zeromander" target="_blank" rel="noopener noreferrer" className={styles.githubLink}>
            GitHub
          </a>
        </div>
      </header>

      {/* Hero: editorial split — copy left, today's real board right */}
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <div className={styles.kickerLive}>Daily Heist #{daily.dayNumber} — one board, everyone, one attempt</div>
            <h2 className={styles.headline}>Whoever draws the map wins the election.</h2>
            <p className={styles.dek}>
              Zeromander is a daily puzzle about gerrymandering — the entirely legal art of
              picking your own voters. Draw the lines. Steal the seats. Learn exactly how
              it's done to you.
            </p>
            <div className={styles.ctaRow}>
              {!lessonDone ? (
                <>
                  <Link to="/game?lesson" className={styles.ctaButton}>
                    Never gerrymandered? 60-second lesson
                  </Link>
                  <Link to={dailyHref} className={styles.ctaButtonDaily}>
                    {dailyCta}
                  </Link>
                </>
              ) : (
                <>
                  <Link to={dailyHref} className={styles.ctaButton}>
                    {dailyCta}
                  </Link>
                  <Link to="/game" className={styles.ctaButtonDaily}>
                    Open the Sandbox
                  </Link>
                </>
              )}
            </div>
            <p className={styles.smallPrint}>Free · No account · Fictional parties, real formulas</p>
          </div>
          <figure className={styles.specimenWrap}>
            <DailySpecimen size={400} className={styles.specimenCanvas} />
            <figcaption className={styles.specimenCaption}>
              Today's actual battleground. {daily.small.config.numDistricts} districts to draw —
              the same map for every player on Earth.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* How the heist works — one ruled strip, no cards */}
      <section className={styles.ruledStrip}>
        <div className={styles.ruledItem}>
          <span className={styles.ruledNum}>01</span>
          <strong>Pack.</strong> Cram your opponents into a few districts they win by a landslide. Every surplus vote is wasted.
        </div>
        <div className={styles.ruledItem}>
          <span className={styles.ruledNum}>02</span>
          <strong>Crack.</strong> Slice the rest of them thin across districts they can never quite win.
        </div>
        <div className={styles.ruledItem}>
          <span className={styles.ruledNum}>03</span>
          <strong>Profit.</strong> 45% of the vote, 60% of the seats. Entirely legal. That's the problem.
        </div>
      </section>

      {/* The fine print — nonpartisan + methodology, unchanged claims */}
      <section className={styles.about}>
        <div className={styles.container}>
          <h2>The fine print</h2>
          <p className={styles.aboutText}>
            Zeromander is an interactive educational game about electoral redistricting. Gerrymandering — the practice of manipulating electoral district boundaries for political advantage — is a real-world problem that affects representation and fairness in elections.
          </p>
          <p className={styles.aboutText}>
            <strong>Zeromander is strictly nonpartisan.</strong> Every party in the game is fictional, and the game makes no argument about who gerrymanders — because the answer is: whoever holds the pen. Gerrymandering is a structural flaw, not a partisan one; in the Daily Heist you're assigned a different side each day, so over any week you'll rig the map for both. The lesson isn't "they cheat" — it's "the same votes can produce opposite outcomes depending on who draws the lines."
          </p>
          <p className={styles.aboutText}>
            <strong>The math is not ours.</strong> The fairness metrics come from the redistricting literature: the efficiency gap (<a href="https://chicagounbound.uchicago.edu/uclrev/vol82/iss2/4/" target="_blank" rel="noopener noreferrer">Stephanopoulos &amp; McGhee, 2015</a>), Polsby-Popper compactness (1991), and seats–votes asymmetry. The "neutral map" baseline is drawn by a party-blind algorithm in the spirit of the ensemble methods popularized by the <a href="https://mggg.org" target="_blank" rel="noopener noreferrer">MGGG Redistricting Lab</a>. Every metric's source is cited in-game next to the number it explains.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerContent}>
            <p>&copy; 2026 Zeromander. Nonpartisan &amp; open source — created for electoral fairness</p>
            <a href="https://github.com/Naadzik/zeromander" target="_blank" rel="noopener noreferrer">
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
