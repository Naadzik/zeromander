export const METRIC_DESCRIPTIONS = {
  efficiencyGap: {
    title: 'Efficiency Gap',
    body: 'Measures partisan gerrymandering by counting "wasted votes" — votes cast for a losing candidate plus surplus votes beyond what was needed to win. The gap is the difference between the two parties\' wasted votes, divided by all votes cast (Stephanopoulos & McGhee, 2015). A lower gap means fairer representation; below ~7-8% is commonly cited as acceptable.',
    source: 'Stephanopoulos & McGhee, "Partisan Gerrymandering and the Efficiency Gap", 82 U. Chi. L. Rev. 831 (2015)'
  },
  compactness: {
    title: 'Compactness (Polsby-Popper)',
    body: 'How "round" a district is, on a 0–100% scale where 100% is a perfect circle. Snaking, irregular districts score low. Compact districts are harder to gerrymander.',
    source: 'Polsby & Popper, "The Third Criterion: Compactness as a Procedural Safeguard Against Partisan Gerrymandering" (1991)'
  },
  competitiveness: {
    title: 'Competitiveness',
    body: 'The share of districts where the winning party has between 45% and 55% of the votes. Higher means closer elections; lower means districts are "safe" for one side.',
    source: 'Game heuristic — the 45–55% band is a common working definition of a competitive district, not a single canonical academic measure'
  },
  asymmetry: {
    title: 'Partisan Asymmetry',
    body: 'The absolute difference between a party\'s seat share and its vote share (|seats% − votes%|). Lower means more proportional representation.',
    source: 'Simplified seats–votes disproportionality; the formal partisan-symmetry standard is Gelman & King (1994)'
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
  }
};

// Shown in the Methodology section: what the "neutral map" is and is not.
export const NEUTRAL_MAP_NOTE =
  'The neutral map is drawn by a party-blind algorithm: it grows contiguous, population-balanced districts from spread-out seeds and never reads any party data — neutrality comes from what it cannot see, not from an added fairness target. It is one reasonable apolitical baseline (in the spirit of the ensemble methods popularized by MGGG at mggg.org), not a canonical "correct" map.';
