// Spec 6 — the forum-channel litigation model.
//
// TARGETS (MODEL-SPECS Spec 6 "CALIBRATION TARGETS", with target 2
// renegotiated in the document's implementation addendum — Channel D uses the
// Spec 1 neutral-anchored ramps, so its inputs are expressed in those units):
//   1. Legislative board, 12% range, clean partisan numbers → federal ≥ 90
//      ("high"), state ≈ 0. The OLD model scored this 0–21 depending on how
//      the range split around the ideal — a symmetric ±6% split scored
//      literally 0, because per-district deviation never reached its 8%
//      onset. A presumptively unconstitutional map read as safe.
//   2. Range 4%, partisan numbers far beyond baseline → state ≥ 70,
//      federal ≤ 20; single-number drivers carry the forum tag.
//   3. Community 20% of 10 districts, cracked to 0 of 2 → federal ≥ 90 via
//      the VRA channel.
//   4. Community fair 2/2 but one district at 92% concentration → the
//      Shaw/Cooper over-packing channel fires ≥ 0.5; the old model read this
//      as "fair"/0 risk.
//   5. A clean map → both dials < 25.
// Plus the doctrinal quantities themselves: the overall range (drawn
// districts only) and the strict Bartlett majority for opportunity districts.

import { litigationRisk } from '../../src/utils/litigation.js';
import { computePopulationDeviation } from '../../src/utils/legalConstraints.js';
import { communityRepresentation } from '../../src/utils/community.js';

export const spec = 'Spec 6 — forum-channel legal layer';

// Board with per-district populations set exactly: one row per district,
// `width` cells, density packed to hit the requested population.
function boardWithPops(pops, width = 100) {
  const party = [], density = [], districts = [];
  for (let y = 0; y < pops.length; y++) {
    party[y] = []; density[y] = []; districts[y] = [];
    const per = Math.floor(pops[y] / width);
    let remainder = pops[y] - per * width;
    for (let x = 0; x < width; x++) {
      party[y][x] = x % 2;
      density[y][x] = per + (remainder-- > 0 ? 1 : 0);
      districts[y][x] = y + 1;
    }
  }
  return { pop: { party, density }, districts, n: pops.length };
}

