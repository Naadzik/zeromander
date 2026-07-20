import { normal } from './rng.js';
import { extractPopulationData, getCellPopulation } from './formatUtils.js';

// The national-swing and district-application models (Spec 4). Shared by the
// decade (its own election loop) and the sandbox election-night reveal, so the
// two can't drift. Everything is a pure function of (inputs, rng), and every
// stochastic routine consumes a FIXED number of draws per unit regardless of
// branch (MODELSPECS §0) — a new branch must never re-roll sibling draws.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = v => Math.round(v * 10) / 10;

// ── National swing draw ────────────────────────────────────────────────────
// Calibrated to the 39 postwar House cycle-to-cycle two-party vote changes
// (1946–2024, Brookings/Sabato series): mean |swing| 3.0pp, SD 3.65,
// P(|swing| ≥ 5) ≈ 23%, maximum 8.9 (2008→2010). The v1 model produced ≥7pp
// swings 3× too often and its 7pp wave floor EXCLUDED 1994/2006/2018 — the
// very waves its own copy cited (~5–7pp each).
//
//   80% of years: Normal(0, 2.6) clamped to ±5 — calm years top out exactly
//     where waves begin, no dead zone.
//   20% of years: a wave of 5 + 4·min(u₁, u₂) points, direction fair-coin.
//     min-of-two-uniforms gives the wave magnitude a DECREASING density on
//     [5, 9]: the famous waves were ~5–7pp, an 8.9 is the postwar maximum.
//     (A flat magnitude was refuted in verification: P(|s| ≥ 7) came out
//     10.5% vs ~5% historical; min-density is the corrective.)
//
// ALWAYS exactly 3 draws (gate, a, b) whichever branch runs. In the wave
// branch, a carries both the direction (its high bit: a < 0.5) and u₁ (its
// remaining uniform fraction, independent of the direction).
export const WAVE_PROB = 0.20;

export function drawNationalSwing(rng) {
  const gate = rng();
  const a = rng();
  const b = rng();
  if (gate < WAVE_PROB) {
    const dir = a < 0.5 ? -1 : 1;
    const u1 = a < 0.5 ? a * 2 : (a - 0.5) * 2;
    return round1(dir * (5 + 4 * Math.min(u1, b)));
  }
  // Reuse a, b as the normal's uniforms — cosine Box–Muller inline keeps the
  // 3-draw contract (calling normal(rng) here would draw 2 MORE).
  const z = Math.sqrt(-2 * Math.log(Math.max(1e-12, a))) * Math.cos(2 * Math.PI * b);
  return round1(clamp(z * 2.6, -5, 5));
}

// ── Midterm structure (decade mode) ───────────────────────────────────────
// The president's party lost House seats in 32 of 33 midterms 1862–1990
// (Tufte 1975; Campbell 1991), and all four canonical waves (1994/2006/2010/
// 2018) were anti-White-House midterms. With 2-year election spacing and the
// White House drawn at decade start, elections 0, 2, 4 are the midterms (the
// first post-draw election is a midterm — explicit constant, not parity of a
// start-year-dependent index).
export const MIDTERM_PENALTY = 2.5;
export const MIDTERM_INDICES = new Set([0, 2, 4]);

// Applies the penalty to a drawn swing. Positive swing = toward blue, so a
// blue White House pays −2.5 and a red one +2.5 at midterm cadence. Applied
// BEFORE the final clamp (a ±9 wave must not become ±11.5 — beyond both the
// model's max and the postwar record 8.9), then re-rounded.
export function applyMidtermPenalty(swingPct, whParty) {
  const penalized = swingPct - (whParty === 'blue' ? MIDTERM_PENALTY : -MIDTERM_PENALTY);
  return round1(clamp(penalized, -9, 9));
}

