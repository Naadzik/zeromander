import { Link } from 'react-router-dom'
import styles from './Landing.module.css'

export default function Landing() {
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
          <Link to="/game" className={styles.ctaButton}>
            Play Now
          </Link>
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
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <h2>How it Works</h2>
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🗳️</div>
              <h3>Electoral Redistricting</h3>
              <p>Draw district boundaries on an interactive map and watch how it affects election outcomes in real-time</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📊</div>
              <h3>Real-time Metrics</h3>
              <p>Monitor live statistics including efficiency gap, compactness, competitiveness, and partisan asymmetry</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🎯</div>
              <h3>Challenge Mode</h3>
              <p>Complete specific challenges with different difficulty levels and constraints to test your redistricting skills</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>⚖️</div>
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
            <p>&copy; 2024 Zeromander. Created with ❤️ for electoral fairness</p>
            <a href="https://github.com/Naadzik/zeromander" target="_blank" rel="noopener noreferrer">
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
