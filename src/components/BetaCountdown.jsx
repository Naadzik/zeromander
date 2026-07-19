import { Link } from 'react-router-dom'
import { useBetaCountdown, BETA_DATE_LABEL, MODEL_DATE_LABEL, modelIsLive } from '../hooks/useBetaCountdown'
import '../styles/BetaCountdown.css'

// The countdown to the Beta launch (broadcast + print editions; the Broadsheet
// renders its own bulletin in the paper's voice).
//
// The copy leads with what is ALREADY TRUE — the new map model is live — and
// counts down to the launch as a date, not as the moment the maps change. That
// distinction is the whole point: the model shipped on 2026-07-19, so a banner
// still promising it "arrives August 1" would be describing something that
// already happened, to players looking at the new boards while they read it.
//
// The reassurance stays, because it is the part that actually affects people:
// past dailies keep regenerating under the old rules forever, so nobody's
// history, streak or shared challenge link broke.
//
// Renders nothing once the date passes (see useBetaCountdown).
export default function BetaCountdown() {
  const { active, label, days } = useBetaCountdown();
  if (!active) return null;

  // The maps and the launch land on different dates, so say which is true now.
  const live = modelIsLive();

  return (
    <aside className="beta-countdown" aria-label={`Zeromander Beta launches ${BETA_DATE_LABEL}`}>
      <div className="beta-countdown__badge">
        <span className="beta-countdown__value">{label}</span>
        <span className="beta-countdown__unit">to Beta</span>
      </div>
      <div className="beta-countdown__body">
        <p className="beta-countdown__hed">
          Beta launches {BETA_DATE_LABEL}
          {days <= 1 ? ' — tomorrow' : ''}.{' '}
          {live ? 'The new maps are already here.' : `The new maps arrive ${MODEL_DATE_LABEL}.`}
        </p>
        <p className="beta-countdown__dek">
          {live ? 'Every board is now drawn on' : `From ${MODEL_DATE_LABEL} every board is drawn on`}
          {' '}the new model: cities that thin out like real ones, countryside that isn't
          uniformly one colour, and a fairness baseline drawn from 25 neutral maps instead of
          one. Earlier boards keep their shape — your streak and shared links are untouched.
        </p>
        <Link to="/methodology" className="beta-countdown__link">
          How the new maps work →
        </Link>
      </div>
    </aside>
  );
}
