import { useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Icon from '../components/ui/Icons'
import { getDailyChallenge } from '../utils/dailyChallenge'
import { hasPlayedToday } from '../utils/dailyHistory'
import styles from './Landing.module.css'

export default function Landing() {
  const daily = getDailyChallenge();
  const playedToday = hasPlayedToday(daily.date);
  const navigate = useNavigate();
  const location = useLocation();

  // Shared links use the short form naadzik.github.io/zeromander/?daily —
  // forward straight into the day's board.
  useEffect(() => {
    if (new URLSearchParams(location.search).has('daily')) {
      navigate('/game?daily', { replace: true });
    }
  }, [location.search]);

  return (
    <div className={styles.landing}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <h1>Zeromander</h1>
          </div>
          <a href="https://github.com/Naadzik/zeromander" target="_blank" rel="noopener noreferrer" className={styles.githubLink}>
            GitHub
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1>Master the art of electoral redistricting</h1>
          <p>Learn how gerrymandering works and create fair electoral districts</p>
          <div className={styles.ctaRow}>
            <Link to="/game?daily" className={styles.ctaButtonDaily}>
              {playedToday ? `🕵️ Daily Heist #${daily.dayNumber} ✓` : `🕵️ Daily Heist #${daily.dayNumber}`}
            </Link>
            <Link to="/game" className={styles.ctaButton}>
              Play Sandbox
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className={styles.about}>
        <div className={styles.container}>
          <h2>What is Zeromander?</h2>
          <p className={styles.aboutText}>
            Zeromander is an interactive educational game about electoral redistricting. Gerrymandering — the practice of manipulating electoral district boundaries for political advantage — is a real-world problem that affects representation and fairness in elections.
          </p>
          <p className={styles.aboutText}>
            In Zeromander, you take control of drawing district maps and learn firsthand how different redistricting strategies affect election outcomes, efficiency gaps, and democratic representation. Discover the power and responsibility of the redistricting process.
          </p>
          <p className={styles.aboutText}>
            <strong>Zeromander is strictly nonpartisan.</strong> Every party in the game is fictional, and the game makes no argument about who gerrymanders — because the answer is: whoever holds the pen. Gerrymandering is a structural flaw, not a partisan one; in the Daily Heist you're assigned a different side each day, so over any week you'll rig the map for both. The lesson isn't "they cheat" — it's "the same votes can produce opposite outcomes depending on who draws the lines."
          </p>
          <p className={styles.aboutText}>
            <strong>The math is not ours.</strong> The fairness metrics come from the redistricting literature: the efficiency gap (<a href="https://chicagounbound.uchicago.edu/uclrev/vol82/iss2/4/" target="_blank" rel="noopener noreferrer">Stephanopoulos &amp; McGhee, 2015</a>), Polsby-Popper compactness (1991), and seats–votes asymmetry. The "neutral map" baseline is drawn by a party-blind algorithm in the spirit of the ensemble methods popularized by the <a href="https://mggg.org" target="_blank" rel="noopener noreferrer">MGGG Redistricting Lab</a>. Every metric's source is cited in-game next to the number it explains.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <h2>How it Works</h2>
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Icon name="ballot" size={36} /></div>
              <h3>Electoral Redistricting</h3>
              <p>Draw district boundaries on an interactive map and watch how it affects election outcomes in real-time</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Icon name="chart" size={36} /></div>
              <h3>Real-time Metrics</h3>
              <p>Monitor live statistics including efficiency gap, compactness, competitiveness, and partisan asymmetry</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Icon name="target" size={36} /></div>
              <h3>Multiple Game Modes</h3>
              <p>Scale from small maps to sprawling ones, or add a third party to the race and explore coalition dynamics beyond two-party politics</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Icon name="scale" size={36} /></div>
              <h3>Fair Representation</h3>
              <p>Learn the principles of fair electoral representation and how to evaluate district fairness</p>
            </div>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className={styles.steps}>
        <div className={styles.container}>
          <h2>Get Started</h2>
          <div className={styles.stepGrid}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>1</div>
              <h3>Generate a Map</h3>
              <p>Choose your difficulty level and customize the population distribution to create your game scenario</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>2</div>
              <h3>Draw Districts</h3>
              <p>Click on counties to assign them to electoral districts and design your map strategically</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>3</div>
              <h3>Analyze Results</h3>
              <p>Review the metrics and statistics to evaluate the fairness and effectiveness of your redistricting</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.finalCta}>
        <div className={styles.container}>
          <h2>Ready to Redistrict?</h2>
          <p>Start playing and learn about electoral fairness through hands-on experience</p>
          <Link to="/game" className={styles.ctaButtonLarge}>
            Play Now
          </Link>
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
