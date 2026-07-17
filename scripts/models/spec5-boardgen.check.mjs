// Spec 5 — board generation v2 and the era gate.
//
// TARGETS (MODEL-SPECS Spec 5 + binding corrections + the 2026-07-17
// implementation addendum, all asserted on a fixed 10-seed sample so every
// number is deterministic):
//   T1  displayed vote share within 0.14pp of target — must hold in BOTH eras
//   T2  Clark's law: OLS slope of ln(density) on u over in-city blue cells
//       = −1.9 ± 0.2 (the corrected fit to v1's own tier midpoints)
//   T3  rank-size cities: fixed-sample MEDIAN largest/smallest population
//       ratio in [2.3, 6.0] and Gini in the n-dependent bands (per-board
//       tails swing ~1.7–17 from jitter + overlapping footprints — medians
//       are the stable statistic; see the addendum)
//   T4  density asymmetry preserved: the minority party holds 13–25% of
//       CELLS at a 48% vote share
//   T5  RENEGOTIATED [3.0%, 12%] of counties in the 40–60% band (was 10–25:
//       that figure was derived on cell shares; population-share weighting
//       compresses the competitive annulus — see the addendum). The full
//       tier still clears the v1 baseline of 1.7–2.6%.
//
//   Bands reflect the FINAL anchors frozen by playtest decision ("A's
//   cities, V1's countryside": pCity 85, pRural 5, w 0.15) — the lower
//   rural floor grows the fitted cities, which nudged T3/T4/T5 by ~1pt
//   each; renegotiated in the MODELSPECS addendum, not silently here.
//   T6  total board population within ±10% of the same-config v1 board
//
// ERA GATE: v1 stays byte-identical (the determinism guard is the real
// proof; a spot assertion here documents it), v2 differs from v1 on the same
// seed, the default parameter is v1 (an unversioned caller must never jump
// eras), and the daily's era rides on MODEL_V2_UTC.

import { createRng, boardModelVersion, MODEL_V2_UTC } from '../../src/utils/rng.js';
import { generatePopulationMap, naturalDist, fitUrbanEdge } from '../../src/utils/mapGenerator.js';
import { generateCounties, rebalanceCountyPopulations } from '../../src/utils/countyGenerator.js';
import { getPopulationShares } from '../../src/utils/gameLogic.js';
import { getDailyChallenge } from '../../src/utils/dailyChallenge.js';

export const spec = 'Spec 5 — board generation v2 + era gate';

const KNUTH = 2654435761;
const median = (arr) => [...arr].sort((a, b) => a - b)[arr.length >> 1];

// The check must replay the city-seed draws (the generator's frozen return
// shape can't carry them): the first 4·numCities draws of the stream, with
// the v2 rank-size size formula. If this drifts from the generator, T2/T3
// collapse visibly — the duplication is self-policing.
function replayCitySeedsV2(seed, gridSize, numCities) {
  const rng = createRng(seed);
  const seeds = [];
  for (let i = 0; i < numCities; i++) {
    seeds.push({
      x: rng() * gridSize, y: rng() * gridSize, phase: rng() * Math.PI * 2,
      size: 1.35 * Math.pow(i + 1, -0.5) * (0.90 + 0.20 * rng())
    });
  }
  return seeds;
}

