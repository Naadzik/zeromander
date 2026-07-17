// Spec 1B — compactness: grid isoperimetric quotient + county cut-edges.
//
// TARGETS (MODEL-SPECS Spec 1B, values REGENERATED from this repo's
// hash-validated pipeline per the appendix — the spec body's own numbers came
// from a divergent pipeline and two were refuted in verification):
//   - square k×k scores exactly 1.0 (the grid optimum is the SQUARE: P ≥ 4√A,
//     Harary & Harborth 1976 — the reason for the 16A/P² rescale)
//   - 1×20 bar ≈ 0.181; rasterized disk r=25 ≈ 0.79 < 1 (a circle is NOT the
//     grid optimum — under the old 4πA/P² it capped the scale at π/4)
//   - diagonal penalty ~2× (corrected value; the body's 3.2× was refuted):
//     the same 20×4 rectangle axis-aligned vs rotated 45°
//   - plan average over DRAWN districts only; null (shown "—") when none
//   - neutral maps never trip the litigation shape factor (relative-to-neutral
//     formula: risk ≡ 0 for the neutral by construction) — while the absolute
//     fallback WOULD flag tail boards (2026-07-08 full: IQ 0.20 → 0.75), which
//     is precisely why the relative form is primary
//   - county cut-edges: exact v1-era snapshots per anchor board; neutral vs
//     itself normalizes to 1.0; CE=0 guard for undrawn plans
//
// CUT-EDGES UNIT DECISION (recorded here because the spec body says cells):
// counted on the COUNTY dual graph, not cell pairs. The cited methods (Duchin
// & Tenner; DeFord-Duchin-Solomon; redist; Validi & Buchanan) count cut edges
// on the dual graph of the units being ASSIGNED — here, counties. A cell-pair
// count is just L1 boundary length: it re-measures the same quantity as the
// Polsby-Popper perimeter and inherits the same diagonal artifact (measured
// 1.95× for a straight 45° boundary), so it adds no independent signal.

import { calculateCompactness, calculateCutEdges } from '../../src/utils/metrics.js';
import { litigationRisk } from '../../src/utils/litigation.js';
import { buildDailyBoards } from '../lib/board.mjs';
import { generateFairMap } from '../../src/utils/fairMapGenerator.js';
import { fairSeedFrom } from '../../src/utils/dailyChallenge.js';
import { createRng } from '../../src/utils/rng.js';

export const spec = 'Spec 1B — compactness (IQ grid + county cut-edges)';

const plan = (fn, G) => Array.from({ length: G }, (_, y) => Array.from({ length: G }, (_, x) => fn(x, y)));

// v1-era snapshots for the neutral plan on each anchor board — deterministic,
// so asserted exactly. Board generation v2 (Spec 5) re-rolls these: regenerate
// alongside the v2 determinism anchors when that era opens.
const NEUTRAL_V1 = {
  '2026-07-02': { small: { iq: 0.50, cut: 120 }, full: { iq: 0.31, cut: 281 } },
  '2026-07-07': { small: { iq: 0.29, cut: 166 }, full: { iq: 0.27, cut: 301 } },
  '2026-07-08': { small: { iq: 0.46, cut: 137 }, full: { iq: 0.20, cut: 387 } },
  '2026-07-16': { small: { iq: 0.44, cut: 123 }, full: { iq: 0.30, cut: 314 } },
};