export function run({ assert }) {
  // ── The doctrinal quantity: overall range ──────────────────────────────
  // Ideal = 1000. Max 1060, min 940 → range 12% — but worst single-district
  // deviation is only 6%, under the old 8% onset. THE bug: symmetric splits
  // hid presumptively unconstitutional spreads.
  const twelve = boardWithPops([1060, 940, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]);
  const dev12 = computePopulationDeviation(twelve.pop, twelve.districts, twelve.n, 10);
  assert.close('overall range: (max−min)/ideal, the Brown v. Thomson quantity', dev12.rangePct, 12, 0.05, '%');
  assert.ok('the same map\'s worst single-district deviation is only 6% — why the old gauge scored it ~0',
    Math.abs(dev12.worstDeviationPct - 6) < 0.1, `worst ${dev12.worstDeviationPct}%`);

  const blank = boardWithPops([1000]);
  blank.districts[0] = blank.districts[0].map(() => 0);
  assert.equal('range needs two drawn districts (0 until then, not a phantom spread)',
    computePopulationDeviation(blank.pop, blank.districts, 4, 10).rangePct, 0);

  // ── Target 1: presumptively unconstitutional population spread ──────────
  const t1 = litigationRisk({ rangePct: 12, gapSeats: 0.2, fairGapSeats: 0.2, meanMedian: 1, numDistricts: 10, compactness: 0.4, fairCompactness: 0.4 });
  assert.ok('T1: 12% range → federal ≥ 90 (prima facie invalid, Brown v. Thomson)',
    t1.federal.score >= 90 && t1.federal.drivers.includes('unequal populations'),
    `federal ${t1.federal.score} (${t1.federal.band}), drivers [${t1.federal.drivers.join(', ')}]`);
  assert.ok('T1: clean partisan numbers → state ≈ 0', t1.state.score <= 5, `state ${t1.state.score}`);

  // The prima facie JUMP at 10%: 9.9% range must read far below 10.1%.
  const under = litigationRisk({ rangePct: 9.9, numDistricts: 10 });
  const over = litigationRisk({ rangePct: 10.1, numDistricts: 10 });
  assert.ok('burden shifts AT the 10% line: risk jumps 0.495 → 0.9, no smooth crossing',
    under.federal.score <= 50 && over.federal.score >= 90,
    `9.9% → ${under.federal.score}; 10.1% → ${over.federal.score}`);
  // Cox v. Larios erosion: under-10 is not a safe harbor — risk grows from 0.
  const four = litigationRisk({ rangePct: 4, numDistricts: 10 });
  assert.range('under-10 ramp (Larios): 4% range reads low but not zero', four.federal.score, 15, 25);

  // Congressional chamber: near-zero tolerance (Karcher struck 0.69%).
  const cong = litigationRisk({ rangePct: 1.0, chamber: 'congressional', numDistricts: 10 });
  assert.ok('congressional chamber: full population risk by a 1% range',
    cong.federal.score === 100, `federal ${cong.federal.score}`);

  // ── Target 2 (renegotiated units): partisan map, tight population ───────
  const t2 = litigationRisk({
    rangePct: 4,
    gapSeats: 3.3, fairGapSeats: 1.3,       // two seat-equivalents beyond baseline
    meanMedian: 21, numDistricts: 10,        // ≥ the N=10 red percentile (20.43)
    compactness: 0.15, fairCompactness: 0.40 // 37.5% of neutral — flagrant shapes
  });
  assert.ok('T2: partisan map → state ≥ 70, federal ≤ 20 (the Rucho split)',
    t2.state.score >= 70 && t2.federal.score <= 20,
    `state ${t2.state.score} (${t2.state.band}), federal ${t2.federal.score}`);
  assert.ok('T2: single-number drivers carry the forum tag — the tag IS the lesson',
    t2.drivers.some(d => d.startsWith('state: ')) && !t2.drivers.some(d => d.startsWith('federal: ')),
    `[${t2.drivers.join(', ')}]`);

  // ── Targets 3 & 4: the community squeezed from both sides ──────────────
  const t3 = litigationRisk({
    rangePct: 3, numDistricts: 10,
    community: { fairShare: 2, opportunityDistricts: 0, maxConcentration: 0.42 },
  });
  assert.ok('T3: compact community cracked to 0 of its 2 feasible seats → federal ≥ 90 (VRA §2, Milligan)',
    t3.federal.score >= 90 && t3.federal.drivers.includes('diluted community (VRA §2)'),
    `federal ${t3.federal.score}, drivers [${t3.federal.drivers.join(', ')}]`);

  const t4 = litigationRisk({
    rangePct: 3, numDistricts: 10,
    community: { fairShare: 2, opportunityDistricts: 2, maxConcentration: 0.92 },
  });
  assert.ok('T4: fair share met but one district packed to 92% → Shaw/Cooper ceiling fires ≥ 0.5 (old model read "fair"/0)',
    t4.federal.score >= 50 && t4.federal.drivers.includes('community over-packed'),
    `federal ${t4.federal.score}, drivers [${t4.federal.drivers.join(', ')}]`);

  // ── Target 5: a clean map keeps both dials low ──────────────────────────
  const t5 = litigationRisk({
    rangePct: 2,
    gapSeats: 0.5, fairGapSeats: 0.4,
    meanMedian: 2, numDistricts: 10,
    compactness: 0.42, fairCompactness: 0.40,
    community: { fairShare: 2, opportunityDistricts: 2, maxConcentration: 0.58 },
  });
  assert.ok('T5: clean map → both dials < 25 ("low")',
    t5.federal.score < 25 && t5.state.score < 25,
    `federal ${t5.federal.score}, state ${t5.state.score}`);

  // ── Bartlett strict majority ────────────────────────────────────────────
  // A district where the community is EXACTLY half cannot elect on its own
  // votes — not an opportunity district (Bartlett v. Strickland, 2009).
  const G = 4;
  const communityMap = Array.from({ length: G }, (_, y) => Array.from({ length: G }, (_, x) => y < 2 && x < 2));
  const pop = {
    party: Array.from({ length: G }, () => Array(G).fill(0)),
    density: Array.from({ length: G }, () => Array(G).fill(5)),
    community: communityMap,
  };
  // District 1 = top-left quadrant + one non-community cell strip? Use two
  // districts: D1 = rows 0-1 (community is exactly half of it), D2 = rest.
  const districts = Array.from({ length: G }, (_, y) => Array.from({ length: G }, () => (y < 2 ? 1 : 2)));
  const rep = communityRepresentation(pop, districts, 2);
  assert.ok('exactly 50% community is NOT an opportunity district (strict Bartlett majority)',
    rep.opportunityDistricts === 0 && rep.maxConcentration === 0.5,
    `opportunity ${rep.opportunityDistricts}, maxConcentration ${rep.maxConcentration}`);
}