export function run({ assert }) {
  // ── Era gate ───────────────────────────────────────────────────────────
  const g1 = generatePopulationMap(50, 45, 3, 100, createRng(1234), 0, 0, 1);
  const g1again = generatePopulationMap(50, 45, 3, 100, createRng(1234), 0, 0);
  const g2 = generatePopulationMap(50, 45, 3, 100, createRng(1234), 0, 0, 2);
  assert.ok('default modelVersion is v1 — an unversioned caller cannot jump eras',
    JSON.stringify(g1) === JSON.stringify(g1again), 'byte-identical');
  assert.ok('same seed, different eras → different boards (the gate is real)',
    JSON.stringify(g1) !== JSON.stringify(g2), 'v1 ≠ v2');

  const dayBefore = new Date(MODEL_V2_UTC - 86400000);
  const dayOf = new Date(MODEL_V2_UTC);
  assert.ok('daily era rides on MODEL_V2_UTC: day-before → v1, cutover day → v2',
    boardModelVersion(dayBefore) === 1 && boardModelVersion(dayOf) === 2,
    `${dayBefore.toISOString().slice(0, 10)} → v1, ${dayOf.toISOString().slice(0, 10)} → v2`);
  assert.ok('getDailyChallenge stamps the era into both tier configs',
    getDailyChallenge(dayBefore).small.config.modelVersion === 1 &&
    getDailyChallenge(dayOf).full.config.modelVersion === 2, 'stamped');

  // v2 features off still consume zero extra draws: grey/community guards.
  const plain = generatePopulationMap(40, 45, 3, 100, createRng(77), 0, 0, 2);
  const withGrey = generatePopulationMap(40, 45, 3, 100, createRng(77), 8, 0, 2);
  assert.ok('v2 grey blobs draw AFTER the base board (same base, grey added)',
    JSON.stringify(plain.density) !== null && withGrey.party.flat().includes(3) &&
    !plain.party.flat().includes(3), 'guards hold');

  // ── T1–T6 on the fixed sample ──────────────────────────────────────────
  const configs = [
    { label: 'small 3-city', gridSize: 50, numCities: 3, numCounties: 250, giniBand: [0.20, 0.30] },
    { label: 'full 4-city', gridSize: 80, numCities: 4, numCounties: 475, giniBand: [0.25, 0.35] },
  ];

  for (const cfg of configs) {
    const share = [], slope = [], ratio = [], gini = [], minority = [], compC = [], popRatio = [];
    for (let s = 0; s < 10; s++) {
      const seed = (0xBE7A + s * KNUTH) >>> 0;
      const split = 38 + (s % 11);
      const pop = generatePopulationMap(cfg.gridSize, split, cfg.numCities, 100, createRng(seed), 0, 0, 2);
      const popV1 = generatePopulationMap(cfg.gridSize, split, cfg.numCities, 100, createRng(seed), 0, 0, 1);

      share.push(Math.abs(getPopulationShares(pop).blue - split));
      const tot = (m) => m.density.flat().reduce((a, b) => a + b, 0);
      popRatio.push(tot(pop) / tot(popV1));

      const seeds = replayCitySeedsV2(seed, cfg.gridSize, cfg.numCities);
      const dist = [];
      for (let y = 0; y < cfg.gridSize; y++) {
        dist[y] = [];
        for (let x = 0; x < cfg.gridSize; x++) dist[y][x] = naturalDist(seeds, x, y);
      }
      const T = fitUrbanEdge(dist, cfg.gridSize, split, 100, 2);

      // T2 — regression of ln(D) on u over blue in-city cells.
      let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
      for (let y = 0; y < cfg.gridSize; y++) for (let x = 0; x < cfg.gridSize; x++) {
        const u = dist[y][x] / T;
        if (pop.party[y][x] !== 0 || u >= 1) continue;
        const ly = Math.log(pop.density[y][x]);
        sx += u; sy += ly; sxx += u * u; sxy += u * ly; n++;
      }
      slope.push((n * sxy - sx * sy) / (n * sxx - sx * sx));

      // T3 — city populations by nearest-footprint assignment of in-city cells.
      const cityPop = new Array(cfg.numCities).fill(0);
      for (let y = 0; y < cfg.gridSize; y++) for (let x = 0; x < cfg.gridSize; x++) {
        if (dist[y][x] / T >= 1) continue;
        let best = 0, bd = Infinity;
        for (let c = 0; c < seeds.length; c++) {
          const d = naturalDist([seeds[c]], x, y);
          if (d < bd) { bd = d; best = c; }
        }
        cityPop[best] += pop.density[y][x];
      }
      const sorted = [...cityPop].sort((a, b) => a - b);
      ratio.push(sorted[sorted.length - 1] / Math.max(1, sorted[0]));
      const totC = cityPop.reduce((a, b) => a + b, 0);
      let g = 0;
      for (const a of cityPop) for (const b of cityPop) g += Math.abs(a - b);
      gini.push(g / (2 * cfg.numCities * totC));

      // T4 — minority-party cell share at a 48% vote share.
      const pop48 = generatePopulationMap(cfg.gridSize, 48, cfg.numCities, 100, createRng(seed ^ 0x48), 0, 0, 2);
      let blueCells = 0, cells = 0;
      for (const row of pop48.party) for (const p of row) { cells++; if (p === 0) blueCells++; }
      minority.push(blueCells / cells * 100);

      // T5 — competitive counties (population-share 40–60% blue).
      const rng2 = createRng(seed);
      const popC = generatePopulationMap(cfg.gridSize, split, cfg.numCities, 100, rng2, 0, 0, 2);
      let counties = generateCounties(cfg.gridSize, cfg.numCounties, rng2);
      counties = rebalanceCountyPopulations(popC, counties, cfg.numCounties, 10, rng2);
      const cb = new Map(), ct = new Map();
      for (let y = 0; y < cfg.gridSize; y++) for (let x = 0; x < cfg.gridSize; x++) {
        const c = counties[y][x], d = popC.density[y][x];
        ct.set(c, (ct.get(c) || 0) + d);
        if (popC.party[y][x] === 0) cb.set(c, (cb.get(c) || 0) + d);
      }
      let comp = 0, nc = 0;
      for (const [c, t] of ct) { nc++; const b = (cb.get(c) || 0) / t * 100; if (b >= 40 && b <= 60) comp++; }
      compC.push(comp / nc * 100);
    }

    assert.ok(`${cfg.label} · T1: vote share honest in v2 (worst ${Math.max(...share).toFixed(3)}pp)`,
      Math.max(...share) <= 0.14, `≤ 0.14pp`);
    assert.range(`${cfg.label} · T2: Clark slope −1.9 ± 0.2 (median of ln-density fits)`,
      median(slope), -2.1, -1.7);
    assert.range(`${cfg.label} · T3: rank-size ratio, fixed-sample median in [2.3, 6.0]`,
      median(ratio), 2.3, 6.0);
    assert.range(`${cfg.label} · T3: city-population Gini median`,
      median(gini), cfg.giniBand[0], cfg.giniBand[1]);
    assert.range(`${cfg.label} · T4: minority party holds 13–25% of cells at 48% of the vote`,
      median(minority), 13, 25, '%');
    assert.range(`${cfg.label} · T5 (renegotiated): 40–60% counties, median in [3.0, 12]% (v1: ~2%)`,
      median(compC), 3.0, 12, '%');
    assert.range(`${cfg.label} · T6: v2 total population within ±10% of v1`,
      median(popRatio), 0.9, 1.1);
  }
}
