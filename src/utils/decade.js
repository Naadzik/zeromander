import { extractPopulationData } from './formatUtils.js';
import { calculateSeatsWithSwing } from './gameLogic.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = v => Math.round(v * 10) / 10;

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
// Over a decade, population concentrates: denser-than-average cells gain
// people, sparser-than-average cells lose them, with the total electorate held
// constant (a redistribution, not growth). `step` = elections since the map was
// drawn (0 = drawn conditions, no drift). Party never moves — only where the
// voters live — but because cities lean one way, the mix shifts under a fixed
// map. Pure: same map + same step → same result.
const URBANIZATION_RATE = 0.015; // per step, scaled by each cell's density deviation
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
      // Above mean → grows; below → shrinks; magnitude ∝ deviation. Clamped so
      // no cell can invert or run away over the decade.
      const factor = clamp(1 + URBANIZATION_RATE * step * (d - mean) / mean, 0.1, 3);
      drifted[y][x] = d * factor;
      newTotal += drifted[y][x];
    }
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
    const seats = calculateSeatsWithSwing(drifted, districts, numDistricts, nationalSwing);
    const ourSeats = playerParty === 'red' ? seats.red : seats.blue;
    const won = ourSeats >= targetSeats;
    if (won) heldMajority++;
    cumulativeOurSeats += ourSeats;
    results.push({ year: startYear + i * yearsApart, nationalSwing, seats, ourSeats, won });
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
