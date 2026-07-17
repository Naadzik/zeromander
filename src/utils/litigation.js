// Litigation risk, v2: a FORUM-CHANNEL model. Risk is scored per legal
// channel — each channel is one actual cause of action in the forum where it
// is live — and the worst channel dominates, because a map dies to one good
// claim. Educational only: the gauge estimates exposure, it does not strike
// maps down (the completion gate is what can).
//
// The two-dial split IS the civics lesson. Since Rucho v. Common Cause (2019)
// no federal court will hear a partisan-gerrymandering claim, however
// lopsided the map — but equal population and VRA §2 dilution are federal
// claims live everywhere. Whether anyone can sue over the partisan numbers
// depends on the state constitution and its supreme court: Pennsylvania said
// yes (2018); North Carolina said yes (2022), then re-heard the case with new
// justices and said no (2023). Same map, different forum, different fate.
// The old single blend put 50% of its weight on claims no federal court can
// hear while the actually-live federal claims carried 25% combined — it
// taught a pre-2019 world.
//
// CHANNELS
//   A — equal population (14th Am. / Art. I §2; FEDERAL, live everywhere).
//       Reads the OVERALL RANGE (max − min over ideal), the doctrinal
//       quantity: ≥10% range is prima facie invalid for a state legislative
//       map (Brown v. Thomson) so risk jumps to 0.90 there; below 10% risk
//       ramps gently from 0 — under-10 is NOT a safe harbor when the
//       deviations serve partisan ends (Cox v. Larios, 2004), and in this
//       game they always do. Congressional chamber: near-zero tolerance
//       (Karcher v. Daggett struck a 0.69% range) — full risk by a 1% range.
//   B — VRA §2 vote dilution (FEDERAL, exists only when a community overlay
//       does). Shortfall from the community's feasible share of opportunity
//       districts — the door Allen v. Milligan (2023) kept open. feasibleShare
//       = fairShare is valid ONLY because the scenario community is compact
//       by construction (Gingles precondition).
//   C — racial-gerrymandering ceiling (FEDERAL, community only). Packing the
//       community far past a majority triggers strict scrutiny (Shaw v. Reno;
//       Cooper v. Harris): fires when an opportunity district exceeds 70%
//       concentration while the fair share is already met. The 0.70 trigger
//       is a game heuristic ("well past what's needed to elect"), disclosed.
//   D — partisan gerrymandering (STATE COURTS ONLY post-Rucho). Blends the
//       three partisan signals, each judged against THIS board's party-blind
//       baseline: efficiency gap in seat units vs the neutral map, mean–median
//       skew vs the neutral generator's own percentiles, and shape as
//       evidence. NOTE, renegotiated vs the spec body (see MODELSPECS
//       addendum): the body's (|egPct|−7)/6 percentage ramp predates the
//       Spec 1 recalibration and re-imports the audit's CRITICAL bug — the
//       game's own neutral baseline (12.71% on a real daily) would flag as a
//       near-certain lawsuit with zero gerrymandering. Ensemble-relative
//       evidence is also what modern state-court experts actually present
//       (LWV v. Pennsylvania, Harper). The 7%/13% history lives in the copy.
//
// All inputs come from tallies already computed in-game; deterministic, zero
// RNG draws, O(districts). 2-party only.
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
// size (scripts/calibrate-mm.mjs, re-run 2026-07-17 after the fair-map
// BALANCE_TOLERANCE fix, splits swept over the daily's 38–48% band; re-run
// again at the Spec 5 era change).
// Literature-scale thresholds do not transfer here: neutral maps on this
// game's deliberately clustered geography carry mean |MM| ≈ 5.5pp with p95
// ≈ 14pp — the urban party self-packs in cities (Chen & Rodden's
// "unintentional gerrymandering"), so only a skew beyond what party-blind
// drawing produces is evidence of intent. Keyed by district count; boards
// between configs use the nearest (sandbox's 40-district extreme reads the
// 12-district constants — coarse, disclosed).
const MM_THRESHOLDS = {
  8: { amber: 14.29, red: 18.37 },
  10: { amber: 13.13, red: 20.09 },
  12: { amber: 15.37, red: 17.69 },
};

function mmThresholdsFor(numDistricts) {
  const keys = Object.keys(MM_THRESHOLDS).map(Number);
  const nearest = keys.reduce((best, k) =>
    Math.abs(k - numDistricts) < Math.abs(best - numDistricts) ? k : best, keys[0]);
  return MM_THRESHOLDS[nearest];
}

