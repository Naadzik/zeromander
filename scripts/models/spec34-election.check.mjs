// Specs 3+4 — election night: the undecided break v2 and the swing model v2.
//
// TARGETS (MODEL-SPECS Specs 3/4, incl. binding corrections):
//   Break (a): map-wide grey break on a 50/50-context board — mean |break−50|
//     ∈ [5, 6.5]pp, P(≥14pp) ∈ [3%, 8%]. This is the ELECTION-WIDE SHOCK's
//     scale (σ=7pp: "historically about even" central case, a 2016-Wisconsin
//     2:1 break ≈ 2σ), so the harness board carries MANY same-size clusters
//     in exactly-50/50 context — per-cluster idiosyncrasy and per-cell coin
//     flips average out and the shared shock is what remains. Real game
//     boards spread wider for two honest reasons the spec does not treat as
//     failures: they carry only 3–6 blobs (cluster-count noise), and blobs
//     inherit their NEIGHBORHOOD's lean — a blob in deep-red countryside
//     breaks red most nights. That context sensitivity is design (target b).
//   Break (b): a cluster in a 90/10 city — median lean ≈ 0.70 (the
//     half-strength anchor: late deciders are weak partisans), 5th–95th ≈
//     [0.52, 0.88] — leans the city's way, can badly underperform it.
//   Break (c): determinism, frozen draw arity 2 + 2·clusters + cells, zero
//     draws with no grey.
//   Swing 2a: postwar House moments (39 transitions 1946–2024): mean|s| ≈
//     3.0, SD ≈ 3.65, P(≥5) ≈ 23%, max 8.9 — plus the binding-correction
//     target P(|s| ≥ 7) ∈ [4%, 8%] that the flat wave magnitude failed
//     (10.5%); min-of-two-uniforms is the corrective. Always exactly 3 draws.
//   Swing 2b: midterm penalty applied at indices {0,2,4}, clamped so a ±9
//     wave never exceeds the postwar record's ballpark.
//   Swing 2c: district elasticity — population-weighted mean exactly 1 (the
//     headline swing stays honest), rural > 1 > dense core, 2 draws/district.
//   Swing 2d: polling error Normal(0,2) clamped ±4.5, 2 draws.
//   Tossup 2e: two tiers — realistic (≤ half the grey) and uncalled (≤ all
//     of it); no-grey boards reduce to exact ties.

import { createRng, normal } from '../../src/utils/rng.js';
import { resolveGreyPopulation } from '../../src/utils/greyReveal.js';
import {
  drawNationalSwing, applyMidtermPenalty, MIDTERM_INDICES,
  districtElasticity, drawDistrictSwings, drawPollingError
} from '../../src/utils/swingModel.js';
import { runDecade } from '../../src/utils/decade.js';
import { classifyDistricts } from '../../src/utils/gameLogic.js';

export const spec = 'Specs 3+4 — undecided break + swing models';

const KNUTH = 2654435761;

// Counting rng wrapper: how many raw draws did a routine consume?
function countingRng(seed) {
  let n = 0;
  const raw = createRng(seed);
  const rng = () => { n++; return raw(); };
  return { rng, count: () => n };
}

// 50/50-context board with `blobs` grey squares of `side`×`side` — decided
// cells alternate blue/red so every neighborhood is exactly half and half.
function neutralBoard(gridSize, blobSpots, side) {
  const party = [], density = [];
  for (let y = 0; y < gridSize; y++) {
    party[y] = []; density[y] = [];
    for (let x = 0; x < gridSize; x++) { party[y][x] = (x + y) % 2; density[y][x] = 5; }
  }
  for (const [bx, by] of blobSpots)
    for (let y = by; y < by + side; y++) for (let x = bx; x < bx + side; x++) party[y][x] = 3;
  return { party, density };
}

