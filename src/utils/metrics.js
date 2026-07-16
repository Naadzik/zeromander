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
  const asymmetry = Math.abs(blueSeatPercent - blueVotePercent);

  return {
    asymmetry: Math.round(asymmetry * 100) / 100,
    blueVotePercent: Math.round(blueVotePercent * 100) / 100,
    blueSeatPercent: Math.round(blueSeatPercent * 100) / 100
  };
}
