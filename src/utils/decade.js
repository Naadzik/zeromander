import { extractPopulationData, getDistrictVotes } from './formatUtils.js';
import { applySwingToVotes } from './gameLogic.js';
import { resolveGreyPopulation } from './greyReveal.js';
import {
  drawNationalSwing, applyMidtermPenalty, MIDTERM_INDICES,
  districtElasticity, drawDistrictSwings
} from './swingModel.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = v => Math.round(v * 10) / 10;

// Per-district winner (0 blue / 1 red) on `map` after the national swing plus
// this district's own swing (elasticity + local noise), mirroring
// calculateSeatsWithSwing's tie-break (blue must strictly win). Lets a caller
// draw the seat map for a given election, not just tally the count.
function districtWinners(populationMap, districts, numDistricts, swingPct, districtSwings = null) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);
  const winners = {};
  for (let d = 1; d <= numDistricts; d++) {
    const { blue, red } = getDistrictVotes(partyMap, densityMap, districts, d);
    const localSwing = districtSwings ? (districtSwings[d] ?? 0) : 0;
    const swung = applySwingToVotes({ blue, red }, swingPct + localSwing);
    winners[d] = swung.blue > swung.red ? 0 : 1;
  }
  return winners;
}

// ── Urbanization drift ───────────────────────────────────────────────────
// Calibrated to U.S. Census county population change, 2010–2020 (the clearest
// modern FPTP case): metro areas grew ~9% over the decade and large-metro cores
// ~7.8%, the SUBURBAN/outlying ring grew fastest of all, while rural/nonmetro
// counties lost population overall and roughly HALF of all counties shrank
// (US Census Bureau, 2020 Census; USDA ERS nonmetro estimates). So a cell's
// growth is not "denser always wins": it rises with density, PEAKS at the
// suburban ring (~1.6× the mean), eases at the very densest core, and turns
// NEGATIVE below ~0.8× the mean (deep rural). The total electorate is held
// constant — a legislature's seats are reapportioned, so a FIXED map faces a
// shifting electorate, which is the whole point of the mode. Because the growth
// concentrates the metro party's voters, it also packs them under winner-take-
// all rules (Chen & Rodden, "Unintentional Gerrymandering," QJPS 2013): a party
// can gain vote share over the decade yet lose ground in seats. Pure: same map
// + same step → same result. `step` = elections since the map was drawn.
// v2 drift constants. DRIFT_RATE reduced 0.035 → 0.030 (Spec 7 B1): the
// suburb-vs-deep-rural spread per decade eases ~14.5pp → ~12.4pp, nearer the
// observed ~11pp (big-metro suburbs +10.2% [Frey/Brookings] vs nonmetro −0.6%
// [USDA ERS], 2010–2020). Renormalization conserves the total, so only the
// RELATIVE spread matters.
const DRIFT_RATE = 0.030;
// The hump's SCALE (renamed from DRIFT_PEAK — it is not the peak). Growth
// peaks at r* = FLOOR + √(FLOOR² + SCALE²) = 0.8 + √(0.64 + 2.56) = 2.59×
// mean — the inner-suburban ring (on a mean-3.4 board, density ~9), not the
// 1.6 the old name implied.
const DRIFT_SCALE = 1.6;
const DRIFT_FLOOR = 0.8;   // below 0.8× mean (remote rural) the interior trend is decline

// Edge expansion (Spec 7 B2 — the extensive margin): a fringe cell that would
// normally DECLINE instead SPRAWLS if it sits beside existing development, so
// the urbanized footprint grows outward, not just denser inside. Grounded in
// spatially-correlated growth (Makse/Havlin/Stanley 1995), SLEUTH's dominant
// edge-spread mode (Clarke/Hoppen/Gaydos 1997), and adjacency-dominated US
// growth (Burchfield et al. 2006). Party of a sprawling cell is UNCHANGED
// (rng-free) — disclosed simplification: real suburban newcomers diversify
// composition (Frey), holding party fixed mechanically favors the metro party.
const EDGE_NBR = 2.0;      // a neighbor at ≥2× mean ≈ suburb-grade (density ≥ ~7)
const EDGE_RATE = 0.025;   // +10%/decade at the fringe — outpaces the ~7% interior peak