export function run({ assert }) {
  // ── normal(): the fixed-arity contract ─────────────────────────────────
  {
    const c = countingRng(1);
    for (let i = 0; i < 5; i++) normal(c.rng);
    assert.equal('normal() consumes exactly 2 draws per call, every call', c.count(), 10);
  }

  // ── Swing 2a: moments vs the postwar record ────────────────────────────
  {
    const rng = createRng(0xABCDEF);
    const n = 60000;
    let sumAbs = 0, sumSq = 0, ge5 = 0, ge7 = 0, max = 0, badRound = 0;
    for (let i = 0; i < n; i++) {
      const s = drawNationalSwing(rng);
      if (Math.round(s * 10) !== s * 10) badRound++;
      const a = Math.abs(s);
      sumAbs += a; sumSq += s * s;
      if (a >= 5) ge5++;
      if (a >= 7) ge7++;
      if (a > max) max = a;
    }
    assert.range('swing mean|s| ≈ 3.0 (postwar mean 3.0)', sumAbs / n, 2.75, 3.2, 'pp');
    assert.range('swing SD ≈ 3.65 (postwar 3.65)', Math.sqrt(sumSq / n), 3.4, 3.9, 'pp');
    assert.range('P(|s| ≥ 5) ≈ 23% (postwar 23.1%)', ge5 / n * 100, 20, 27, '%');
    assert.range('P(|s| ≥ 7) ∈ [4%, 8%] — the binding-correction target the flat wave failed at 10.5%', ge7 / n * 100, 4, 8, '%');
    assert.ok('wave ceiling 9.0 (postwar max 8.9), tenth-point rounded', max <= 9.0 && badRound === 0, `max ${max}`);
    const c = countingRng(3);
    drawNationalSwing(c.rng); drawNationalSwing(c.rng);
    assert.equal('swing draw consumes exactly 3 draws whichever branch runs', c.count(), 6);
  }

  // ── Swing 2b: midterm structure ────────────────────────────────────────
  assert.ok('midterms are elections 0, 2, 4 (explicit set, not start-year parity)',
    MIDTERM_INDICES.has(0) && MIDTERM_INDICES.has(2) && MIDTERM_INDICES.has(4) && !MIDTERM_INDICES.has(1) && !MIDTERM_INDICES.has(3),
    [...MIDTERM_INDICES].join(','));
  assert.equal('blue White House pays −2.5 at the midterm', applyMidtermPenalty(0, 'blue'), -2.5);
  assert.ok('penalty is applied before the final clamp: a ±9 wave stays within ±9',
    applyMidtermPenalty(9, 'red') === 9 && applyMidtermPenalty(-9, 'blue') === -9,
    `+9 red→${applyMidtermPenalty(9, 'red')}, −9 blue→${applyMidtermPenalty(-9, 'blue')}`);

  // ── Break (a): the election-wide shock's scale ─────────────────────────
  {
    // 12 clusters × 100 cells in exact 50/50 context: ε and per-cell noise
    // average out; β (σ=7pp) is what the map-wide break measures.
    const spots = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) spots.push([2 + c * 15, 2 + r * 20]);
    const board = neutralBoard(62, spots, 10);
    const runs = 2500;
    const dev = [];
    for (let i = 0; i < runs; i++) {
      const { clusters } = resolveGreyPopulation(board, createRng((0x5EED + i * KNUTH) >>> 0));
      let blue = 0, tot = 0;
      for (const cl of clusters) { blue += cl.bluePop; tot += cl.bluePop + cl.redPop; }
      dev.push(Math.abs(blue / tot * 100 - 50));
    }
    const mean = dev.reduce((a, b) => a + b, 0) / runs;
    const p14 = dev.filter(d => d >= 14).length / runs * 100;
    assert.range('map-wide break: mean |break−50| ∈ [5, 6.5]pp ("historically about even" is the central case)', mean, 5, 6.5, 'pp');
    assert.range('map-wide break: a ≥14pp night (2016-Wisconsin scale) is a tail, P ∈ [3%, 8%]', p14, 3, 8, '%');
  }

  // ── Break (b): the half-strength anchor in a 90/10 city ────────────────
  {
    // Deterministic 90/10 decided pattern. NOT a plain running counter: with
    // row length 30 ≡ 0 (mod 10) that degenerates into red COLUMNS, and one
    // landed inside the cluster's ring (baseline 0.84, caught by this very
    // check). The y·7 offset is coprime to the period, so the red cells
    // distribute evenly and the neighborhood is ~90% blue as intended.
    const G = 30;
    const party = [], density = [];
    for (let y = 0; y < G; y++) {
      party[y] = []; density[y] = [];
      for (let x = 0; x < G; x++) { party[y][x] = ((y * 7 + x) % 10 === 0) ? 1 : 0; density[y][x] = 10; }
    }
    for (let y = 12; y < 18; y++) for (let x = 12; x < 18; x++) party[y][x] = 3;
    const board = { party, density };
    const runs = 4000;
    const leans = [];
    for (let i = 0; i < runs; i++) {
      leans.push(resolveGreyPopulation(board, createRng((0x9999 + i * KNUTH) >>> 0)).clusters[0].lean);
    }
    leans.sort((a, b) => a - b);
    const q = f => leans[Math.floor(f * runs)];
    assert.range('90/10 city cluster: median lean ≈ 0.70 (half-strength anchor, not full)', q(0.5), 0.67, 0.73);
    assert.range('90/10 city cluster: 5th pct ≈ 0.52 — it can badly underperform its city', q(0.05), 0.48, 0.56);
    assert.range('90/10 city cluster: 95th pct ≈ 0.88', q(0.95), 0.84, 0.92);
  }

  // ── Break (c): determinism, arity, the zero-draw guard ─────────────────
  {
    const board = neutralBoard(40, [[2, 2], [20, 8], [10, 28]], 6);
    const a = JSON.stringify(resolveGreyPopulation(board, createRng(7)).revealedMap);
    const b = JSON.stringify(resolveGreyPopulation(board, createRng(7)).revealedMap);
    assert.ok('same seed → byte-identical revealedMap', a === b, 'deterministic');

    const c = countingRng(7);
    const res = resolveGreyPopulation(board, c.rng);
    let cells = 0;
    for (const cl of res.clusters) cells += cl.cells.length;
    assert.equal('frozen draw budget: 2 + 2·clusters + greyCells',
      c.count(), 2 + 2 * res.clusters.length + cells);

    const noGrey = neutralBoard(10, [], 0);
    const c2 = countingRng(7);
    resolveGreyPopulation(noGrey, c2.rng);
    assert.equal('no grey → ZERO draws (the hard guard)', c2.count(), 0);

    // COUPLE: a +8 national swing moves every unclamped cluster lean by
    // exactly 0.5 × 0.08 = +0.04 on the same seed.
    const base = resolveGreyPopulation(board, createRng(11)).clusters.map(cl => cl.lean);
    const coupled = resolveGreyPopulation(board, createRng(11), { nationalSwingPct: 8 }).clusters.map(cl => cl.lean);
    const shifts = coupled.map((v, i) => v - base[i]).filter((_, i) => base[i] > 0.06 && base[i] < 0.9);
    assert.ok('COUPLE: national swing shifts cluster leans by exactly swing/2 (deterministic, no draw)',
      shifts.length > 0 && shifts.every(s => Math.abs(s - 0.04) < 1e-9),
      `shifts: ${shifts.map(s => s.toFixed(3)).join(', ')}`);
  }

  // ── Swing 2c: elasticity ───────────────────────────────────────────────
  {
    // Two districts: a dense city half (density 20) and a sparse rural half
    // (density 2). Rural must respond harder than the core, and the
    // population-weighted mean must be exactly 1.
    const G = 20;
    const party = [], density = [], districts = [];
    for (let y = 0; y < G; y++) {
      party[y] = []; density[y] = []; districts[y] = [];
      for (let x = 0; x < G; x++) {
        party[y][x] = 0;
        density[y][x] = x < G / 2 ? 20 : 2;
        districts[y][x] = x < G / 2 ? 1 : 2;
      }
    }
    const map = { party, density };
    const E = districtElasticity(map, districts, 2);
    assert.ok('elasticity: rural district > 1 > dense core', E[2] > 1 && E[1] < 1,
      `core ${E[1].toFixed(3)}, rural ${E[2].toFixed(3)}`);
    const pops = [0, 20 * 10 * G, 2 * 10 * G];
    const weightedMean = (pops[1] * E[1] + pops[2] * E[2]) / (pops[1] + pops[2]);
    assert.close('population-weighted mean elasticity is exactly 1 — the headline swing stays honest',
      weightedMean, 1, 1e-9);

    const c = countingRng(5);
    drawDistrictSwings(E, 2, 4, c.rng);
    assert.equal('district swings: exactly 2 draws per district, ascending', c.count(), 4);
  }

  // ── Swing 2d: polling error ────────────────────────────────────────────
  {
    const rng = createRng(0xFACE);
    let sumSq = 0, maxAbs = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const e = drawPollingError(rng);
      sumSq += e * e;
      maxAbs = Math.max(maxAbs, Math.abs(e));
    }
    assert.range('polling error SD ≈ 2.0 share points (fundamentals-scale, below single-poll RMSE)', Math.sqrt(sumSq / n), 1.9, 2.1, 'pp');
    assert.ok('polling error clamped to ±4.5', maxAbs <= 4.5, `max |e| ${maxAbs.toFixed(2)}`);
  }

  // ── Decade integration: deterministic replay ───────────────────────────
  {
    const G = 20;
    const party = [], density = [], districts = [];
    for (let y = 0; y < G; y++) {
      party[y] = []; density[y] = []; districts[y] = [];
      for (let x = 0; x < G; x++) {
        party[y][x] = (x + y) % 2;
        density[y][x] = 3 + (x % 5);
        districts[y][x] = x < 10 ? 1 : 2;
      }
    }
    const map = { party, density };
    const r1 = runDecade(map, districts, 2, 'blue', createRng(99));
    const r2 = runDecade(map, districts, 2, 'blue', createRng(99));
    assert.ok('a decade replays identically from one seed (midterms + elasticity + noise included)',
      JSON.stringify(r1) === JSON.stringify(r2), `${r1.elections.length} elections`);
    assert.ok('midterm-adjusted swings never exceed the model ceiling',
      r1.elections.every(e => Math.abs(e.nationalSwing) <= 9), r1.elections.map(e => e.nationalSwing).join(', '));
  }

  // ── Tossup 2e: two tiers of doubt ──────────────────────────────────────
  {
    // One row per district, equal density: margins set against grey = 100.
    const mk = (blue, red, grey) => {
      const party = [], density = [];
      const cells = [[0, blue], [1, red], [3, grey]];
      const width = blue + red + grey;
      party[0] = []; density[0] = [];
      let x = 0;
      for (const [p, count] of cells) for (let i = 0; i < count; i++) { party[0][x] = p; density[0][x] = 1; x++; }
      return { map: { party, density }, districts: [Array(width).fill(1)] };
    };
    const status = (blue, red, grey) => classifyDistricts(mk(blue, red, grey).map, mk(blue, red, grey).districts, 1)[0].status;
    assert.equal('margin ≤ half the grey → TOSSUP (realistic flip)', status(140, 100, 100), 'tossup');
    assert.equal('margin between half and all the grey → UNCALLED (extreme break could flip)', status(180, 100, 100), 'uncalled');
    assert.equal('margin beyond the grey → called', status(220, 100, 100), 'blue');
    assert.equal('no grey: only an exact tie is a tossup', status(101, 100, 0), 'blue');
    assert.equal('no grey, exact tie → tossup', status(100, 100, 0), 'tossup');
  }
}
