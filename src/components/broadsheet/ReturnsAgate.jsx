import { getDistrictStats } from '../../utils/gameLogic'
import { getPopulationShares } from '../../utils/gameLogic'
import { targetSeatCount } from '../../utils/computeGameStats'
import { extractPopulationData, getCellPopulation } from '../../utils/formatUtils'
import { PARTY } from '../../utils/partyConfig'

// "LATEST RETURNS" — the Broadsheet's agate column. Dense, typeset, live:
// seat tally, target line, one agate row per district (click → highlight on
// the plate) with its POPULATION against the ±10% parity bound — the reader
// must be able to see exactly which district still blocks the presses —
// plus the unclaimed-county link and any rejection notice from the desk.
export default function ReturnsAgate({
  populationMap, districts, numDistricts, isThreeParty, playerParty,
  highlightedDistrict, onDistrictSelect, showUnassignedCounties, onToggleUnassigned,
  lastRejection, greyPercentage,
  // Neutral map's player seats (v2 target = beat it by one); null → fallback.
  // Must match the dashboard's target or the two editions disagree.
  fairSeats = null,
}) {
  if (!populationMap?.party && !populationMap?.length) return null;
  const rows = getDistrictStats(populationMap, districts, numDistricts, isThreeParty);
  const shares = getPopulationShares(populationMap);
  const greyShare = shares.grey ?? 0;
  const ourShare = (shares[playerParty] ?? 0) * (1 - greyShare / 100);
  const target = targetSeatCount(ourShare, numDistricts, fairSeats);

  // Population parity: one pass over the grid — per-district resident counts
  // (undecideds count as people even before they vote) + the state total.
  const { densityMap } = extractPopulationData(populationMap);
  const gridSize = districts.length;
  const pops = new Array(numDistricts + 1).fill(0);
  let totalPop = 0, unassignedCells = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const pop = getCellPopulation(densityMap, y, x);
      totalPop += pop;
      const d = districts[y][x];
      if (d >= 1 && d <= numDistricts) pops[d] += pop;
      else unassignedCells++;
    }
  }
  const fair = totalPop / numDistricts;
  const lo = Math.floor(fair * 0.9);
  const hi = Math.ceil(fair * 1.1);
  // 'empty' | 'light' (needs more people) | 'heavy' (too many) | 'ok'
  const parity = id => pops[id] === 0 ? 'empty' : pops[id] < lo ? 'light' : pops[id] > hi ? 'heavy' : 'ok';
  const outOfBounds = rows.filter(r => parity(r.id) === 'light' || parity(r.id) === 'heavy').length;

  let ourSeats = 0;
  for (const r of rows) {
    if (r.winner === playerParty && r.total > 0) ourSeats++;
  }

  const p = PARTY[playerParty];
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const PARITY_MARK = { ok: '✓', light: '▽', heavy: '▲', empty: '' };
  const PARITY_TITLE = {
    ok: 'Within the ±10% population bound',
    light: `Under the bound — needs at least ${fmt(lo)} residents`,
    heavy: `Over the bound — at most ${fmt(hi)} residents`,
    empty: 'Not yet drawn',
  };

  return (
    <section className="paper-agate-box" aria-label="Latest returns">
      <h3 className="paper-agate-head">Latest Returns</h3>
      <p className="paper-agate-tally">
        <strong style={{ color: p.cssColor }}>{ourSeats}</strong> of {numDistricts} seats lean {p.shortLabel} ·
        target <strong>{target}</strong>
        {greyShare > 0.5 ? <> · {Math.round(greyShare)}% undecided</> : null}
      </p>
      <p className="paper-agate-tally">
        Each district must hold <strong>{fmt(lo)}–{fmt(hi)}</strong> residents
        {outOfBounds > 0 && <span className="paper-parity-alert"> · {outOfBounds} outside the bound</span>}
      </p>
      {/* Visible legend — the hover titles have no touch equivalent. */}
      <p className="paper-agate-foot paper-parity-legend">✓ within bound · ▽ needs residents · ▲ over</p>
      <table className="paper-agate-table">
        <thead>
          <tr><th>Dist.</th><th>U.U.</th><th>H.A.</th>{isThreeParty && <th>F.C.</th>}<th>Pop.</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const st = parity(r.id);
            return (
              <tr
                key={r.id}
                className={highlightedDistrict === r.id ? 'is-lit' : ''}
                onClick={() => onDistrictSelect(highlightedDistrict === r.id ? null : r.id)}
              >
                <td>D{r.id}</td>
                <td>{r.total ? fmt(r.blue) : '—'}</td>
                <td>{r.total ? fmt(r.red) : '—'}</td>
                {isThreeParty && <td>{r.total ? fmt(r.green) : '—'}</td>}
                <td className={`paper-parity paper-parity--${st}`} title={PARITY_TITLE[st]}>
                  {st === 'empty' ? '—' : <>{fmt(pops[r.id])} {PARITY_MARK[st]}</>}
                </td>
                <td className="paper-agate-lead">
                  {r.total > 0 && <span className="paper-lead-dot" data-party={r.winner} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="paper-agate-foot">
        {unassignedCells > 0
          ? <button className="paper-agate-link" onClick={onToggleUnassigned}>
              {showUnassignedCounties ? 'Hide' : 'Show'} unclaimed territory
            </button>
          : 'All territory claimed.'}
      </p>
      {lastRejection && (
        <p className="paper-agate-notice">CORRECTION — {lastRejection.message}</p>
      )}
    </section>
  );
}
