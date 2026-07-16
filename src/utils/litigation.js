// Litigation-risk score (0–100): a read-only gauge of how likely this map is
// to draw a court challenge. Educational only — it does NOT strike maps down
// (that wiring is deliberately deferred). It blends the signals a real lawsuit
// would actually cite: contorted districts (compactness), the partisan
// efficiency gap, seats–votes asymmetry, unequal populations, and — when a
// protected community exists — vote dilution. 2-party only.
//
// Thresholds are grounded in the game's own metric scale (compactness runs low
// on a jagged grid; ~7% efficiency gap is the flagged line, ~13% the Wisconsin
// / Gill v. Whitford level) rather than a naive 0–1 read.
const clamp01 = v => Math.min(1, Math.max(0, v));

// Shape risk, relative to the party-blind map when one is in scope: a plan is
// "contorted" when it scores well below what neutral line-drawing achieves ON
// THIS BOARD (risk 0 at 90% of the neutral score, 1.0 at 40% of it). The
// neutral map itself can never trip its own gauge by construction — a fixed
// absolute threshold couldn't promise that: across 120 days the neutral
// plan-average spans ~0.14–0.55, so tail boards cross any fixed line with zero
// gerrymandering. The absolute ramp survives only as the fallback for when no
// neutral score exists (sandbox mid-game), anchored to the neutral 120-day
// means (~0.37–0.41). `compactness == null` = nothing drawn = nothing to sue.
function compactnessRisk(compactness, fairCompactness) {
  if (compactness == null) return 0;
  if (fairCompactness != null && fairCompactness > 0) {
    return clamp01((0.9 * fairCompactness - compactness) / (0.5 * fairCompactness));
  }
  return clamp01((0.35 - compactness) / 0.20);
}

// Mean–median flag thresholds: the 95th ("amber") and 99th ("red") percentiles
// of |MM| across 220 of this game's OWN party-blind neutral maps per board
// size (scripts/calibrate-mm.mjs, run 2026-07-17, v1-era generator, splits
// swept over the daily's 38–48% band; re-run at the Spec 5 era change).
// Literature-scale thresholds do not transfer here: neutral maps on this
// game's deliberately clustered geography carry mean |MM| ≈ 5.5pp with p95
// ≈ 14pp — the urban party self-packs in cities (Chen & Rodden's
// "unintentional gerrymandering"), so only a skew beyond what party-blind
// drawing produces is evidence of intent. Keyed by district count; boards
// between configs use the nearest (sandbox's 40-district extreme reads the
// 12-district constants — coarse, disclosed).
const MM_THRESHOLDS = {
  8: { amber: 13.72, red: 18.45 },
  10: { amber: 14.23, red: 20.43 },
  12: { amber: 15.44, red: 17.35 },
};

function mmThresholdsFor(numDistricts) {
  const keys = Object.keys(MM_THRESHOLDS).map(Number);
  const nearest = keys.reduce((best, k) =>
    Math.abs(k - numDistricts) < Math.abs(best - numDistricts) ? k : best, keys[0]);
  return MM_THRESHOLDS[nearest];
}

// Efficiency-gap risk in SEAT units, relative to the party-blind map when one
// is in scope: risk 0 within half a seat-equivalent of the neutral baseline,
// 1.0 at two beyond it (mirroring S&M's two-seat congressional standard).
// Percentage ramps fail at this district count — one flipped seat moves the
// gap ~10 points, and the game's own neutral baselines measure up to ~1.3
// seat-equivalents (12.7% on a real daily) with zero gerrymandering, which
// the old (gap−7)/13 ramp flagged as a lawsuit driver. The absolute fallback
// (no neutral in scope: sandbox mid-game) therefore has its onset just above
// that measured neutral tail.
function efficiencyGapRisk(gapSeats, fairGapSeats) {
  if (gapSeats == null) return 0;
  if (fairGapSeats != null) {
    return clamp01((Math.abs(gapSeats - fairGapSeats) - 0.5) / 1.5);
  }
  return clamp01((Math.abs(gapSeats) - 1.3) / 1.2);
}

// `meanMedian` is the signed mean–median difference in pp (null when not yet
// defined — undrawn or all-grey districts); direction doesn't matter to a
// court, so the ramp reads |MM|. `gapSeats`/`fairGapSeats` are SIGNED
// seat-equivalents (calculateEfficiencyGap().gapSeats) for player and neutral.
export function litigationRisk({ compactness = null, fairCompactness = null, gapSeats = null, fairGapSeats = null, meanMedian = null, numDistricts = 10, worstDeviationPct = 0, communityDilution = null } = {}) {
  const { amber, red } = mmThresholdsFor(numDistricts);
  const factors = [
    { label: 'contorted districts', risk: compactnessRisk(compactness, fairCompactness), weight: 0.25 },
    { label: 'efficiency gap beyond baseline', risk: efficiencyGapRisk(gapSeats, fairGapSeats), weight: 0.30 },
    // Replaced 'seats far from votes' (disproportionality): winner-take-all
    // produces seats≠votes on perfectly fair maps, so it was flagging normal
    // FPTP behavior. District-distribution skew is the symmetry-family signal
    // courts' experts actually compute (McDonald & Best 2015).
    { label: 'skewed district distribution', risk: meanMedian == null ? 0 : clamp01((Math.abs(meanMedian) - amber) / (red - amber)), weight: 0.20 },
    { label: 'unequal populations', risk: clamp01((worstDeviationPct - 8) / 12), weight: 0.15 },
  ];
  if (communityDilution != null) {
    factors.push({ label: 'diluted community', risk: clamp01(communityDilution), weight: 0.10 });
  }

  const totalW = factors.reduce((s, f) => s + f.weight, 0);
  const weightedMean = factors.reduce((s, f) => s + f.weight * f.risk, 0) / totalW;
  const maxRisk = Math.max(...factors.map(f => f.risk));
  // A single flagrant factor is enough to invite a suit, so let the worst
  // driver dominate — with cumulative risk layered on top.
  const score = Math.round(100 * (0.55 * maxRisk + 0.45 * weightedMean));
  const band = score >= 60 ? 'high' : score >= 25 ? 'elevated' : 'low';
  const drivers = factors.filter(f => f.risk >= 0.25).sort((a, b) => b.risk - a.risk).map(f => f.label);
  return { score, band, drivers };
}
