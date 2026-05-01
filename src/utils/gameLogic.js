import { extractPopulationData, getDistrictVotes } from './formatUtils.js';

export function calculateSeats(populationMap, districts, numDistricts) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);

  let blueSeats = 0, redSeats = 0;

  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const { blueVotes, redVotes } = getDistrictVotes(partyMap, densityMap, districts, districtId);
    if (blueVotes > redVotes) blueSeats++;
    else redSeats++;
  }

  return { blue: blueSeats, red: redSeats };
}

export function getSeatPercentage(seats, totalDistricts) {
  return totalDistricts > 0 ? (seats / totalDistricts) * 100 : 0;
}

export function getPopulationPercentage(populationMap) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);

  let blue = 0, total = 0;
  for (let y = 0; y < partyMap.length; y++) {
    for (let x = 0; x < partyMap[y].length; x++) {
      const population = densityMap ? densityMap[y][x] : 1;
      total += population;
      if (partyMap[y][x] === 0) blue += population;
    }
  }
  return total > 0 ? (blue / total) * 100 : 0;
}

export function calculateEfficiencyGap(populationMap, districts, numDistricts) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);

  let blueWasted = 0, redWasted = 0;

  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const { blueVotes, redVotes } = getDistrictVotes(partyMap, densityMap, districts, districtId);
    const total = blueVotes + redVotes;
    if (blueVotes > redVotes) {
      blueWasted += Math.max(0, blueVotes - Math.ceil(total / 2));
      redWasted += redVotes;
    } else {
      blueWasted += blueVotes;
      redWasted += Math.max(0, redVotes - Math.ceil(total / 2));
    }
  }

  const totalVotes = blueWasted + redWasted;
  const gap = totalVotes > 0 ? Math.abs(blueWasted - redWasted) / totalVotes * 100 : 0;

  return { blueWasted, redWasted, gap };
}

export function checkWin(populationMap, districts, numDistricts, targetSeatPercentage) {
  const seats = calculateSeats(populationMap, districts, numDistricts);
  const seatPercentage = getSeatPercentage(seats.blue, numDistricts);
  return seatPercentage >= targetSeatPercentage && allDistrictsAssigned(districts, numDistricts);
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
  for (let y = 0; y < partyMap.length; y++) {
    for (let x = 0; x < partyMap[y].length; x++) {
      if (districts[y][x] === districtId) {
        count += densityMap ? densityMap[y][x] : 1;
      }
    }
  }
  return count;
}

export function getDistrictStats(populationMap, districts, numDistricts) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);

  const stats = [];
  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const { blueVotes, redVotes } = getDistrictVotes(partyMap, densityMap, districts, districtId);
    stats.push({
      id: districtId,
      blue: blueVotes,
      red: redVotes,
      total: blueVotes + redVotes
    });
  }
  return stats;
}

export function isCountyAdjacentToDistrict(counties, districts, countyId, districtId) {
  let isFirst = true;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (let y = 0; y < counties.length; y++) {
    for (let x = 0; x < counties[y].length; x++) {
      if (counties[y][x] === countyId) {
        if (isFirst) {
          isFirst = false;
          continue;
        }

        let hasAdjacent = false;
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < counties[y].length &&
            ny >= 0 && ny < counties.length &&
            districts[ny][nx] === districtId) {
            hasAdjacent = true;
            break;
          }
        }

        if (!hasAdjacent && districts[y][x] !== districtId) {
          return false;
        }
      }
    }
  }

  return true;
}
