export const METRIC_DESCRIPTIONS = {
  efficiencyGap: {
    title: 'Efficiency Gap',
    body: 'Counts each side\'s "wasted votes" — every vote for a losing candidate, plus winning votes beyond the half needed to carry the district — nets them, and divides by all votes cast (Stephanopoulos & McGhee, 2015). The sign says who the map favors; we also convert it to seats, the honest unit here. The 8%/two-seat (S&M) and 7% (Whitford plaintiffs) thresholds were proposed for real statewide legislatures — on a board this size one flipped seat moves the gap by ~10 points, and even the party-blind map can score above those lines from geography alone. So judge your gap against this board\'s party-blind map, not the statewide numbers.',
    source: 'Stephanopoulos & McGhee, 82 U. Chi. L. Rev. 831 (2015); granularity critique per Bernstein & Duchin (2017); courts treated the gap as evidence, never a verdict (Gill v. Whitford, 2018, decided on standing; Rucho v. Common Cause, 2019, closed federal courts)'
  },
  compactness: {
    title: 'Compactness (grid-adjusted Polsby-Popper)',
    body: 'Compares each district\'s area to its boundary length, on a 0–100% scale where 100% is a perfect square — the roundest shape a cell map allows. Snaking, contorted districts score low; the party-blind neutral map typically lands around 30–45% on this geometry, so judge against that, not against 100%. Contorted shapes are the classic visible symptom of a gerrymander — a safeguard, not a guarantee: tidy-looking maps can still be badly skewed.',
    source: 'Polsby & Popper (1991), rescaled for grid geometry; the area-vs-perimeter idea is Cox\'s isoperimetric quotient (1927); discrete measures for grid settings per Duchin & Tenner'
  },
  competitiveness: {
    title: 'Competitiveness',
    body: 'The share of districts where the winner has 55% of the two-party vote or less (a margin within 10 points) — close enough that a normal election-to-election swing could flip them. Competitive districts are what make seats respond to voters at all; a map of safe seats has already decided the election.',
    source: 'Matches the Cook Political Report swing-seat band (PVI D+5 to R+5, 2023) and the marginal-seats tradition (Mayhew, 1974); responsiveness framing per Gelman & King (1994)'
  },
  asymmetry: {
    title: 'Disproportionality',
    body: 'How far your seat share drifts from your vote share (|seats% − votes%|). Important: winner-take-all elections normally hand the bigger party a seat bonus — drift alone isn\'t cheating, which is why this number is descriptive, not a verdict. For a metric that detects deliberate skew, see Mean–Median.',
    source: 'Two-party reduction of the Loosemore–Hanby (1971) / Gallagher (1991) disproportionality indices; courts reject proportionality as an entitlement (Davis v. Bandemer, 1986; Rucho v. Common Cause, 2019)'
  },
  meanMedian: {
    title: 'Mean–Median Difference',
    body: 'Line your districts up from worst to best for your party: if your middle district is stronger than your average district, the map leans your way — the other side\'s voters are packed. Positive = skewed for you. Shown once every district has votes. On boards this size the number is naturally noisy, so the litigation gauge only flags a skew bigger than what 95% of party-blind maps produce on this game\'s own geography.',
    source: 'McDonald & Best, "Unfair Partisan Gerrymanders in Politics and Law" (2015); small-N and near-50/50 caveats per Katz, King & Rosenblatt (2020)'
  },
  bias50: {
    title: 'Partisan Bias at 50%',
    body: 'Pretend the election ended exactly 50–50: shift every district by the same amount until the overall vote is tied, then count who wins. Whoever still takes most districts has the map on their side. Reported in seats, not a percentage — with this few districts a smooth number would be false precision.',
    source: 'Gelman & King (1994), as operationalized by PlanScore; relies on the uniform-swing assumption'
  },
  undecided: {
    title: 'Undecided Voters',
    body: 'Grey areas hold voters who only make up their minds on election night — and whole neighborhoods break together, usually (but not always!) leaning like the area around them. They count toward district population, but cast no votes until the reveal. A district is a TOSSUP (?) when its undecided population is larger than the current leader\'s margin: the election could flip it. Build a cushion, or gamble.',
    source: 'Game mechanic — models local turnout/persuasion uncertainty, the reason real mapmakers build safety margins instead of maximally efficient 51-49 districts'
  },
  populationParity: {
    title: 'Population Parity',
    body: 'Each district must contain roughly the same population (within ±10% of the target) so that every vote carries equal weight.',
    source: 'One person, one vote — Reynolds v. Sims (1964); ±10% reflects the practical threshold courts applied to state legislative maps'
  },
  litigationRisk: {
    title: 'Litigation Risk',
    body: 'A 0–100 estimate of how likely this map is to draw a court challenge, blending the signals lawsuits actually cite: contorted districts (compactness well below what a party-blind map achieves on this board), a large partisan efficiency gap, a skewed district distribution (mean–median beyond what party-blind maps produce), unequal district populations, and — when present — dilution of a protected community. It is a gauge, not a verdict — the game does not yet strike maps down.',
    source: 'Composite of the metrics above; shape and skew thresholds are calibrated against this game\'s own party-blind maps, the efficiency-gap flag echoes ~7% (Whitford plaintiffs), population echoes the ±10% rule (Reynolds v. Sims)'
  },
  communityRepresentation: {
    title: 'Community Representation',
    body: 'Reads as opportunity districts / fair share. An "opportunity" (majority-community) district is one where the dashed-amber community is over half the voters, so it can actually elect its candidate of choice. Fair share = their population share × the number of districts (here ~20% × 10 ≈ 2). Draw that many majority-community districts and it reads "fair". Fall short and it is dilution: CRACKING (sliced so thin they are a majority in too few) or PACKING (crammed into fewer districts than fair, wasting the surplus). Both feed Litigation Risk — and the fix for either is the same: draw exactly their fair share of majority-community districts, no fewer and no more.',
    source: 'Voting Rights Act §2 vote-dilution doctrine — Thornburg v. Gingles (1986); the community here is fictional and non-partisan'
  }
};

// Shown in the Methodology section: what the party-blind baseline is and is not.
export const NEUTRAL_MAP_NOTE =
  'The baseline is an ensemble of 25 party-blind maps (15 on the largest boards), each grown from a fixed seed schedule by an algorithm that only sees population and geography — never party data — and filtered to the same ±10% population rule that binds you. Your score compares your seats to the ensemble MEDIAN, and the full range is shown; the map displayed is the ensemble member that matches the median. This is a deliberately small, browser-scale version of the ensemble analyses used in redistricting litigation (DeFord, Duchin & Solomon 2021; Common Cause v. Rucho). Two honest limits: 25 seed-and-grow maps are not a uniform sample of all legal plans (samplers of this family are known to be biased — Fifield et al. 2020), so we claim only "what this party-blind procedure typically draws"; and party-blind is not automatically outcome-neutral — on real maps, blind drawing systematically costs the party clustered in cities (Chen & Rodden 2013). Zeromander\'s boards are calibrated so the blind baseline treats both parties symmetrically — a property of our board model, not of blindness itself.';
