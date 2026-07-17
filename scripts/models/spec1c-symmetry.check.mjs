// Spec 1C — symmetry family + the v2 win target.
//
// TARGETS (MODEL-SPECS Spec 1C):
//   - Disproportionality (renamed from "Partisan Asymmetry"): formula
//     unchanged, sign preserved in `signedBlue` (+ = blue over-rewarded)
//   - Mean–median (McDonald & Best 2015): MM = median − mean of the player's
//     district two-party shares; + = map leans the player's way; 'n/a' (never
//     guessed) while any district lacks two-party votes; antisymmetric
//     between the parties
//   - Partisan bias at 50% (Gelman & King 1994 / PlanScore): uniform shift to
//     a tied election; seats quantized, exact ties worth half a seat each
//   - Target v2: min(N, fairSeats + 1) — beat the party-blind map by one;
//     proportional fallback when no neutral map is in scope
//   - MM litigation thresholds: 95th/99th percentiles of |MM| across 220 of
//     this game's own neutral maps per board size (scripts/calibrate-mm.mjs).
//     The spec body guessed "amber ~3–5pp"; measured amber is ~14pp — neutral
//     maps on this game's clustered geography carry mean |MM| ≈ 5.5pp (the
//     urban party self-packs: Chen & Rodden's unintentional gerrymandering),
//     so literature-scale thresholds would flag half of all fair maps.
//     A mini-reproduction below pins the calibration pipeline byte-for-byte.
//
// ERA NOTE: real-board snapshots are v1-era; regenerate at the Spec 5 re-roll.

import { createHash } from 'node:crypto';
import { calculatePartisanAsymmetry, calculateMeanMedian, calculateBias50 } from '../../src/utils/metrics.js';
import { targetSeatCount } from '../../src/utils/computeGameStats.js';
import { litigationRisk } from '../../src/utils/litigation.js';
import { calculateSeats } from '../../src/utils/gameLogic.js';
import { buildDailyBoards } from '../lib/board.mjs';
import { generateFairMap } from '../../src/utils/fairMapGenerator.js';
import { fairSeedFrom } from '../../src/utils/dailyChallenge.js';
import { createRng } from '../../src/utils/rng.js';
import { generatePopulationMap } from '../../src/utils/mapGenerator.js';
import { generateCounties, rebalanceCountyPopulations } from '../../src/utils/countyGenerator.js';

export const spec = 'Spec 1C — symmetry family + target v2';

// Equal-turnout board: one row per district, blue share set by cell counts.
function rowBoard(blueCounts, width) {
  const party = [], density = [], districts = [];
  for (let y = 0; y < blueCounts.length; y++) {
    party[y] = []; density[y] = []; districts[y] = [];
    for (let x = 0; x < width; x++) {
      party[y][x] = x < blueCounts[y] ? 0 : 1;
      density[y][x] = 1;
      districts[y][x] = y + 1;
    }
  }
  return { pop: { party, density }, districts, n: blueCounts.length };
}

// v1-era snapshots (measured from the hash-validated pipeline, 2026-07-17):
// the neutral plan's seats for the day's assigned party, hence the v2 target,
// plus its mean–median and tied-election seats.
const NEUTRAL_V1 = {
  '2026-07-08': {
    small: { party: 'red', fairSeats: 4, target: 5, mm: -0.45, bias50: 4 },
    full: { party: 'red', fairSeats: 3, target: 4, mm: 2.22, bias50: 6 },
  },
  '2026-07-16': {
    small: { party: 'red', fairSeats: 4, target: 5, mm: 2.54, bias50: 4 },
    full: { party: 'red', fairSeats: 5, target: 6, mm: -2.24, bias50: 5 },
  },
};

// First 30 |MM| values of the calibrate-mm.mjs N=8 schedule — reproducing
// them pins the calibration pipeline (same seeds, same generator, same MM).
const MINI_CALIB_SHA = 'ec0eb076e2759e755318dbc9a3973f419843998a8f2426bcd3d7699ad171b8f2';