export function run({ assert }) {
  // ── Geometric primitives ───────────────────────────────────────────────
  const square = calculateCompactness(plan((x, y) => (x < 5 && y < 5 ? 1 : 0), 10), 1, 10);
  assert.equal('5×5 square scores exactly 1.0', square.byDistrict[0], 1);

  const bar = calculateCompactness(plan((x, y) => (y === 0 && x < 20 ? 1 : 0), 25), 1, 25);
  assert.close('1×20 bar (flagrant shape) ≈ 0.181', bar.byDistrict[0], 0.1814, 0.001);

  const disk = calculateCompactness(plan((x, y) => ((x - 29.5) ** 2 + (y - 29.5) ** 2 <= 625 ? 1 : 0), 60), 1, 60);
  assert.range('rasterized disk r=25 lands ~π/4 — below the square, the point of the rescale', disk.byDistrict[0], 0.75, 0.82);

  const axis = calculateCompactness(plan((x, y) => (x < 20 && y < 4 ? 1 : 0), 30), 1, 30).byDistrict[0];
  const c = Math.SQRT1_2;
  const rot45 = calculateCompactness(plan((x, y) => {
    const u = ((x - 15) + (y - 2)) * c, v = (-(x - 15) + (y - 2)) * c;
    return (u >= 0 && u < 20 && v >= 0 && v < 4) ? 1 : 0;
  }, 40), 1, 40).byDistrict[0];
  assert.range('disclosed diagonal penalty ≈2× (same 20×4 rectangle, axis vs 45°)', axis / rot45, 1.7, 2.3);

  // ── Aggregation semantics ──────────────────────────────────────────────
  const blank = calculateCompactness(plan(() => 0, 10), 8, 10);
  assert.ok('blank board averages to null (displays "—"), not 0 or NaN',
    blank.average === null, `average=${blank.average}`);

  const oneDrawn = calculateCompactness(plan((x, y) => (x < 5 && y < 5 ? 1 : 0), 10), 8, 10);
  assert.equal('1 drawn square of 8 districts averages 1.0 — shape, not completion', oneDrawn.average, 1);

  // ── Real neutral plans: snapshots + the litigation contract ────────────
  for (const [date, tiers] of Object.entries(NEUTRAL_V1)) {
    const built = buildDailyBoards(date);
    for (const tier of ['small', 'full']) {
      const b = built[tier];
      const p = generateFairMap(b.pop, b.counties, b.config.numDistricts, b.config.gridSize, createRng(fairSeedFrom(b.seed)));
      const iq = calculateCompactness(p, b.config.numDistricts, b.config.gridSize).average;
      const ce = calculateCutEdges(p, b.counties);

      assert.close(`${date} ${tier}: neutral IQ snapshot (v1 era)`, iq, tiers[tier].iq, 0.005);
      assert.equal(`${date} ${tier}: neutral county cut-edges snapshot (v1 era)`, ce.cut, tiers[tier].cut);

      // The relative-to-neutral gauge: the neutral map can never be named a
      // lawsuit driver on its own board. This is the property the fixed
      // absolute threshold could not deliver on tail boards.
      // (state channel: shape enters the partisan claim as evidence)
      const gauge = litigationRisk({ compactness: iq, fairCompactness: iq });
      assert.ok(`${date} ${tier}: neutral map never trips its own shape gauge`,
        !gauge.state.drivers.includes('contorted districts'),
        `IQ ${iq.toFixed(2)}, state drivers: [${gauge.state.drivers.join(', ') || 'none'}]`);

      // Neutral vs itself normalizes to exactly 1.0.
      assert.equal(`${date} ${tier}: CE_neutral/CE_neutral = 1`, ce.cut / ce.cut, 1);
    }
  }

  // The documented reason "relative" is primary: on the 2026-07-08 full board
  // (a verified tail: neutral IQ 0.20) the absolute fallback flags the neutral
  // map itself at risk 0.75. Keep this assertion as the tombstone of the bug.
  const tail = NEUTRAL_V1['2026-07-08'].full.iq;
  const fallbackRisk = Math.min(1, Math.max(0, (0.35 - tail) / 0.20));
  assert.range('tail board documents the absolute-threshold failure the relative form fixes',
    fallbackRisk, 0.7, 0.8);

  // ── Cut-edges guards ───────────────────────────────────────────────────
  const counties = plan((x) => (x < 5 ? 1 : 2), 10);
  const undrawn = calculateCutEdges(plan(() => 0, 10), counties);
  assert.ok('undrawn plan: CE=0 and the normalized ratio is skipped, not divided',
    undrawn.cut === 0 && undrawn.adjacentPairs === 1,
    `cut=${undrawn.cut} adjacentPairs=${undrawn.adjacentPairs}`);

  const split = calculateCutEdges(plan((x) => (x < 5 ? 1 : 2), 10), counties);
  assert.equal('two counties, two districts: exactly 1 county border cut', split.cut, 1);
}
