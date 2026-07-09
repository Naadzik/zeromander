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

export function litigationRisk({ compactness = 0.3, gap = 0, asymmetry = 0, worstDeviationPct = 0, communityDilution = null } = {}) {
  const factors = [
    { label: 'contorted districts', risk: clamp01((0.30 - compactness) / 0.18), weight: 0.25 },
    { label: 'large efficiency gap', risk: clamp01((gap - 7) / 13), weight: 0.30 },
    { label: 'seats far from votes', risk: clamp01((asymmetry - 10) / 25), weight: 0.20 },
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
