#!/usr/bin/env node
// Calibrates the mean–median litigation thresholds: MM_AMBER / MM_RED per
// board size = the 95th / 99th percentiles of |MM| across this game's OWN
// party-blind neutral maps. Run: `node scripts/calibrate-mm.mjs` (~1 min).
//
// WHY OWN-GENERATOR PERCENTILES: on 8–12 district boards the mean–median
// difference carries real small-N noise, so literature thresholds (calibrated
// on ~100-district congressional ensembles — and the oft-quoted "neutral plans:
// mean |MM| ≈ 1.2pp, max ≈ 2.8pp" describes Chen & Rodden's 50 Florida plans,
// not a universal scale) do not transfer. The defensible flag is "worse than
// 95% / 99% of what party-blind line-drawing produces on THIS game's boards."
//
// The sample: ≥200 neutral maps per difficulty config, each from its own board
// seed (the fair-map generator is deterministic per seed, so distinct maps
// require distinct seeds — the spec's own correction), with the vote split
// swept across the daily's 38–48% band. Deterministic seed schedule, so this
// script reproduces its numbers byte-for-byte.
//
// Output is pasted into MM_THRESHOLDS in src/utils/litigation.js with the run
// date. Re-run when the board generator changes era (Spec 5 / MODEL_V2_UTC).

import { createRng } from '../src/utils/rng.js';
import { fairSeedFrom } from '../src/utils/dailyChallenge.js';
import { generatePopulationMap } from '../src/utils/mapGenerator.js';
import { generateCounties, rebalanceCountyPopulations } from '../src/utils/countyGenerator.js';
import { generateFairMap } from '../src/utils/fairMapGenerator.js';
import { calculateMeanMedian } from '../src/utils/metrics.js';

// The app's real difficulty configs (Controls.jsx / dailyChallenge.js):
// counties/cities per the daily where one exists, sliders' defaults otherwise.
const CONFIGS = {
  8: { gridSize: 50, numCounties: 250, numCities: 3 },   // small (daily Warm-up)
  10: { gridSize: 80, numCounties: 475, numCities: 4 },  // medium (daily Full Job)
  12: { gridSize: 100, numCounties: 600, numCities: 4 }, // large (sandbox)
};
const SAMPLES = 220;
const SEED_BASE = 0x5EED1C; // arbitrary, frozen
const KNUTH = 2654435761;

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

console.log(`Calibrating |MM| thresholds — ${SAMPLES} neutral maps per config\n`);
const out = {};
for (const [numDistricts, cfg] of Object.entries(CONFIGS)) {
  const N = Number(numDistricts);
  const values = [];
  let skipped = 0;
  const t0 = Date.now();
  for (let i = 0; i < SAMPLES; i++) {
    const seed = (SEED_BASE + i * KNUTH) >>> 0;
    const bluePercentage = 38 + (i % 11); // sweep the daily's 38–48 band
    const rng = createRng(seed);
    const pop = generatePopulationMap(cfg.gridSize, bluePercentage, cfg.numCities, 100, rng, 0, 0);
    let counties = generateCounties(cfg.gridSize, cfg.numCounties, rng);
    counties = rebalanceCountyPopulations(pop, counties, cfg.numCounties, 10, rng);
    const plan = generateFairMap(pop, counties, N, cfg.gridSize, createRng(fairSeedFrom(seed)));
    const { mm, valid } = calculateMeanMedian(pop, plan, N, 'blue');
    if (!valid) { skipped++; continue; }
    values.push(Math.abs(mm));
  }
  values.sort((a, b) => a - b);
  const amber = percentile(values, 0.95);
  const red = percentile(values, 0.99);
  out[N] = { amber, red };
  console.log(
    `N=${N}: n=${values.length}${skipped ? ` (${skipped} skipped)` : ''}  ` +
    `mean |MM| ${(values.reduce((s, v) => s + v, 0) / values.length).toFixed(2)}pp  ` +
    `p50 ${percentile(values, 0.5).toFixed(2)}  p95 ${amber.toFixed(2)}  p99 ${red.toFixed(2)}  ` +
    `max ${values[values.length - 1].toFixed(2)}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`
  );
}

console.log('\nPaste into MM_THRESHOLDS (src/utils/litigation.js):');
console.log(JSON.stringify(Object.fromEntries(
  Object.entries(out).map(([n, v]) => [n, { amber: +v.amber.toFixed(2), red: +v.red.toFixed(2) }])
), null, 2));
