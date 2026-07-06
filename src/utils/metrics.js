import { extractPopulationData, getDistrictVotes, getCellPopulation, forEachCell } from './formatUtils.js';

export function calculateCompactness(districts, numDistricts, gridSize) {
  const byDistrict = [];
  let total = 0;

  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const score = getDistrictCompactness(districts, districtId, gridSize);
    byDistrict.push(score);
    total += score;
  }

  const average = numDistricts > 0 ? total / numDistricts : 0;
  return { average: Math.round(average * 100) / 100, byDistrict };
}

function getDistrictCompactness(districts, districtId, gridSize) {
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
  const compactness = (4 * Math.PI * area) / (perimeter * perimeter);
  return Math.min(1, compactness);
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
