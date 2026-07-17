import { useMemo } from 'react'
import { classifyDistricts, getDistrictPopulation } from '../utils/gameLogic'
import { computeCoreStats, targetSeatCount } from '../utils/computeGameStats'
import { extractPopulationData, getCellPopulation } from '../utils/formatUtils'
import { PARITY_AID_PCT } from '../utils/legalConstraints'
import { PARTY } from '../utils/partyConfig'
import '../styles/MobileScoreStrip.css'

// The phone's always-visible scoreboard: one 44px row under the map so the
// full stats panel can stay collapsed while playing. Three cells — seats vs
// target, the district in hand with its parity read, and a map-wide
// parity alert. Tapping it opens the full stats (dashboard: expands the
// rail; paper: scrolls to the agate). Pure memo, no effects.
export default function MobileScoreStrip({
  populationMap, districts, numDistricts, currentDistrict,
  playerParty, isThreeParty, onExpand, variant = 'dashboard',
  // Neutral map's player seats (v2 target = beat it by one); null → fallback.
  // Must match GameStats' target or the strip and the rail disagree.
  fairSeats = null,
}) {
  const data = useMemo(() => {
    if (!populationMap?.party && !populationMap?.length) return null;
    if (!districts?.length) return null;
    const core = computeCoreStats(populationMap, districts, numDistricts, playerParty, isThreeParty);
    const fair = core.mapTotalPop / numDistricts;
    const lo = Math.floor(fair * (1 - PARITY_AID_PCT / 100));
    const hi = Math.ceil(fair * (1 + PARITY_AID_PCT / 100));

    // Seats: risk-aware for 2-party (safe seats + tossups), plain count 3-party.
    let seatLabel, tossups = 0, target;
    if (isThreeParty) {
      seatLabel = `${core.ourSeatCount}/${numDistricts}`;
      target = null;
    } else {
      const classified = classifyDistricts(populationMap, districts, numDistricts);
      const ourSafe = classified.filter(r => r.status === playerParty).length;
      // tossup + uncalled: everything the undecideds could still take away.
      tossups = classified.filter(r => r.status === 'tossup' || r.status === 'uncalled').length;
      const greyShare = core.shares.grey ?? 0;
      target = targetSeatCount((core.shares[playerParty] ?? 0) * (1 - greyShare / 100), numDistricts, fairSeats);
      seatLabel = `${ourSafe}/${numDistricts}`;
    }

    // Current district population vs the parity band + vote split.
    const pop = getDistrictPopulation(populationMap, districts, currentDistrict);
    const parity = pop === 0 ? 'empty' : pop < lo ? 'light' : pop > hi ? 'heavy' : 'ok';
    const d = core.districtStats[currentDistrict - 1] ?? { blue: 0, red: 0 };

    // Map-wide parity alert: how many drawn districts sit outside the band.
    const { densityMap } = extractPopulationData(populationMap);
    const pops = new Array(numDistricts + 1).fill(0);
    const G = districts.length;
    for (let y = 0; y < G; y++)
      for (let x = 0; x < G; x++) {
        const id = districts[y][x];
        if (id >= 1 && id <= numDistricts) pops[id] += getCellPopulation(densityMap, y, x);
      }
    let outOfBounds = 0;
    for (let id = 1; id <= numDistricts; id++)
      if (pops[id] > 0 && (pops[id] < lo || pops[id] > hi)) outOfBounds++;

    return { seatLabel, tossups, target, pop, parity, d, outOfBounds, allDrawn: pops.slice(1).every(p => p > 0) };
  }, [populationMap, districts, numDistricts, currentDistrict, playerParty, isThreeParty, fairSeats]);

  if (!data) return null;
  const p = PARTY[playerParty];
  const MARK = { ok: '✓', light: '▽', heavy: '▲', empty: '·' };
  const fmt = n => Math.round(n).toLocaleString('en-US');

  return (
    <button className={`score-strip score-strip--${variant}`} onClick={onExpand} aria-label="Open full stats">
      <span className="score-strip__cell">
        <strong style={{ color: p.cssColor }}>{data.seatLabel}</strong>
        {data.target != null && <span className="score-strip__sub">→ {data.target}</span>}
        {data.tossups > 0 && <span className="score-strip__chip">+{data.tossups}?</span>}
      </span>
      <span className="score-strip__cell">
        D{currentDistrict} · {data.pop > 0 ? fmt(data.pop) : '—'}
        <span className={`score-strip__parity score-strip__parity--${data.parity}`}> {MARK[data.parity]}</span>
      </span>
      <span className="score-strip__cell">
        {data.outOfBounds > 0
          ? <span className="score-strip__alert">⚠ {data.outOfBounds}</span>
          : data.allDrawn ? <span className="score-strip__ok">✓ parity</span> : <span className="score-strip__sub">stats ›</span>}
      </span>
    </button>
  );
}
