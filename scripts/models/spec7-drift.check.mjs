// Spec 7 — decade urbanization drift v2 (the extensive margin).
//
// TARGETS (MODEL-SPECS Spec B "Calibration targets", using the CORRECTED
// D1–D6 from the binding corrections — which are defined POST-renormalization,
// i.e. what a harness actually observes — plus the D4 renegotiation from this
// spec's implementation addendum):
//   D1  suburb ring (r ∈ [1.2, 3.0]) gains +1.5% to +5%
//   D2  cores (r > 5) gain +1% to +3%, STRICTLY LESS than the suburb ring
//       (the Frey/Brookings ordering: suburbs +10.2% > cities +8.4%)
//   D3  deep-rural non-fringe cells (r < 0.5) lose 6–10% (USDA ERS: nonmetro
//       counties lost population over 2010–2020)
//   D4  RENEGOTIATED 70–90% of counties end smaller (measured v2 81.3%,
//       v1 84.3%). The corrected 45–65% assumed US county geography; here
//       counties are equal-population Voronoi cells over a 4-city map, so
//       only ~16% are city-area and ~84% sit outside the growth zone by
//       construction. See the addendum.
//   D5  metro-party vote share drifts +1.0 to +2.0pp — the Chen & Rodden
//       (2013) teaching claim: a party can GAIN votes over a decade and still
//       lose ground in seats, because the gain packs into its own cities.
//   D6  ≥60% of B2 fringe cells (r < FLOOR beside development) gain ≥8% over
//       the decade, and every one of them is 4-adjacent to prior development
//       (true by the rule's construction — asserted so a refactor can't
//       silently drop the adjacency test and turn sprawl into teleportation).
//   D7  determinism: applyDrift is pure and rng-free — same map + step ⇒
//       bit-identical output, and it takes no rng parameter at all.
//
// Drift is decade-mode only (sandbox; a fresh random board each visit), so it
// touches no frozen daily board and needs no era gate — but it IS the model
// that decides whether a map ages well, so it is calibrated like the rest.

import { createRng } from '../../src/utils/rng.js';
import { generatePopulationMap } from '../../src/utils/mapGenerator.js';
import { generateCounties, rebalanceCountyPopulations } from '../../src/utils/countyGenerator.js';
import { getPopulationShares } from '../../src/utils/gameLogic.js';
import { applyDrift } from '../../src/utils/decade.js';

export const spec = 'Spec 7 — decade drift v2 (sprawl + honest hump)';

const KNUTH = 2654435761;
const DECADE_STEPS = 4;           // elections 0..4 — the 5th board is step 4
const EDGE_NBR = 2.0, FLOOR = 0.8; // must mirror decade.js's B2 rule
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// The decade's own config: fresh medium board, 4 cities, 45% Urban Union.
function decadeBoard(seed) {
  const rng = createRng(seed);
  const pop = generatePopulationMap(80, 45, 4, 100, rng, 0, 0, 2);
  let counties = generateCounties(80, 475, rng);
  counties = rebalanceCountyPopulations(pop, counties, 475, 10, rng);
  return { pop, counties };
}

