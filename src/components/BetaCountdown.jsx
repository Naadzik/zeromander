import { Link } from 'react-router-dom'
import { useBetaCountdown, BETA_DATE_LABEL } from '../hooks/useBetaCountdown'
import '../styles/BetaCountdown.css'

// The countdown to the Beta board model (broadcast + print editions; the
// Broadsheet renders its own bulletin in the paper's voice).
//
// Deliberately a NOTICE, not a hype banner. What is changing is the thing the
// whole game is measured on, so the honest framing is "here is what changes,
// here is what doesn't" — and the reassurance matters more than the tease:
// past dailies keep regenerating under the old rules forever, so nobody's
// history, streak or shared challenge link breaks on the first.
//
// Renders nothing once the date passes (see useBetaCountdown).
export default function BetaCountdown() {
  const { active, label, days } = useBetaCountdown();
  if (!active) return null;

  return (
    <aside className="beta-countdown" aria-label={`Beta board model arrives ${BETA_DATE_LABEL}`}>
      <div className="beta-countdown__badge">
        <span className="beta-countdown__value">{label}</span>
        <span className="beta-countdown__unit">to Beta</span>
      </div>
      <div className="beta-countdown__body">
        <p className="beta-countdown__hed">
          A new map model arrives {BETA_DATE_LABEL}
          {days <= 1 ? ' — tomorrow' : ''}.
        </p>
        <p className="beta-countdown__dek">
          Cities that thin out like real ones, countryside that isn't uniformly one colour,
          and a fairness baseline drawn from 25 neutral maps instead of one. Earlier boards
          keep their shape — your streak and shared links are untouched.
        </p>
        <Link to="/methodology" className="beta-countdown__link">
          What's changing, in full →
        </Link>
      </div>
    </aside>
  );
}