export function run({ assert }) {
  // ── Hand-checkable example: blue packed into one 90% district ──────────
  // Shares [0.4, 0.4, 0.9]: mean 0.5667, median 0.4.
  const packed = rowBoard([4, 4, 9], 10);
  const mmBlue = calculateMeanMedian(packed.pop, packed.districts, 3, 'blue');
  assert.close('MM hand example: blue packed → −16.67pp against blue', mmBlue.mm, -16.6667, 0.001, 'pp');
  const mmRed = calculateMeanMedian(packed.pop, packed.districts, 3, 'red');
  assert.close('MM is antisymmetric between the parties', mmRed.mm, -mmBlue.mm, 1e-9, 'pp');

  // Same board through bias at 50%: V=0.5667, shift −0.0667 → blue keeps only
  // the packed district in a tied election.
  const b50 = calculateBias50(packed.pop, packed.districts, 3, 'blue');
  assert.equal('bias50 hand example: blue wins 1/3 in a tied election', b50.seats50, 1);
  assert.close('bias50 pct = seat share − 50', b50.biasPct, -16.6667, 0.001, 'pp');
  const b50red = calculateBias50(packed.pop, packed.districts, 3, 'red');
  assert.close('bias50 antisymmetric', b50red.biasPct, -b50.biasPct, 1e-9, 'pp');

  // Exactly tied shifted districts are worth half a seat each — the tie rule
  // that keeps the metric antisymmetric.
  const tied = rowBoard([5, 5], 10);
  const tiedBlue = calculateBias50(tied.pop, tied.districts, 2, 'blue');
  const tiedRed = calculateBias50(tied.pop, tied.districts, 2, 'red');
  assert.ok('bias50 exact ties: half a seat each, zero bias both ways',
    tiedBlue.seats50 === 1 && tiedRed.seats50 === 1 && tiedBlue.biasPct === 0 && tiedRed.biasPct === 0,
    `blue ${tiedBlue.seats50}/2 (${tiedBlue.biasPct}pp), red ${tiedRed.seats50}/2 (${tiedRed.biasPct}pp)`);

  // ── Never guess: undefined until every district has two-party votes ────
  const partial = rowBoard([4, 4, 9], 10);
  for (let x = 0; x < 10; x++) partial.districts[2][x] = 0; // undraw district 3
  assert.ok('MM is n/a with an undrawn district',
    calculateMeanMedian(partial.pop, partial.districts, 3, 'blue').valid === false, 'valid=false');
  const grey = rowBoard([4, 4, 9], 10);
  for (let x = 0; x < 10; x++) grey.pop.party[2][x] = 3; // all-grey district
  assert.ok('MM is n/a with an all-grey district (population without votes)',
    calculateMeanMedian(grey.pop, grey.districts, 3, 'blue').valid === false, 'valid=false');

  // ── Disproportionality: renamed, sign preserved ─────────────────────────
  const d = calculatePartisanAsymmetry(packed.pop, packed.districts, 3);
  assert.close('disproportionality |D| unchanged by the rename', d.asymmetry, Math.abs(d.signedBlue), 1e-9, 'pp');
  // Blue: 56.7% of votes but packed into ONE of three districts → 33.3% of
  // seats → UNDER-rewarded → signedBlue < 0. (That packing is the whole point
  // of this example board.)
  assert.ok('signedBlue sign: − = blue under-rewarded (packed)', d.signedBlue < 0,
    `blue ${d.blueVotePercent}% votes → ${d.blueSeatPercent}% seats, signed ${d.signedBlue}pp`);

  // ── Target v2 ───────────────────────────────────────────────────────────
  assert.equal('target = fairSeats + 1 when the neutral map is in scope', targetSeatCount(43, 8, 3), 4);
  assert.equal('target capped at N', targetSeatCount(43, 8, 8), 8);
  assert.equal('fallback keeps the v1 proportional rule', targetSeatCount(43, 8), 4);
  assert.equal('fallback: 20% of 4 districts targets 1, not an unreachable 2', targetSeatCount(20, 4), 1);

  // ── Real boards: v1-era snapshots ───────────────────────────────────────
  for (const [date, tiers] of Object.entries(NEUTRAL_V1)) {
    const built = buildDailyBoards(date);
    for (const tier of ['small', 'full']) {
      const want = tiers[tier];
      const b = built[tier];
      const N = b.config.numDistricts;
      const plan = generateFairMap(b.pop, b.counties, N, b.config.gridSize, createRng(fairSeedFrom(b.seed)));
      const fairSeats = calculateSeats(b.pop, plan, N)[want.party];
      assert.equal(`${date} ${tier}: neutral seats for the day's party (v1 era)`, fairSeats, want.fairSeats);
      assert.equal(`${date} ${tier}: v2 target = neutral + 1`, targetSeatCount(50, N, fairSeats), want.target);
      const mm = calculateMeanMedian(b.pop, plan, N, want.party);
      assert.close(`${date} ${tier}: neutral plan mean–median snapshot`, mm.mm, want.mm, 0.005, 'pp');
      const bias = calculateBias50(b.pop, plan, N, want.party);
      assert.equal(`${date} ${tier}: neutral plan tied-election seats snapshot`, bias.seats50, want.bias50);

      // The gauge contract: a neutral map's own skew never flags — its |MM|
      // sits far below the amber percentile of its own distribution.
      const gauge = litigationRisk({ meanMedian: mm.mm, numDistricts: N });
      assert.ok(`${date} ${tier}: neutral map never trips the skew factor`,
        !gauge.state.drivers.includes('skewed district distribution'),
        `|MM| ${Math.abs(mm.mm).toFixed(2)}pp, state drivers: [${gauge.state.drivers.join(', ') || 'none'}]`);
    }
  }

  // Ramp behavior at the calibrated thresholds (N=10: amber 14.23, red 20.43).
  const below = litigationRisk({ meanMedian: 14.0, numDistricts: 10 });
  const above = litigationRisk({ meanMedian: -21.0, numDistricts: 10 });
  assert.ok('skew below amber does not flag; beyond red flags at full strength (sign-blind)',
    !below.state.drivers.includes('skewed district distribution') && above.state.drivers.includes('skewed district distribution'),
    `14.0pp → [${below.state.drivers.join(', ') || 'none'}]; |−21.0|pp → flagged`);

  // ── Calibration pipeline reproduction (first 30 of 220 N=8 samples) ────
  const vals = [];
  for (let i = 0; i < 30; i++) {
    const seed = (0x5EED1C + i * 2654435761) >>> 0;
    const rng = createRng(seed);
    const pop = generatePopulationMap(50, 38 + (i % 11), 3, 100, rng, 0, 0);
    let counties = generateCounties(50, 250, rng);
    counties = rebalanceCountyPopulations(pop, counties, 250, 10, rng);
    const plan = generateFairMap(pop, counties, 8, 50, createRng(fairSeedFrom(seed)));
    vals.push(Math.abs(calculateMeanMedian(pop, plan, 8, 'blue').mm).toFixed(3));
  }
  const sha = createHash('sha256').update(vals.join(',')).digest('hex');
  assert.ok('MM_THRESHOLDS provenance: calibration schedule reproduces byte-for-byte',
    sha === MINI_CALIB_SHA, `first values ${vals.slice(0, 3).join(', ')}… sha ${sha.slice(0, 12)}…`);
}