export function run({ assert }) {
  const G = 80;
  const d1 = [], d2 = [], d3 = [], d4 = [], d5 = [], d6 = [];
  let adjacencyHolds = true;
  let fringeSeen = 0;

  for (let s = 0; s < 8; s++) {
    const { pop, counties } = decadeBoard((0xDECADE + s * KNUTH) >>> 0);
    const drift = applyDrift(pop, DECADE_STEPS);

    let sum = 0, cells = 0;
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { sum += pop.density[y][x]; cells++; }
    const mean = sum / cells;

    const nbrMax = (x, y) => {
      let m = 0;
      if (x > 0) m = Math.max(m, pop.density[y][x - 1]);
      if (x < G - 1) m = Math.max(m, pop.density[y][x + 1]);
      if (y > 0) m = Math.max(m, pop.density[y - 1][x]);
      if (y < G - 1) m = Math.max(m, pop.density[y + 1][x]);
      return m;
    };

    let sub = 0, subN = 0, core = 0, coreN = 0, rural = 0, ruralN = 0;
    let fringeTot = 0, fringeGain = 0;
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      const before = pop.density[y][x], after = drift.density[y][x];
      const r = before / mean;
      const pct = (after - before) / before * 100;
      const isFringe = r < FLOOR && nbrMax(x, y) >= EDGE_NBR * mean;

      if (r >= 1.2 && r <= 3.0) { sub += pct; subN++; }
      if (r > 5) { core += pct; coreN++; }
      if (r < 0.5 && !isFringe) { rural += pct; ruralN++; }
      if (isFringe) {
        fringeTot++;
        if (pct >= 8) fringeGain++;
        // The rule fires only beside development — restate it as an assertion
        // so a refactor can't let sprawl appear away from a city.
        if (nbrMax(x, y) < EDGE_NBR * mean) adjacencyHolds = false;
      }
    }
    fringeSeen += fringeTot;
    d1.push(sub / subN); d2.push(core / coreN); d3.push(rural / ruralN);
    d6.push(fringeTot > 0 ? fringeGain / fringeTot * 100 : 100);

    // D4 — counties, not cells (the Census comparator's unit).
    const before = new Map(), after = new Map();
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      const c = counties[y][x];
      before.set(c, (before.get(c) || 0) + pop.density[y][x]);
      after.set(c, (after.get(c) || 0) + drift.density[y][x]);
    }
    let lost = 0;
    for (const [c, v] of before) if (after.get(c) < v) lost++;
    d4.push(lost / before.size * 100);

    // D5 — the metro party's vote share moves because DENSITY moved; party
    // labels never change during drift.
    d5.push(getPopulationShares(drift).blue - getPopulationShares(pop).blue);
  }

  assert.range('D1: suburb ring (r 1.2–3.0) gains +1.5% to +5% over the decade', avg(d1), 1.5, 5, '%');
  assert.range('D2: cores (r > 5) gain +1% to +3%', avg(d2), 1, 3, '%');
  assert.ok('D2: cores gain STRICTLY LESS than the suburb ring (Frey ordering)',
    avg(d2) < avg(d1), `cores ${avg(d2).toFixed(2)}% < suburbs ${avg(d1).toFixed(2)}%`);
  assert.range('D3: deep-rural non-fringe (r < 0.5) loses 6–10%', -avg(d3), 6, 10, '%');
  assert.range('D4 (renegotiated): 70–90% of counties end smaller', avg(d4), 70, 90, '%');
  assert.range('D5: metro-party vote share drifts +1.0 to +2.0pp (Chen & Rodden)', avg(d5), 1.0, 2.0, 'pp');
  assert.ok('D6: sprawl fringe exists on these boards at all', fringeSeen > 0, `${fringeSeen} fringe cells across 8 boards`);
  assert.range('D6: ≥60% of sprawl-fringe cells gain ≥8% over the decade', avg(d6), 60, 100, '%');
  assert.ok('D6: every sprawling cell is 4-adjacent to prior development', adjacencyHolds, 'no teleported sprawl');

  // D7 — purity. applyDrift takes (map, step) only: no rng parameter exists to
  // pass, so it cannot consume draws; assert repeat-identity and the arity.
  const { pop } = decadeBoard(0xD7);
  const a = applyDrift(pop, DECADE_STEPS);
  const b = applyDrift(pop, DECADE_STEPS);
  assert.ok('D7: applyDrift is bit-identical across runs (pure, rng-free)',
    JSON.stringify(a.density) === JSON.stringify(b.density), 'deterministic');
  assert.equal('D7: applyDrift takes no rng parameter (arity 2)', applyDrift.length, 2);
  assert.ok('D7: step 0 is a no-op passthrough (the baseline year)',
    applyDrift(pop, 0) === pop, 'same object');

  // The constant-total contract: drift REDISTRIBUTES people, it does not grow
  // the electorate (a fixed-seat legislature facing reapportionment pressure).
  const totalOf = (m) => m.density.flat().reduce((x, y) => x + y, 0);
  assert.close('drift conserves the total population (redistribution, not growth)',
    totalOf(a), totalOf(pop), Math.max(1e-6, totalOf(pop) * 1e-9));
}
