// Spec 2 — the 25-map neutral mini-ensemble.
//
// FROZEN CONTRACT (the determinism-protocol set — changing any of these
// silently redefines every player's "seats stolen"):
//   - seed schedule: seed_i = (fairSeedFrom(boardSeed) + i·2654435761) >>> 0.
//     The increment is Knuth's constant, NOT the spec body's 0x9E3779B9 —
//     that constant was refuted in adversarial verification (the reference
//     data was generated with 2654435761).
//   - i = 0 reproduces the v1 pinned map byte-for-byte: the old baseline is
//     the first member of the new one (continuity of the SEED — the
//     displayed ghost usually differs, and may score differently).
//   - N_TARGET 25 (15 on ≥100 grids), MAX_TRIES 60, the ±10%+full-district
//     acceptance rule, the LOWER median, ghost = lowest-seed median member.
//   - the reference ensembles below (2026-07-08 / -16, both tiers).
//
// WHY: the audit measured the single pinned map diverging from the ensemble
// median on ~half of boards, up to 2 seats. The tombstone is 2026-07-08 full:
// pinned map 3 red seats, ensemble median 5, range [3,6] — a player scored
// against the pinned map got +2 "stolen" seats for free. This check
// reproduces that exact case from the audit's own hash-validated data.

import { buildDailyBoards } from '../lib/board.mjs';
import { generateNeutralEnsemble, ensembleTarget, ENSEMBLE_INCREMENT } from '../../src/utils/neutralEnsemble.js';
import { generateFairMap } from '../../src/utils/fairMapGenerator.js';
import { computePopulationDeviation } from '../../src/utils/legalConstraints.js';
import { fairSeedFrom, buildDailyResult } from '../../src/utils/dailyChallenge.js';
import { createRng } from '../../src/utils/rng.js';
import { calculateSeats } from '../../src/utils/gameLogic.js';

export const spec = 'Spec 2 — neutral ensemble baseline';

// v2-era reference ensembles (generated from this repo's hash-validated
// pipeline, 2026-07-17). Frozen: these ARE the score baseline for these
// boards, forever.
const REFERENCE = {
  '2026-07-08': {
    small: { median: 3, min: 2, max: 4, n: 25, ghostIdx: 1, histogram: { 2: 2, 3: 11, 4: 12 } },
    full: { median: 5, min: 3, max: 6, n: 25, ghostIdx: 2, histogram: { 3: 2, 4: 4, 5: 18, 6: 1 } },
  },
  '2026-07-16': {
    small: { median: 3, min: 2, max: 5, n: 25, ghostIdx: 1, histogram: { 2: 3, 3: 12, 4: 8, 5: 2 } },
    full: { median: 4, min: 3, max: 5, n: 25, ghostIdx: 2, histogram: { 3: 5, 4: 10, 5: 10 } },
  },
};

