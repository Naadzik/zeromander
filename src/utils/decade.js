import { extractPopulationData, getDistrictVotes } from './formatUtils.js';
import { applySwingToVotes } from './gameLogic.js';
import { resolveGreyPopulation } from './greyReveal.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = v => Math.round(v * 10) / 10;

// Per-district winner (0 blue / 1 red) on `map` after `swingPct`, mirroring
// calculateSeatsWithSwing's tie-break (blue must strictly win). Lets a caller
// draw the seat map for a given election, not just tally the count.
function districtWinners(populationMap, districts, numDistricts, swingPct) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);
  const winners = {};
  for (let d = 1; d <= numDistricts; d++) {
    const { blue, red } = getDistrictVotes(partyMap, densityMap, districts, d);
    const swung = applySwingToVotes({ blue, red }, swingPct);
    winners[d] = swung.blue > swung.red ? 0 : 1;
  }
  return winners;
}

// ── Realistic national swing draw ────────────────────────────────────────
// Most cycles are quiet — a couple of points either way; roughly one in seven
// is a "wave" that sweeps 7–10 points in a single direction (1994/2008/2010).
// Positive = toward blue, matching applySwingToVotes. Seeded entirely by the
// passed rng, so a whole decade replays identically from one seed.
const WAVE_PROB = 0.15;
export function drawNationalSwing(rng) {
  if (rng() < WAVE_PROB) {
    const dir = rng() < 0.5 ? -1 : 1;
    return round1(dir * (7 + rng() * 3)); // ±7–10
  }
  // Normal(0, 3.5) via Box–Muller, clamped so a calm year never rivals a wave.
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return round1(clamp(z * 3.5, -6.5, 6.5));
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
const DRIFT_RATE = 0.035;  // ~7% peak metro gain over a 4-step (decade) run
const DRIFT_PEAK = 1.6;    // growth peaks near 1.6× mean density (the suburbs)
const DRIFT_FLOOR = 0.8;   // below 0.8× mean (remote rural) the trend is decline

// Per-step relative growth for a cell at density-to-mean ratio r — a rational
// "hump": negative below the rural floor, peaking at the suburban ring, easing
// for the densest core.
function growthPerStep(r) {
  return DRIFT_RATE * (r - DRIFT_FLOOR) / (1 + (r / DRIFT_PEAK) ** 2);
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

  const drifted = densityMap.map(row => [...row]);
  let origTotal = 0, newTotal = 0;
  for (let y = 0; y < gridSize; y++)
    for (let x = 0; x < densityMap[y].length; x++) {
      const d = densityMap[y][x];
      origTotal += d;
      // Clamped so no cell can invert or run away over the decade.
      const factor = clamp(1 + step * growthPerStep(d / mean), 0.1, 3);
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
// accumulated urbanization drift and one national-swing draw onto the FIXED
// districts, then scores them. This is where a map's durability shows: a greedy
// map that wins big today can bleed seats as a wave lands or the ground shifts
// under it, while a sturdier map holds. Pure given `rng`.
export function runDecade(populationMap, districts, numDistricts, playerParty, rng, opts = {}) {
  const elections = opts.elections ?? 5;
  const startYear = opts.startYear ?? 2026;
  const yearsApart = opts.yearsApart ?? 2;
  const targetSeats = opts.targetSeats ?? (Math.floor(numDistricts / 2) + 1);

  const results = [];
  let heldMajority = 0, cumulativeOurSeats = 0;
  for (let i = 0; i < elections; i++) {
    const drifted = applyDrift(populationMap, i);
    const nationalSwing = drawNationalSwing(rng);
    // Undecideds ("grey") break FRESH each cycle — a new clustered lean every
    // election, on top of the national swing. No-grey boards pass through
    // untouched (and consume no rng), so this is a no-op there.
    const decided = resolveGreyPopulation(drifted, rng).revealedMap;
    // Per-district winners drive both the tally and the drawable seat map, so
    // the count and the rendered map can never disagree.
    const winners = districtWinners(decided, districts, numDistricts, nationalSwing);
    let blue = 0, red = 0;
    for (let d = 1; d <= numDistricts; d++) (winners[d] === 0 ? blue++ : red++);
    const seats = { blue, red, swingPct: nationalSwing };
    const ourSeats = playerParty === 'red' ? red : blue;
    const won = ourSeats >= targetSeats;
    if (won) heldMajority++;
    cumulativeOurSeats += ourSeats;
    results.push({ year: startYear + i * yearsApart, nationalSwing, seats, ourSeats, won, winners });
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
