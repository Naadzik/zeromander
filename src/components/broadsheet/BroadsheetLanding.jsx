import { Link } from 'react-router-dom'
import DailySpecimen from '../DailySpecimen'
import Icon from '../ui/Icons'
import { useTheme, NEXT_LABEL } from '../../hooks/useTheme'
import { useBetaCountdown, BETA_DATE_LABEL } from '../../hooks/useBetaCountdown'
import '../../styles/broadsheet.css'

// The Broadsheet edition's front page — a newspaper cover, not a marketing
// splash. Same masthead + type system as the /game Broadsheet so cycling
// editions on the landing feels like turning to the same paper's cover.
// Pure presentation; Landing.jsx owns the daily data, redirect, and streak.
export default function BroadsheetLanding({ daily, dailyCta, dailyHref, lessonDone, streak, best, countdown }) {
  const { edition, cycleEdition } = useTheme();
  const beta = useBetaCountdown();
  const dateline = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="paper-page paper-front">
      <header className="paper-masthead paper-front__masthead">
        <div className="paper-folio">
          <span>{dateline}</span>
          <span>MORNING EDITION · No. {daily.dayNumber}</span>
          <span>PRICE: FREE — LIKE MOST BAD MAPS</span>
        </div>
        <h1 className="paper-nameplate paper-front__nameplate">The Zeromander</h1>
        <div className="paper-front__slogan-row">
          <span className="paper-front__motto">“All the districts fit to rig”</span>
          <span className="paper-mast-actions">
            <button className="paper-agate-link" onClick={cycleEdition}>{NEXT_LABEL[edition]}</button>
            <a className="paper-agate-link" href="https://github.com/Naadzik/zeromander" target="_blank" rel="noopener noreferrer">GitHub</a>
          </span>
        </div>
      </header>

      {/* The cutover notice, set as a front-page stop-press rule. Same facts
          as BetaCountdown, in the paper's voice; vanishes on the day. */}
      {beta.active && (
        <aside className="paper-front__bulletin">
          <span className="paper-front__bulletin-slug">Stop Press</span>
          <p className="paper-front__bulletin-body">
            <strong>New presses arrive {BETA_DATE_LABEL} — in {beta.label}.</strong>{' '}
            From that morning the maps are drawn on a new model: cities that thin out the way
            real ones do, a countryside that isn't uniformly one colour, and a fairness
            baseline struck from twenty-five neutral maps rather than one. Every back number
            prints exactly as it did — no streak, no filed result and no shared link is
            disturbed. <Link to="/methodology" className="paper-agate-link">See the full notice →</Link>
          </p>
        </aside>
      )}

      {/* Lead story: headline + the day's real board as the front-page engraving */}
      <section className="paper-front__lead">
        <div className="paper-front__story">
          <p className="paper-kicker">Daily Heist No. {daily.dayNumber} — one board, everyone, one attempt</p>
          <h2 className="paper-front__hed">Whoever Draws the Map Wins the Election</h2>
          <p className="paper-byline">By the Redistricting Desk · Filed from the sandbox</p>
          <p className="paper-front__lede">
            <span className="paper-front__dropcap">Z</span>eromander is a daily puzzle about
            gerrymandering — the entirely legal art of picking your own voters. Draw the lines.
            Steal the seats. Learn exactly how it is done to you, then do it back.
          </p>
          <blockquote className="paper-front__pull">
            “The vote doesn't decide the election. The lines do.”
          </blockquote>
          <div className="paper-front__cta">
            {!lessonDone ? (
              <>
                <Link to="/game?lesson" className="paper-cta paper-cta--ink">Never gerrymandered? The 60-second lesson →</Link>
                <Link to={dailyHref} className="paper-cta">{dailyCta}</Link>
              </>
            ) : (
              <>
                <Link to={dailyHref} className="paper-cta paper-cta--ink">{dailyCta} →</Link>
                <Link to="/game" className="paper-cta">Open the Sandbox</Link>
              </>
            )}
          </div>
          <p className="paper-front__meta">
            {streak >= 1 ? (
              <>
                <span className="paper-front__streak"><Icon name="flame" size={12} /> {streak}-day streak{best > streak ? ` · best ${best}` : ''}</span>
                {' '}— next edition off the presses in {countdown.label}.
              </>
            ) : best >= 2 ? (
              <>Longest run on record: <strong>{best} days</strong>. Next edition in {countdown.label}.</>
            ) : (
              <>A new front page prints at midnight, UTC — in {countdown.label}. Same board for every reader.</>
            )}
          </p>
        </div>
        <figure className="paper-front__engraving">
          <DailySpecimen size={440} className="paper-front__plate" />
          <figcaption className="paper-plate-caption">
            FIG. 1 — Today's battleground, {daily.small.config.numDistricts} districts to draw.
            Hand-tinted from the returns; identical for every reader until midnight.
          </figcaption>
        </figure>
      </section>

      {/* How the heist works — three ruled columns */}
      <section className="paper-front__method">
        <h3 className="paper-slug">How the heist works — in three moves</h3>
        <div className="paper-front__cols">
          <div className="paper-front__col">
            <span className="paper-front__colnum">I</span>
            <h4 className="paper-front__colhed">Pack</h4>
            <p>Cram your opponents into a few districts they win by a landslide. Every surplus vote past 50% is a vote thrown in the river.</p>
          </div>
          <div className="paper-front__col">
            <span className="paper-front__colnum">II</span>
            <h4 className="paper-front__colhed">Crack</h4>
            <p>Slice the rest of them thin, spread across districts they can never quite win. A permanent minority, one percentage point at a time.</p>
          </div>
          <div className="paper-front__col">
            <span className="paper-front__colnum">III</span>
            <h4 className="paper-front__colhed">Profit</h4>
            <p>Forty-five percent of the vote, sixty percent of the seats. No law broken, no ballot forged. That is precisely the problem.</p>
          </div>
        </div>
      </section>

      {/* Also inside — the other modes as a section index */}
      <section className="paper-front__inside">
        <h3 className="paper-slug">Also in today's edition</h3>
        <ul className="paper-front__index">
          <li>
            <Link to="/game?decade" className="paper-front__index-title">The Decade</Link>
            <span className="paper-front__index-dek">Draw once, then defend the map through ten years of demographic drift.</span>
          </li>
          <li>
            <Link to="/game?scenario=community" className="paper-front__index-title">The Community Scenario</Link>
            <span className="paper-front__index-dek">A neighbourhood that votes together. Keep it whole — or quarter it for sport.</span>
          </li>
          <li>
            <Link to="/game" className="paper-front__index-title">The Sandbox</Link>
            <span className="paper-front__index-dek">Your own state, your own rules. No streak, no scorekeeper, no mercy.</span>
          </li>
        </ul>
      </section>

      {/* The fine print — nonpartisan + methodology, newspaper prose */}
      <section className="paper-front__fineprint">
        <h3 className="paper-slug">The fine print</h3>
        <div className="paper-front__prose">
          <p>
            <strong>The Zeromander is strictly nonpartisan.</strong> Every party in these pages is
            fictional, and the game makes no argument about who gerrymanders — because the answer is:
            whoever holds the pen. In the Daily Heist you are handed a different side each morning, so
            over any week you will rig the map for both. The lesson is not “they cheat.” It is that the
            same votes can produce opposite outcomes depending on who draws the lines.
          </p>
          <p>
            <strong>The math is not ours.</strong> The fairness metrics come from the redistricting
            literature: the efficiency gap, Polsby-Popper compactness, and seats–votes asymmetry. The
            neutral map is drawn by a party-blind algorithm in the spirit of the ensemble methods from
            the MGGG Redistricting Lab. The <Link to="/methodology">full methodology &amp; sources</Link>{' '}
            spell out every metric and citation.
          </p>
        </div>
      </section>

      <footer className="paper-colophon">
        Set in Newsreader &amp; Libre Franklin · Nonpartisan &amp; open source · Fictional parties, real formulas ·{' '}
        <a href="https://github.com/Naadzik/zeromander" target="_blank" rel="noopener noreferrer">GitHub</a>
        {' · '}<Link to="/methodology">Methodology</Link>
      </footer>
    </div>
  );
}