export function run({ assert }) {
  assert.equal('N_TARGET is 25 on standard boards', ensembleTarget(80), 25);
  assert.equal('N_TARGET drops to 15 on 100-grids (mobile budget)', ensembleTarget(100), 15);
  assert.equal('schedule increment is Knuth\'s constant (spec-body 0x9E3779B9 was refuted)', ENSEMBLE_INCREMENT, 2654435761);

  for (const [date, tiers] of Object.entries(REFERENCE)) {
    const built = buildDailyBoards(date);
    for (const tier of ['small', 'full']) {
      const want = tiers[tier];
      const b = built[tier];
      const N = b.config.numDistricts;
      const base = fairSeedFrom(b.seed);
      const ens = generateNeutralEnsemble(b.pop, b.counties, N, b.config.gridSize, base, built.party, false);

      // The frozen score baseline.
      assert.equal(`${date} ${tier}: ensemble median (THE baseline)`, ens.median, want.median);
      assert.ok(`${date} ${tier}: range and size frozen`,
        ens.min === want.min && ens.max === want.max && ens.n === want.n,
        `[${ens.min},${ens.max}] n=${ens.n} vs [${want.min},${want.max}] n=${want.n}`);
      assert.ok(`${date} ${tier}: seat histogram frozen`,
        JSON.stringify(ens.histogram) === JSON.stringify(want.histogram),
        JSON.stringify(ens.histogram));

      // Ghost invariants: the displayed map's seats ALWAYS equal the score
      // baseline, and it is the lowest-seed member that does.
      assert.equal(`${date} ${tier}: ghost member index`, ens.ghostSeedIndex, want.ghostIdx);
      const ghostSeats = calculateSeats(b.pop, ens.ghostDistricts, N, false)[built.party];
      assert.equal(`${date} ${tier}: ghost seats == median (the map on screen shows the baseline)`, ghostSeats, ens.median);
      const firstMedianIdx = ens.seedIndices[ens.seatsList.findIndex(s => s === ens.median)];
      assert.equal(`${date} ${tier}: ghost is the LOWEST-seed median member`, ens.ghostSeedIndex, firstMedianIdx);

      // Seed-schedule continuity: member i=0 is the v1 pinned map, byte-identical.
      const pinned = generateFairMap(b.pop, b.counties, N, b.config.gridSize, createRng(base));
      const member0 = generateFairMap(b.pop, b.counties, N, b.config.gridSize, createRng((base + 0 * ENSEMBLE_INCREMENT) >>> 0));
      assert.ok(`${date} ${tier}: member i=0 IS the v1 pinned map`,
        JSON.stringify(member0) === JSON.stringify(pinned), 'byte-identical');
    }
  }

  // The tombstone: on 2026-07-08 full the v1 pinned baseline (3 seats) sat 2
  // seats below the ensemble median (5) — the measured arbitrariness that
  // motivated the ensemble. Keep it asserted so nobody "simplifies" back.
  const b0708 = buildDailyBoards('2026-07-08').full;
  const pinnedSeats = calculateSeats(
    b0708.pop,
    generateFairMap(b0708.pop, b0708.counties, 10, 80, createRng(fairSeedFrom(b0708.seed))),
    10, false
  ).red;
  assert.ok('tombstone: the single pinned map diverged from the median by 2 seats (2026-07-08 full)',
    pinnedSeats === 3 && REFERENCE['2026-07-08'].full.median === 5,
    `pinned ${pinnedSeats} vs median ${REFERENCE['2026-07-08'].full.median}, range [3,6]`);

  // Acceptance rule: every member obeys the SAME ±10% two-sided parity rule
  // that binds the player, and fields every district. (Re-derived from the
  // seed schedule on the small tier — cheap; the rule is tier-independent.)
  const bSmall = buildDailyBoards('2026-07-16').small;
  const ensSmall = generateNeutralEnsemble(bSmall.pop, bSmall.counties, 8, 50, fairSeedFrom(bSmall.seed), 'red', false);
  let allLegal = true;
  for (const idx of ensSmall.seedIndices) {
    const d = generateFairMap(bSmall.pop, bSmall.counties, 8, 50, createRng((fairSeedFrom(bSmall.seed) + idx * ENSEMBLE_INCREMENT) >>> 0));
    if (!computePopulationDeviation(bSmall.pop, d, 8, 10).pass) allLegal = false;
  }
  assert.ok('every accepted member obeys the player\'s own ±10% parity rule', allLegal,
    `${ensSmall.seedIndices.length} members re-derived from the schedule`);

  // Record shape: the daily result is v2 with the ensemble context, additive.
  const rec2 = buildDailyResult({
    date: '2026-07-16', dayNumber: 16, party: 'red',
    playerCore: { ourSeatCount: 6, ourPopPercent: 43 },
    fairCore: { ourSeatCount: 5 },
    districtBreakdown: null, numDistricts: 10,
    ensemble: { median: 5, min: 3, max: 5, n: 25 },
  });
  assert.ok('daily record v2: median baseline + additive ensemble fields',
    rec2.v === 2 && rec2.neutralSeats === 5 && rec2.seatsStolen === 1 &&
    rec2.neutralMin === 3 && rec2.neutralMax === 5 && rec2.ensembleN === 25,
    JSON.stringify({ v: rec2.v, neutralSeats: rec2.neutralSeats, stolen: rec2.seatsStolen, min: rec2.neutralMin, max: rec2.neutralMax, n: rec2.ensembleN }));
  const rec1 = buildDailyResult({
    date: '2026-07-16', dayNumber: 16, party: 'red',
    playerCore: { ourSeatCount: 6, ourPopPercent: 43 },
    fairCore: { ourSeatCount: 5 },
    districtBreakdown: null, numDistricts: 10,
  });
  assert.ok('without ensemble context the record stays v1 (no phantom fields)',
    rec1.v === 1 && rec1.neutralMin === undefined, `v=${rec1.v}`);
}
