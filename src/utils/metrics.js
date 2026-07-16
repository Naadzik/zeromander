import { extractPopulationData, getDistrictVotes, getCellPopulation, forEachCell } from './formatUtils.js';

// Compactness = the grid isoperimetric quotient, IQ = 16·A/P². On a rook grid
// the isoperimetric optimum is the SQUARE, not the circle: P ≥ 4√A (Harary &
// Harborth 1976), so IQ ≤ 1 with equality exactly for perfect squares. This is
// Polsby-Popper's idea (4πA/P², itself Cox's 1927 isoperimetric quotient)
// rescaled by 4/π — the circle normalization capped scores at π/4 ≈ 0.785 on
// cell geometry, so "100%" was unreachable by construction and the Math.min
// guard was dead code. A pure rescaling: every ordering and comparison is
// preserved, only the scale is honest now.
//
// Known residual bias, disclosed rather than hidden: rook perimeter is an L1
// length, so a boundary at 45° costs ~√2 more than the same boundary
// axis-aligned (≈2× on the squared score). Scores are comparable within
// Zeromander's fixed grid, NOT against published real-map Polsby-Popper values.
export function calculateCompactness(districts, numDistricts, gridSize) {
  const byDistrict = [];
  let total = 0;
  let drawn = 0;

  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const score = getDistrictCompactness(districts, districtId);
    byDistrict.push(score);
    // Average over DRAWN districts only. An empty district scores 0, and
    // averaging those zeros in made the live mid-game number conflate shape
    // with completion (7 undrawn districts read as "contorted", not "not
    // drawn yet"). End-of-game numbers are unchanged — every district exists.
    if (score > 0) {
      total += score;
      drawn++;
    }
  }

  // null (not 0, not NaN) when nothing is drawn — a blank board has no shape
  // to score and displays render it as "—".
  const average = drawn > 0 ? total / drawn : null;
  return { average: average == null ? null : Math.round(average * 100) / 100, byDistrict };
}

function getDistrictCompactness(districts, districtId) {
  let area = 0;
  let perimeter = 0;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (let y = 0; y < districts.length; y++) {
    for (let x = 0; x < districts[y].length; x++) {
      if (districts[y][x] === districtId) {
        area++;
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= districts[y].length ||
            ny < 0 || ny >= districts.length ||
            districts[ny][nx] !== districtId) {
            perimeter++;
          }
        }
      }
    }
  }

  if (perimeter === 0) return 0;
  // Board edges count toward perimeter (matching real practice, where state
  // borders count) — the loop above already treats out-of-grid as exposed.
  const compactness = (16 * area) / (perimeter * perimeter);
  return Math.min(1, compactness); // pure guard; equality only for squares
}

// Cut edges on the COUNTY dual graph: how many pairs of neighboring counties
// the plan places in different districts. The discrete-native compactness
// measure the redistricting literature prefers for graph/grid settings
// (Duchin & Tenner; DeFord, Duchin & Solomon 2021; Validi & Buchanan 2022) —
// and deliberately counted on counties, not cells, because counties are the
// unit the player assigns (the cited methods all count cut edges on the dual
// graph of the assignment units). A cell-pair count would just re-measure L1
// boundary length — the same quantity Polsby-Popper's perimeter already uses,
// with the same ~2× diagonal artifact; measured here: a straight 45° boundary
// cuts 1.95× the cell pairs of the same boundary axis-aligned, while the
// county count is resolution-free.
//
// Whole-county painting guarantees county → district is well-defined
// (verified: 0 split counties across 2,843 on real neutral plans); the first
// cell seen speaks for its county. A county whose district is 0 is unassigned
// and its pairs are skipped.
//
// Displayed normalized against the same board's party-blind plan:
// CE_neutral / CE_player, so 100% = "your boundaries are no longer than a
// neutral map needs on this exact geography". Guard CE_player = 0 (nothing
// drawn) before that ratio.
export function calculateCutEdges(districts, counties) {
  if (!counties || counties.length === 0 || !districts || districts.length === 0) {
    return { cut: 0, adjacentPairs: 0 };
  }
  const gridSize = counties.length;

  const districtOf = new Map();
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < counties[y].length; x++) {
      const county = counties[y][x];
      if (!districtOf.has(county)) districtOf.set(county, districts[y][x]);
    }
  }

  // Each adjacent county pair counted ONCE (dual-graph edges, not border cells).
  const seen = new Set();
  let cut = 0;
  let adjacentPairs = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < counties[y].length; x++) {
      const county = counties[y][x];
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= counties[y].length || ny >= gridSize) continue;
        const neighbor = counties[ny][nx];
        if (neighbor === county) continue;
        const key = county < neighbor ? county * 100000 + neighbor : neighbor * 100000 + county;
        if (seen.has(key)) continue;
        seen.add(key);
        adjacentPairs++;
        const a = districtOf.get(county), b = districtOf.get(neighbor);
        if (a > 0 && b > 0 && a !== b) cut++;
      }
    }
  }

  return { cut, adjacentPairs };
}

// A district is competitive when the winner's two-party share ≤ 55% (margin
// ≤ 10 points) — the Cook Political Report swing-seat band (PVI D+5 to R+5,
// per the 2023 release) and the marginal-seats tradition (Mayhew 1974). Real
// indices normalize to a national baseline over two elections; a fictional
// board has no nation, so the raw single-election share is the direct analog.
// Grey (undecided) population is excluded — its uncertainty is the TOSSUP
// indicator, a different concept.
export function calculateCompetitiveness(populationMap, districts, numDistricts) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);

  let competitive = 0;

  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const { blue: blueVotes, red: redVotes } = getDistrictVotes(partyMap, densityMap, districts, districtId);
    const total = blueVotes + redVotes;
    if (total > 0) {
      const bluePercent = (blueVotes / total) * 100;
      if (bluePercent >= 45 && bluePercent <= 55) {
        competitive++;
      }
    }
  }

  return {
    percentage: numDistricts > 0 ? (competitive / numDistricts) * 100 : 0,
    competitive,
    total: numDistricts
  };
}

