import { createRng } from './rng.js';
import { generateFairMap } from './fairMapGenerator.js';
import { calculateSeats } from './gameLogic.js';
import { computePopulationDeviation } from './legalConstraints.js';

// The party-blind baseline, v2: a deterministic mini-ensemble of neutral maps
// instead of one arbitrary draw. The audit measured why one draw can't carry
// the score: the single pinned map differed from an ensemble median on about
// half of boards (up to 2 seats), so the headline "seats stolen" carried a
// board-specific ±1–2 seat arbitrariness. Scoring against the MEDIAN of 25
// maps — with the min–max range shown — is the browser-scale version of the
// ensemble analyses used in litigation and scholarship (DeFord–Duchin–Solomon
// 2021; Herschlag et al. 2020; credited in Common Cause v. Rucho).
//
// EVERYTHING HERE IS FROZEN once Beta ships (the determinism-protocol set):
//   - N_TARGET (25; 15 on ≥100 grids), MAX_TRIES (60)
//   - the seed schedule: seed_i = (base + i·2654435761) >>> 0, where base is
//     fairSeedFrom(boardSeed). The increment is Knuth's constant — the same
//     one hashGrid uses — NOT 0x9E3779B9 (the spec body's constant was
//     refuted in verification: its own reference histograms were generated
//     with 2654435761). i = 0 reproduces the v1 pinned map exactly, so the
//     seed schedule is a superset of the old baseline — continuity of the
//     SEED, not of the displayed ghost (the median member usually differs).
//   - the acceptance rule, the lower-median definition, the ghost selection.
// Changing any of these silently redefines every player's score.
//
// Deterministic: same inputs → byte-identical ensemble for every player, so
// "seats stolen" stays comparable. Pure Node-importable (the calibration
// harness runs it directly); the browser calls it through a Web Worker.

export const ENSEMBLE_INCREMENT = 2654435761; // Knuth's multiplicative constant
export const ENSEMBLE_MAX_TRIES = 60;

// 25 accepted maps normally; 15 on the 100-grid "large" sandbox config
// (measured ~87ms/map in Node, ~2.2s for 25 — too slow on mobile). Both odd,
// so the lower median is the true median of a full ensemble.
export function ensembleTarget(gridSize) {
  return gridSize >= 100 ? 15 : 25;
}

// A candidate is accepted iff it obeys the SAME rules that bind the player:
// every district within ±10% of ideal population (two-sided, the completion
// gate) and exactly numDistricts non-empty districts. Unfiltered baselines
// violate the parity rule ~1.7% of the time — a baseline allowed to break a
// rule the player cannot is not a fair baseline.
function isAccepted(populationMap, districts, numDistricts) {
  if (!computePopulationDeviation(populationMap, districts, numDistricts, 10).pass) return false;
  const present = new Set();
  for (let y = 0; y < districts.length; y++) {
    for (let x = 0; x < districts[y].length; x++) {
      if (districts[y][x] > 0) present.add(districts[y][x]);
    }
  }
  return present.size === numDistricts;
}

export function generateNeutralEnsemble(populationMap, counties, numDistricts, gridSize, baseSeed, playerParty, isThreeParty = false) {
  const nTarget = ensembleTarget(gridSize);
  const accepted = [];
  const rejected = [];

  for (let i = 0; i < ENSEMBLE_MAX_TRIES && accepted.length < nTarget; i++) {
    const seed = (baseSeed + i * ENSEMBLE_INCREMENT) >>> 0;
    const districts = generateFairMap(populationMap, counties, numDistricts, gridSize, createRng(seed));
    const member = {
      districts,
      seats: calculateSeats(populationMap, districts, numDistricts, isThreeParty),
      seedIndex: i,
    };
    if (isAccepted(populationMap, districts, numDistricts)) {
      accepted.push(member);
    } else {
      rejected.push({
        ...member,
        worstDeviationPct: computePopulationDeviation(populationMap, districts, numDistricts, 10).worstDeviationPct,
      });
    }
  }

  // Degenerate fallback (never observed on real configs): if the filter
  // starved the ensemble, top up with the least-imbalanced rejects rather
  // than return an empty baseline.
  if (accepted.length < nTarget && rejected.length > 0) {
    rejected.sort((a, b) => a.worstDeviationPct - b.worstDeviationPct);
    while (accepted.length < nTarget && rejected.length > 0) accepted.push(rejected.shift());
    accepted.sort((a, b) => a.seedIndex - b.seedIndex);
  }

  const seatsList = accepted.map(m => m.seats[playerParty]);
  const sorted = [...seatsList].sort((a, b) => a - b);
  // Lower median: a single integer seat count, deterministic for any n.
  const median = sorted[(sorted.length - 1) >> 1];

  // The displayed ghost is the lowest-seed accepted member whose seats equal
  // the median — so the map on screen ALWAYS shows the seat count the score
  // is measured against. (An "average of maps" cannot be drawn; a median
  // member can.)
  const ghost = accepted.find(m => m.seats[playerParty] === median);

  const histogram = {};
  for (const s of seatsList) histogram[s] = (histogram[s] || 0) + 1;

  return {
    ghostDistricts: ghost.districts,
    ghostSeedIndex: ghost.seedIndex,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    n: accepted.length,
    histogram,
    seatsList,
    // Which schedule seeds produced the accepted members, in order — lets the
    // harness re-derive any member and audit acceptance/ghost selection.
    seedIndices: accepted.map(m => m.seedIndex),
  };
}
