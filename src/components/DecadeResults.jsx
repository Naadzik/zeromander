import { useState, useEffect, useMemo } from 'react'
import { PARTY } from '../utils/partyConfig'
import { applyDrift } from '../utils/decade'
import { getPopulationShares } from '../utils/gameLogic'
import { extractPopulationData } from '../utils/formatUtils'
import { computeCoreStats } from '../utils/computeGameStats'
import GhostMapCanvas from './GhostMapCanvas'
import '../styles/DecadeResults.css'

// A decade played out one election at a time, broadcast-style, then a verdict.
// `result` is a runDecade() return; `best` is the prior best-decade record (or
// null); `isNewBest` flags a record-beating run. `districts`/`counties`/
// `populationMap` let it draw the fixed map coloured by each election's winners.
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

export default function DecadeResults({ result, playerParty, numDistricts, best, isNewBest, onNewMap, onBack, districts, counties, populationMap }) {
  const { elections, totalElections, heldMajority, cumulativeOurSeats, avgSeats, targetSeats } = result;
  const party = PARTY[playerParty];

  // Broadcast beat: reveal elections one by one, then the verdict footer.
  const [shown, setShown] = useState(0);
  const done = shown >= elections.length;

  // Which election's map is on screen. Null = follow the reveal (and, once done,
  // rest on the final year); clicking a revealed year pins it.
  const [selected, setSelected] = useState(null);
  // 'result' = who won each seat; 'population' = where the voters moved.
  const [mapView, setMapView] = useState('result');

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setShown(s => s + 1), shown === 0 ? 500 : 1150);
    return () => clearTimeout(t);
  }, [shown, done]);

  const maxSeats = numDistricts * totalElections;
  const canMap = districts && counties && populationMap;

  const autoIdx = Math.min(elections.length - 1, Math.max(0, shown - 1));
  const displayIdx = selected != null ? selected : (done ? elections.length - 1 : autoIdx);
  const shownE = elections[displayIdx];
  const shownSwing = swingLabel(shownE.nationalSwing);

  // The drifted board for the shown year + the start-year baseline drive the
  // 'People' view (density change) and the urban vote-share readout.
  const baseDensity = useMemo(
    () => (canMap ? extractPopulationData(populationMap).densityMap : null),
    [canMap, populationMap]
  );
  const driftedMap = useMemo(
    () => (canMap ? applyDrift(populationMap, displayIdx) : populationMap),
    [canMap, populationMap, displayIdx]
  );
  const popShift = useMemo(
    () => (canMap ? { base: getPopulationShares(populationMap).blue, now: getPopulationShares(driftedMap).blue } : null),
    [canMap, populationMap, driftedMap]
  );
  // Biggest relative move by the FINAL year — a fixed color scale so the People
  // heat builds across the decade instead of self-scaling each year.
  const popScale = useMemo(() => {
    if (!canMap || !baseDensity) return null;
    const finalD = extractPopulationData(applyDrift(populationMap, elections.length - 1)).densityMap;
    let m = 0;
    for (let y = 0; y < baseDensity.length; y++)
      for (let x = 0; x < baseDensity[y].length; x++) {
        const b = baseDensity[y][x];
        if (b > 0) m = Math.max(m, Math.abs((finalD[y][x] - b) / b));
      }
    return m || null;
  }, [canMap, populationMap, baseDensity, elections.length]);

  // Structural fairness of the map as drawn (2-party) — the "all the stats" read.
  const mapStats = useMemo(
    () => (canMap ? computeCoreStats(populationMap, districts, numDistricts, playerParty, false) : null),
    [canMap, populationMap, districts, numDistricts, playerParty]
  );

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

        {canMap && (
          <div className="decade-stage">
            <div className="decade-view-toggle" role="group" aria-label="Map view">
              <button className={mapView === 'result' ? 'is-active' : ''} onClick={() => setMapView('result')}>Result</button>
              <button className={mapView === 'population' ? 'is-active' : ''} onClick={() => setMapView('population')}>People</button>
            </div>
            <div className="decade-map">
              <GhostMapCanvas
                populationMap={driftedMap}
                counties={counties}
                districts={districts}
                view={mapView === 'population' ? 'population' : 'party'}
                districtWinners={shownE.winners}
                baselineDensity={mapView === 'population' ? baseDensity : null}
                popScale={mapView === 'population' ? popScale : null}
                size={300}
              />
            </div>
            <div className="decade-map-caption">
              <span className="decade-map-year">{shownE.year}</span>
              {mapView === 'result' ? (
                <>
                  <span className={`decade-swing${shownSwing.wave ? ' is-wave' : ''}`} data-who={shownSwing.who || ''}>
                    {shownSwing.wave && <span className="wave-badge">WAVE</span>}
                    {shownSwing.text}
                  </span>
                  <span className="decade-map-seats">
                    <strong style={{ color: party.color }}>{shownE.ourSeats}</strong>/{numDistricts} seats · {shownE.won ? 'held' : 'lost'}
                  </span>
                </>
              ) : (
                <span className="decade-pop-shift">
                  {PARTY.blue.shortLabel} vote share {popShift.base.toFixed(1)}% → <strong>{popShift.now.toFixed(1)}%</strong>
                </span>
              )}
            </div>
            {mapView === 'population' && (
              <div className="decade-pop-legend">
                <span><i className="decade-swatch decade-swatch--gain" /> gained people</span>
                <span><i className="decade-swatch decade-swatch--loss" /> lost people</span>
                <span className="decade-pop-since">vs {elections[0].year}, as cities pull people in</span>
              </div>
            )}
          </div>
        )}

        <div className="decade-timeline">
          {elections.map((e, i) => {
            const s = swingLabel(e.nationalSwing);
            const revealed = i < shown;
            return (
              <button
                type="button"
                key={e.year}
                className={`decade-row${revealed ? ' is-in' : ''}${e.won ? ' is-win' : ' is-loss'}${i === displayIdx ? ' is-selected' : ''}`}
                onClick={revealed ? () => setSelected(i) : undefined}
                disabled={!revealed}
              >
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
              </button>
            );
          })}
          {canMap && done && <p className="decade-scrub-hint">Click a year to replay its map.</p>}
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

            {mapStats && (
              <div className="decade-mapstats">
                <span className="decade-mapstats-label">The map, as drawn</span>
                <div className="decade-mapstats-row">
                  <span>Efficiency gap <strong>{Math.round(mapStats.gap.gap)}%</strong></span>
                  <span>Compactness <strong>{Math.round(mapStats.compactness.average * 100)}%</strong></span>
                  <span>Partisan asymmetry <strong>{Math.round(mapStats.asymmetry.asymmetry)}%</strong></span>
                </div>
              </div>
            )}

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