// ── District application: density elasticity + local noise ────────────────
// A cell's responsiveness to the national swing scales with density: rural
// ≈ 1.2×, dense core ≈ 0.8× — low-density areas have swung hardest in recent
// US cycles (Scala & Johnson 2017; Rodden 2019), and FiveThirtyEight's
// published elasticity scores span 0.72–1.24 across districts, comfortably
// containing this range. DISCLOSED LIMIT: this is direction-symmetric
// responsiveness, not one-way realignment — the game does not model secular
// realignment inside a decade.
//
// The cell elasticities are renormalized so the POPULATION-WEIGHTED mean is
// exactly 1: the headline "national swing S" stays honest (the pop-weighted
// mean district shift equals S).
function elasticityOf(r) {
  return clamp(1.2 - 0.3 * Math.min(r, 2.5) / 1.25, 0.8, 1.2);
}

// Per-board elasticity profile: E_d (pop-weighted mean cell elasticity per
// district, after normalization). Deterministic, zero draws — compute once
// per board+districts and reuse across elections.
export function districtElasticity(populationMap, districts, numDistricts) {
  const { densityMap } = extractPopulationData(populationMap);
  const gridSize = densityMap.length;

  let totalPop = 0, cells = 0;
  for (let y = 0; y < gridSize; y++)
    for (let x = 0; x < densityMap[y].length; x++) { totalPop += densityMap[y][x]; cells++; }
  const meanDensity = cells > 0 ? totalPop / cells : 1;
  if (meanDensity <= 0) return null;

  // Pass 1: normalization constant. Pass 2: per-district weighted means.
  let weighted = 0;
  for (let y = 0; y < gridSize; y++)
    for (let x = 0; x < densityMap[y].length; x++) {
      const pop = getCellPopulation(densityMap, y, x);
      weighted += pop * elasticityOf(densityMap[y][x] / meanDensity);
    }
  const escale = weighted > 0 ? totalPop / weighted : 1;

  const popByDistrict = new Array(numDistricts + 1).fill(0);
  const sumByDistrict = new Array(numDistricts + 1).fill(0);
  for (let y = 0; y < gridSize; y++)
    for (let x = 0; x < densityMap[y].length; x++) {
      const d = districts[y]?.[x] ?? 0;
      if (d < 1 || d > numDistricts) continue;
      const pop = getCellPopulation(densityMap, y, x);
      popByDistrict[d] += pop;
      sumByDistrict[d] += pop * elasticityOf(densityMap[y][x] / meanDensity) * escale;
    }

  const byDistrict = new Array(numDistricts + 1).fill(1);
  for (let d = 1; d <= numDistricts; d++) {
    if (popByDistrict[d] > 0) byDistrict[d] = sumByDistrict[d] / popByDistrict[d];
  }
  return byDistrict;
}

// District-level swings for one election: the elasticity-scaled share of the
// national swing beyond uniform, plus ~2pp of local noise (the stochastic-
// uniform-swing tradition, Gelman & King 1994). EXACTLY 2 draws per district,
// ascending district id — frozen order. Feeds the districtSwings hook of
// calculateSeatsWithSwing / the decade's own winner pass unchanged in shape.
export const SIGMA_DISTRICT = 2.0;

export function drawDistrictSwings(elasticity, numDistricts, nationalSwingPct, rng) {
  const swings = {};
  for (let d = 1; d <= numDistricts; d++) {
    const e = elasticity ? elasticity[d] : 1;
    swings[d] = nationalSwingPct * (e - 1) + normal(rng) * SIGMA_DISTRICT;
  }
  return swings;
}

// ── Sandbox election-night reveal ("polling error") ───────────────────────
// v1 drew uniform ±4. v2: Normal(0, 2.0) share points clamped ±4.5 — sized as
// a fundamentals-style baseline below the single-poll historical RMSE
// (Shirani-Mehr et al. 2018 put ~3.5pp RMSE on a candidate's two-party share;
// the worst modern national miss was ~2 share points, AAPOR 2020). Exactly 2
// draws.
export function drawPollingError(rng) {
  return clamp(normal(rng) * 2.0, -4.5, 4.5);
}