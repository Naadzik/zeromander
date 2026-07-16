// Spec 1A — efficiency gap: signed, seats-denominated, canonical.
//
// TARGETS (MODEL-SPECS, Spec 1A "CALIBRATION TARGETS"):
//   1. game vs canonical signed form agree within 0.05pp
//   2. full-vs-shortcut divergence on generated boards ~1pp — the disclosed
//      magnitude, and the reason the full wasted-votes form is used at all
//   3. neutral-baseline EG on daily full boards can reach ~13% (measured 12.71%)
//
// Target 3 is the audit's headline evidence, so it is worth stating plainly:
// the game's OWN party-blind baseline scores ~12.7% on a real daily board —
// above the "~7-8% is acceptable" line the game used to quote at players. That
// is baseline geography, not cheating, and it is why the EG is benchmarked
// against this board's neutral map rather than a statewide threshold.
//
// ERA NOTE: targets 2 and 3 are measured on v1 boards. Board generation v2
// (Spec 5) re-rolls every board and will legitimately move them — that is a
// renegotiation in MODEL-SPECS, not a number to quietly edit here.

import { buildDailyBoards } from '../lib/board.mjs';
import { calculateEfficiencyGap, calculateSeats } from '../../src/utils/gameLogic.js';
import { litigationRisk } from '../../src/utils/litigation.js';
import { generateFairMap } from '../../src/utils/fairMapGenerator.js';
import { fairSeedFrom } from '../../src/utils/dailyChallenge.js';
import { createRng } from '../../src/utils/rng.js';

export const spec = 'Spec 1A — efficiency gap';

// An INDEPENDENT transcription of Stephanopoulos & McGhee's definition, written
// from the paper rather than from gameLogic.js: loser's votes are all wasted,
// the winner wastes everything beyond half the district, netted over all votes
// cast. If this and the game's implementation ever disagree, one of them has
// drifted from the literature.
function canonicalSignedEG(pop, districts, numDistricts) {
  let blueWasted = 0, redWasted = 0, cast = 0;
  for (let d = 1; d <= numDistricts; d++) {
    let blue = 0, red = 0;
    for (let y = 0; y < districts.length; y++) {
      for (let x = 0; x < districts[y].length; x++) {
        if (districts[y][x] !== d) continue;
        const party = pop.party[y][x];
        if (party === 0) blue += pop.density[y][x];
        else if (party === 1) red += pop.density[y][x];
      }
    }
    const total = blue + red;
    if (total === 0) continue;
    cast += total;
    const half = total / 2;
    if (blue > red) { blueWasted += blue - half; redWasted += red; }
    else { blueWasted += blue; redWasted += red - half; }
  }
  return cast > 0 ? ((blueWasted - redWasted) / cast) * 100 : 0;
}

// Two-party vote share and seat share for blue, over the whole board.
function shares(pop, districts, numDistricts) {
  let blue = 0, all = 0;
  for (let y = 0; y < pop.party.length; y++) {
    for (let x = 0; x < pop.party[y].length; x++) {
      const party = pop.party[y][x];
      if (party === 0) { blue += pop.density[y][x]; all += pop.density[y][x]; }
      else if (party === 1) { all += pop.density[y][x]; }
    }
  }
  const seats = calculateSeats(pop, districts, numDistricts);
  return { V: blue / all, S: seats.blue / numDistricts };
}

// The party-blind map the game itself draws for a board — the fair comparison,
// and the source of target 3.
function neutralPlan(built) {
  const { pop, counties, config, seed } = built;
  return generateFairMap(pop, counties, config.numDistricts, config.gridSize, createRng(fairSeedFrom(seed)));
}

const DATES = ['2026-07-08', '2026-07-16'];