// Per-step relative growth for a cell at density-to-mean ratio r — a rational
// "hump": negative below the rural floor, peaking at the inner-suburban ring,
// easing for the densest core.
function growthPerStep(r) {
  return DRIFT_RATE * (r - DRIFT_FLOOR) / (1 + (r / DRIFT_SCALE) ** 2);
}

export function applyDrift(populationMap, step) {
  const { partyMap, densityMap, communityMap } = extractPopulationData(populationMap);
  if (!densityMap || step <= 0) return populationMap;
  const gridSize = densityMap.length;

  let sum = 0, count = 0;
  for (let y = 0; y < gridSize; y++)
    for (let x = 0; x < densityMap[y].length; x++) { sum += densityMap[y][x]; count++; }
  const mean = count > 0 ? sum / count : 0;
  if (mean <= 0) return populationMap;

  // Highest-density orthogonal neighbor of each cell, from the BASELINE map —
  // the "is there development next door?" test for edge expansion. Computed
  // once, before any cell drifts, so growth reads only the original board.
  const nbrMax = (x, y) => {
    let m = 0;
    if (x > 0) m = Math.max(m, densityMap[y][x - 1]);
    if (x < densityMap[y].length - 1) m = Math.max(m, densityMap[y][x + 1]);
    if (y > 0) m = Math.max(m, densityMap[y - 1][x]);
    if (y < gridSize - 1) m = Math.max(m, densityMap[y + 1][x]);
    return m;
  };

  const drifted = densityMap.map(row => [...row]);
  let origTotal = 0, newTotal = 0;
  for (let y = 0; y < gridSize; y++)
    for (let x = 0; x < densityMap[y].length; x++) {
      const d = densityMap[y][x];
      const r = d / mean;
      origTotal += d;
      // A declining fringe cell (r < FLOOR) beside development sprawls instead;
      // otherwise the interior hump. Linear accumulation (1 + step·g) differs
      // from compounding (1+g)^step by <0.3pp at these magnitudes — kept.
      const isSprawlFringe = r < DRIFT_FLOOR && nbrMax(x, y) >= EDGE_NBR * mean;
      const growth = isSprawlFringe ? EDGE_RATE : growthPerStep(r);
      const factor = clamp(1 + step * growth, 0.1, 3);
      drifted[y][x] = d * factor;
      newTotal += drifted[y][x];
    }
  // Renormalize to the original total — the shift is a redistribution, not net
  // growth (the seat count is fixed; reapportionment moves seats, not people).
  const norm = newTotal > 0 ? origTotal / newTotal : 1;
  for (let y = 0; y < gridSize; y++)
    for (let x = 0; x < densityMap[y].length; x++) drifted[y][x] *= norm;

  const out = { party: partyMap, density: drifted };
  if (communityMap) out.community = communityMap;
  return out;
}

