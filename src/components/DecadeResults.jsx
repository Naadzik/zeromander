import { useState, useEffect } from 'react'
import { PARTY } from '../utils/partyConfig'
import '../styles/DecadeResults.css'

// A decade played out one election at a time, broadcast-style, then a verdict.
// `result` is a runDecade() return; `best` is the prior best-decade record (or
// null); `isNewBest` flags a record-beating run.
function verdict(heldMajority, total) {
  const frac = heldMajority / total;
  if (frac === 1) return 'A dynasty. The map held every single election.';
  if (frac >= 0.6) return 'You held the line. The map aged well.';
  if (frac >= 0.4) return 'A decade of trench warfare — traded blows, kept it close.';
  if (frac > 0) return 'A rough decade. The map cracked under the swings.';
  return 'Wiped out. A greedy map that never survived contact with reality.';
}

// "toward blue" is positive; label the beneficiary and flag wave years.
function swingLabel(swingPct) {
  const mag = Math.abs(swingPct).toFixed(1);
  const who = swingPct >= 0 ? PARTY.blue.shortLabel : PARTY.red.shortLabel;
  if (Math.abs(swingPct) < 0.05) return { text: 'Dead even', wave: false, who: null };
  return { text: `${who} +${mag}`, wave: Math.abs(swingPct) >= 7, who: swingPct >= 0 ? 'blue' : 'red' };
}

export default function DecadeResults({ result, playerParty, numDistricts, best, isNewBest, onNewMap, onBack }) {
  const { elections, totalElections, heldMajority, cumulativeOurSeats, avgSeats, targetSeats } = result;
  const party = PARTY[playerParty];

  // Broadcast beat: reveal elections one by one, then the verdict footer.
  const [shown, setShown] = useState(0);
  const done = shown >= elections.length;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setShown(s => s + 1), shown === 0 ? 500 : 1150);
    return () => clearTimeout(t);
  }, [shown, done]);

  const maxSeats = numDistricts * totalElections;

  return (
    <div className="modal-overlay">
      <div className="modal-content decade-results">
        <div className="decade-head">
          <span className="decade-kicker">The Decade · playing as {party.label}</span>
          <h2>Ten years, one map.</h2>
          <p className="decade-sub">
            You drew the lines once. Then {totalElections} elections rolled through — national
            swings and a slow drift of people toward the cities — on the districts exactly as
            you left them.
          </p>
        </div>

        <div className="decade-timeline">
          {elections.map((e, i) => {
            const s = swingLabel(e.nationalSwing);
            const revealed = i < shown;
            return (
              <div key={e.year} className={`decade-row${revealed ? ' is-in' : ''}${e.won ? ' is-win' : ' is-loss'}`}>
                <span className="decade-year">{e.year}</span>
                <span className={`decade-swing${s.wave ? ' is-wave' : ''}`} data-who={s.who || ''}>
                  {s.wave && <span className="wave-badge">WAVE</span>}
                  {s.text}
                </span>
                <span className="decade-seats">
                  <strong style={{ color: party.color }}>{e.ourSeats}</strong>
                  <span className="decade-seats-sep">/ {numDistricts}</span>
                </span>
                <span className="decade-outcome">{e.won ? 'HELD' : 'LOST'}</span>
              </div>
            );
          })}
        </div>

        {done && (
          <div className="decade-verdict is-in">
            <p className="decade-verdict-line">{verdict(heldMajority, totalElections)}</p>
            <div className="decade-scorecard">
              <div className="decade-stat">
                <span className="decade-stat-num">{heldMajority}<span className="decade-stat-den">/{totalElections}</span></span>
                <span className="decade-stat-label">majorities held (≥{targetSeats})</span>
              </div>
              <div className="decade-stat decade-stat--hero">
                <span className="decade-stat-num">{cumulativeOurSeats}<span className="decade-stat-den">/{maxSeats}</span></span>
                <span className="decade-stat-label">cumulative seats</span>
              </div>
              <div className="decade-stat">
                <span className="decade-stat-num">{avgSeats}</span>
                <span className="decade-stat-label">avg seats / election</span>
              </div>
            </div>

            <p className="decade-best">
              {isNewBest
                ? <><strong className="decade-best-flag">★ New best decade!</strong> {cumulativeOurSeats} cumulative seats.</>
                : best
                  ? <>Your best decade: <strong>{best.cumulativeOurSeats}</strong> seats ({best.heldMajority}/{best.totalElections} majorities).</>
                  : null}
            </p>

            <div className="decade-actions">
              <button className="btn-primary" onClick={onNewMap}>Draw a new map</button>
              <button className="btn-secondary" onClick={onBack}>Back to menu</button>
            </div>
          </div>
        )}

        {!done && (
          <button className="decade-skip" onClick={() => setShown(elections.length)}>Skip ahead ›</button>
        )}
      </div>
    </div>
  );
}