export function run({ assert }) {
  // ── Target 1 + the equal-turnout identity ──────────────────────────────
  //
  // Under EQUAL district turnout the wasted-votes form collapses to the
  // shortcut exactly:  net = 2(V-1/2) - (S-1/2).  Derivation: a party wasting
  // W = V_abs - k*(T_d/2) over k won districts gives
  // (W_blue - W_red)/T = 2(V-1/2) - (S-1/2).
  //
  // This is the property the exact-half winner's surplus buys. It is also a
  // test that must be built carefully: the ceil() residue is 0.5*(n-2k)/T, so
  // it VANISHES on even district totals and whenever blue wins exactly half the
  // seats. The board below therefore uses odd turnout (9) and a 5-of-8 seat
  // split — under the old ceil() rule this assertion fails by 1.4e-2.
  const splits = [[6, 3], [5, 4], [3, 6], [7, 2], [2, 7], [5, 4], [1, 8], [5, 4]];
  const party = [], density = [], districts = [];
  for (let y = 0; y < splits.length; y++) {
    party[y] = []; density[y] = []; districts[y] = [];
    for (let x = 0; x < 9; x++) {
      party[y][x] = x < splits[y][0] ? 0 : 1;
      density[y][x] = 1;
      districts[y][x] = y + 1;
    }
  }
  const flat = { party, density };
  const eg = calculateEfficiencyGap(flat, districts, splits.length);
  const { V, S } = shares(flat, districts, splits.length);
  const identity = (2 * (V - 0.5) - (S - 0.5)) * 100;
  assert.close('equal turnout: EG identity to the shortcut form is exact', eg.signed, identity, 1e-9, 'pp');

  // ── Targets 1-3 on real party-blind maps ───────────────────────────────
  let neutralFullEG = null;
  for (const date of DATES) {
    const built = buildDailyBoards(date);
    for (const tier of ['small', 'full']) {
      const b = built[tier];
      const plan = neutralPlan(b);
      const n = b.config.numDistricts;
      const got = calculateEfficiencyGap(b.pop, plan, n);

      // Target 1 — the game must agree with the paper's definition.
      assert.close(
        `${date} ${tier}: matches canonical S&M signed form`,
        got.signed, canonicalSignedEG(b.pop, plan, n), 0.05, 'pp'
      );

      // gapSeats is just the signed gap in seat units — the honest unit on an
      // 8-10 district board, where one seat moves the percentage by ~10 points.
      assert.close(
        `${date} ${tier}: gapSeats == signed x districts`,
        got.gapSeats, (got.signed / 100) * n, 1e-9, ' seats'
      );

      // The sign carries the metric's core content: WHO the map favors. The old
      // code threw it away with Math.abs.
      const { V: Vb, S: Sb } = shares(b.pop, plan, n);
      const expectedFavors = got.signed > 0 ? 'red' : got.signed < 0 ? 'blue' : 'none';
      assert.ok(
        `${date} ${tier}: favors '${got.favors}' agrees with sign`,
        got.favors === expectedFavors,
        `signed ${got.signed.toFixed(2)}pp, blue ${(Vb * 100).toFixed(2)}% of votes → ${(Sb * 100).toFixed(0)}% of seats`
      );

      // Target 2 — the shortcut assumes equal turnout, which these boards
      // violate by design. Quantify the gap between the two forms: it is the
      // disclosed reason the full form is used.
      const shortcut = (2 * (Vb - 0.5) - (Sb - 0.5)) * 100;
      assert.range(
        `${date} ${tier}: full-vs-shortcut divergence is the disclosed ~1pp`,
        Math.abs(got.signed - shortcut), 0.5, 2.0, 'pp'
      );

      if (date === '2026-07-16' && tier === 'full') neutralFullEG = got.gap;

      // The recalibrated litigation contract (Spec 1A item 3): the EG factor
      // is seat-denominated and relative to the neutral baseline, so the
      // neutral map can never be named a lawsuit driver on its own board —
      // under the old (gap−7)/13 percentage ramp this exact plan scored
      // risk 0.44 on tail boards with zero gerrymandering.
      const gauge = litigationRisk({ gapSeats: got.gapSeats, fairGapSeats: got.gapSeats, numDistricts: n });
      assert.ok(
        `${date} ${tier}: neutral map never trips its own EG gauge`,
        !gauge.drivers.includes('efficiency gap beyond baseline'),
        `|EG| ${got.gap.toFixed(2)}% (${got.gapSeats.toFixed(2)} seats), drivers: [${gauge.drivers.join(', ') || 'none'}]`
      );
    }
  }

  // Ramp shape: flags at half a stolen seat beyond baseline, saturates at two.
  const rel = (p, f) => litigationRisk({ gapSeats: p, fairGapSeats: f, numDistricts: 10 });
  assert.ok('EG risk 0 within half a seat of baseline; 1.0 at two beyond',
    rel(1.6, 1.27).drivers.length === 0 &&
    !rel(1.6, 1.27).drivers.includes('efficiency gap beyond baseline') &&
    rel(3.27, 1.27).score >= 60,
    `Δ0.33 seats → [${rel(1.6, 1.27).drivers.join(', ') || 'none'}]; Δ2.0 seats → score ${rel(3.27, 1.27).score}`);

  // Fallback (no neutral in scope): onset sits just above the measured
  // neutral tail (~1.3 seat-equivalents), so a sandbox mid-game gauge can't
  // flag baseline geography as cheating.
  const fb = (g) => litigationRisk({ gapSeats: g, numDistricts: 10 });
  assert.ok('EG fallback: measured neutral tail (1.27 seats) does not flag',
    !fb(1.27).drivers.includes('efficiency gap beyond baseline') &&
    fb(2.5).drivers.includes('efficiency gap beyond baseline'),
    `1.27 seats → [${fb(1.27).drivers.join(', ') || 'none'}]; 2.5 seats → flagged`);

  // ── Target 3 — the audit's headline ────────────────────────────────────
  assert.range(
    'party-blind baseline on a real daily board reaches ~13% EG (v1 era)',
    neutralFullEG, 12, 13.5, '%'
  );
  assert.ok(
    'that baseline flunks the "~7-8% is acceptable" line the game used to quote',
    neutralFullEG > 8,
    `${neutralFullEG.toFixed(2)}% with zero gerrymandering — this is geography, not cheating`
  );

  // ── Degenerate states must not produce NaN ─────────────────────────────
  // A blank board is a live render state (the stats panel reads it before the
  // player has drawn anything), and an all-grey district has population but no
  // votes — grey is undecided until election night.
  const blank = calculateEfficiencyGap({ party: [[0, 1], [1, 0]], density: [[1, 1], [1, 1]] }, [[0, 0], [0, 0]], 4);
  assert.ok('blank board: no NaN, no phantom winner',
    blank.gap === 0 && blank.signed === 0 && blank.favors === 'none' && blank.gapSeats === 0,
    `gap=${blank.gap} signed=${blank.signed} favors=${blank.favors}`);

  const grey = calculateEfficiencyGap({ party: [[3, 3], [3, 3]], density: [[5, 5], [5, 5]] }, [[1, 1], [1, 1]], 1);
  assert.ok('all-grey district: population without votes is not a wasted vote',
    grey.gap === 0 && grey.favors === 'none' && !Number.isNaN(grey.gap),
    `gap=${grey.gap} favors=${grey.favors}`);
}