// ── The decade ───────────────────────────────────────────────────────────
// Draw once, then play `elections` cycles two years apart. Each cycle stacks
// accumulated urbanization drift, one national-swing draw (with the midterm
// penalty at midterm cadence), a fresh undecided break COUPLED to that swing,
// and per-district elasticity + local noise onto the FIXED districts, then
// scores them. This is where a map's durability shows: a greedy map that wins
// big today can bleed seats as a wave lands or the ground shifts under it,
// while a sturdier map holds. Pure given `rng`.
//
// FROZEN v2 DRAW ORDER (fixed arity per unit — a replay must never re-roll):
// whParty (1 draw, midterms only; zero when off) → per election: national
// swing (always 3) → grey resolution (2 + 2·clusters + cells; zero without
// grey) → district swings (2 per district, ascending).
export function runDecade(populationMap, districts, numDistricts, playerParty, rng, opts = {}) {
  const elections = opts.elections ?? 5;
  const startYear = opts.startYear ?? 2026;
  const yearsApart = opts.yearsApart ?? 2;
  const targetSeats = opts.targetSeats ?? (Math.floor(numDistricts / 2) + 1);
  const midterms = opts.midterms ?? true;

  // Who holds the White House shapes midterm cadence; drawn once per decade.
  let whParty = midterms ? (rng() < 0.5 ? 'blue' : 'red') : null;

  // Elasticity profile is a pure function of the baseline board + districts —
  // computed once. (Drift shifts densities slightly across the decade; the
  // baseline profile is the disclosed simplification: responsiveness is a
  // standing property of the map's geography, not re-fitted per cycle.)
  const elasticity = districtElasticity(populationMap, districts, numDistricts);

  const results = [];
  let heldMajority = 0, cumulativeOurSeats = 0;
  for (let i = 0; i < elections; i++) {
    const drifted = applyDrift(populationMap, i);
    let nationalSwing = drawNationalSwing(rng);
    if (midterms && MIDTERM_INDICES.has(i)) {
      nationalSwing = applyMidtermPenalty(nationalSwing, whParty);
    }
    // Undecideds ("grey") break FRESH each cycle — a new clustered lean every
    // election, COUPLED to the year's national environment (the same mood
    // moves decideds and late deciders — the 2016 pattern). No-grey boards
    // pass through untouched (and consume no rng), so this is a no-op there.
    const decided = resolveGreyPopulation(drifted, rng, { nationalSwingPct: nationalSwing }).revealedMap;
    const districtSwings = drawDistrictSwings(elasticity, numDistricts, nationalSwing, rng);
    // Per-district winners drive both the tally and the drawable seat map, so
    // the count and the rendered map can never disagree.
    const winners = districtWinners(decided, districts, numDistricts, nationalSwing, districtSwings);
    let blue = 0, red = 0;
    for (let d = 1; d <= numDistricts; d++) (winners[d] === 0 ? blue++ : red++);
    const seats = { blue, red, swingPct: nationalSwing };
    const ourSeats = playerParty === 'red' ? red : blue;
    const won = ourSeats >= targetSeats;
    if (won) heldMajority++;
    cumulativeOurSeats += ourSeats;
    results.push({ year: startYear + i * yearsApart, nationalSwing, seats, ourSeats, won, winners });

    // After a presidential-cadence election (indices 1, 3), the White House
    // flips if the year swung more than 2.5 points toward the opposition — a
    // cheap deterministic proxy for losing the presidency.
    if (midterms && !MIDTERM_INDICES.has(i)) {
      const towardOpposition = whParty === 'blue' ? -nationalSwing : nationalSwing;
      if (towardOpposition > 2.5) whParty = whParty === 'blue' ? 'red' : 'blue';
    }
  }

  return {
    elections: results,
    totalElections: elections,
    targetSeats,
    heldMajority,
    cumulativeOurSeats,
    avgSeats: round1(cumulativeOurSeats / elections)
  };
}

// ── Best-decade record (localStorage, no backend) ────────────────────────
// Ranked by cumulative seats first, then years the majority held. Kept small
// and JSON-only so a corrupt/absent value degrades to "no best yet".
const BEST_KEY = 'zeromander.decade.best';

export function readBestDecade() {
  try {
    const raw = JSON.parse(localStorage.getItem(BEST_KEY));
    if (raw && typeof raw.cumulativeOurSeats === 'number') return raw;
  } catch { /* absent or private mode */ }
  return null;
}

// Saves `result` if it beats the stored best. Returns true when it's a new best.
export function saveBestDecade(result) {
  const best = readBestDecade();
  const better = !best
    || result.cumulativeOurSeats > best.cumulativeOurSeats
    || (result.cumulativeOurSeats === best.cumulativeOurSeats && result.heldMajority > best.heldMajority);
  if (!better) return false;
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify({
      cumulativeOurSeats: result.cumulativeOurSeats,
      heldMajority: result.heldMajority,
      totalElections: result.totalElections,
      avgSeats: result.avgSeats,
      date: new Date().toISOString().slice(0, 10)
    }));
  } catch { /* private mode — the run still shows, just isn't remembered */ }
  return true;
}