// Efficiency-gap risk in SEAT units, relative to the party-blind map when one
// is in scope: risk 0 within half a seat-equivalent of ENGINEERED EXCESS,
// 1.0 at two (mirroring S&M's two-seat congressional standard). Percentage
// ramps fail at this district count — one flipped seat moves the gap ~10
// points, and the game's own neutral baselines measure up to ~1.3
// seat-equivalents (12.7% on a real daily) with zero gerrymandering, which
// the old (gap−7)/13 ramp flagged as a lawsuit driver.
//
// "Excess" is directional, not raw distance — |player − neutral| looked
// right but fired on maps FAIRER than geography (a blank board, gap 0, read
// as lawsuit exposure because it differed from a 1.1-seat baseline; caught
// live on screen). What is actionable is advantage the pen ADDED:
//   same side favored as the baseline → only the growth beyond the
//     baseline's magnitude counts (shrinking the gap is fairness, not a claim);
//   the map FLIPS who geography favored → the favored side's entire
//     advantage is engineered, so its full magnitude counts.
// The absolute fallback (no neutral in scope: sandbox mid-game) keeps its
// onset just above the measured neutral tail.
function efficiencyGapRisk(gapSeats, fairGapSeats) {
  if (gapSeats == null) return 0;
  if (fairGapSeats != null) {
    const sameSide = gapSeats === 0 || fairGapSeats === 0 || (gapSeats > 0) === (fairGapSeats > 0);
    const excess = sameSide
      ? Math.abs(gapSeats) - Math.abs(fairGapSeats)
      : Math.abs(gapSeats);
    return clamp01((excess - 0.5) / 1.5);
  }
  return clamp01((Math.abs(gapSeats) - 1.3) / 1.2);
}

const band = (score) => score >= 60 ? 'high' : score >= 25 ? 'elevated' : 'low';

// Inputs:
//   rangePct        — overall population range, (max−min)/ideal × 100
//   chamber         — 'legislative' (default) | 'congressional'
//   gapSeats/fairGapSeats — SIGNED EG seat-equivalents, player and neutral
//   meanMedian      — signed pp (null until every district has votes)
//   compactness/fairCompactness — plan-average IQ, player and neutral
//   community       — communityRepresentation() result or null
// Returns { federal, state, score, band, drivers }: two dials plus a
// single-number mode (max of the dials, forum-tagged drivers) for compact
// layouts and any legacy consumer.
export function litigationRisk({
  rangePct = 0,
  chamber = 'legislative',
  compactness = null,
  fairCompactness = null,
  gapSeats = null,
  fairGapSeats = null,
  meanMedian = null,
  numDistricts = 10,
  community = null,
} = {}) {
  const { amber, red } = mmThresholdsFor(numDistricts);

  // ── Federal channels ────────────────────────────────────────────────────
  const rA = chamber === 'congressional'
    ? clamp01(rangePct / 1.0)
    : rangePct >= 10
      ? clamp01(0.90 + (rangePct - 10) / 20)
      : clamp01(0.05 * rangePct);

  let rB = 0, rC = 0;
  if (community != null) {
    const feasibleShare = community.fairShare;
    rB = feasibleShare > 0
      ? clamp01((feasibleShare - community.opportunityDistricts) / feasibleShare)
      : 0;
    const overPacked = community.maxConcentration >= 0.70 &&
      community.opportunityDistricts >= feasibleShare;
    rC = overPacked ? clamp01((community.maxConcentration - 0.70) / 0.20) : 0;
  }

  const federalFactors = [
    { label: 'unequal populations', risk: rA },
    ...(community != null ? [
      { label: 'diluted community (VRA §2)', risk: rB },
      { label: 'community over-packed', risk: rC },
    ] : []),
  ];
  // A map dies to one good claim: the worst federal channel IS the exposure.
  const federalRisk = Math.max(...federalFactors.map(f => f.risk));

  // ── State channel (partisan; federal courts closed per Rucho) ──────────
  const dEG = efficiencyGapRisk(gapSeats, fairGapSeats);
  const dSkew = meanMedian == null ? 0 : clamp01((Math.abs(meanMedian) - amber) / (red - amber));
  const dShape = compactnessRisk(compactness, fairCompactness);
  const stateFactors = [
    { label: 'efficiency gap beyond baseline', risk: dEG },
    { label: 'skewed district distribution', risk: dSkew },
    // Shape enters as EVIDENCE inside the partisan claim, not standalone —
    // contorted districts don't lose cases by themselves.
    { label: 'contorted districts', risk: dShape },
  ];
  const stateRisk = 0.5 * dEG + 0.3 * dSkew + 0.2 * dShape;

  const channelDrivers = (factors) =>
    factors.filter(f => f.risk >= 0.25).sort((a, b) => b.risk - a.risk).map(f => f.label);

  const federal = {
    score: Math.round(100 * federalRisk),
    band: band(Math.round(100 * federalRisk)),
    drivers: channelDrivers(federalFactors),
  };
  const state = {
    score: Math.round(100 * stateRisk),
    band: band(Math.round(100 * stateRisk)),
    drivers: channelDrivers(stateFactors),
  };

  // Single-number mode (share text, compact layouts): the worse forum, with
  // drivers carrying their forum tag — the tag IS the lesson.
  const score = Math.max(federal.score, state.score);
  const drivers = [
    ...federal.drivers.map(d => `federal: ${d}`),
    ...state.drivers.map(d => `state: ${d}`),
  ];

  return { federal, state, score, band: band(score), drivers };
}
