// Board generation — the vote-share honesty invariant.
//
// TARGET T1 (MODEL-SPECS, Spec 5): "Displayed vote share within 0.14pp of
// target (existing invariant)."
//
// Why it matters: the UI tells the player "X% of the vote", and the whole
// premise — same voters, opposite outcomes, depending on who draws the lines —
// collapses if that number is a lie. The generator earns it with two corrective
// share passes (mapGenerator.js): pass 1 fits on tier midpoints, pass 2 lands
// the real share after densities are rolled.
//
// This target predates Beta and must survive it: the check runs against
// whatever the generator currently is, so it guards v1 today and v2 after the
// cutover. If board generation v2 (Spec 5) ever fails this, the share passes
// broke — that is a bug, not a target to renegotiate.
//
// Measured on v1 at implementation time: worst deviation 0.0751pp across 80
// boards (40 days × 2 tiers) — comfortable headroom under the 0.14pp line.

import { buildDailyBoards } from '../lib/board.mjs';
import { getPopulationShares } from '../../src/utils/gameLogic.js';

export const spec = 'Spec 5 · T1 — displayed vote share is honest';

const THRESHOLD_PP = 0.14;

// A fixed date span, not a random sample: the harness must be deterministic, and
// these dates cover both tiers, both assigned parties (party sets bluePercentage,
// so blue and red days are different boards) and the full 38–48% split band.
const DATES = [
  '2026-07-02', '2026-07-05', '2026-07-07', '2026-07-08', '2026-07-11',
  '2026-07-12', '2026-07-14', '2026-07-16', '2026-07-17', '2026-07-21',
];

export function run({ assert }) {
  let worst = { dev: -1 };
  let boards = 0;

  for (const date of DATES) {
    const built = buildDailyBoards(date);
    for (const tier of ['small', 'full']) {
      const target = built[tier].config.bluePercentage;
      const actual = getPopulationShares(built[tier].pop).blue;
      const dev = Math.abs(actual - target);
      boards++;
      if (dev > worst.dev) worst = { dev, date, tier, target, actual };
    }
  }

  assert.ok(
    `worst vote-share deviation across ${boards} boards is within ${THRESHOLD_PP}pp`,
    worst.dev <= THRESHOLD_PP,
    `worst ${worst.dev.toFixed(4)}pp — ${worst.date} ${worst.tier}: target ${worst.target}%, actual ${worst.actual.toFixed(4)}%`
  );

  // The share passes are also the thing that keeps the daily's "seats stolen"
  // comparable between players, so a systematic bias (always overshooting) would
  // matter even inside the tolerance. Assert the deviation is genuinely small,
  // not merely under the line by luck.
  assert.range('worst deviation leaves headroom (not hugging the threshold)', worst.dev, 0, THRESHOLD_PP * 0.8, 'pp');
}
