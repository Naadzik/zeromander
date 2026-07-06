import { extractPopulationData, getDistrictVotes, getCellPopulation, forEachCell, totalPopulation } from './formatUtils.js';

// Tie-breaks intentionally differ between modes and must stay that way:
// 2-party ties go to red (blue must strictly win), 3-party ties favor blue.
export function calculateSeats(populationMap, districts, numDistricts, isThreeParty = false) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);
  const seats = { blue: 0, red: 0, green: 0 };

  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const { blue, red, green } = getDistrictVotes(partyMap, densityMap, districts, districtId);
    // A district nobody has drawn yet has no votes and is no-one's seat —
    // without this, empty districts fall into the tie-breaks and a blank
    // board reads as a 10/10 sweep for one side.
    if (blue + red + green === 0) continue;
    if (isThreeParty) {
      if (blue >= red && blue >= green) seats.blue++;
      else if (red >= blue && red >= green) seats.red++;
      else seats.green++;
    } else {
      if (blue > red) seats.blue++;
      else seats.red++;
    }
  }

  return seats;
}

// Uniform partisan swing: shifts a district's two-party vote share by
// swingPct (positive = toward blue) before recomputing the winner. Pure and
// deterministic given swingPct — the random draw itself happens in the
// caller (useGameCompletion), not here, so this stays easily testable.
export function applySwingToVotes({ blue, red }, swingPct) {
  const total = blue + red;
  if (total === 0) return { blue, red };
  const blueShare = Math.min(1, Math.max(0, blue / total + swingPct / 100));
  const swungBlue = total * blueShare;
  return { blue: swungBlue, red: total - swungBlue };
}

// 2-party only, mirrors calculateSeats' tie-break (blue must strictly win).
// Standard two-level swing model: one uniform national swing (`swingPct`)
// plus optional district-level noise (`districtSwings`, 1-indexed by district
// id) — local variation, so knife-edge districts can flip individually even
// in a neutral national environment.
export function calculateSeatsWithSwing(populationMap, districts, numDistricts, swingPct, districtSwings = null) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);
  const seats = { blue: 0, red: 0 };

  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const { blue, red } = getDistrictVotes(partyMap, densityMap, districts, districtId);
    const localSwing = districtSwings ? (districtSwings[districtId] ?? 0) : 0;
    const swung = applySwingToVotes({ blue, red }, swingPct + localSwing);
    if (swung.blue > swung.red) seats.blue++;
    else seats.red++;
  }

  return { ...seats, swingPct };
}

export function getSeatPercentage(seats, totalDistricts) {
  return totalDistricts > 0 ? (seats / totalDistricts) * 100 : 0;
}

// Risk-aware live classification (2-party): a district is a TOSSUP when its
// undecided (grey) population is at least the current leader's margin — the
// election-night break could flip it. With no grey on the map this reduces to
// exact ties only, i.e. today's behavior.
export function classifyDistricts(populationMap, districts, numDistricts) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);
  const rows = [];
  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const { blue, red, greyPop } = getDistrictVotes(partyMap, densityMap, districts, districtId);
    let status;
    if (blue + red + greyPop === 0) status = 'empty';
    else if (Math.abs(blue - red) <= greyPop) status = 'tossup';
    else status = blue > red ? 'blue' : 'red';
    rows.push({ id: districtId, blue, red, greyPop, status });
  }
  return rows;
}

// Party shares are over DECIDED voters only: grey (undecided) population is
// reported separately as its share of everyone. This makes ourPopPercent the
// decided-vote share — exactly the anchor the seat target needs, stable from
// generation through the election-night reveal.
export function getPopulationShares(populationMap) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);
  const counts = { blue: 0, red: 0, green: 0, grey: 0 };

  forEachCell(partyMap, (party, x, y) => {
    const population = getCellPopulation(densityMap, y, x);
    if (party === 0) counts.blue += population;
    else if (party === 1) counts.red += population;
    else if (party === 2) counts.green += population;
    else counts.grey += population;
  });

  const decided = counts.blue + counts.red + counts.green;
  const everyone = decided + counts.grey;
  return {
    blue: decided > 0 ? (counts.blue / decided) * 100 : 0,
    red: decided > 0 ? (counts.red / decided) * 100 : 0,
    green: decided > 0 ? (counts.green / decided) * 100 : 0,
    grey: everyone > 0 ? (counts.grey / everyone) * 100 : 0,
  };
}