// Per-district blue two-party shares, the shared input of the symmetry family
// below. `valid` is false if ANY of the N districts has zero two-party votes —
// an undrawn district mid-game, or an all-grey district. The symmetry metrics
// report "n/a" then rather than guessing (per spec: never guess).
function districtTwoPartyShares(populationMap, districts, numDistricts) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);
  const shares = [];
  let blueTotal = 0, allTotal = 0;
  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const { blue, red } = getDistrictVotes(partyMap, densityMap, districts, districtId);
    const total = blue + red;
    if (total === 0) return { valid: false, shares: [], overallBlue: 0 };
    shares.push(blue / total);
    blueTotal += blue;
    allTotal += total;
  }
  return { valid: true, shares, overallBlue: blueTotal / allTotal };
}

// Mean–median difference (McDonald & Best 2015) — the headline symmetry-family
// diagnostic: the party's MEDIAN district two-party share minus its MEAN
// district share (simple mean of district shares, per the paper — not the
// population-weighted overall share). Positive = the map is skewed FOR the
// player: they reach half the seats with less than their average vote share,
// i.e. the opponent's voters are packed. Detects skew of the district
// DISTRIBUTION — a different concept from disproportionality (seats − votes),
// which winner-take-all inflates even on fair maps.
//
// Small-N caveat, owned rather than hidden: on 8–12 district boards |MM| is
// noisy, so the amber/red flags in litigation.js are calibrated to the 95th /
// 99th percentiles of |MM| across this game's OWN party-blind maps (see
// MM_THRESHOLDS there), not to congressional-scale values from the literature.
export function calculateMeanMedian(populationMap, districts, numDistricts, playerParty) {
  const { valid, shares } = districtTwoPartyShares(populationMap, districts, numDistricts);
  if (!valid) return { mm: null, valid: false };

  const oriented = playerParty === 'red' ? shares.map(v => 1 - v) : shares;
  const sorted = [...oriented].sort((a, b) => a - b);
  const n = sorted.length;
  const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const mean = oriented.reduce((s, v) => s + v, 0) / n;

  return { mm: (median - mean) * 100, valid: true };
}

// Partisan bias at 50% (Gelman & King 1994, as operationalized by PlanScore):
// shift every district's two-party share uniformly until the overall vote is
// tied, then count the player's seats. Reported in SEATS ("in a tied election
// you'd win 7/12"), never as a smooth percentage — with N ≤ 12 the measure
// quantizes in steps of 1/N and a percentage would be false precision. An
// exactly tied shifted district counts half a seat for each side, keeping the
// metric antisymmetric between the parties. Relies on the uniform-swing
// assumption; same validity rule as the mean–median.
export function calculateBias50(populationMap, districts, numDistricts, playerParty) {
  const { valid, shares, overallBlue } = districtTwoPartyShares(populationMap, districts, numDistricts);
  if (!valid) return { seats50: null, biasPct: null, valid: false };

  const shift = 0.5 - overallBlue;
  let blueWins = 0;
  for (const v of shares) {
    const shifted = v + shift;
    if (shifted > 0.5) blueWins += 1;
    else if (shifted === 0.5) blueWins += 0.5;
  }
  const seats50 = playerParty === 'red' ? numDistricts - blueWins : blueWins;

  return { seats50, biasPct: (seats50 / numDistricts - 0.5) * 100, valid: true };
}

// Disproportionality: |seat share − vote share|, the two-party reduction of
// the Loosemore–Hanby (1971) / Gallagher (1991) indices. RENAMED from
// "Partisan Asymmetry" — that name belongs to a different concept (the
// Gelman–King symmetry standard; see calculateMeanMedian and calculateBias50
// for true symmetry-family diagnostics). Descriptive, not a verdict:
// winner-take-all systems hand the leading party a seat bonus as a matter of
// course (the cube-law tradition, Kendall & Stuart 1950; Tufte 1973), and
// U.S. courts expressly reject proportionality as an entitlement (Davis v.
// Bandemer 1986; Rucho 2019) — drift alone isn't cheating.
//
// The function name and `asymmetry` field are kept for consumer compatibility;
// display layers say "Disproportionality".
export function calculatePartisanAsymmetry(populationMap, districts, numDistricts) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);

  let blueVotes = 0, redVotes = 0;
  let blueSeats = 0;

  forEachCell(partyMap, (party, x, y) => {
    const population = getCellPopulation(densityMap, y, x);
    if (party === 0) blueVotes += population;
    else if (party === 1) redVotes += population;
    // green/grey cast no votes in this 2-party metric
  });

  const blueVotePercent = (blueVotes / (blueVotes + redVotes)) * 100;

  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const { blue: dBlue, red: dRed } = getDistrictVotes(partyMap, densityMap, districts, districtId);
    if (dBlue > dRed) blueSeats++;
  }

  const blueSeatPercent = (blueSeats / numDistricts) * 100;
  const signedBlue = blueSeatPercent - blueVotePercent; // + = blue over-rewarded

  return {
    asymmetry: Math.round(Math.abs(signedBlue) * 100) / 100,
    signedBlue: Math.round(signedBlue * 100) / 100,
    blueVotePercent: Math.round(blueVotePercent * 100) / 100,
    blueSeatPercent: Math.round(blueSeatPercent * 100) / 100
  };
}