export function calculateEfficiencyGap(populationMap, districts, numDistricts) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);

  let blueWasted = 0, redWasted = 0;
  let totalCast = 0;

  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const { blue: blueVotes, red: redVotes } = getDistrictVotes(partyMap, densityMap, districts, districtId);
    const total = blueVotes + redVotes;
    totalCast += total;
    if (blueVotes > redVotes) {
      blueWasted += Math.max(0, blueVotes - Math.ceil(total / 2));
      redWasted += redVotes;
    } else {
      blueWasted += blueVotes;
      redWasted += Math.max(0, redVotes - Math.ceil(total / 2));
    }
  }

  // Stephanopoulos–McGhee: net wasted votes over total votes CAST (not total
  // wasted) — the canonical denominator, so figures are comparable to
  // published efficiency gaps.
  const gap = totalCast > 0 ? Math.abs(blueWasted - redWasted) / totalCast * 100 : 0;

  return { blueWasted, redWasted, gap };
}

export function checkWin(populationMap, districts, numDistricts, opts) {
  if (opts.isThreeParty) {
    const seats = calculateSeats(populationMap, districts, numDistricts, true);
    const shares = getPopulationShares(populationMap);
    const playerSeatPct = (seats[opts.playerParty] / numDistricts) * 100;
    return playerSeatPct > shares[opts.playerParty];
  }
  const seats = calculateSeats(populationMap, districts, numDistricts);
  const seatPercentage = getSeatPercentage(seats.blue, numDistricts);
  return seatPercentage >= opts.targetSeatPercentage && allDistrictsAssigned(districts, numDistricts);
}

export function allDistrictsAssigned(districts, numDistricts) {
  for (let y = 0; y < districts.length; y++) {
    for (let x = 0; x < districts[y].length; x++) {
      if (districts[y][x] === 0) return false;
    }
  }
  return true;
}

export function getDistrictPopulation(populationMap, districts, districtId) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);

  let count = 0;
  forEachCell(partyMap, (_, x, y) => {
    if (districts[y][x] === districtId) {
      count += getCellPopulation(densityMap, y, x);
    }
  });
  return count;
}

export function getDistrictStats(populationMap, districts, numDistricts, isThreeParty = false) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);

  const stats = [];
  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const { blue, red, green } = getDistrictVotes(partyMap, densityMap, districts, districtId);
    let winner = 'blue';
    if (isThreeParty) {
      if (red > blue && red > green) winner = 'red';
      else if (green > blue && green > red) winner = 'green';
    } else {
      winner = blue > red ? 'blue' : 'red';
    }
    stats.push({ id: districtId, blue, red, green, total: blue + red + green, winner });
  }
  return stats;
}

export function isCountyAdjacentToDistrict(districts, counties, countyId, districtId) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  let hasAdjacent = false;
  let districtHasCells = false;

  for (let y = 0; y < counties.length; y++) {
    for (let x = 0; x < counties[y].length; x++) {
      if (counties[y][x] === countyId) {
        if (districts[y][x] === districtId) return true;
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < counties[y].length && ny >= 0 && ny < counties.length &&
            districts[ny][nx] === districtId) {
            hasAdjacent = true;
          }
        }
      }
      if (districts[y][x] === districtId) districtHasCells = true;
    }
  }

  return !districtHasCells || hasAdjacent;
}

export function validateCountyPopulations(populationMap, counties, numCounties) {
  const { densityMap } = extractPopulationData(populationMap);

  const fairShare = totalPopulation(populationMap) / numCounties;
  const minPop = Math.ceil(fairShare * 0.75);
  const maxPop = Math.ceil(fairShare * 1.25);

  const violations = [];
  const countyPops = {};

  forEachCell(counties, (countyId, x, y) => {
    if (countyId > 0) {
      countyPops[countyId] = (countyPops[countyId] || 0) + getCellPopulation(densityMap, y, x);
    }
  });

  for (const countyId in countyPops) {
    const pop = countyPops[countyId];
    if (pop < minPop || pop > maxPop) {
      violations.push({ countyId: parseInt(countyId), population: pop, minPop, maxPop });
    }
  }

  return { isValid: violations.length === 0, violations, fairShare, minPop, maxPop };
}
